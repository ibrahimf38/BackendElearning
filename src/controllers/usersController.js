const pool = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')

const getAllUsers = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.telephone, u.date_inscription, u.est_actif,
            c.nom_complet, c.date_derniere_connexion,
            (SELECT statut FROM abonnement
             WHERE id_client = c.id_client
               AND date_fin >= CURRENT_DATE
             ORDER BY date_debut DESC LIMIT 1) AS statut_abonnement
     FROM utilisateur u
     JOIN client c ON c.id_client = u.id
     ORDER BY u.date_inscription DESC`
  )
  res.json(rows)
})

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows } = await pool.query(
    `SELECT u.id, u.telephone, u.date_inscription, u.est_actif,
            c.nom_complet, c.date_derniere_connexion
     FROM utilisateur u
     JOIN client c ON c.id_client = u.id
     WHERE u.id = $1`,
    [id]
  )
  if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' })
  res.json(rows[0])
})

const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rows: [row] } = await pool.query(
    `UPDATE utilisateur
     SET est_actif = NOT est_actif
     WHERE id = $1 AND id IN (SELECT id_client FROM client)
     RETURNING id, est_actif`,
    [id]
  )
  if (!row) return res.status(404).json({ message: 'Utilisateur introuvable' })
  res.json({
    message: `Compte ${row.est_actif ? 'activé' : 'désactivé'}`,
    est_actif: row.est_actif,
  })
})

module.exports = { getAllUsers, getUserById, toggleUserActive }
