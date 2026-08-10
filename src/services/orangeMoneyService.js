// // const fetch = global.fetch || require('node-fetch')

// // /**
// //  * Service Orange Money WebPay Mali.
// //  *
// //  * Environnements :
// //  *   DEV/Sandbox : ORANGE_MONEY_ENV=dev
// //  *   Production  : ORANGE_MONEY_ENV=ml
// //  *
// //  * Flux :
// //  *   1. getAccessToken()   → OAuth2 → Bearer token (valide ~90j en sandbox, 1h en prod)
// //  *   2. initierPaiement()  → POST /webpayment → payment_url + pay_token + notif_token
// //  *   3. (l'utilisateur paie sur la WebView ou via le simulateur sandbox)
// //  *   4. orangeMoneyCallback() ou verifierStatut() → confirme le paiement
// //  *
// //  * Variables d'env requises :
// //  *   ORANGE_MONEY_ENV          = dev (sandbox) | ml (production Mali)
// //  *   ORANGE_MONEY_CLIENT_ID    = votre Client ID du portail Orange Developer
// //  *   ORANGE_MONEY_CLIENT_SECRET= votre Client Secret
// //  *   ORANGE_MONEY_MERCHANT_KEY = clé marchande générée depuis MyApps
// //  *   ORANGE_MONEY_RETURN_URL   = URL de retour après paiement
// //  *   ORANGE_MONEY_CANCEL_URL   = URL de retour si annulation
// //  *   ORANGE_MONEY_NOTIF_URL    = URL webhook pour la notification de statut
// //  *
// //  * Credentials de test (sandbox) :
// //  *   Merchant MSISDN : 7701900259  |  Agent Code : 101379  |  PIN : 3631
// //  *   Subscriber MSISDN : 7701100259  |  PIN : 5304  |  Balance : 1 000 000
// //  *   Simulateur USSD : https://mpayment.orange-money.com/mpayment-otp/login
// //  *     Login : 7701900259  |  MDP : MerchantWP00259
// //  */
// // class OrangeMoneyService {
// //   constructor() {
// //     this.clientId     = process.env.ORANGE_MONEY_CLIENT_ID
// //     this.clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET
// //     this.merchantKey  = process.env.ORANGE_MONEY_MERCHANT_KEY
// //     this.env          = process.env.ORANGE_MONEY_ENV || 'dev'
// //     this.returnUrl    = process.env.ORANGE_MONEY_RETURN_URL
// //     this.cancelUrl    = process.env.ORANGE_MONEY_CANCEL_URL
// //     this.notifUrl     = process.env.ORANGE_MONEY_NOTIF_URL
// //     this._tokenCache  = null
// //   }

// //   get _tokenUrl() {
// //     return 'https://api.orange.com/oauth/v3/token'
// //   }

// //   get _webpaymentUrl() {
// //     return `https://api.orange.com/orange-money-webpay/${this.env}/v1/webpayment`
// //   }

// //   get _statusUrl() {
// //     return `https://api.orange.com/orange-money-webpay/${this.env}/v1/transactionstatus`
// //   }

// //   /**
// //    * Récupère un access_token OAuth2.
// //    * En sandbox, il est valide ~90 jours. En prod, 1 heure.
// //    * Mis en cache pour éviter les appels inutiles.
// //    */
// //   async getAccessToken() {
// //     if (this._tokenCache && this._tokenCache.expires_at > Date.now()) {
// //       return this._tokenCache.access_token
// //     }

// //     const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

// //     const res = await fetch(this._tokenUrl, {
// //       method: 'POST',
// //       headers: {
// //         'Authorization': `Basic ${basic}`,
// //         'Content-Type':  'application/x-www-form-urlencoded',
// //         'Accept':        'application/json',
// //       },
// //       body: 'grant_type=client_credentials',
// //     })

// //     if (!res.ok) {
// //       const text = await res.text()
// //       throw new Error(`Orange Money — échec OAuth2 (${res.status}): ${text}`)
// //     }

// //     const data = await res.json()
// //     // expires_in en secondes (3600 en prod, ~7776000 en sandbox)
// //     const expiresIn = parseInt(data.expires_in, 10) || 3600
// //     this._tokenCache = {
// //       access_token: data.access_token,
// //       expires_at: Date.now() + (expiresIn - 60) * 1000,
// //     }
// //     console.log(`🔐 Orange Money — token renouvelé (expire dans ${Math.round(expiresIn / 3600)}h)`)
// //     return data.access_token
// //   }

// //   /**
// //    * Initie un paiement WebPay.
// //    *
// //    * @param {Object} params
// //    * @param {string} params.orderId    - Référence unique (max 30 chars) = notre id_transaction
// //    * @param {number} params.amount     - Montant en FCFA (OUV en sandbox)
// //    * @param {string} params.reference  - Nom marchand affiché (max 30 chars)
// //    *
// //    * @returns {Promise<{paymentUrl, payToken, notifToken}>}
// //    *   paymentUrl → à ouvrir dans la WebView Flutter
// //    *   payToken   → à stocker pour vérification de statut
// //    *   notifToken → à comparer avec le token reçu dans le webhook
// //    */
// //   async initierPaiement({ orderId, amount, reference }) {
// //     const token = await this.getAccessToken()

// //     const body = {
// //       merchant_key: this.merchantKey,
// //       currency:     this.env === 'dev' ? 'OUV' : 'XOF', // OUV en sandbox, XOF en prod Mali
// //       order_id:     orderId.substring(0, 30),            // max 30 chars
// //       amount,
// //       return_url:   this.returnUrl,
// //       cancel_url:   this.cancelUrl,
// //       notif_url:    this.notifUrl,
// //       lang:         'fr',
// //       reference:    (reference || 'Mali Kalan').substring(0, 30),
// //     }

// //     const res = await fetch(this._webpaymentUrl, {
// //       method: 'POST',
// //       headers: {
// //         'Authorization': `Bearer ${token}`,
// //         'Accept':        'application/json',
// //         'Content-Type':  'application/json',
// //       },
// //       body: JSON.stringify(body),
// //     })

// //     const data = await res.json().catch(() => ({}))

// //     if (!res.ok || !data.payment_url) {
// //       if (res.status === 401) this._tokenCache = null
// //       throw new Error(
// //         `Orange Money — échec initialisation paiement (${res.status}): ${JSON.stringify(data)}`
// //       )
// //     }

// //     console.log(`💳 Orange Money — paiement initié (order: ${orderId})`)
// //     return {
// //       paymentUrl: data.payment_url,
// //       payToken:   data.pay_token,
// //       notifToken: data.notif_token,
// //     }
// //   }

// //   /**
// //    * Vérifie le statut d'une transaction WebPay.
// //    * Statuts possibles : INITIATED | PENDING | EXPIRED | SUCCESS | FAILED
// //    *
// //    * @param {Object} params
// //    * @param {string} params.orderId  - Notre id_transaction
// //    * @param {number} params.amount   - Montant
// //    * @param {string} params.payToken - pay_token reçu lors de l'initiation
// //    *
// //    * @returns {Promise<{status: string, txnid: string|null, raw: Object}>}
// //    */
// //   async verifierStatut({ orderId, amount, payToken }) {
// //     const token = await this.getAccessToken()

// //     const res = await fetch(this._statusUrl, {
// //       method: 'POST',
// //       headers: {
// //         'Authorization': `Bearer ${token}`,
// //         'Accept':        'application/json',
// //         'Content-Type':  'application/json',
// //       },
// //       body: JSON.stringify({
// //         order_id:  orderId,
// //         amount,
// //         pay_token: payToken,
// //       }),
// //     })

// //     const data = await res.json().catch(() => ({}))

// //     if (!res.ok) {
// //       if (res.status === 401) this._tokenCache = null
// //       throw new Error(
// //         `Orange Money — échec vérification statut (${res.status}): ${JSON.stringify(data)}`
// //       )
// //     }

// //     return {
// //       status: data.status || 'PENDING',
// //       txnid:  data.txnid  || null,
// //       raw:    data,
// //     }
// //   }

// //   /**
// //    * Valide l'authenticité d'une notification webhook Orange Money.
// //    * Compare le notif_token reçu avec celui stocké lors de l'initiation.
// //    *
// //    * @param {string} receivedNotifToken  - Token reçu dans le body du webhook
// //    * @param {string} storedNotifToken    - Token stocké en base lors de l'initiation
// //    * @returns {boolean}
// //    */
// //   validateNotification(receivedNotifToken, storedNotifToken) {
// //     if (!receivedNotifToken || !storedNotifToken) return false
// //     return receivedNotifToken === storedNotifToken
// //   }
// // }

// // module.exports = new OrangeMoneyService()














// const fetch = global.fetch || require('node-fetch')

// /**
//  * Service d'intégration Moov Money Mali (environnement de TEST).
//  *
//  * Conforme à la spec Huawei "Moov Money MM FRS - Integration with
//  * Merchant" (v1.1) + collection Postman fournie par Moov.
//  *
//  * Endpoints :
//  *   - QueryCustomerStatus                   (command-id: process-check-subscriber)
//  *   - CustomerPayOnlineMerchant              (command-id: mror-transaction-ussd)
//  *   - OnlineMerchantTransferMoneytoCustomer  (command-id: transfer-api-transaction)
//  *   - SearchTransactionByExtID               (command-id: process-check-transaction)
//  *
//  * Authentification : Authorization: Bearer <base64(username:password)>
//  * (PAS "Basic" — la doc générique parle de Basic, mais la collection
//  * Postman réellement fournie par Moov utilise bien "Bearer").
//  *
//  * Codes de statut de la réponse ("status") — tableau §3.6.1 de la spec :
//  *   "0"  = SUCCESS
//  *   "12" = FAILED
//  *   "15" = UNKNOWN (transaction encore en cours / pas trouvée)
//  *
//  * Variables d'env requises :
//  *   MOOV_MONEY_USERNAME     = SITESCOLAIRE
//  *   MOOV_MONEY_PASSWORD     = Moov@2026!
//  *   MOOV_MONEY_SHORTCODE    = 99789716   (gardé pour info/logs — la spec
//  *                                          ne le demande dans aucun body)
//  *   MOOV_MONEY_BASE_URL     = https://testbed.moovmoney.ml:38443
//  *   (en production, remplacer BASE_URL par l'URL de prod fournie par Moov)
//  */
// class MoovMoneyService {
//   constructor() {
//     this.username  = process.env.MOOV_MONEY_USERNAME
//     this.password  = process.env.MOOV_MONEY_PASSWORD
//     this.shortcode = process.env.MOOV_MONEY_SHORTCODE
//     this.baseUrl   = process.env.MOOV_MONEY_BASE_URL
//                      || 'https://testbed.moovmoney.ml:38443'
//   }

//   get _isConfigured() {
//     return !!(this.username && this.password)
//   }

//   /**
//    * Token Bearer = base64(username:password).
//    * NOTE: la spec générique dit "Basic Auth", mais la collection Postman
//    * réelle envoie ce même base64 avec le préfixe "Bearer" — c'est ce
//    * format qui fonctionne réellement contre l'API Moov.
//    */
//   _bearerToken() {
//     return Buffer.from(`${this.username}:${this.password}`).toString('base64')
//   }

//   /**
//    * Headers communs à tous les appels Moov Money.
//    * `commandId` est OBLIGATOIRE et différent par endpoint (voir spec).
//    */
//   _headers(commandId) {
//     return {
//       'Authorization': `Bearer ${this._bearerToken()}`,
//       'command-id':    commandId,
//       'Content-Type':  'application/json',
//       'Accept':        'application/json',
//     }
//   }

//   /**
//    * Normalise le statut renvoyé par Moov (toujours "0"/"12"/"15" —
//    * jamais "SUCCESS"/"FAILED" en toutes lettres, contrairement à ce
//    * que l'ancienne version de ce fichier supposait).
//    */
//   _normalizeStatus(rawStatus) {
//     if (rawStatus === '0') return 'SUCCESS'
//     if (rawStatus === '12') return 'FAILED'
//     return 'PENDING' // "15" (UNKNOWN) ou absent -> toujours en cours
//   }

//   /**
//    * Vérifie si un numéro Moov Money est actif et peut effectuer des paiements.
//    *
//    * @param {string} telephone - Numéro sans indicatif (ex: 95100553)
//    * @returns {Promise<{isActive: boolean, raw: Object}>}
//    */
//   async queryCustomerStatus(telephone) {
//     const requestId = `CHK-${Date.now()}`

//     const res = await fetch(`${this.baseUrl}/apiaccess/QueryCustomerStatus`, {
//       method: 'POST',
//       headers: this._headers('process-check-subscriber'),
//       body: JSON.stringify({
//         'request-id':   requestId,
//         'destination':  telephone,
//         'extended-data': {},
//       }),
//     })

//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) {
//       throw new Error(`Moov QueryStatus — échec (${res.status}): ${JSON.stringify(data)}`)
//     }

//     // "subscriber-details" est une STRING JSON échappée -> il faut la
//     // re-parser pour lire le statut réel du client (ACTIVE, SUSPENDED...).
//     let subscriberDetails = null
//     try {
//       const raw = data?.['extended-data']?.data?.['subscriber-details']
//       subscriberDetails = raw ? JSON.parse(raw) : null
//     } catch (_) {
//       subscriberDetails = null
//     }

//     const isActive = subscriberDetails?.status === 'ACTIVE'
//     return { isActive, subscriberDetails, raw: data }
//   }

//   /**
//    * Initie un paiement : le client paie le marchand.
//    * Moov envoie une notification USSD sur le téléphone du client
//    * pour qu'il confirme avec son code PIN.
//    *
//    * @param {Object} params
//    * @param {string} params.telephone   - Numéro Moov du client (sans indicatif, ex: 95100553)
//    * @param {number} params.amount      - Montant en FCFA
//    * @param {string} params.reference   - Référence unique de la transaction (notre id_transaction)
//    *                                      -> envoyée comme "request-id" (sert d'index pour
//    *                                      retrouver la transaction ensuite).
//    * @param {string} params.message     - Description affichée au client (sert aussi de "remarks",
//    *                                      champ obligatoire côté Moov).
//    * @returns {Promise<{status: string, transactionId: string, raw: Object}>}
//    */
//   async customerPayMerchant({ telephone, amount, reference, message }) {
//     if (!this._isConfigured) {
//       console.log(`💳 [SIMULATION Moov Money] ${telephone} → ${amount} FCFA (ref: ${reference})`)
//       return { status: 'PENDING', transactionId: reference, simulated: true }
//     }

//     const remarks = (message || 'Abonnement MaliKalan').substring(0, 60)

//     const res = await fetch(`${this.baseUrl}/apiaccess/CustomerPayOnlineMerchant`, {
//       method: 'POST',
//       headers: this._headers('mror-transaction-ussd'),
//       body: JSON.stringify({
//         'request-id':    reference,
//         'destination':   telephone,
//         'amount':        String(amount),
//         'remarks':       remarks,
//         'message':       remarks,
//         'extended-data': {},
//       }),
//     })

//     const data = await res.json().catch(() => ({}))

//     if (!res.ok) {
//       throw new Error(`Moov CustomerPay — échec (${res.status}): ${JSON.stringify(data)}`)
//     }

//     console.log(`💳 Moov Money — demande envoyée vers ${telephone} (ref: ${reference}), statut brut: ${data?.status}`)

//     return {
//       status:        this._normalizeStatus(data?.status),
//       transactionId: data?.['trans-id'] || reference,
//       raw:           data,
//     }
//   }

//   /**
//    * Vérifie le statut d'une transaction par son identifiant externe (notre id_transaction).
//    * À appeler en polling après initiation du paiement.
//    *
//    * @param {string} externalId - Notre id_transaction (le même "request-id" que celui
//    *                               passé à customerPayMerchant — c'est ce qui permet à
//    *                               Moov de retrouver la transaction).
//    * @returns {Promise<{status: string, raw: Object}>} status: 'SUCCESS' | 'FAILED' | 'PENDING'
//    */
//   async getTransactionStatus(externalId) {
//     if (!this._isConfigured) {
//       // En simulation, on retourne toujours SUCCESS pour les tests
//       return { status: 'SUCCESS', simulated: true }
//     }

//     const res = await fetch(`${this.baseUrl}/apiaccess/SearchTransactionByExtID`, {
//       method: 'POST',
//       headers: this._headers('process-check-transaction'),
//       body: JSON.stringify({
//         'request-id': externalId,
//       }),
//     })

//     const data = await res.json().catch(() => ({}))

//     if (!res.ok) {
//       throw new Error(`Moov SearchTransaction — échec (${res.status}): ${JSON.stringify(data)}`)
//     }

//     // IMPORTANT: la vraie API renvoie "status": "0" (succès), "12" (échec)
//     // ou "15" (inconnu/en attente) — jamais "SUCCESS"/"FAILED" en toutes
//     // lettres. L'ancienne version de ce fichier cherchait ces mots et ne
//     // matchait donc jamais rien -> le statut restait bloqué sur PENDING
//     // indéfiniment, même quand la transaction était déjà résolue.
//     return { status: this._normalizeStatus(data?.status), raw: data }
//   }

//   /**
//    * Remboursement : le marchand transfère de l'argent vers le client.
//    * Utile en cas d'annulation ou d'erreur après débit.
//    *
//    * @param {Object} params
//    * @param {string} params.telephone - Numéro Moov du client
//    * @param {number} params.amount    - Montant à rembourser en FCFA
//    * @param {string} params.reference - Référence unique
//    */
//   async merchantRefundCustomer({ telephone, amount, reference }) {
//     const res = await fetch(
//       `${this.baseUrl}/apiaccess/OnlineMerchantTransferMoneytoCustomer`,
//       {
//         method: 'POST',
//         headers: this._headers('transfer-api-transaction'),
//         body: JSON.stringify({
//           'request-id':    reference,
//           'destination':   telephone,
//           'amount':        String(amount),
//           'remarks':       'Remboursement Mali Kalan',
//           'extended-data': {},
//         }),
//       }
//     )

//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) {
//       throw new Error(`Moov Refund — échec (${res.status}): ${JSON.stringify(data)}`)
//     }
//     return { success: this._normalizeStatus(data?.status) === 'SUCCESS', raw: data }
//   }
// }

// //
// //

// module.exports = new MoovMoneyService()



const fetch = global.fetch || require('node-fetch')

/**
 * Service Orange Money WebPay Mali.
 *
 * Environnements :
 *   DEV/Sandbox : ORANGE_MONEY_ENV=dev
 *   Production  : ORANGE_MONEY_ENV=ml
 *
 * Flux :
 *   1. getAccessToken()   → OAuth2 → Bearer token (valide ~90j en sandbox, 1h en prod)
 *   2. initierPaiement()  → POST /webpayment → payment_url + pay_token + notif_token
 *   3. (l'utilisateur paie sur la WebView ou via le simulateur sandbox)
 *   4. orangeMoneyCallback() ou verifierStatut() → confirme le paiement
 *
 * Variables d'env requises :
 *   ORANGE_MONEY_ENV          = dev (sandbox) | ml (production Mali)
 *   ORANGE_MONEY_CLIENT_ID    = votre Client ID du portail Orange Developer
 *   ORANGE_MONEY_CLIENT_SECRET= votre Client Secret
 *   ORANGE_MONEY_MERCHANT_KEY = clé marchande générée depuis MyApps
 *   ORANGE_MONEY_RETURN_URL   = URL de retour après paiement
 *   ORANGE_MONEY_CANCEL_URL   = URL de retour si annulation
 *   ORANGE_MONEY_NOTIF_URL    = URL webhook pour la notification de statut
 *
 * Credentials de test (sandbox) :
 *   Merchant MSISDN : 7701900259  |  Agent Code : 101379  |  PIN : 3631
 *   Subscriber MSISDN : 7701100259  |  PIN : 5304  |  Balance : 1 000 000
 *   Simulateur USSD : https://mpayment.orange-money.com/mpayment-otp/login
 *     Login : 7701900259  |  MDP : MerchantWP00259
 */
class OrangeMoneyService {
  constructor() {
    this.clientId     = process.env.ORANGE_MONEY_CLIENT_ID
    this.clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET
    this.merchantKey  = process.env.ORANGE_MONEY_MERCHANT_KEY
    this.env          = process.env.ORANGE_MONEY_ENV || 'dev'
    this.returnUrl    = process.env.ORANGE_MONEY_RETURN_URL
    this.cancelUrl    = process.env.ORANGE_MONEY_CANCEL_URL
    this.notifUrl     = process.env.ORANGE_MONEY_NOTIF_URL
    this._tokenCache  = null
  }

  get _tokenUrl() {
    return 'https://api.orange.com/oauth/v3/token'
  }

  get _webpaymentUrl() {
    return `https://api.orange.com/orange-money-webpay/${this.env}/v1/webpayment`
  }

  get _statusUrl() {
    return `https://api.orange.com/orange-money-webpay/${this.env}/v1/transactionstatus`
  }

  /**
   * Récupère un access_token OAuth2.
   * En sandbox, il est valide ~90 jours. En prod, 1 heure.
   * Mis en cache pour éviter les appels inutiles.
   */
  async getAccessToken() {
    if (this._tokenCache && this._tokenCache.expires_at > Date.now()) {
      return this._tokenCache.access_token
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const res = await fetch(this._tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Accept':        'application/json',
      },
      body: 'grant_type=client_credentials',
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Orange Money — échec OAuth2 (${res.status}): ${text}`)
    }

    const data = await res.json()
    // expires_in en secondes (3600 en prod, ~7776000 en sandbox)
    const expiresIn = parseInt(data.expires_in, 10) || 3600
    this._tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (expiresIn - 60) * 1000,
    }
    console.log(`🔐 Orange Money — token renouvelé (expire dans ${Math.round(expiresIn / 3600)}h)`)
    return data.access_token
  }

  /**
   * Initie un paiement WebPay.
   *
   * @param {Object} params
   * @param {string} params.orderId    - Référence unique (max 30 chars) = notre id_transaction
   * @param {number} params.amount     - Montant en FCFA (OUV en sandbox)
   * @param {string} params.reference  - Nom marchand affiché (max 30 chars)
   *
   * @returns {Promise<{paymentUrl, payToken, notifToken}>}
   *   paymentUrl → à ouvrir dans la WebView Flutter
   *   payToken   → à stocker pour vérification de statut
   *   notifToken → à comparer avec le token reçu dans le webhook
   */
  async initierPaiement({ orderId, amount, reference }) {
    const token = await this.getAccessToken()

    const body = {
      merchant_key: this.merchantKey,
      currency:     this.env === 'dev' ? 'OUV' : 'XOF', // OUV en sandbox, XOF en prod Mali
      order_id:     orderId.substring(0, 30),            // max 30 chars
      amount,
      return_url:   this.returnUrl,
      cancel_url:   this.cancelUrl,
      notif_url:    this.notifUrl,
      lang:         'fr',
      // NOTE: Orange Money WebPay rejette les caractères accentués et les
      // tirets spéciaux (—) dans "reference" (code 24 "Invalid body field").
      // On reste donc en ASCII simple ici.
      reference:    (reference || 'Abonnement Mali Kalan').substring(0, 30),
    }

    const res = await fetch(this._webpaymentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.payment_url) {
      if (res.status === 401) this._tokenCache = null
      throw new Error(
        `Orange Money — échec initialisation paiement (${res.status}): ${JSON.stringify(data)}`
      )
    }

    console.log(`💳 Orange Money — paiement initié (order: ${orderId})`)
    return {
      paymentUrl: data.payment_url,
      payToken:   data.pay_token,
      notifToken: data.notif_token,
    }
  }

  /**
   * Vérifie le statut d'une transaction WebPay.
   * Statuts possibles : INITIATED | PENDING | EXPIRED | SUCCESS | FAILED
   *
   * @param {Object} params
   * @param {string} params.orderId  - Notre id_transaction
   * @param {number} params.amount   - Montant
   * @param {string} params.payToken - pay_token reçu lors de l'initiation
   *
   * @returns {Promise<{status: string, txnid: string|null, raw: Object}>}
   */
  async verifierStatut({ orderId, amount, payToken }) {
    const token = await this.getAccessToken()

    const res = await fetch(this._statusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        order_id:  orderId,
        amount,
        pay_token: payToken,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (res.status === 401) this._tokenCache = null
      throw new Error(
        `Orange Money — échec vérification statut (${res.status}): ${JSON.stringify(data)}`
      )
    }

    return {
      status: data.status || 'PENDING',
      txnid:  data.txnid  || null,
      raw:    data,
    }
  }

  /**
   * Valide l'authenticité d'une notification webhook Orange Money.
   * Compare le notif_token reçu avec celui stocké lors de l'initiation.
   *
   * @param {string} receivedNotifToken  - Token reçu dans le body du webhook
   * @param {string} storedNotifToken    - Token stocké en base lors de l'initiation
   * @returns {boolean}
   */
  validateNotification(receivedNotifToken, storedNotifToken) {
    if (!receivedNotifToken || !storedNotifToken) return false
    return receivedNotifToken === storedNotifToken
  }
}

module.exports = new OrangeMoneyService()