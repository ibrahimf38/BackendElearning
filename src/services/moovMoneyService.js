const fetch = global.fetch || require('node-fetch')

/**
 * Service d'intégration Moov Money Mali.
 *
 * Flux (push USSD) :
 *   1. pushTransaction()   -> envoie une demande de paiement au numéro du client
 *   2. (le client reçoit une notification USSD sur son téléphone, confirme avec son code PIN)
 *   3. getTransactionStatus() -> on poll le statut jusqu'à confirmation (ou on attend le webhook)
 *
 * Variables d'env requises :
 *   MOOV_MONEY_API_URL         (ex: https://apimarchand.moov-africa.ml/com.tlc.merchant.api/UssdPush)
 *   MOOV_MONEY_USERNAME
 *   MOOV_MONEY_PASSWORD
 *   MOOV_MONEY_MERCHANT_NUMBER
 */
class MoovMoneyService {
  constructor() {
    this.apiUrl    = process.env.MOOV_MONEY_API_URL
    this.username  = process.env.MOOV_MONEY_USERNAME
    this.password  = process.env.MOOV_MONEY_PASSWORD
    this.merchantNumber = process.env.MOOV_MONEY_MERCHANT_NUMBER
  }

  _basicAuthHeader() {
    const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64')
    return `Basic ${basic}`
  }

  /**
   * Envoie une demande de paiement push vers le numéro du client.
   * Le client reçoit une notification USSD et doit confirmer avec son code PIN.
   *
   * @param {Object} params
   * @param {string} params.telephone   - Numéro du client (sans indicatif pays)
   * @param {number} params.amount      - Montant en FCFA
   * @param {string} params.reference   - Référence unique de la transaction
   * @param {string} params.message     - Message affiché au client
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async pushTransaction({ telephone, amount, reference, message }) {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': this._basicAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        callbackurl: process.env.MOOV_MONEY_NOTIF_URL,
        idFromClient: reference,
        amount: String(amount),
        merchant: this.merchantNumber,
        numberSubscriber: telephone,
        otp: '', // certains environnements exigent un OTP préalable — à ajuster selon la doc reçue
        purpose: message || 'Abonnement Elearning Mali',
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Moov Money — échec de la demande de paiement: ${data.message || res.status}`)
    }

    return {
      referenceId: data.referenceId || reference,
      status: data.status || 'PENDING',
      raw: data,
    }
  }

  /**
   * Vérifie le statut d'une transaction Moov Money.
   *
   * @param {string} referenceId
   * @returns {Promise<{status: string, raw: Object}>} status: 'SUCCESS' | 'FAILED' | 'PENDING'
   */
  async getTransactionStatus(referenceId) {
    const statusUrl = `${this.apiUrl}/status/${referenceId}`

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': this._basicAuthHeader(),
        'Accept': 'application/json',
      },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Moov Money — échec vérification statut: ${data.message || res.status}`)
    }

    return { status: data.status, raw: data }
  }
}

module.exports = new MoovMoneyService()
