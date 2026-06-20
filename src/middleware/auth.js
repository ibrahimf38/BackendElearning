const jwt  = require('jsonwebtoken')
const pool = require('../config/db')

const SECRET = process.env.JWT_SECRET || 'fallback_secret'

/**
 * Vérifie le token JWT et charge l'utilisateur depuis la BDD.
 * Attache `req.user = { id, telephone, role, ... }`.
 */
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant' })
    }

    const token   = header.split(' ')[1]
    const decoded = jwt.verify(token, SECRET)

    // Vérifier que l'utilisateur existe encore et est actif
    const { rows } = await pool.query(
      'SELECT id, telephone, est_actif FROM utilisateur WHERE id = $1',
      [decoded.id]
    )
    if (!rows[0])          return res.status(401).json({ message: 'Utilisateur introuvable' })
    if (!rows[0].est_actif) return res.status(403).json({ message: 'Compte désactivé' })

    req.user = { ...decoded, ...rows[0] }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expiré — reconnectez-vous' })
    }
    return res.status(401).json({ message: 'Token invalide' })
  }
}

/**
 * Vérifie que l'utilisateur connecté est un admin.
 * À utiliser APRÈS authMiddleware.
 */
async function adminMiddleware(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id_admin, email FROM admin WHERE id_admin = $1',
      [req.user.id]
    )
    if (!rows[0]) {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs' })
    }
    req.admin = rows[0]
    next()
  } catch {
    res.status(500).json({ message: 'Erreur serveur' })
  }
}

/**
 * Vérifie que le client a un abonnement actif.
 * À utiliser APRÈS authMiddleware pour protéger les contenus premium.
 */
async function abonnementActifMiddleware(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM abonnement
       WHERE id_client = $1
         AND statut = 'Actif'
         AND date_fin >= CURRENT_DATE
       LIMIT 1`,
      [req.user.id]
    )
    if (!rows[0]) {
      return res.status(403).json({
        message: 'Abonnement requis pour accéder à ce contenu',
        code: 'ABONNEMENT_REQUIS',
      })
    }
    next()
  } catch {
    res.status(500).json({ message: 'Erreur serveur' })
  }
}

/**
 * Génère un token JWT pour un utilisateur.
 */
function generateToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '7d') {
  return jwt.sign(payload, SECRET, { expiresIn })
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  abonnementActifMiddleware,
  generateToken,
}
