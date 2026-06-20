const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'elearning_mali',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
  // Pool settings
  max:              10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Test connection au démarrage
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message)
  } else {
    console.log('✅ PostgreSQL connecté — base:', process.env.DB_NAME)
    release()
  }
})

module.exports = pool
