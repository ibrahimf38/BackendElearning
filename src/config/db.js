const { Pool } = require('pg')

const isRailway = process.env.DATABASE_URL?.includes('railway')

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isRailway ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'elearning_mali',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl:      false,
    }

const pool = new Pool({
  ...connectionConfig,
  max:               10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message)
  } else {
    console.log('✅ PostgreSQL connecté')
    release()
  }
})

module.exports = pool