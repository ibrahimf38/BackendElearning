// const { v4: uuidv4 }   = require('uuid')
// const pool              = require('../config/db')
// const { asyncHandler }  = require('../middleware/errorHandler')
// const orangeMoney        = require('../services/orangeMoneyService')
// const moovMoney           = require('../services/moovMoneyService')

// const MONTANT      = parseInt(process.env.ABONNEMENT_MONTANT)     || 1000
// const DUREE_JOURS  = parseInt(process.env.ABONNEMENT_DUREE_JOURS) || 30

// // ── Helpers ──────────────────────────────────────────────────

// async function verifierAbonnementExistant(idClient) {
//   const { rows } = await pool.query(
//     `SELECT id FROM abonnement
//      WHERE id_client = $1 AND statut = 'Actif' AND date_fin >= CURRENT_DATE`,
//     [idClient]
//   )
//   return !!rows[0]
// }

// /**
//  * Crée les lignes paiement (statut 'En attente') + table fille.
//  * `id_client` est stocké directement sur `paiement` car l'abonnement
//  * n'existe pas encore à ce stade (il est créé après confirmation).
//  */
// async function creerPaiementEnAttente({ idTransaction, montant, idClient, type, numero }) {
//   const db = await pool.connect()
//   try {
//     await db.query('BEGIN')
//     await db.query(
//       `INSERT INTO paiement (id_transaction, montant, statut, id_client)
//        VALUES ($1, $2, 'En attente', $3)`,
//       [idTransaction, montant, idClient]
//     )
//     if (type === 'orange') {
//       await db.query(
//         'INSERT INTO orange_money (id_transaction, numero_orange) VALUES ($1, $2)',
//         [idTransaction, numero]
//       )
//     } else {
//       await db.query(
//         'INSERT INTO moov_money (id_transaction, numero_moov) VALUES ($1, $2)',
//         [idTransaction, numero]
//       )
//     }
//     await db.query('COMMIT')
//   } catch (err) {
//     await db.query('ROLLBACK')
//     throw err
//   } finally {
//     db.release()
//   }
// }

// /** Active l'abonnement et marque le paiement comme réussi. */
// async function activerAbonnement({ idTransaction, idClient, montant }) {
//   const db = await pool.connect()
//   try {
//     await db.query('BEGIN')

//     await db.query(
//       `UPDATE paiement SET statut = 'Succes' WHERE id_transaction = $1`,
//       [idTransaction]
//     )

//     const dateFin = new Date()
//     dateFin.setDate(dateFin.getDate() + DUREE_JOURS)

//     const { rows: [abo] } = await db.query(
//       `INSERT INTO abonnement
//          (id_client, id_transaction, date_debut, date_fin, statut, montant)
//        VALUES ($1, $2, CURRENT_DATE, $3, 'Actif', $4)
//        ON CONFLICT (id_transaction) DO NOTHING
//        RETURNING *`,
//       [idClient, idTransaction, dateFin.toISOString().slice(0, 10), montant]
//     )

//     await db.query('COMMIT')
//     return abo
//   } catch (err) {
//     await db.query('ROLLBACK')
//     throw err
//   } finally {
//     db.release()
//   }
// }

// async function marquerPaiementEchec(idTransaction) {
//   await pool.query(
//     `UPDATE paiement SET statut = 'Echec' WHERE id_transaction = $1`,
//     [idTransaction]
//   ).catch(() => {})
// }

// // ══════════════════════════════════════════════════════════════
// // ORANGE MONEY — flux WebPay (redirection / WebView)
// // ══════════════════════════════════════════════════════════════

// /**
//  * Initie un paiement Orange Money WebPay.
//  * Retourne une `payment_url` à charger dans une WebView côté Flutter.
//  * L'abonnement n'est PAS créé ici — il l'est soit via le webhook
//  * /callback, soit via le polling de /paiements/:id/statut.
//  */
// const payerOrangeMoney = asyncHandler(async (req, res) => {
//   const idClient = req.user.id
//   const { numero_orange } = req.body

//   if (!numero_orange) {
//     return res.status(400).json({ message: 'numero_orange requis' })
//   }
//   if (!/^[0-9]{8}$/.test(numero_orange)) {
//     return res.status(400).json({ message: 'Numéro invalide (8 chiffres requis)' })
//   }
//   if (await verifierAbonnementExistant(idClient)) {
//     return res.status(409).json({ message: 'Vous avez déjà un abonnement actif' })
//   }

//   const idTransaction = `OM-${uuidv4()}`

//   await creerPaiementEnAttente({
//     idTransaction, montant: MONTANT, idClient, type: 'orange', numero: numero_orange,
//   })

//   try {
//     const { paymentUrl, payToken } = await orangeMoney.initierPaiement({
//       orderId: idTransaction,
//       amount: MONTANT,
//       reference: 'Elearning Mali — Abonnement Découverte',
//     })

//     await pool.query(
//       `UPDATE orange_money SET pay_token = $1 WHERE id_transaction = $2`,
//       [payToken, idTransaction]
//     )

//     res.status(201).json({
//       id_transaction: idTransaction,
//       payment_url: paymentUrl,
//       message: 'Paiement initié — ouvrez le lien pour confirmer',
//     })
//   } catch (err) {
//     await marquerPaiementEchec(idTransaction)
//     throw err
//   }
// })

// /**
//  * Webhook appelé par Orange Money après confirmation/échec du paiement
//  * (configuré via ORANGE_MONEY_NOTIF_URL). Cette route N'EST PAS protégée
//  * par authMiddleware (Orange ne possède pas de token JWT client).
//  */
// const orangeMoneyCallback = asyncHandler(async (req, res) => {
//   const { order_id, status } = req.body

//   if (!order_id) {
//     return res.status(400).json({ message: 'order_id manquant' })
//   }

//   const { rows: [paiement] } = await pool.query(
//     `SELECT id_transaction, montant, id_client, statut
//      FROM paiement WHERE id_transaction = $1`,
//     [order_id]
//   )
//   if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })

//   // Idempotence : si déjà traité, on ne refait rien.
//   if (paiement.statut === 'Succes' || paiement.statut === 'Echec') {
//     return res.json({ received: true })
//   }

//   if (status === 'SUCCESS') {
//     await activerAbonnement({
//       idTransaction: order_id,
//       idClient: paiement.id_client,
//       montant: paiement.montant,
//     })
//   } else {
//     await marquerPaiementEchec(order_id)
//   }

//   res.json({ received: true })
// })

// // ══════════════════════════════════════════════════════════════
// // MOOV MONEY — flux push USSD
// // ══════════════════════════════════════════════════════════════

// const payerMoovMoney = asyncHandler(async (req, res) => {
//   const idClient = req.user.id
//   const { numero_moov } = req.body

//   if (!numero_moov) {
//     return res.status(400).json({ message: 'numero_moov requis' })
//   }
//   if (!/^[0-9]{8}$/.test(numero_moov)) {
//     return res.status(400).json({ message: 'Numéro invalide (8 chiffres requis)' })
//   }
//   if (await verifierAbonnementExistant(idClient)) {
//     return res.status(409).json({ message: 'Vous avez déjà un abonnement actif' })
//   }

//   const idTransaction = `MM-${uuidv4()}`

//   await creerPaiementEnAttente({
//     idTransaction, montant: MONTANT, idClient, type: 'moov', numero: numero_moov,
//   })

//   try {
//     const { referenceId } = await moovMoney.pushTransaction({
//       telephone: numero_moov,
//       amount: MONTANT,
//       reference: idTransaction,
//       message: 'Abonnement Elearning Mali — Découverte',
//     })

//     res.status(201).json({
//       id_transaction: idTransaction,
//       reference_id: referenceId,
//       message: 'Demande envoyée — confirmez sur votre téléphone (notification USSD)',
//     })
//   } catch (err) {
//     await marquerPaiementEchec(idTransaction)
//     throw err
//   }
// })

// /**
//  * Webhook appelé par Moov Money après confirmation/échec du paiement
//  * (configuré via MOOV_MONEY_NOTIF_URL).
//  */
// const moovMoneyCallback = asyncHandler(async (req, res) => {
//   const { idFromClient, status } = req.body
//   const orderId = idFromClient

//   if (!orderId) {
//     return res.status(400).json({ message: 'idFromClient manquant' })
//   }

//   const { rows: [paiement] } = await pool.query(
//     `SELECT id_transaction, montant, id_client, statut
//      FROM paiement WHERE id_transaction = $1`,
//     [orderId]
//   )
//   if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })

//   if (paiement.statut === 'Succes' || paiement.statut === 'Echec') {
//     return res.json({ received: true })
//   }

//   if (status === 'SUCCESS') {
//     await activerAbonnement({
//       idTransaction: orderId,
//       idClient: paiement.id_client,
//       montant: paiement.montant,
//     })
//   } else {
//     await marquerPaiementEchec(orderId)
//   }

//   res.json({ received: true })
// })

// // ══════════════════════════════════════════════════════════════
// // STATUT — poll côté Flutter pendant la confirmation
// // ══════════════════════════════════════════════════════════════

// /**
//  * Vérifie le statut d'un paiement en attente et active l'abonnement
//  * si le paiement est confirmé. Appelé en polling par l'app Flutter
//  * pendant que l'utilisateur confirme sur Orange/Moov. Sert aussi de
//  * filet de sécurité si le webhook n'arrive pas (réseau, etc.).
//  */
// const verifierStatutPaiement = asyncHandler(async (req, res) => {
//   const { idTransaction } = req.params
//   const idClient = req.user.id

//   const { rows: [paiement] } = await pool.query(
//     `SELECT p.id_transaction, p.montant, p.statut, p.id_client,
//             om.numero_orange, om.pay_token,
//             mm.numero_moov
//      FROM paiement p
//      LEFT JOIN orange_money om ON om.id_transaction = p.id_transaction
//      LEFT JOIN moov_money   mm ON mm.id_transaction = p.id_transaction
//      WHERE p.id_transaction = $1`,
//     [idTransaction]
//   )
//   if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })
//   if (paiement.id_client !== idClient) {
//     return res.status(403).json({ message: 'Accès refusé à cette transaction' })
//   }

//   if (paiement.statut === 'Succes') {
//     const { rows: [abo] } = await pool.query(
//       `SELECT * FROM abonnement WHERE id_transaction = $1`, [idTransaction]
//     )
//     return res.json({ statut: 'Succes', abonnement: abo || null })
//   }
//   if (paiement.statut === 'Echec') {
//     return res.json({ statut: 'Echec' })
//   }

//   // Toujours en attente -> on interroge le fournisseur (filet de sécurité)
//   try {
//     let providerStatus
//     if (paiement.numero_orange) {
//       const { status } = await orangeMoney.verifierStatut({
//         orderId: idTransaction,
//         amount: paiement.montant,
//         payToken: paiement.pay_token,
//       })
//       providerStatus = status
//     } else if (paiement.numero_moov) {
//       const { status } = await moovMoney.getTransactionStatus(idTransaction)
//       providerStatus = status
//     }

//     if (providerStatus === 'SUCCESS') {
//       const abo = await activerAbonnement({
//         idTransaction, idClient, montant: paiement.montant,
//       })
//       return res.json({ statut: 'Succes', abonnement: abo })
//     }
//     if (providerStatus === 'FAILED' || providerStatus === 'EXPIRED') {
//       await marquerPaiementEchec(idTransaction)
//       return res.json({ statut: 'Echec' })
//     }

//     res.json({ statut: 'En attente' })
//   } catch (err) {
//     // Le fournisseur n'a pas répondu — on reste en attente, l'app réessaiera
//     res.json({ statut: 'En attente', warning: err.message })
//   }
// })

// // ── Historique abonnements du client connecté ─────────────────
// const getHistoriqueAbonnements = asyncHandler(async (req, res) => {
//   const { rows } = await pool.query(
//     `SELECT a.*, p.date_paiement, p.statut as statut_paiement
//      FROM abonnement a
//      JOIN paiement p ON p.id_transaction = a.id_transaction
//      WHERE a.id_client = $1
//      ORDER BY a.date_debut DESC`,
//     [req.user.id]
//   )
//   res.json(rows)
// })

// // ── Admin : tous les abonnements ──────────────────────────────
// const getAllAbonnements = asyncHandler(async (req, res) => {
//   const { rows } = await pool.query(
//     `SELECT a.*, c.nom_complet, u.telephone, p.date_paiement,
//             CASE WHEN om.id_transaction IS NOT NULL THEN 'Orange Money'
//                  WHEN mm.id_transaction IS NOT NULL THEN 'Moov Money'
//                  ELSE 'Inconnu' END AS methode_paiement
//      FROM abonnement a
//      JOIN client c ON c.id_client = a.id_client
//      JOIN utilisateur u ON u.id = c.id_client
//      JOIN paiement p ON p.id_transaction = a.id_transaction
//      LEFT JOIN orange_money om ON om.id_transaction = a.id_transaction
//      LEFT JOIN moov_money   mm ON mm.id_transaction = a.id_transaction
//      ORDER BY a.date_debut DESC`
//   )
//   res.json(rows)
// })

// module.exports = {
//   payerOrangeMoney,
//   orangeMoneyCallback,
//   payerMoovMoney,
//   moovMoneyCallback,
//   verifierStatutPaiement,
//   getHistoriqueAbonnements,
//   getAllAbonnements,
// }



const { v4: uuidv4 }   = require('uuid')
const pool              = require('../config/db')
const { asyncHandler }  = require('../middleware/errorHandler')
const orangeMoney        = require('../services/orangeMoneyService')
const moovMoney           = require('../services/moovMoneyService')

const MONTANT      = parseInt(process.env.ABONNEMENT_MONTANT)     || 1000
const DUREE_JOURS  = parseInt(process.env.ABONNEMENT_DUREE_JOURS) || 30

// ── Helpers ──────────────────────────────────────────────────

async function verifierAbonnementExistant(idClient) {
  const { rows } = await pool.query(
    `SELECT id FROM abonnement
     WHERE id_client = $1 AND statut = 'Actif' AND date_fin >= CURRENT_DATE`,
    [idClient]
  )
  return !!rows[0]
}

/**
 * Crée les lignes paiement (statut 'En attente') + table fille.
 * `id_client` est stocké directement sur `paiement` car l'abonnement
 * n'existe pas encore à ce stade (il est créé après confirmation).
 */
async function creerPaiementEnAttente({ idTransaction, montant, idClient, type, numero }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query(
      `INSERT INTO paiement (id_transaction, montant, statut, id_client)
       VALUES ($1, $2, 'En attente', $3)`,
      [idTransaction, montant, idClient]
    )
    if (type === 'orange') {
      await db.query(
        'INSERT INTO orange_money (id_transaction, numero_orange) VALUES ($1, $2)',
        [idTransaction, numero]
      )
    } else {
      await db.query(
        'INSERT INTO moov_money (id_transaction, numero_moov) VALUES ($1, $2)',
        [idTransaction, numero]
      )
    }
    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

/** Active l'abonnement et marque le paiement comme réussi. */
async function activerAbonnement({ idTransaction, idClient, montant }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')

    await db.query(
      `UPDATE paiement SET statut = 'Succes' WHERE id_transaction = $1`,
      [idTransaction]
    )

    const dateFin = new Date()
    dateFin.setDate(dateFin.getDate() + DUREE_JOURS)

    const { rows: [abo] } = await db.query(
      `INSERT INTO abonnement
         (id_client, id_transaction, date_debut, date_fin, statut, montant)
       VALUES ($1, $2, CURRENT_DATE, $3, 'Actif', $4)
       ON CONFLICT (id_transaction) DO NOTHING
       RETURNING *`,
      [idClient, idTransaction, dateFin.toISOString().slice(0, 10), montant]
    )

    await db.query('COMMIT')
    return abo
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

async function marquerPaiementEchec(idTransaction) {
  await pool.query(
    `UPDATE paiement SET statut = 'Echec' WHERE id_transaction = $1`,
    [idTransaction]
  ).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// ORANGE MONEY — flux WebPay (redirection / WebView)
// ══════════════════════════════════════════════════════════════

/**
 * Initie un paiement Orange Money WebPay.
 * Retourne une `payment_url` à charger dans une WebView côté Flutter.
 * L'abonnement n'est PAS créé ici — il l'est soit via le webhook
 * /callback, soit via le polling de /paiements/:id/statut.
 */
const payerOrangeMoney = asyncHandler(async (req, res) => {
  const idClient = req.user.id
  const { numero_orange } = req.body

  if (!numero_orange) {
    return res.status(400).json({ message: 'numero_orange requis' })
  }
  if (!/^[0-9]{8}$/.test(numero_orange)) {
    return res.status(400).json({ message: 'Numéro invalide (8 chiffres requis)' })
  }
  if (await verifierAbonnementExistant(idClient)) {
    return res.status(409).json({ message: 'Vous avez déjà un abonnement actif' })
  }

  const idTransaction = `OM-${uuidv4()}`

  await creerPaiementEnAttente({
    idTransaction, montant: MONTANT, idClient, type: 'orange', numero: numero_orange,
  })

  try {
    const { paymentUrl, payToken } = await orangeMoney.initierPaiement({
      orderId: idTransaction,
      amount: MONTANT,
      reference: 'Elearning Mali — Abonnement Découverte',
    })

    await pool.query(
      `UPDATE orange_money SET pay_token = $1 WHERE id_transaction = $2`,
      [payToken, idTransaction]
    )

    res.status(201).json({
      id_transaction: idTransaction,
      payment_url: paymentUrl,
      message: 'Paiement initié — ouvrez le lien pour confirmer',
    })
  } catch (err) {
    await marquerPaiementEchec(idTransaction)
    throw err
  }
})

/**
 * Webhook appelé par Orange Money après confirmation/échec du paiement
 * (configuré via ORANGE_MONEY_NOTIF_URL). Cette route N'EST PAS protégée
 * par authMiddleware (Orange ne possède pas de token JWT client).
 */
const orangeMoneyCallback = asyncHandler(async (req, res) => {
  const { order_id, status } = req.body

  if (!order_id) {
    return res.status(400).json({ message: 'order_id manquant' })
  }

  const { rows: [paiement] } = await pool.query(
    `SELECT id_transaction, montant, id_client, statut
     FROM paiement WHERE id_transaction = $1`,
    [order_id]
  )
  if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })

  // Idempotence : si déjà traité, on ne refait rien.
  if (paiement.statut === 'Succes' || paiement.statut === 'Echec') {
    return res.json({ received: true })
  }

  if (status === 'SUCCESS') {
    await activerAbonnement({
      idTransaction: order_id,
      idClient: paiement.id_client,
      montant: paiement.montant,
    })
  } else {
    await marquerPaiementEchec(order_id)
  }

  res.json({ received: true })
})

// ══════════════════════════════════════════════════════════════
// MOOV MONEY — flux push USSD
// ══════════════════════════════════════════════════════════════

const payerMoovMoney = asyncHandler(async (req, res) => {
  const idClient = req.user.id
  const { numero_moov } = req.body

  if (!numero_moov) {
    return res.status(400).json({ message: 'numero_moov requis' })
  }
  if (!/^[0-9]{8}$/.test(numero_moov)) {
    return res.status(400).json({ message: 'Numéro invalide (8 chiffres requis)' })
  }
  if (await verifierAbonnementExistant(idClient)) {
    return res.status(409).json({ message: 'Vous avez déjà un abonnement actif' })
  }

  const idTransaction = `MM-${uuidv4()}`

  await creerPaiementEnAttente({
    idTransaction, montant: MONTANT, idClient, type: 'moov', numero: numero_moov,
  })

  try {
    const { referenceId } = await moovMoney.customerPayMerchant({
      telephone: numero_moov,
      amount: MONTANT,
      reference: idTransaction,
      message: 'Abonnement Elearning Mali — Découverte',
    })

    res.status(201).json({
      id_transaction: idTransaction,
      reference_id: referenceId,
      message: 'Demande envoyée — confirmez sur votre téléphone (notification USSD)',
    })
  } catch (err) {
    await marquerPaiementEchec(idTransaction)
    throw err
  }
})

/**
 * Webhook appelé par Moov Money après confirmation/échec du paiement
 * (configuré via MOOV_MONEY_NOTIF_URL).
 */
const moovMoneyCallback = asyncHandler(async (req, res) => {
  const { idFromClient, status } = req.body
  const orderId = idFromClient

  if (!orderId) {
    return res.status(400).json({ message: 'idFromClient manquant' })
  }

  const { rows: [paiement] } = await pool.query(
    `SELECT id_transaction, montant, id_client, statut
     FROM paiement WHERE id_transaction = $1`,
    [orderId]
  )
  if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })

  if (paiement.statut === 'Succes' || paiement.statut === 'Echec') {
    return res.json({ received: true })
  }

  if (status === 'SUCCESS') {
    await activerAbonnement({
      idTransaction: orderId,
      idClient: paiement.id_client,
      montant: paiement.montant,
    })
  } else {
    await marquerPaiementEchec(orderId)
  }

  res.json({ received: true })
})

// ══════════════════════════════════════════════════════════════
// STATUT — poll côté Flutter pendant la confirmation
// ══════════════════════════════════════════════════════════════

/**
 * Vérifie le statut d'un paiement en attente et active l'abonnement
 * si le paiement est confirmé. Appelé en polling par l'app Flutter
 * pendant que l'utilisateur confirme sur Orange/Moov. Sert aussi de
 * filet de sécurité si le webhook n'arrive pas (réseau, etc.).
 */
const verifierStatutPaiement = asyncHandler(async (req, res) => {
  const { idTransaction } = req.params
  const idClient = req.user.id

  const { rows: [paiement] } = await pool.query(
    `SELECT p.id_transaction, p.montant, p.statut, p.id_client,
            om.numero_orange, om.pay_token,
            mm.numero_moov
     FROM paiement p
     LEFT JOIN orange_money om ON om.id_transaction = p.id_transaction
     LEFT JOIN moov_money   mm ON mm.id_transaction = p.id_transaction
     WHERE p.id_transaction = $1`,
    [idTransaction]
  )
  if (!paiement) return res.status(404).json({ message: 'Transaction introuvable' })
  if (paiement.id_client !== idClient) {
    return res.status(403).json({ message: 'Accès refusé à cette transaction' })
  }

  if (paiement.statut === 'Succes') {
    const { rows: [abo] } = await pool.query(
      `SELECT * FROM abonnement WHERE id_transaction = $1`, [idTransaction]
    )
    return res.json({ statut: 'Succes', abonnement: abo || null })
  }
  if (paiement.statut === 'Echec') {
    return res.json({ statut: 'Echec' })
  }

  // Toujours en attente -> on interroge le fournisseur (filet de sécurité)
  try {
    let providerStatus
    if (paiement.numero_orange) {
      const { status } = await orangeMoney.verifierStatut({
        orderId: idTransaction,
        amount: paiement.montant,
        payToken: paiement.pay_token,
      })
      providerStatus = status
    } else if (paiement.numero_moov) {
      const { status } = await moovMoney.getTransactionStatus(idTransaction)
      providerStatus = status
    }

    if (providerStatus === 'SUCCESS') {
      const abo = await activerAbonnement({
        idTransaction, idClient, montant: paiement.montant,
      })
      return res.json({ statut: 'Succes', abonnement: abo })
    }
    if (providerStatus === 'FAILED' || providerStatus === 'EXPIRED') {
      await marquerPaiementEchec(idTransaction)
      return res.json({ statut: 'Echec' })
    }

    res.json({ statut: 'En attente' })
  } catch (err) {
    // Le fournisseur n'a pas répondu — on reste en attente, l'app réessaiera
    res.json({ statut: 'En attente', warning: err.message })
  }
})

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
  orangeMoneyCallback,
  payerMoovMoney,
  moovMoneyCallback,
  verifierStatutPaiement,
  getHistoriqueAbonnements,
  getAllAbonnements,
}