require('dotenv').config()

const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const rateLimit  = require('express-rate-limit')
const routes     = require('./routes/index')
const { errorHandler, notFound } = require('./middleware/errorHandler')

const app  = express()
const PORT = process.env.PORT || 3000

// ── Trust proxy (Railway / Vercel / Render utilisent des reverse proxies) ──
// Sans ça, express-rate-limit plante sur les plateformes cloud.
app.set('trust proxy', 1)

// ── Sécurité ──────────────────────────────────────────────────
app.use(helmet())

app.use(cors({
  origin: [
    'http://localhost:5173', // Admin React (dev)
    'http://localhost:3001',
    process.env.ADMIN_URL,   // Admin en production
  ].filter(Boolean),
  credentials: true,
}))

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { message: 'Trop de requêtes, réessayez dans 15 minutes' },
}))

// Rate limiting strict pour auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Trop de tentatives de connexion' },
})
app.use('/api/auth', authLimiter)

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Routes ────────────────────────────────────────────────────
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV,
}))

// ── Erreurs ───────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)
//____________________
//____________________
// ── Démarrage ─────────────────────────────────────────────────
//____________________
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`)
  console.log(`📱 Accessible sur le réseau via http://<votre-IP>:${PORT}`)
  console.log(`📋 Environnement: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app