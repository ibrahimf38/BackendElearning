/**
 * Wrapper pour éviter les try/catch répétitifs dans les controllers.
 * Utilisation : router.get('/', asyncHandler(monController))
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Middleware global de gestion d'erreurs.
 * À placer EN DERNIER dans app.js.
 */
function errorHandler(err, req, res, next) {
  console.error('❌ Erreur:', err.message)

  // Erreur multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Fichier trop volumineux' })
  }
  if (err.message?.includes('Type de fichier non autorisé')) {
    return res.status(415).json({ message: err.message })
  }

  // Erreur PostgreSQL
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ message: 'Cette valeur existe déjà' })
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(400).json({ message: 'Référence invalide' })
  }
  if (err.code === '23502') { // not_null_violation
    return res.status(400).json({ message: `Champ obligatoire manquant: ${err.column}` })
  }

  const status = err.status || err.statusCode || 500
  res.status(status).json({
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

/**
 * Middleware 404.
 */
function notFound(req, res) {
  res.status(404).json({ message: `Route introuvable: ${req.method} ${req.path}` })
}

module.exports = { asyncHandler, errorHandler, notFound }
