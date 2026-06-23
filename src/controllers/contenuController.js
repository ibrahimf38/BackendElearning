const pool = require('../config/db')
const { deleteFromS3, signUrlField, signUrlFieldList } = require('../config/s3')
const { asyncHandler }  = require('../middleware/errorHandler')

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/** Insère dans `contenu` (table mère) et retourne l'id généré. */
async function insertContenu(client) {
  const { rows: [c] } = await client.query(
    'INSERT INTO contenu DEFAULT VALUES RETURNING id'
  )
  return c.id
}

// ══════════════════════════════════════════════════════════════
// COURS
// ══════════════════════════════════════════════════════════════

const getCoursByMatiere = asyncHandler(async (req, res) => {
  const { idMatiere } = req.params
  const { rows } = await pool.query(
    `SELECT c.id_cours, c.id_matiere, c.titre, c.sous_titre, c.url_fichier,
            ct.date_ajout
     FROM cours c JOIN contenu ct ON ct.id = c.id_cours
     WHERE c.id_matiere = $1
     ORDER BY ct.date_ajout DESC`,
    [idMatiere]
  )
  await signUrlFieldList(rows, 'url_fichier')
  res.json(rows)
})

const createCours = asyncHandler(async (req, res) => {
  const { titre, sous_titre, id_matiere } = req.body
  if (!titre || !id_matiere) return res.status(400).json({ message: 'titre et id_matiere requis' })
  if (!req.file) return res.status(400).json({ message: 'Fichier PDF requis' })

  const url = req.file.location // URL S3 brute (stockée telle quelle en BDD)
  const db  = await pool.connect()
  try {
    await db.query('BEGIN')
    const id = await insertContenu(db)
    const { rows: [row] } = await db.query(
      `INSERT INTO cours (id_cours, id_matiere, titre, sous_titre, url_fichier)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, id_matiere, titre, sous_titre || null, url]
    )
    await db.query('COMMIT')
    await signUrlField(row, 'url_fichier') // signe avant de répondre (lien "Voir" admin)
    res.status(201).json(row)
  } catch (err) { await db.query('ROLLBACK'); throw err }
  finally { db.release() }
})

const updateCours = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { titre, sous_titre } = req.body
  let url_fichier

  if (req.file) {
    // Récupérer l'ancienne URL pour supprimer l'ancien fichier S3
    const { rows: [old] } = await pool.query('SELECT url_fichier FROM cours WHERE id_cours = $1', [id])
    if (old?.url_fichier) await deleteFromS3(old.url_fichier).catch(() => {})
    url_fichier = req.file.location
  }

  const sets = []
  const vals = []
  let i = 1
  if (titre)       { sets.push(`titre = $${i++}`);      vals.push(titre) }
  if (sous_titre !== undefined) { sets.push(`sous_titre = $${i++}`); vals.push(sous_titre) }
  if (url_fichier) { sets.push(`url_fichier = $${i++}`); vals.push(url_fichier) }
  if (!sets.length) return res.status(400).json({ message: 'Rien à modifier' })
  vals.push(id)

  const { rows: [row] } = await pool.query(
    `UPDATE cours SET ${sets.join(', ')} WHERE id_cours = $${i} RETURNING *`, vals
  )
  if (!row) return res.status(404).json({ message: 'Cours introuvable' })
  await signUrlField(row, 'url_fichier')
  res.json(row)
})

const deleteCours = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [old] } = await pool.query('SELECT url_fichier FROM cours WHERE id_cours = $1', [id])
  if (!old) return res.status(404).json({ message: 'Cours introuvable' })

  // Supprime en cascade grâce au ON DELETE CASCADE sur contenu
  await pool.query('DELETE FROM contenu WHERE id = $1', [id])
  await deleteFromS3(old.url_fichier).catch(() => {})
  res.json({ message: 'Cours supprimé' })
})

// ══════════════════════════════════════════════════════════════
// TUTORIELS VIDEO
// ══════════════════════════════════════════════════════════════

const getTutoriels = asyncHandler(async (req, res) => {
  const { id_domaine, id_matiere, search } = req.query

  let query = `
    SELECT tv.id_tuto, tv.id_matiere, tv.titre, tv.sous_titre,
           tv.description, tv.url_video, tv.duree_minutes, ct.date_ajout,
           m.nom_matiere
    FROM tutoriel_video tv
    JOIN contenu ct ON ct.id = tv.id_tuto
    JOIN matiere m  ON m.id  = tv.id_matiere`

  const conditions = [], params = []
  let i = 1

  if (id_matiere) {
    conditions.push(`tv.id_matiere = $${i++}`)
    params.push(id_matiere)
  }
  if (id_domaine) {
    query += ` JOIN domaine_matiere_tutoriel dmt ON dmt.id_matiere = tv.id_matiere`
    conditions.push(`dmt.id_domaine = $${i++}`)
    params.push(id_domaine)
  }
  if (search) {
    conditions.push(`(tv.titre ILIKE $${i} OR tv.description ILIKE $${i++})`)
    params.push(`%${search}%`)
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY ct.date_ajout DESC'

  const { rows } = await pool.query(query, params)
  await signUrlFieldList(rows, 'url_video')
  res.json(rows)
})

const getTutosByMatiere = asyncHandler(async (req, res) => {
  const { idMatiere } = req.params
  const { rows } = await pool.query(
    `SELECT tv.*, ct.date_ajout FROM tutoriel_video tv
     JOIN contenu ct ON ct.id = tv.id_tuto
     WHERE tv.id_matiere = $1 ORDER BY ct.date_ajout DESC`,
    [idMatiere]
  )
  await signUrlFieldList(rows, 'url_video')
  res.json(rows)
})

const createTutoriel = asyncHandler(async (req, res) => {
  const { titre, sous_titre, description, duree_minutes, id_matiere } = req.body
  if (!titre || !id_matiere || !duree_minutes) {
    return res.status(400).json({ message: 'titre, id_matiere et duree_minutes requis' })
  }
  if (!req.file) return res.status(400).json({ message: 'Fichier vidéo requis' })

  const url = req.file.location
  const db  = await pool.connect()
  try {
    await db.query('BEGIN')
    const id = await insertContenu(db)
    const { rows: [row] } = await db.query(
      `INSERT INTO tutoriel_video
         (id_tuto, id_matiere, titre, sous_titre, description, url_video, duree_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, id_matiere, titre, sous_titre || null, description || null, url, duree_minutes]
    )

    // Lie automatiquement cette matière au domaine pour le filtrage
    // des tutoriels (table domaine_matiere_tutoriel). Sans ce lien,
    // le tutoriel n'apparaît jamais quand le client filtre par domaine
    // dans la page Tutoriel vidéo — seulement en mode "Tout".
    const { rows: [domaineRow] } = await db.query(
      `SELECT n.id_domaine
       FROM matiere m
       JOIN niveau n ON n.id = m.id_niveau
       WHERE m.id = $1`,
      [id_matiere]
    )
    if (domaineRow) {
      await db.query(
        `INSERT INTO domaine_matiere_tutoriel (id_domaine, id_matiere)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [domaineRow.id_domaine, id_matiere]
      )
    }

    await db.query('COMMIT')
    await signUrlField(row, 'url_video')
    res.status(201).json(row)
  } catch (err) { await db.query('ROLLBACK'); throw err }
  finally { db.release() }
})

const deleteTutoriel = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [old] } = await pool.query('SELECT url_video FROM tutoriel_video WHERE id_tuto = $1', [id])
  if (!old) return res.status(404).json({ message: 'Tutoriel introuvable' })
  await pool.query('DELETE FROM contenu WHERE id = $1', [id])
  await deleteFromS3(old.url_video).catch(() => {})
  res.json({ message: 'Tutoriel supprimé' })
})

// ══════════════════════════════════════════════════════════════
// EBOOKS
// ══════════════════════════════════════════════════════════════

const getEbooks = asyncHandler(async (req, res) => {
  const { search } = req.query
  let query = `SELECT e.*, ct.date_ajout FROM ebook e JOIN contenu ct ON ct.id = e.id_ebook`
  const params = []
  if (search) {
    query += ` WHERE e.titre ILIKE $1 OR e.nom_auteur ILIKE $1`
    params.push(`%${search}%`)
  }
  query += ' ORDER BY ct.date_ajout DESC'
  const { rows } = await pool.query(query, params)
  await signUrlFieldList(rows, 'url_fichier')
  res.json(rows)
})

const createEbook = asyncHandler(async (req, res) => {
  const { titre, type_ebook, nom_auteur, date_sortie } = req.body
  if (!titre) return res.status(400).json({ message: 'titre requis' })
  if (!req.file) return res.status(400).json({ message: 'Fichier PDF requis' })

  const url = req.file.location
  const db  = await pool.connect()
  try {
    await db.query('BEGIN')
    const id = await insertContenu(db)
    const { rows: [row] } = await db.query(
      `INSERT INTO ebook (id_ebook, titre, type_ebook, nom_auteur, date_sortie, url_fichier)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, titre, type_ebook || null, nom_auteur || null, date_sortie || null, url]
    )
    await db.query('COMMIT')
    await signUrlField(row, 'url_fichier')
    res.status(201).json(row)
  } catch (err) { await db.query('ROLLBACK'); throw err }
  finally { db.release() }
})

const deleteEbook = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [old] } = await pool.query('SELECT url_fichier FROM ebook WHERE id_ebook = $1', [id])
  if (!old) return res.status(404).json({ message: 'Ebook introuvable' })
  await pool.query('DELETE FROM contenu WHERE id = $1', [id])
  await deleteFromS3(old.url_fichier).catch(() => {})
  res.json({ message: 'Ebook supprimé' })
})

// ══════════════════════════════════════════════════════════════
// BROCHURES
// ══════════════════════════════════════════════════════════════

const getBrochures = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, ct.date_ajout FROM brochure b
     JOIN contenu ct ON ct.id = b.id_brochure
     ORDER BY ct.date_ajout DESC`
  )
  await signUrlFieldList(rows, 'url_fichier')
  res.json(rows)
})

const createBrochure = asyncHandler(async (req, res) => {
  const { titre, sous_titre, nom_auteur, module, date_sortie } = req.body
  if (!titre) return res.status(400).json({ message: 'titre requis' })
  if (!req.file) return res.status(400).json({ message: 'Fichier PDF requis' })

  const url = req.file.location
  const db  = await pool.connect()
  try {
    await db.query('BEGIN')
    const id = await insertContenu(db)
    const { rows: [row] } = await db.query(
      `INSERT INTO brochure (id_brochure, titre, sous_titre, nom_auteur, module, date_sortie, url_fichier)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, titre, sous_titre || null, nom_auteur || null, module || null, date_sortie || null, url]
    )
    await db.query('COMMIT')
    await signUrlField(row, 'url_fichier')
    res.status(201).json(row)
  } catch (err) { await db.query('ROLLBACK'); throw err }
  finally { db.release() }
})

const deleteBrochure = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [old] } = await pool.query('SELECT url_fichier FROM brochure WHERE id_brochure = $1', [id])
  if (!old) return res.status(404).json({ message: 'Brochure introuvable' })
  await pool.query('DELETE FROM contenu WHERE id = $1', [id])
  await deleteFromS3(old.url_fichier).catch(() => {})
  res.json({ message: 'Brochure supprimée' })
})

// ══════════════════════════════════════════════════════════════
// SUJETS D'EXAMEN
// ══════════════════════════════════════════════════════════════

const getSujets = asyncHandler(async (req, res) => {
  const { classe, annee } = req.query
  let query = `SELECT s.*, ct.date_ajout FROM sujet_examen s JOIN contenu ct ON ct.id = s.id_sujet`
  const conditions = [], params = []
  let i = 1
  if (classe) { conditions.push(`s.classe = $${i++}`); params.push(classe) }
  if (annee)  { conditions.push(`s.annee  = $${i++}`); params.push(annee) }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY s.annee DESC'

  const { rows } = await pool.query(query, params)
  await signUrlFieldList(rows, 'url_fichier')
  res.json(rows)
})

const createSujet = asyncHandler(async (req, res) => {
  const { annee, module, classe } = req.body
  if (!annee || !classe) return res.status(400).json({ message: 'annee et classe requis' })
  if (!req.file) return res.status(400).json({ message: 'Fichier PDF requis' })

  const url = req.file.location
  const db  = await pool.connect()
  try {
    await db.query('BEGIN')
    const id = await insertContenu(db)
    const { rows: [row] } = await db.query(
      `INSERT INTO sujet_examen (id_sujet, annee, module, classe, url_fichier)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, annee, module || null, classe, url]
    )
    await db.query('COMMIT')
    await signUrlField(row, 'url_fichier')
    res.status(201).json(row)
  } catch (err) { await db.query('ROLLBACK'); throw err }
  finally { db.release() }
})

const deleteSujet = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [old] } = await pool.query('SELECT url_fichier FROM sujet_examen WHERE id_sujet = $1', [id])
  if (!old) return res.status(404).json({ message: 'Sujet introuvable' })
  await pool.query('DELETE FROM contenu WHERE id = $1', [id])
  await deleteFromS3(old.url_fichier).catch(() => {})
  res.json({ message: 'Sujet supprimé' })
})

module.exports = {
  getCoursByMatiere, createCours, updateCours, deleteCours,
  getTutoriels, getTutosByMatiere, createTutoriel, deleteTutoriel,
  getEbooks, createEbook, deleteEbook,
  getBrochures, createBrochure, deleteBrochure,
  getSujets, createSujet, deleteSujet,
}