// const express = require('express')
// const router  = express.Router()

// const { authMiddleware, adminMiddleware, abonnementActifMiddleware, adminOrAbonneMiddleware } = require('../middleware/auth')
// const { uploadPDF, uploadVideo } = require('../config/s3')

// // Controllers
// const auth    = require('../controllers/authController')
// const filtre  = require('../controllers/filtreController')
// const contenu = require('../controllers/contenuController')
// const paie    = require('../controllers/paiementController')
// const users   = require('../controllers/usersController')
// const stats   = require('../controllers/statsController')

// // ══════════════════════════════════════════════════════════════
// // AUTH
// // ══════════════════════════════════════════════════════════════
// router.post('/auth/register',          auth.register)
// router.post('/auth/login',             auth.login)
// router.post('/auth/verify-otp',        auth.verifyOtp)
// router.post('/auth/resend-otp',        auth.resendOtp)
// router.post('/auth/admin/login',       auth.adminLogin)

// // ══════════════════════════════════════════════════════════════
// // FILTRAGE — Domaines / Niveaux / Matières (PUBLIC lecture)
// // ══════════════════════════════════════════════════════════════
// router.get('/domaines',                           filtre.getDomaines)
// router.get('/domaines/:idDomaine/niveaux',        filtre.getNiveauxByDomaine)
// router.get('/niveaux/:idNiveau/matieres',         filtre.getMatieresByNiveau)
// router.get('/domaines/:idDomaine/matieres-tutoriels', filtre.getMatieresByDomaineTutoriel)

// // CRUD admin seulement
// router.post  ('/domaines',            authMiddleware, adminMiddleware, filtre.createDomaine)
// router.put   ('/domaines/:id',        authMiddleware, adminMiddleware, filtre.updateDomaine)
// router.delete('/domaines/:id',        authMiddleware, adminMiddleware, filtre.deleteDomaine)

// router.post  ('/domaines/:idDomaine/niveaux',     authMiddleware, adminMiddleware, filtre.createNiveau)
// router.put   ('/niveaux/:id',         authMiddleware, adminMiddleware, filtre.updateNiveau)
// router.delete('/niveaux/:id',         authMiddleware, adminMiddleware, filtre.deleteNiveau)

// router.post  ('/niveaux/:idNiveau/matieres',      authMiddleware, adminMiddleware, filtre.createMatiere)
// router.put   ('/matieres/:id',        authMiddleware, adminMiddleware, filtre.updateMatiere)
// router.delete('/matieres/:id',        authMiddleware, adminMiddleware, filtre.deleteMatiere)

// router.post  ('/domaines/tutoriels/link', authMiddleware, adminMiddleware, filtre.addDomaineTutorielLink)

// // ══════════════════════════════════════════════════════════════
// // COURS
// // ══════════════════════════════════════════════════════════════
// // Route admin — liste tous les cours (sans filtre abonnement)
// router.get   ('/cours',                     authMiddleware, adminMiddleware, contenu.getAllCours)
// router.get   ('/matieres/:idMatiere/cours', authMiddleware, abonnementActifMiddleware, contenu.getCoursByMatiere)
// router.post  ('/cours',                     authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createCours)
// router.put   ('/cours/:id',                 authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.updateCours)
// router.delete('/cours/:id',                 authMiddleware, adminMiddleware, contenu.deleteCours)

// // ══════════════════════════════════════════════════════════════
// // TUTORIELS VIDÉO
// // ══════════════════════════════════════════════════════════════
// router.get   ('/tutoriels',                    authMiddleware, adminOrAbonneMiddleware, contenu.getTutoriels)
// router.get   ('/matieres/:idMatiere/tutoriels', authMiddleware, abonnementActifMiddleware, contenu.getTutosByMatiere)
// router.post  ('/tutoriels',                    authMiddleware, adminMiddleware, uploadVideo.single('fichier'), contenu.createTutoriel)
// router.delete('/tutoriels/:id',                authMiddleware, adminMiddleware, contenu.deleteTutoriel)

// // ══════════════════════════════════════════════════════════════
// // EBOOKS / BROCHURES / SUJETS
// // ══════════════════════════════════════════════════════════════
// router.get   ('/ebooks',        authMiddleware, adminOrAbonneMiddleware, contenu.getEbooks)
// router.post  ('/ebooks',        authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createEbook)
// router.delete('/ebooks/:id',    authMiddleware, adminMiddleware, contenu.deleteEbook)

// router.get   ('/brochures',     authMiddleware, adminOrAbonneMiddleware, contenu.getBrochures)
// router.post  ('/brochures',     authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createBrochure)
// router.delete('/brochures/:id', authMiddleware, adminMiddleware, contenu.deleteBrochure)

// router.get   ('/sujets-examen', authMiddleware, adminOrAbonneMiddleware, contenu.getSujets)
// router.post  ('/sujets-examen', authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createSujet)
// router.delete('/sujets-examen/:id', authMiddleware, adminMiddleware, contenu.deleteSujet)

// // ══════════════════════════════════════════════════════════════
// // PAIEMENT & ABONNEMENT
// // ══════════════════════════════════════════════════════════════
// router.post('/paiements/orange-money',          authMiddleware, paie.payerOrangeMoney)
// router.post('/paiements/moov-money',            authMiddleware, paie.payerMoovMoney)
// router.get ('/paiements/:idTransaction/statut', authMiddleware, paie.verifierStatutPaiement)
// router.get ('/abonnements',                     authMiddleware, paie.getHistoriqueAbonnements)
// router.get ('/admin/abonnements',               authMiddleware, adminMiddleware, paie.getAllAbonnements)

// // Webhooks fournisseurs — PAS de authMiddleware (Orange/Moov n'ont pas de JWT client).
// // Sécurisés autrement : vérification de signature/IP à ajouter en production
// // selon ce que fournit chaque opérateur.
// router.post('/paiements/orange-money/callback', paie.orangeMoneyCallback)
// router.post('/paiements/moov-money/callback',   paie.moovMoneyCallback)

// // ══════════════════════════════════════════════════════════════
// // USERS & STATS (admin)
// // ══════════════════════════════════════════════════════════════
// router.get ('/admin/users',       authMiddleware, adminMiddleware, users.getAllUsers)
// router.get ('/admin/users/:id',   authMiddleware, adminMiddleware, users.getUserById)
// router.patch('/admin/users/:id/toggle', authMiddleware, adminMiddleware, users.toggleUserActive)
// router.get ('/stats',             authMiddleware, adminMiddleware, stats.getStats)

// module.exports = router





const express = require('express')
const router  = express.Router()

const { authMiddleware, adminMiddleware, abonnementActifMiddleware, adminOrAbonneMiddleware } = require('../middleware/auth')
const { uploadPDF, uploadVideo } = require('../config/s3')

// Controllers
const auth    = require('../controllers/authController')
const filtre  = require('../controllers/filtreController')
const contenu = require('../controllers/contenuController')
const paie    = require('../controllers/paiementController')
const users   = require('../controllers/usersController')
const stats   = require('../controllers/statsController')

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
router.post('/auth/register',          auth.register)
router.post('/auth/login',             auth.login)
router.post('/auth/verify-otp',        auth.verifyOtp)
router.post('/auth/resend-otp',        auth.resendOtp)
router.post('/auth/admin/login',       auth.adminLogin)

// ══════════════════════════════════════════════════════════════
// FILTRAGE — Domaines / Niveaux / Matières (PUBLIC lecture)
// ══════════════════════════════════════════════════════════════
router.get('/domaines',                           filtre.getDomaines)
router.get('/domaines/:idDomaine/niveaux',        filtre.getNiveauxByDomaine)
router.get('/niveaux/:idNiveau/matieres',         filtre.getMatieresByNiveau)
router.get('/domaines/:idDomaine/matieres-tutoriels', filtre.getMatieresByDomaineTutoriel)

// CRUD admin seulement
router.post  ('/domaines',            authMiddleware, adminMiddleware, filtre.createDomaine)
router.put   ('/domaines/:id',        authMiddleware, adminMiddleware, filtre.updateDomaine)
router.delete('/domaines/:id',        authMiddleware, adminMiddleware, filtre.deleteDomaine)

router.post  ('/domaines/:idDomaine/niveaux',     authMiddleware, adminMiddleware, filtre.createNiveau)
router.put   ('/niveaux/:id',         authMiddleware, adminMiddleware, filtre.updateNiveau)
router.delete('/niveaux/:id',         authMiddleware, adminMiddleware, filtre.deleteNiveau)

router.post  ('/niveaux/:idNiveau/matieres',      authMiddleware, adminMiddleware, filtre.createMatiere)
router.put   ('/matieres/:id',        authMiddleware, adminMiddleware, filtre.updateMatiere)
router.delete('/matieres/:id',        authMiddleware, adminMiddleware, filtre.deleteMatiere)

router.post  ('/domaines/tutoriels/link', authMiddleware, adminMiddleware, filtre.addDomaineTutorielLink)

// ══════════════════════════════════════════════════════════════
// COURS
// ══════════════════════════════════════════════════════════════
router.get   ('/cours',                     authMiddleware, adminMiddleware, contenu.getAllCours)
router.get   ('/matieres/:idMatiere/cours', authMiddleware, contenu.getCoursByMatiere)
router.post  ('/cours',                     authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createCours)
router.put   ('/cours/:id',                 authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.updateCours)
router.delete('/cours/:id',                 authMiddleware, adminMiddleware, contenu.deleteCours)

// ══════════════════════════════════════════════════════════════
// TUTORIELS VIDÉO
// ══════════════════════════════════════════════════════════════
router.get   ('/tutoriels',                    authMiddleware, contenu.getTutoriels)
router.get   ('/matieres/:idMatiere/tutoriels', authMiddleware, contenu.getTutosByMatiere)
router.post  ('/tutoriels',                    authMiddleware, adminMiddleware, uploadVideo.single('fichier'), contenu.createTutoriel)
router.delete('/tutoriels/:id',                authMiddleware, adminMiddleware, contenu.deleteTutoriel)

// ══════════════════════════════════════════════════════════════
// EBOOKS / BROCHURES / SUJETS
// ══════════════════════════════════════════════════════════════
router.get   ('/ebooks',        authMiddleware, contenu.getEbooks)
router.post  ('/ebooks',        authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createEbook)
router.delete('/ebooks/:id',    authMiddleware, adminMiddleware, contenu.deleteEbook)

router.get   ('/brochures',     authMiddleware, contenu.getBrochures)
router.post  ('/brochures',     authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createBrochure)
router.delete('/brochures/:id', authMiddleware, adminMiddleware, contenu.deleteBrochure)

router.get   ('/sujets-examen', authMiddleware, contenu.getSujets)
router.post  ('/sujets-examen', authMiddleware, adminMiddleware, uploadPDF.single('fichier'), contenu.createSujet)
router.delete('/sujets-examen/:id', authMiddleware, adminMiddleware, contenu.deleteSujet)

// ══════════════════════════════════════════════════════════════
// PAIEMENT & ABONNEMENT
// ══════════════════════════════════════════════════════════════
router.post('/paiements/orange-money',          authMiddleware, paie.payerOrangeMoney)
router.post('/paiements/moov-money',            authMiddleware, paie.payerMoovMoney)
router.get ('/paiements/:idTransaction/statut', authMiddleware, paie.verifierStatutPaiement)
router.get ('/abonnements',                     authMiddleware, paie.getHistoriqueAbonnements)
router.get ('/admin/abonnements',               authMiddleware, adminMiddleware, paie.getAllAbonnements)

// Webhooks fournisseurs — PAS de authMiddleware (Orange/Moov n'ont pas de JWT client).
// Sécurisés autrement : vérification de signature/IP à ajouter en production
// selon ce que fournit chaque opérateur.
router.post('/paiements/orange-money/callback', paie.orangeMoneyCallback)
router.post('/paiements/moov-money/callback',   paie.moovMoneyCallback)
router.get('/paiement/retour', (req, res) => res.send('<h2>Paiement en cours de vérification...</h2>'))
router.get('/paiement/annule', (req, res) => res.send('<h2>Paiement annulé</h2>'))
// ══════════════════════════════════════════════════════════════
// USERS & STATS (admin)
// ══════════════════════════════════════════════════════════════
router.get ('/admin/users',       authMiddleware, adminMiddleware, users.getAllUsers)
router.get ('/admin/users/:id',   authMiddleware, adminMiddleware, users.getUserById)
router.patch('/admin/users/:id/toggle', authMiddleware, adminMiddleware, users.toggleUserActive)
router.get ('/stats',             authMiddleware, adminMiddleware, stats.getStats)

module.exports = router