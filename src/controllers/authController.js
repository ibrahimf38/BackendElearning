// const bcrypt  = require('bcryptjs')
// const { v4: uuidv4 } = require('uuid')
// const pool    = require('../config/db')
// const { generateToken } = require('../middleware/auth')
// const { asyncHandler }  = require('../middleware/errorHandler')

// // ── Utilitaire OTP ────────────────────────────────────────────
// function genererOtp() {
//   return Math.floor(1000 + Math.random() * 9000).toString() // 4 chiffres
// }

// async function envoyerSms(telephone, message) {
//   // TODO: brancher votre fournisseur SMS (Orange, Twilio, etc.)
//   // En dev, on log simplement l'OTP
//   console.log(`📱 SMS vers ${telephone}: ${message}`)
// }

// // ── CLIENT : Inscription ──────────────────────────────────────
// const register = asyncHandler(async (req, res) => {
//   const { nom_complet, telephone, mot_de_passe } = req.body

//   if (!nom_complet || !telephone || !mot_de_passe) {
//     return res.status(400).json({ message: 'Tous les champs sont requis' })
//   }
//   if (mot_de_passe.length < 6) {
//     return res.status(400).json({ message: 'Mot de passe trop court (min 6 caractères)' })
//   }

//   const hash = await bcrypt.hash(mot_de_passe, 12)
//   const otp  = genererOtp()

//   const client = await pool.connect()
//   try {
//     await client.query('BEGIN')

//     // Insérer dans utilisateur
//     const { rows: [user] } = await client.query(
//       `INSERT INTO utilisateur (telephone, mot_de_passe)
//        VALUES ($1, $2) RETURNING id`,
//       [telephone, hash]
//     )

//     // Insérer dans client
//     await client.query(
//       `INSERT INTO client (id_client, nom_complet, code_otp)
//        VALUES ($1, $2, $3)`,
//       [user.id, nom_complet, otp]
//     )

//     await client.query('COMMIT')

//     // Envoyer OTP par SMS
//     await envoyerSms(telephone, `Votre code de vérification Elearning-Mali : ${otp}`)

//     res.status(201).json({ message: 'Compte créé. Code OTP envoyé par SMS.', telephone })
//   } catch (err) {
//     await client.query('ROLLBACK')
//     throw err
//   } finally {
//     client.release()
//   }
// })

// // ── CLIENT : Vérification OTP ─────────────────────────────────
// const verifyOtp = asyncHandler(async (req, res) => {
//   const { telephone, code_otp } = req.body
//   if (!telephone || !code_otp) {
//     return res.status(400).json({ message: 'Téléphone et code OTP requis' })
//   }

//   const { rows } = await pool.query(
//     `SELECT u.id, u.est_actif, c.id_client, c.nom_complet, c.code_otp
//      FROM utilisateur u
//      JOIN client c ON c.id_client = u.id
//      WHERE u.telephone = $1`,
//     [telephone]
//   )
//   const user = rows[0]
//   if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
//   if (user.code_otp !== code_otp) return res.status(400).json({ message: 'Code OTP incorrect' })

//   // Effacer l'OTP après utilisation
//   await pool.query(`UPDATE client SET code_otp = NULL WHERE id_client = $1`, [user.id_client])
//   // Activer le compte si premier login
//   await pool.query(`UPDATE utilisateur SET est_actif = TRUE WHERE id = $1`, [user.id])
//   // Mettre à jour la date de dernière connexion
//   await pool.query(`UPDATE client SET date_derniere_connexion = NOW() WHERE id_client = $1`, [user.id_client])

//   const token = generateToken({ id: user.id, role: 'client' })

//   res.json({
//     token,
//     client: {
//       id:          user.id_client,
//       nom_complet: user.nom_complet,
//       telephone,
//       est_actif:   true,
//     },
//   })
// })

// // ── CLIENT : Connexion ────────────────────────────────────────
// const login = asyncHandler(async (req, res) => {
//   const { telephone, mot_de_passe } = req.body
//   if (!telephone || !mot_de_passe) {
//     return res.status(400).json({ message: 'Téléphone et mot de passe requis' })
//   }

//   const { rows } = await pool.query(
//     `SELECT u.id, u.mot_de_passe, u.est_actif,
//             c.id_client, c.nom_complet
//      FROM utilisateur u
//      JOIN client c ON c.id_client = u.id
//      WHERE u.telephone = $1`,
//     [telephone]
//   )
//   const user = rows[0]
//   if (!user) return res.status(401).json({ message: 'Identifiants incorrects' })
//   if (!user.est_actif) return res.status(403).json({ message: 'Compte désactivé' })

//   const ok = await bcrypt.compare(mot_de_passe, user.mot_de_passe)
//   if (!ok) return res.status(401).json({ message: 'Identifiants incorrects' })

//   // Envoyer OTP pour la vérification à chaque connexion
//   const otp = genererOtp()
//   await pool.query(`UPDATE client SET code_otp = $1 WHERE id_client = $2`, [otp, user.id_client])
//   await envoyerSms(telephone, `Votre code de connexion Elearning-Mali : ${otp}`)

//   res.json({ message: 'Code OTP envoyé par SMS.', telephone })
// })

// // ── CLIENT : Renvoi OTP ───────────────────────────────────────
// const resendOtp = asyncHandler(async (req, res) => {
//   const { telephone } = req.body
//   if (!telephone) return res.status(400).json({ message: 'Téléphone requis' })

//   const otp = genererOtp()
//   const { rowCount } = await pool.query(
//     `UPDATE client SET code_otp = $1
//      WHERE id_client = (SELECT id FROM utilisateur WHERE telephone = $2)`,
//     [otp, telephone]
//   )
//   if (!rowCount) return res.status(404).json({ message: 'Utilisateur introuvable' })

//   await envoyerSms(telephone, `Nouveau code Elearning-Mali : ${otp}`)
//   res.json({ message: 'Nouveau code OTP envoyé' })
// })

// // ── ADMIN : Connexion ─────────────────────────────────────────
// const adminLogin = asyncHandler(async (req, res) => {
//   const { email, mot_de_passe } = req.body
//   if (!email || !mot_de_passe) {
//     return res.status(400).json({ message: 'Email et mot de passe requis' })
//   }

//   const { rows } = await pool.query(
//     `SELECT u.id, u.mot_de_passe, u.est_actif, a.email
//      FROM utilisateur u
//      JOIN admin a ON a.id_admin = u.id
//      WHERE a.email = $1`,
//     [email]
//   )
//   const admin = rows[0]
//   if (!admin) return res.status(401).json({ message: 'Identifiants incorrects' })
//   if (!admin.est_actif) return res.status(403).json({ message: 'Compte désactivé' })

//   const ok = await bcrypt.compare(mot_de_passe, admin.mot_de_passe)
//   if (!ok) return res.status(401).json({ message: 'Identifiants incorrects' })

//   const token = generateToken(
//     { id: admin.id, role: 'admin', email: admin.email },
//     process.env.JWT_ADMIN_EXPIRES_IN || '24h'
//   )

//   res.json({
//     token,
//     admin: { id: admin.id, email: admin.email },
//   })
// })

// module.exports = { register, verifyOtp, login, resendOtp, adminLogin }



const bcrypt  = require('bcryptjs')
const crypto  = require('crypto')
const pool    = require('../config/db')
const { generateToken } = require('../middleware/auth')
const { asyncHandler }  = require('../middleware/errorHandler')

// ── Utilitaire OTP ────────────────────────────────────────────
function genererOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString() // 4 chiffres
}

// Mot de passe interne aléatoire — le client n'en a jamais besoin.
// La table `utilisateur` exige une valeur (NOT NULL), mais pour les
// comptes Client l'authentification se fait uniquement par OTP/SMS.
function genererMotDePasseInterne() {
  return crypto.randomBytes(32).toString('hex')
}

async function envoyerSms(telephone, message) {
  // TODO: brancher votre fournisseur SMS (Orange, Twilio, etc.)
  // En dev, on log simplement l'OTP
  console.log(`📱 SMS vers ${telephone}: ${message}`)
}

// ── CLIENT : Inscription (nom complet + téléphone) ─────────────
const register = asyncHandler(async (req, res) => {
  const { nom_complet, telephone } = req.body

  if (!nom_complet?.trim() || !telephone?.trim()) {
    return res.status(400).json({ message: 'Nom complet et téléphone requis' })
  }

  const motDePasseInterne = await bcrypt.hash(genererMotDePasseInterne(), 12)
  const otp = genererOtp()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [user] } = await client.query(
      `INSERT INTO utilisateur (telephone, mot_de_passe)
       VALUES ($1, $2) RETURNING id`,
      [telephone.trim(), motDePasseInterne]
    )

    await client.query(
      `INSERT INTO client (id_client, nom_complet, code_otp)
       VALUES ($1, $2, $3)`,
      [user.id, nom_complet.trim(), otp]
    )

    await client.query('COMMIT')

    await envoyerSms(telephone, `Votre code de vérification Elearning-Mali : ${otp}`)

    res.status(201).json({ message: 'Compte créé. Code OTP envoyé par SMS.', telephone })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

// ── CLIENT : Vérification OTP ─────────────────────────────────
const verifyOtp = asyncHandler(async (req, res) => {
  const { telephone, code_otp } = req.body
  if (!telephone || !code_otp) {
    return res.status(400).json({ message: 'Téléphone et code OTP requis' })
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.est_actif, c.id_client, c.nom_complet, c.code_otp
     FROM utilisateur u
     JOIN client c ON c.id_client = u.id
     WHERE u.telephone = $1`,
    [telephone]
  )
  const user = rows[0]
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  if (!user.code_otp || user.code_otp !== code_otp) {
    return res.status(400).json({ message: 'Code OTP incorrect' })
  }

  // Effacer l'OTP après utilisation
  await pool.query(`UPDATE client SET code_otp = NULL WHERE id_client = $1`, [user.id_client])
  // Activer le compte si premier login
  await pool.query(`UPDATE utilisateur SET est_actif = TRUE WHERE id = $1`, [user.id])
  // Mettre à jour la date de dernière connexion
  await pool.query(`UPDATE client SET date_derniere_connexion = NOW() WHERE id_client = $1`, [user.id_client])

  const token = generateToken({ id: user.id, role: 'client' })

  res.json({
    token,
    client: {
      id:          user.id_client,
      nom_complet: user.nom_complet,
      telephone,
      est_actif:   true,
    },
  })
})

// ── CLIENT : Connexion (téléphone seul → envoie OTP) ───────────
const login = asyncHandler(async (req, res) => {
  const { telephone } = req.body
  if (!telephone?.trim()) {
    return res.status(400).json({ message: 'Numéro de téléphone requis' })
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.est_actif, c.id_client
     FROM utilisateur u
     JOIN client c ON c.id_client = u.id
     WHERE u.telephone = $1`,
    [telephone.trim()]
  )
  const user = rows[0]
  if (!user) return res.status(404).json({ message: "Aucun compte avec ce numéro. Inscrivez-vous d'abord." })
  if (!user.est_actif) return res.status(403).json({ message: 'Compte désactivé' })

  // Envoyer OTP pour la vérification à chaque connexion
  const otp = genererOtp()
  await pool.query(`UPDATE client SET code_otp = $1 WHERE id_client = $2`, [otp, user.id_client])
  await envoyerSms(telephone, `Votre code de connexion Elearning-Mali : ${otp}`)

  res.json({ message: 'Code OTP envoyé par SMS.', telephone })
})

// ── CLIENT : Renvoi OTP ───────────────────────────────────────
const resendOtp = asyncHandler(async (req, res) => {
  const { telephone } = req.body
  if (!telephone) return res.status(400).json({ message: 'Téléphone requis' })

  const otp = genererOtp()
  const { rowCount } = await pool.query(
    `UPDATE client SET code_otp = $1
     WHERE id_client = (SELECT id FROM utilisateur WHERE telephone = $2)`,
    [otp, telephone]
  )
  if (!rowCount) return res.status(404).json({ message: 'Utilisateur introuvable' })

  await envoyerSms(telephone, `Nouveau code Elearning-Mali : ${otp}`)
  res.json({ message: 'Nouveau code OTP envoyé' })
})

// ── ADMIN : Connexion (email + mot de passe — inchangé) ────────
const adminLogin = asyncHandler(async (req, res) => {
  const { email, mot_de_passe } = req.body
  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe requis' })
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.mot_de_passe, u.est_actif, a.email
     FROM utilisateur u
     JOIN admin a ON a.id_admin = u.id
     WHERE a.email = $1`,
    [email]
  )
  const admin = rows[0]
  if (!admin) return res.status(401).json({ message: 'Identifiants incorrects' })
  if (!admin.est_actif) return res.status(403).json({ message: 'Compte désactivé' })

  const ok = await bcrypt.compare(mot_de_passe, admin.mot_de_passe)
  if (!ok) return res.status(401).json({ message: 'Identifiants incorrects' })

  const token = generateToken(
    { id: admin.id, role: 'admin', email: admin.email },
    process.env.JWT_ADMIN_EXPIRES_IN || '24h'
  )

  res.json({
    token,
    admin: { id: admin.id, email: admin.email },
  })
})

module.exports = { register, verifyOtp, login, resendOtp, adminLogin }