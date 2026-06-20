const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const multer        = require('multer')
const multerS3      = require('multer-s3')

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET || 'elearning-mali-content'
const SIGNED_URL_EXPIRES_SECONDS = parseInt(process.env.S3_SIGNED_URL_EXPIRES) || 3600 // 1h

/**
 * Crée un middleware multer-S3 pour un dossier donné.
 *
 * @param {string} folder       - Sous-dossier S3 (ex: 'cours', 'tutoriels')
 * @param {RegExp} mimeFilter   - Regex des MIME types acceptés
 * @param {number} maxSizeMB    - Taille max en MB
 */
function createUploader(folder, mimeFilter, maxSizeMB = 50) {
  return multer({
    storage: multerS3({
      s3,
      bucket: BUCKET,
      // Pas de ACL public — accès via URL signée uniquement (lecture seule)
      key: (req, file, cb) => {
        const ext      = file.originalname.split('.').pop().toLowerCase()
        const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        cb(null, filename)
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (mimeFilter.test(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error(`Type de fichier non autorisé. Attendu: ${mimeFilter}`), false)
      }
    },
  })
}

// Uploaders spécialisés par type de contenu
const uploadPDF   = createUploader('pdfs',      /pdf$/i,               20)
const uploadVideo = createUploader('tutoriels',  /mp4|webm|ogg/i,      500)
const uploadImage = createUploader('images',     /jpeg|jpg|png|webp/i,  5)

/**
 * Supprime un fichier S3 à partir de son URL complète ou de sa clé.
 */
async function deleteFromS3(urlOrKey) {
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
  let key = urlOrKey
  if (urlOrKey.startsWith('http')) {
    // Extraire la clé depuis l'URL : https://bucket.s3.region.amazonaws.com/KEY
    const url = new URL(urlOrKey)
    key = url.pathname.slice(1) // retire le '/' initial
  }
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Extrait la clé S3 depuis une URL complète (ou retourne tel quel si déjà une clé).
 */
function extractKey(urlOrKey) {
  if (!urlOrKey.startsWith('http')) return urlOrKey
  const url = new URL(urlOrKey)
  return decodeURIComponent(url.pathname.slice(1))
}

/**
 * Génère une URL signée temporaire (lecture seule) pour un fichier S3.
 * L'URL expire après SIGNED_URL_EXPIRES_SECONDS (1h par défaut).
 *
 * @param {string} urlOrKey - URL S3 brute stockée en BDD, ou clé directe
 * @returns {Promise<string>} URL signée temporaire
 */
async function signUrl(urlOrKey) {
  const key = extractKey(urlOrKey)
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_EXPIRES_SECONDS })
}

/**
 * Signe l'URL d'un seul champ d'un objet (mutation en place + retour).
 * Pratique pour les contrôleurs : signUrlField(cours, 'url_fichier')
 */
async function signUrlField(obj, field) {
  if (obj && obj[field]) {
    obj[field] = await signUrl(obj[field])
  }
  return obj
}

/**
 * Signe le même champ sur une liste d'objets, en parallèle.
 */
async function signUrlFieldList(list, field) {
  return Promise.all(list.map((obj) => signUrlField(obj, field)))
}

module.exports = {
  s3, BUCKET, uploadPDF, uploadVideo, uploadImage,
  deleteFromS3, signUrl, signUrlField, signUrlFieldList,
}