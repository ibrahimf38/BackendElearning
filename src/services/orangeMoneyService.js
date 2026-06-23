const fetch = global.fetch || require('node-fetch')

/**
 * Service d'intégration Orange Money Web Payment (WebPay).
 *
 * Flux :
 *   1. getAccessToken()      -> OAuth2 client_credentials, donne un Bearer token
 *   2. initierPaiement()     -> POST /webpayment, retourne payment_url + pay_token
 *   3. (utilisateur paie sur la page Orange via WebView)
 *   4. Orange notifie via notif_url (webhook) OU on vérifie via verifierStatut()
 *
 * Documentation : https://developer.orange.com/apis/om-webpay
 *
 * Variables d'env requises :
 *   ORANGE_MONEY_CLIENT_ID
 *   ORANGE_MONEY_CLIENT_SECRET
 *   ORANGE_MONEY_MERCHANT_KEY
 *   ORANGE_MONEY_AUTH_HEADER      (header Basic fourni par Orange, alternative à client_id/secret)
 *   ORANGE_MONEY_ENV              ('dev' pour sandbox, 'ml' pour production Mali)
 *   ORANGE_MONEY_RETURN_URL
 *   ORANGE_MONEY_CANCEL_URL
 *   ORANGE_MONEY_NOTIF_URL
 */
class OrangeMoneyService {
  constructor() {
    this.clientId     = process.env.ORANGE_MONEY_CLIENT_ID
    this.clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET
    this.authHeader   = process.env.ORANGE_MONEY_AUTH_HEADER // optionnel, fourni par Orange
    this.merchantKey  = process.env.ORANGE_MONEY_MERCHANT_KEY
    this.env          = process.env.ORANGE_MONEY_ENV || 'dev' // 'dev' = sandbox, 'ml' = prod Mali
    this.returnUrl    = process.env.ORANGE_MONEY_RETURN_URL
    this.cancelUrl    = process.env.ORANGE_MONEY_CANCEL_URL
    this.notifUrl     = process.env.ORANGE_MONEY_NOTIF_URL

    this._tokenCache = null // { access_token, expires_at }
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
   * Récupère un access_token OAuth2 (mis en cache jusqu'à expiration).
   */
  async getAccessToken() {
    if (this._tokenCache && this._tokenCache.expires_at > Date.now()) {
      return this._tokenCache.access_token
    }

    const basicAuth = this.authHeader
      || Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const res = await fetch(this._tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials',
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Orange Money — échec authentification OAuth2 (${res.status}): ${text}`)
    }

    const data = await res.json()
    // expires_in est en secondes — on garde une marge de sécurité de 60s
    this._tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000,
    }
    return data.access_token
  }

  /**
   * Initie un paiement WebPay.
   *
   * @param {Object} params
   * @param {string} params.orderId     - Référence unique de la commande (id_transaction)
   * @param {number} params.amount      - Montant en FCFA
   * @param {string} params.reference   - Texte affiché sur la page de paiement
   * @returns {Promise<{payment_url: string, pay_token: string, notif_token: string}>}
   */
  async initierPaiement({ orderId, amount, reference }) {
    const token = await this.getAccessToken()

    const body = {
      merchant_key: this.merchantKey,
      currency: 'OUV', // devise Orange Money WebPay (Ouverture/XOF selon doc)
      order_id: orderId,
      amount,
      return_url: this.returnUrl,
      cancel_url: this.cancelUrl,
      notif_url: this.notifUrl,
      lang: 'fr',
      reference: reference || 'Elearning Mali — Abonnement',
    }

    const res = await fetch(this._webpaymentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.payment_url) {
      throw new Error(
        `Orange Money — échec initialisation du paiement: ${data.message || res.status}`
      )
    }

    return {
      paymentUrl: data.payment_url,
      payToken: data.pay_token,
      notifToken: data.notif_token,
    }
  }

  /**
   * Vérifie le statut d'une transaction WebPay déjà initiée.
   *
   * @param {Object} params
   * @param {string} params.orderId
   * @param {number} params.amount
   * @param {string} params.payToken
   * @returns {Promise<{status: string, raw: Object}>} status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED'
   */
  async verifierStatut({ orderId, amount, payToken }) {
    const token = await this.getAccessToken()

    const res = await fetch(this._statusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        amount,
        pay_token: payToken,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Orange Money — échec vérification statut: ${data.message || res.status}`)
    }

    return { status: data.status, raw: data }
  }
}

module.exports = new OrangeMoneyService()
