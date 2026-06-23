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