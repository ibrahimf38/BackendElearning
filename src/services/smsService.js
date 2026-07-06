// /**
//  * Service SMS simplifié — affiche le code OTP dans le terminal.
//  *
//  * Pour brancher un vrai fournisseur SMS plus tard (Twilio, Orange SMS API...),
//  * remplacez simplement le console.log par l'appel API correspondant.
//  */
// class SmsService {
//   async envoyer(telephone, message) {
//     console.log(`📱 SMS vers ${telephone}: ${message}`)
//     return { simulated: true }
//   }
// }

// module.exports = new SmsService()


const twilio = require('twilio')

class SmsService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID
    this.authToken  = process.env.TWILIO_AUTH_TOKEN
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER

    this._client = (this.accountSid && this.authToken)
      ? twilio(this.accountSid, this.authToken)
      : null
  }

  async envoyer(telephone, message) {
    // Fallback console si Twilio non configuré (développement)
    if (!this._client || !this.fromNumber) {
      console.log(`📱 [SMS NON ENVOYÉ — Twilio non configuré] vers ${telephone}: ${message}`)
      return { simulated: true }
    }

    try {
      const result = await this._client.messages.create({
        body: message,
        from: this.fromNumber,
        to:   telephone,
      })
      console.log(`📱 SMS envoyé vers ${telephone} (sid: ${result.sid})`)
      return { simulated: false, sid: result.sid }
    } catch (err) {
      // En dev : affiche le code dans le terminal au lieu de planter
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  Twilio échoué — code en console (DEV): ${message}`)
        console.log(`📱 [DEV] SMS vers ${telephone}: ${message}`)
        return { simulated: true, reason: err.message }
      }
      console.error(`❌ Échec SMS vers ${telephone}:`, err.message)
      throw new Error(`Échec de l'envoi du SMS: ${err.message}`)
    }
  }
}

module.exports = new SmsService()



























//Orange sms api intergration

// const fetch = global.fetch || require('node-fetch')

// /**
//  * Service SMS via l'API Orange SMS Mali (Business 3.0).
//  *
//  * Flux :
//  *   1. OAuth2 : POST /oauth/v3/token → access_token
//  *   2. Envoi  : POST /smsmessaging/v1/outbound/tel:+{sender}/requests
//  *
//  * Variables d'env requises :
//  *   ORANGE_SMS_CLIENT_ID        → votre Client ID
//  *   ORANGE_SMS_CLIENT_SECRET    → votre Client Secret
//  *   ORANGE_SMS_SENDER_NUMBER    → numéro expéditeur Mali (ex: 22390000223)
//  *
//  * Documentation : https://developer.orange.com/apis/sms-ml
//  */
// class SmsService {
//   constructor() {
//     this.clientId     = process.env.ORANGE_SMS_CLIENT_ID
//     this.clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET
//     // Numéro expéditeur Orange Mali (sans + ni 00, juste les chiffres)
//     this.senderNumber = process.env.ORANGE_SMS_SENDER_NUMBER || '22390000223'
//     this._tokenCache  = null // { access_token, expires_at }
//   }

//   get _isConfigured() {
//     return !!(this.clientId && this.clientSecret)
//   }

//   /**
//    * Récupère un access_token OAuth2 (mis en cache jusqu'à expiration).
//    * L'Authorization header est le Base64 de "clientId:clientSecret"
//    * — identique au header que vous avez déjà.
//    */
//   async _getAccessToken() {
//     if (this._tokenCache && this._tokenCache.expires_at > Date.now()) {
//       return this._tokenCache.access_token
//     }

//     const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

//     const res = await fetch('https://api.orange.com/oauth/v3/token', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Basic ${basic}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'Accept': 'application/json',
//       },
//       body: 'grant_type=client_credentials',
//     })

//     if (!res.ok) {
//       const text = await res.text()
//       throw new Error(`Orange SMS — échec OAuth2 (${res.status}): ${text}`)
//     }

//     const data = await res.json()
//     this._tokenCache = {
//       access_token: data.access_token,
//       expires_at: Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000,
//     }
//     return data.access_token
//   }

//   /**
//    * Envoie un SMS via l'API Orange SMS Mali.
//    *
//    * @param {string} telephone - Numéro destinataire format E.164 (ex: +22376123456)
//    * @param {string} message   - Texte du SMS (max 160 chars)
//    */
//   async envoyer(telephone, message) {
//     // Fallback console si API non configurée (développement sans credentials)
//     if (!this._isConfigured) {
//       console.log(`📱 [SMS NON ENVOYÉ — Orange SMS non configuré] vers ${telephone}: ${message}`)
//       return { simulated: true }
//     }

//     try {
//       const token = await this._getAccessToken()

//       // L'URL encode "tel:+" comme "tel:%2B" dans l'endpoint
//       const senderEncoded = encodeURIComponent(`tel:+${this.senderNumber}`)
//       const endpoint = `https://api.orange.com/smsmessaging/v1/outbound/${senderEncoded}/requests`

//       const body = {
//         outboundSMSMessageRequest: {
//           address: `tel:${telephone}`,
//           senderAddress: `tel:+${this.senderNumber}`,
//           outboundSMSTextMessage: {
//             message,
//           },
//         },
//       }

//       const res = await fetch(endpoint, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           'Accept': 'application/json',
//         },
//         body: JSON.stringify(body),
//       })

//       if (!res.ok) {
//         const text = await res.text()
//         throw new Error(`Orange SMS — échec envoi (${res.status}): ${text}`)
//       }

//       const data = await res.json()
//       console.log(`📱 SMS Orange envoyé vers ${telephone}`)
//       return { simulated: false, data }
//     } catch (err) {
//       // En développement, fallback console pour ne pas bloquer les tests
//       if (process.env.NODE_ENV !== 'production') {
//         console.warn(`⚠️  Orange SMS indisponible — code en console (DEV): ${message}`)
//         console.log(`📱 [DEV] SMS vers ${telephone}: ${message}`)
//         return { simulated: true, reason: err.message }
//       }
//       console.error(`❌ Échec SMS Orange vers ${telephone}:`, err.message)
//       throw new Error(`Échec de l'envoi du SMS: ${err.message}`)
//     }
//   }
// }

// module.exports = new SmsService()




























// const fetch = global.fetch || require('node-fetch')

// /**
//  * Service SMS via l'API Orange SMS Mali.
//  *
//  * Documentation : https://developer.orange.com/apis/sms-ml
//  *
//  * Flux :
//  *   1. OAuth2 : POST /oauth/v3/token → access_token (valide 1h, mis en cache)
//  *   2. Envoi  : POST /smsmessaging/v1/outbound/tel%3A%2B2230000/requests
//  *
//  * Variables d'env requises :
//  *   ORANGE_SMS_CLIENT_ID        → ID client du portail Orange Developer
//  *   ORANGE_SMS_CLIENT_SECRET    → Secret client
//  *   ORANGE_SMS_AUTH_HEADER      → (optionnel) header Basic précalculé fourni par Orange
//  *   ORANGE_SMS_SENDER_NAME      → (optionnel) nom d'expéditeur validé par Orange Mali
//  *                                  ex: "ElearningML" (max 11 caractères alphanumériques)
//  *
//  * Numéro expéditeur Mali (fixe selon doc Orange) : +2230000
//  */
// class SmsService {
//   constructor() {
//     this.clientId     = process.env.ORANGE_SMS_CLIENT_ID
//     this.clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET
//     // Header Basic précalculé fourni par Orange — prioritaire sur clientId/clientSecret
//     this.authHeader   = process.env.ORANGE_SMS_AUTH_HEADER
//     // Nom d'expéditeur personnalisé (doit être approuvé par Orange Mali)
//     this.senderName   = process.env.ORANGE_SMS_SENDER_NAME || null
//     // Numéro expéditeur Mali selon documentation officielle Orange
//     this.senderNumber = '2230000'
//     this._tokenCache  = null // { access_token, expires_at }
//   }

//   get _isConfigured() {
//     return !!(this.authHeader || (this.clientId && this.clientSecret))
//   }

//   /**
//    * Génère le header Basic pour l'authentification OAuth2.
//    * Utilise ORANGE_SMS_AUTH_HEADER si fourni (déjà Base64),
//    * sinon encode clientId:clientSecret en Base64.
//    */
//   _getBasicAuth() {
//     if (this.authHeader) {
//       // Si le header fourni commence déjà par "Basic ", on le retourne tel quel
//       return this.authHeader.startsWith('Basic ')
//         ? this.authHeader
//         : `Basic ${this.authHeader}`
//     }
//     return `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
//   }

//   /**
//    * Récupère un access_token OAuth2 (mis en cache jusqu'à expiration).
//    * Renouvelle automatiquement si le token est expiré (erreur 401).
//    */
//   async _getAccessToken() {
//     if (this._tokenCache && this._tokenCache.expires_at > Date.now()) {
//       return this._tokenCache.access_token
//     }

//     const res = await fetch('https://api.orange.com/oauth/v3/token', {
//       method: 'POST',
//       headers: {
//         'Authorization': this._getBasicAuth(),
//         'Content-Type':  'application/x-www-form-urlencoded',
//         'Accept':        'application/json',
//       },
//       body: 'grant_type=client_credentials',
//     })

//     if (!res.ok) {
//       const text = await res.text()
//       throw new Error(`Orange SMS — échec OAuth2 (${res.status}): ${text}`)
//     }

//     const data = await res.json()
//     // expires_in = 3600 secondes, on garde une marge de sécurité de 60s
//     this._tokenCache = {
//       access_token: data.access_token,
//       expires_at: Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000,
//     }
//     console.log('🔐 Orange SMS — token OAuth2 renouvelé')
//     return data.access_token
//   }

//   /**
//    * Envoie un SMS via l'API Orange SMS Mali.
//    *
//    * @param {string} telephone - Numéro destinataire format E.164 (ex: +22376123456)
//    * @param {string} message   - Texte du SMS (max 160 chars recommandé)
//    */
//   async envoyer(telephone, message) {
//     // Fallback console si credentials non configurés (développement)
//     if (!this._isConfigured) {
//       console.log(`📱 [SMS NON ENVOYÉ — Orange SMS non configuré] vers ${telephone}: ${message}`)
//       return { simulated: true }
//     }

//     try {
//       const token = await this._getAccessToken()

//       // L'endpoint encode "tel:+" en "tel%3A%2B" dans l'URL
//       const senderEncoded = `tel%3A%2B${this.senderNumber}`
//       const endpoint = `https://api.orange.com/smsmessaging/v1/outbound/${senderEncoded}/requests`

//       // Corps de la requête — avec ou sans senderName personnalisé
//       const requestBody = {
//         outboundSMSMessageRequest: {
//           address:       `tel:${telephone}`,
//           senderAddress: `tel:+${this.senderNumber}`,
//           outboundSMSTextMessage: { message },
//           // Ajoute le senderName uniquement s'il est configuré et validé par Orange
//           ...(this.senderName && { senderName: this.senderName }),
//         },
//       }

//       const res = await fetch(endpoint, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type':  'application/json',
//           'Accept':        'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       })

//       const data = await res.json().catch(() => ({}))

//       if (!res.ok) {
//         // Si token expiré, vider le cache pour forcer le renouvellement au prochain appel
//         if (res.status === 401) this._tokenCache = null
//         throw new Error(`Orange SMS — échec envoi (${res.status}): ${JSON.stringify(data)}`)
//       }

//       const resourceId = data?.outboundSMSMessageRequest?.resourceURL?.split('/').pop()
//       console.log(`📱 SMS Orange envoyé vers ${telephone} (id: ${resourceId || 'N/A'})`)
//       return { simulated: false, resourceId, data }

//     } catch (err) {
//       // En développement : affiche le code dans le terminal au lieu de planter
//       if (process.env.NODE_ENV !== 'production') {
//         console.warn(`⚠️  Orange SMS indisponible — code en console (DEV): ${message}`)
//         console.log(`📱 [DEV] SMS vers ${telephone}: ${message}`)
//         return { simulated: true, reason: err.message }
//       }
//       console.error(`❌ Échec SMS Orange vers ${telephone}:`, err.message)
//       throw new Error(`Échec de l'envoi du SMS: ${err.message}`)
//     }
//   }
// }

// module.exports = new SmsService()