const { v4: uuidv4 }   = require('uuid')
const pool             = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')

const MONTANT      = parseInt(process.env.ABONNEMENT_MONTANT)    || 1000
const DUREE_JOURS  = parseInt(process.env.ABONNEMENT_DUREE_JOURS) || 30

// ── Simulation paiement (à remplacer par l'API réelle) ────────
async function simulerPaiementOrange(numeroOrange, montant) {
  // TODO: appel réel à l'API Orange Money Mali
  // https://developer.orange.com/apis/orange-money-webpay-mali
  console.log(`💳 Simulation Orange Money: ${numeroOrange} — ${montant} FCFA`)
  return { success: true, id_transaction: `OM-${uuidv4()}` }
}

async function simulerPaiementMoov(numeroMoov, montant) {
  // TODO: appel réel à l'API Moov Money
  console.log(`💳 Simulation Moov Money: ${numeroMoov} — ${montant} FCFA`)
  return { success: true, id_transaction: `MM-${uuidv4()}` }
}

// ── Controller générique paiement ─────────────────────────────
async function processerPaiement(req, res, type) {
  const idClient   = req.user.id
  const champNumero = type === 'orange' ? 'numero_orange' : 'numero_moov'
  const numero     = req.body[champNumero]

  if (!numero) {
    return res.status(400).json({ message: `${champNumero} requis` })
  }
  if (!/^[0-9]{8}$/.test(numero)) {
    return res.status(400).json({ message: 'Numéro invalide (8 chiffres requis)' })
  }

  // Vérifier si déjà un abonnement actif
  const { rows: existing } = await pool.query(
    `SELECT id FROM abonnement
     WHERE id_client = $1 AND statut = 'Actif' AND date_fin >= CURRENT_DATE`,
    [idClient]
  )
  if (existing[0]) {
    return res.status(409).json({ message: 'Vous avez déjà un abonnement actif' })
  }

  // Appel API paiement
  const result = type === 'orange'
    ? await simulerPaiementOrange(numero, MONTANT)
    : await simulerPaiementMoov(numero, MONTANT)

  if (!result.success) {
    return res.status(402).json({ message: 'Paiement refusé par l\'opérateur' })
  }

  const { id_transaction } = result

  const db = await pool.connect()
  try {
    await db.query('BEGIN')

    // Insérer dans paiement (table mère)
    await db.query(
      `INSERT INTO paiement (id_transaction, montant, statut)
       VALUES ($1, $2, 'Succes')`,
      [id_transaction, MONTANT]
    )

    // Insérer dans la table fille (orange_money ou moov_money)
    if (type === 'orange') {
      await db.query(
        'INSERT INTO orange_money (id_transaction, numero_orange) VALUES ($1, $2)',
        [id_transaction, numero]
      )
    } else {
      await db.query(
        'INSERT INTO moov_money (id_transaction, numero_moov) VALUES ($1, $2)',
        [id_transaction, numero]
      )
    }

    // Calculer date de fin
    const dateFin = new Date()
    dateFin.setDate(dateFin.getDate() + DUREE_JOURS)

    // Créer l'abonnement
    const { rows: [abo] } = await db.query(
      `INSERT INTO abonnement
         (id_client, id_transaction, date_debut, date_fin, statut, montant)
       VALUES ($1, $2, CURRENT_DATE, $3, 'Actif', $4)
       RETURNING *`,
      [idClient, id_transaction, dateFin.toISOString().slice(0, 10), MONTANT]
    )

    await db.query('COMMIT')

    res.status(201).json({
      success:        true,
      id_transaction,
      message:        'Paiement effectué avec succès',
      abonnement:     abo,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    // Marquer le paiement comme échoué
    await pool.query(
      `UPDATE paiement SET statut = 'Echec' WHERE id_transaction = $1`,
      [id_transaction]
    ).catch(() => {})
    throw err
  } finally {
    db.release()
  }
}

const payerOrangeMoney = asyncHandler((req, res) => processerPaiement(req, res, 'orange'))
const payerMoovMoney   = asyncHandler((req, res) => processerPaiement(req, res, 'moov'))

// ── Historique abonnements du client connecté ─────────────────
const getHistoriqueAbonnements = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, p.date_paiement, p.statut as statut_paiement
     FROM abonnement a
     JOIN paiement p ON p.id_transaction = a.id_transaction
     WHERE a.id_client = $1
     ORDER BY a.date_debut DESC`,
    [req.user.id]
  )
  res.json(rows)
})

// ── Admin : tous les abonnements ──────────────────────────────
const getAllAbonnements = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, c.nom_complet, u.telephone, p.date_paiement,
            CASE WHEN om.id_transaction IS NOT NULL THEN 'Orange Money'
                 WHEN mm.id_transaction IS NOT NULL THEN 'Moov Money'
                 ELSE 'Inconnu' END AS methode_paiement
     FROM abonnement a
     JOIN client c ON c.id_client = a.id_client
     JOIN utilisateur u ON u.id = c.id_client
     JOIN paiement p ON p.id_transaction = a.id_transaction
     LEFT JOIN orange_money om ON om.id_transaction = a.id_transaction
     LEFT JOIN moov_money   mm ON mm.id_transaction = a.id_transaction
     ORDER BY a.date_debut DESC`
  )
  res.json(rows)
})

module.exports = {
  payerOrangeMoney,
  payerMoovMoney,
  getHistoriqueAbonnements,
  getAllAbonnements,
}
