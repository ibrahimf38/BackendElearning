const pool = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')

// ══════════════════════════════════════════════════════════════
// DOMAINES
// ══════════════════════════════════════════════════════════════

const getDomaines = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM domaine ORDER BY nom_domaine'
  )
  res.json(rows)
})

const createDomaine = asyncHandler(async (req, res) => {
  const { nom_domaine } = req.body
  if (!nom_domaine?.trim()) return res.status(400).json({ message: 'nom_domaine requis' })

  const { rows: [row] } = await pool.query(
    'INSERT INTO domaine (nom_domaine) VALUES ($1) RETURNING *',
    [nom_domaine.trim()]
  )
  res.status(201).json(row)
})

const updateDomaine = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nom_domaine } = req.body
  const { rows: [row] } = await pool.query(
    'UPDATE domaine SET nom_domaine = $1 WHERE id = $2 RETURNING *',
    [nom_domaine, id]
  )
  if (!row) return res.status(404).json({ message: 'Domaine introuvable' })
  res.json(row)
})

const deleteDomaine = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rowCount } = await pool.query('DELETE FROM domaine WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ message: 'Domaine introuvable' })
  res.json({ message: 'Domaine supprimé' })
})

// ══════════════════════════════════════════════════════════════
// NIVEAUX
// ══════════════════════════════════════════════════════════════

const getNiveauxByDomaine = asyncHandler(async (req, res) => {
  const { idDomaine } = req.params
  const { rows } = await pool.query(
    'SELECT * FROM niveau WHERE id_domaine = $1 ORDER BY nom_niveau',
    [idDomaine]
  )
  res.json(rows)
})

const createNiveau = asyncHandler(async (req, res) => {
  const { idDomaine } = req.params
  const { nom_niveau } = req.body
  if (!nom_niveau?.trim()) return res.status(400).json({ message: 'nom_niveau requis' })

  const { rows: [row] } = await pool.query(
    'INSERT INTO niveau (id_domaine, nom_niveau) VALUES ($1, $2) RETURNING *',
    [idDomaine, nom_niveau.trim()]
  )
  res.status(201).json(row)
})

const updateNiveau = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nom_niveau } = req.body
  const { rows: [row] } = await pool.query(
    'UPDATE niveau SET nom_niveau = $1 WHERE id = $2 RETURNING *',
    [nom_niveau, id]
  )
  if (!row) return res.status(404).json({ message: 'Niveau introuvable' })
  res.json(row)
})

const deleteNiveau = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rowCount } = await pool.query('DELETE FROM niveau WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ message: 'Niveau introuvable' })
  res.json({ message: 'Niveau supprimé' })
})

// ══════════════════════════════════════════════════════════════
// MATIERES
// ══════════════════════════════════════════════════════════════

const getMatieresByNiveau = asyncHandler(async (req, res) => {
  const { idNiveau } = req.params
  const { rows } = await pool.query(
    'SELECT * FROM matiere WHERE id_niveau = $1 ORDER BY nom_matiere',
    [idNiveau]
  )
  res.json(rows)
})

const createMatiere = asyncHandler(async (req, res) => {
  const { idNiveau } = req.params
  const { nom_matiere } = req.body
  if (!nom_matiere?.trim()) return res.status(400).json({ message: 'nom_matiere requis' })

  const { rows: [row] } = await pool.query(
    'INSERT INTO matiere (id_niveau, nom_matiere) VALUES ($1, $2) RETURNING *',
    [idNiveau, nom_matiere.trim()]
  )
  res.status(201).json(row)
})

const updateMatiere = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nom_matiere } = req.body
  const { rows: [row] } = await pool.query(
    'UPDATE matiere SET nom_matiere = $1 WHERE id = $2 RETURNING *',
    [nom_matiere, id]
  )
  if (!row) return res.status(404).json({ message: 'Matière introuvable' })
  res.json(row)
})

const deleteMatiere = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rowCount } = await pool.query('DELETE FROM matiere WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ message: 'Matière introuvable' })
  res.json({ message: 'Matière supprimée' })
})

// ══════════════════════════════════════════════════════════════
// DOMAINE-MATIERE-TUTORIEL (table d'association)
// ══════════════════════════════════════════════════════════════

const getMatieresByDomaineTutoriel = asyncHandler(async (req, res) => {
  const { idDomaine } = req.params
  const { rows } = await pool.query(
    `SELECT m.* FROM matiere m
     JOIN domaine_matiere_tutoriel dmt ON dmt.id_matiere = m.id
     WHERE dmt.id_domaine = $1
     ORDER BY m.nom_matiere`,
    [idDomaine]
  )
  res.json(rows)
})

const addDomaineTutorielLink = asyncHandler(async (req, res) => {
  const { idDomaine, idMatiere } = req.body
  await pool.query(
    `INSERT INTO domaine_matiere_tutoriel (id_domaine, id_matiere)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [idDomaine, idMatiere]
  )
  res.status(201).json({ message: 'Association créée' })
})

module.exports = {
  getDomaines, createDomaine, updateDomaine, deleteDomaine,
  getNiveauxByDomaine, createNiveau, updateNiveau, deleteNiveau,
  getMatieresByNiveau, createMatiere, updateMatiere, deleteMatiere,
  getMatieresByDomaineTutoriel, addDomaineTutorielLink,
}
