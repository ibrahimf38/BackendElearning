// const fetch = global.fetch || require('node-fetch')

// /**
//  * Service d'intégration Moov Money Mali.
//  *
//  * Flux (push USSD) :
//  *   1. pushTransaction()   -> envoie une demande de paiement au numéro du client
//  *   2. (le client reçoit une notification USSD sur son téléphone, confirme avec son code PIN)
//  *   3. getTransactionStatus() -> on poll le statut jusqu'à confirmation (ou on attend le webhook)
//  *
//  * Variables d'env requises :
//  *   MOOV_MONEY_API_URL         (ex: https://apimarchand.moov-africa.ml/com.tlc.merchant.api/UssdPush)
//  *   MOOV_MONEY_USERNAME
//  *   MOOV_MONEY_PASSWORD
//  *   MOOV_MONEY_MERCHANT_NUMBER
//  */
// class MoovMoneyService {
//   constructor() {
//     this.apiUrl    = process.env.MOOV_MONEY_API_URL
//     this.username  = process.env.MOOV_MONEY_USERNAME
//     this.password  = process.env.MOOV_MONEY_PASSWORD
//     this.merchantNumber = process.env.MOOV_MONEY_MERCHANT_NUMBER
//   }

//   _basicAuthHeader() {
//     const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64')
//     return `Basic ${basic}`
//   }

//   /**
//    * Envoie une demande de paiement push vers le numéro du client.
//    * Le client reçoit une notification USSD et doit confirmer avec son code PIN.
//    *
//    * @param {Object} params
//    * @param {string} params.telephone   - Numéro du client (sans indicatif pays)
//    * @param {number} params.amount      - Montant en FCFA
//    * @param {string} params.reference   - Référence unique de la transaction
//    * @param {string} params.message     - Message affiché au client
//    * @returns {Promise<{referenceId: string, status: string}>}
//    */
//   async pushTransaction({ telephone, amount, reference, message }) {
//     const res = await fetch(this.apiUrl, {
//       method: 'POST',
//       headers: {
//         'Authorization': this._basicAuthHeader(),
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//       },
//       body: JSON.stringify({
//         callbackurl: process.env.MOOV_MONEY_NOTIF_URL,
//         idFromClient: reference,
//         amount: String(amount),
//         merchant: this.merchantNumber,
//         numberSubscriber: telephone,
//         otp: '', // certains environnements exigent un OTP préalable — à ajuster selon la doc reçue
//         purpose: message || 'Abonnement Elearning Mali',
//       }),
//     })

//     const data = await res.json().catch(() => ({}))

//     if (!res.ok) {
//       throw new Error(`Moov Money — échec de la demande de paiement: ${data.message || res.status}`)
//     }

//     return {
//       referenceId: data.referenceId || reference,
//       status: data.status || 'PENDING',
//       raw: data,
//     }
//   }

//   /**
//    * Vérifie le statut d'une transaction Moov Money.
//    *
//    * @param {string} referenceId
//    * @returns {Promise<{status: string, raw: Object}>} status: 'SUCCESS' | 'FAILED' | 'PENDING'
//    */
//   async getTransactionStatus(referenceId) {
//     const statusUrl = `${this.apiUrl}/status/${referenceId}`

//     const res = await fetch(statusUrl, {
//       method: 'GET',
//       headers: {
//         'Authorization': this._basicAuthHeader(),
//         'Accept': 'application/json',
//       },
//     })

//     const data = await res.json().catch(() => ({}))

//     if (!res.ok) {
//       throw new Error(`Moov Money — échec vérification statut: ${data.message || res.status}`)
//     }

//     return { status: data.status, raw: data }
//   }
// }

// module.exports = new MoovMoneyService()




const fetch = global.fetch || require('node-fetch')

/**
 * Service d'intégration Moov Money Mali (environnement de TEST).
 *
 * Endpoints fournis par Moov Mali :
 *   - QueryCustomerStatus          → vérifier si le client est actif
 *   - CustomerPayOnlineMerchant    → le client paie le marchand (flux principal OTP)
 *   - OnlineMerchantTransferMoneytoCustomer → remboursement marchand → client
 *   - SearchTransactionByExtID     → vérifier le statut d'une transaction
 *
 * Variables d'env requises :
 *   MOOV_MONEY_USERNAME     = SITESCOLAIRE
 *   MOOV_MONEY_PASSWORD     = Moov@2026!
 *   MOOV_MONEY_SHORTCODE    = 99789716
 *   MOOV_MONEY_BASE_URL     = https://testbed.moovmoney.ml:38443
 *   (en production, remplacer BASE_URL par l'URL de prod fournie par Moov)
 */
class MoovMoneyService {
  constructor() {
    this.username  = process.env.MOOV_MONEY_USERNAME
    this.password  = process.env.MOOV_MONEY_PASSWORD
    this.shortcode = process.env.MOOV_MONEY_SHORTCODE
    this.baseUrl   = process.env.MOOV_MONEY_BASE_URL
                     || 'https://testbed.moovmoney.ml:38443'
  }

  get _isConfigured() {
    return !!(this.username && this.password && this.shortcode)
  }

  /**
   * Header Authorization Basic (username:password en Base64).
   */
  _basicAuth() {
    return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
  }

  /**
   * Headers communs à tous les appels Moov Money.
   */
  _headers() {
    return {
      'Authorization': this._basicAuth(),
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    }
  }

  /**
   * Vérifie si un numéro Moov Money est actif et peut effectuer des paiements.
   *
   * @param {string} telephone - Numéro sans indicatif (ex: 69123456)
   * @returns {Promise<{isActive: boolean, raw: Object}>}
   */
  async queryCustomerStatus(telephone) {
    const res = await fetch(`${this.baseUrl}/apiaccess/QueryCustomerStatus`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        msisdn: telephone,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Moov QueryStatus — échec (${res.status}): ${JSON.stringify(data)}`)
    }

    // La réponse Moov contient généralement un status code interne
    const isActive = data?.status === '200' || data?.responseCode === '0'
                     || data?.customerStatus === 'ACTIVE'
    return { isActive, raw: data }
  }

  /**
   * Initie un paiement : le client paie le marchand.
   * Moov envoie une notification USSD sur le téléphone du client
   * pour qu'il confirme avec son code PIN.
   *
   * @param {Object} params
   * @param {string} params.telephone   - Numéro Moov du client (sans indicatif, ex: 69123456)
   * @param {number} params.amount      - Montant en FCFA
   * @param {string} params.reference   - Référence unique de la transaction (notre id_transaction)
   * @param {string} params.message     - Description affichée au client
   * @returns {Promise<{status: string, transactionId: string, raw: Object}>}
   */
  async customerPayMerchant({ telephone, amount, reference, message }) {
    if (!this._isConfigured) {
      console.log(`💳 [SIMULATION Moov Money] ${telephone} → ${amount} FCFA (ref: ${reference})`)
      return { status: 'PENDING', transactionId: reference, simulated: true }
    }

    const res = await fetch(`${this.baseUrl}/apiaccess/CustomerPayOnlineMerchant`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        msisdn:      telephone,
        amount:      String(amount),
        shortCode:   this.shortcode,
        externalId:  reference,
        message:     message || 'Abonnement Elearning Mali',
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Moov CustomerPay — échec (${res.status}): ${JSON.stringify(data)}`)
    }

    // Normalise le statut retourné
    const rawStatus  = data?.status || data?.responseCode || data?.transactionStatus || ''
    const isPending  = rawStatus === '200' || rawStatus === '0' || rawStatus === 'PENDING'
    const isSuccess  = rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED'

    console.log(`💳 Moov Money — demande envoyée vers ${telephone} (ref: ${reference})`)

    return {
      status:        isSuccess ? 'SUCCESS' : isPending ? 'PENDING' : 'FAILED',
      transactionId: data?.transactionId || data?.externalId || reference,
      raw:           data,
    }
  }

  /**
   * Vérifie le statut d'une transaction par son identifiant externe (notre id_transaction).
   * À appeler en polling après initiation du paiement.
   *
   * @param {string} externalId - Notre id_transaction (référence passée à customerPayMerchant)
   * @returns {Promise<{status: string, raw: Object}>} status: 'SUCCESS' | 'FAILED' | 'PENDING'
   */
  async getTransactionStatus(externalId) {
    if (!this._isConfigured) {
      // En simulation, on retourne toujours SUCCESS pour les tests
      return { status: 'SUCCESS', simulated: true }
    }

    const res = await fetch(`${this.baseUrl}/apiaccess/SearchTransactionByExtID`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        externalId,
        shortCode: this.shortcode,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Moov SearchTransaction — échec (${res.status}): ${JSON.stringify(data)}`)
    }

    const rawStatus = data?.status || data?.transactionStatus || data?.responseCode || ''

    let status = 'PENDING'
    if (['SUCCESS', 'COMPLETED', 'TS'].includes(rawStatus)) status = 'SUCCESS'
    else if (['FAILED', 'ERROR', 'TF', 'REJECTED'].includes(rawStatus)) status = 'FAILED'

    return { status, raw: data }
  }

  /**
   * Remboursement : le marchand transfère de l'argent vers le client.
   * Utile en cas d'annulation ou d'erreur après débit.
   *
   * @param {Object} params
   * @param {string} params.telephone - Numéro Moov du client
   * @param {number} params.amount    - Montant à rembourser en FCFA
   * @param {string} params.reference - Référence unique
   */
  async merchantRefundCustomer({ telephone, amount, reference }) {
    const res = await fetch(
      `${this.baseUrl}/apiaccess/OnlineMerchantTransferMoneytoCustomer`,
      {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          msisdn:     telephone,
          amount:     String(amount),
          shortCode:  this.shortcode,
          externalId: reference,
          message:    'Remboursement Elearning Mali',
        }),
      }
    )

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Moov Refund — échec (${res.status}): ${JSON.stringify(data)}`)
    }
    return { success: true, raw: data }
  }
}

module.exports = new MoovMoneyService()