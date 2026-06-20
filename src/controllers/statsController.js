const pool = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')

const getStats = asyncHandler(async (req, res) => {
  const [
    clients, abonnements, cours, tutoriels,
    ebooks, brochures, sujets,
    revenuMois, inscriptionsMois, aboParMethode
  ] = await Promise.all([
    // Total clients
    pool.query('SELECT COUNT(*) FROM client'),
    // Abonnements actifs
    pool.query(`SELECT COUNT(*) FROM abonnement WHERE statut = 'Actif' AND date_fin >= CURRENT_DATE`),
    // Cours
    pool.query('SELECT COUNT(*) FROM cours'),
    // Tutoriels
    pool.query('SELECT COUNT(*) FROM tutoriel_video'),
    // Ebooks
    pool.query('SELECT COUNT(*) FROM ebook'),
    // Brochures
    pool.query('SELECT COUNT(*) FROM brochure'),
    // Sujets
    pool.query('SELECT COUNT(*) FROM sujet_examen'),
    // Revenu ce mois
    pool.query(`
      SELECT COALESCE(SUM(montant), 0) AS total
      FROM paiement
      WHERE statut = 'Succes'
        AND date_trunc('month', date_paiement) = date_trunc('month', NOW())`),
    // Inscriptions par mois (12 derniers mois)
    pool.query(`
      SELECT TO_CHAR(date_inscription, 'Mon') AS mois,
             EXTRACT(MONTH FROM date_inscription) AS mois_num,
             COUNT(*) AS inscriptions
      FROM utilisateur
      WHERE date_inscription >= NOW() - INTERVAL '12 months'
      GROUP BY mois, mois_num
      ORDER BY mois_num`),
    // Abonnements par méthode de paiement
    pool.query(`
      SELECT
        COUNT(CASE WHEN om.id_transaction IS NOT NULL THEN 1 END) AS orange_money,
        COUNT(CASE WHEN mm.id_transaction IS NOT NULL THEN 1 END) AS moov_money
      FROM abonnement a
      LEFT JOIN orange_money om ON om.id_transaction = a.id_transaction
      LEFT JOIN moov_money   mm ON mm.id_transaction = a.id_transaction`),
  ])

  res.json({
    totalClients:       parseInt(clients.rows[0].count),
    abonnementsActifs:  parseInt(abonnements.rows[0].count),
    totalCours:         parseInt(cours.rows[0].count),
    totalTutoriels:     parseInt(tutoriels.rows[0].count),
    totalEbooks:        parseInt(ebooks.rows[0].count),
    totalBrochures:     parseInt(brochures.rows[0].count),
    totalSujets:        parseInt(sujets.rows[0].count),
    revenuMois:         parseInt(revenuMois.rows[0].total),
    inscriptionsMois:   inscriptionsMois.rows,
    abonnementsParMethode: {
      orangeMoney: parseInt(aboParMethode.rows[0].orange_money),
      moovMoney:   parseInt(aboParMethode.rows[0].moov_money),
    },
  })
})

module.exports = { getStats }
