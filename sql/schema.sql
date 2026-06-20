-- =========================================================================
-- PROJET : Elearning-Mali
-- SCRIPT DE CRÉATION DE LA BASE DE DONNÉES COMPLÈTE
-- SYSTEME : PostgreSQL
-- =========================================================================

DROP TABLE IF EXISTS domaine_matiere_tutoriel CASCADE;
DROP TABLE IF EXISTS sujet_examen CASCADE;
DROP TABLE IF EXISTS brochure CASCADE;
DROP TABLE IF EXISTS ebook CASCADE;
DROP TABLE IF EXISTS tutoriel_video CASCADE;
DROP TABLE IF EXISTS cours CASCADE;
DROP TABLE IF EXISTS contenu CASCADE;
DROP TABLE IF EXISTS matiere CASCADE;
DROP TABLE IF EXISTS niveau CASCADE;
DROP TABLE IF EXISTS domaine CASCADE;
DROP TABLE IF EXISTS abonnement CASCADE;
DROP TABLE IF EXISTS moov_money CASCADE;
DROP TABLE IF EXISTS orange_money CASCADE;
DROP TABLE IF EXISTS paiement CASCADE;
DROP TABLE IF EXISTS client CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS utilisateur CASCADE;

-- ── UTILISATEURS ─────────────────────────────────────────────
CREATE TABLE utilisateur (
    id SERIAL PRIMARY KEY,
    telephone VARCHAR(20) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    est_actif BOOLEAN DEFAULT TRUE
);

CREATE TABLE admin (
    id_admin INT PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE client (
    id_client INT PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    nom_complet VARCHAR(150) NOT NULL,
    date_derniere_connexion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    code_otp VARCHAR(10)
);

-- ── PAIEMENT ──────────────────────────────────────────────────
CREATE TABLE paiement (
    id_transaction VARCHAR(100) PRIMARY KEY,
    montant INT NOT NULL DEFAULT 1000,
    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    statut VARCHAR(50) NOT NULL
);

CREATE TABLE orange_money (
    id_transaction VARCHAR(100) PRIMARY KEY REFERENCES paiement(id_transaction) ON DELETE CASCADE,
    numero_orange VARCHAR(20) NOT NULL
);

CREATE TABLE moov_money (
    id_transaction VARCHAR(100) PRIMARY KEY REFERENCES paiement(id_transaction) ON DELETE CASCADE,
    numero_moov VARCHAR(20) NOT NULL
);

CREATE TABLE abonnement (
    id SERIAL PRIMARY KEY,
    id_client INT NOT NULL REFERENCES client(id_client) ON DELETE CASCADE,
    id_transaction VARCHAR(100) UNIQUE NOT NULL REFERENCES paiement(id_transaction) ON DELETE CASCADE,
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE NOT NULL,
    statut VARCHAR(50) DEFAULT 'Actif',
    montant INT NOT NULL DEFAULT 1000
);

-- ── FILTRAGE ──────────────────────────────────────────────────
CREATE TABLE domaine (
    id SERIAL PRIMARY KEY,
    nom_domaine VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE niveau (
    id SERIAL PRIMARY KEY,
    id_domaine INT NOT NULL REFERENCES domaine(id) ON DELETE CASCADE,
    nom_niveau VARCHAR(100) NOT NULL
);

CREATE TABLE matiere (
    id SERIAL PRIMARY KEY,
    id_niveau INT NOT NULL REFERENCES niveau(id) ON DELETE CASCADE,
    nom_matiere VARCHAR(100) NOT NULL
);

CREATE TABLE domaine_matiere_tutoriel (
    id_domaine INT REFERENCES domaine(id) ON DELETE CASCADE,
    id_matiere INT REFERENCES matiere(id) ON DELETE CASCADE,
    PRIMARY KEY (id_domaine, id_matiere)
);

-- ── CONTENUS ──────────────────────────────────────────────────
CREATE TABLE contenu (
    id SERIAL PRIMARY KEY,
    date_ajout DATE DEFAULT CURRENT_DATE
);

CREATE TABLE cours (
    id_cours INT PRIMARY KEY REFERENCES contenu(id) ON DELETE CASCADE,
    id_matiere INT NOT NULL REFERENCES matiere(id) ON DELETE RESTRICT,
    titre VARCHAR(255) NOT NULL,
    sous_titre VARCHAR(255),
    url_fichier VARCHAR(255) NOT NULL
);

CREATE TABLE tutoriel_video (
    id_tuto INT PRIMARY KEY REFERENCES contenu(id) ON DELETE CASCADE,
    id_matiere INT NOT NULL REFERENCES matiere(id) ON DELETE RESTRICT,
    titre VARCHAR(255) NOT NULL,
    sous_titre VARCHAR(255),
    description TEXT,
    url_video VARCHAR(255) NOT NULL,
    duree_minutes INT NOT NULL
);

CREATE TABLE ebook (
    id_ebook INT PRIMARY KEY REFERENCES contenu(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    type_ebook VARCHAR(100),
    nom_auteur VARCHAR(150),
    date_sortie DATE,
    url_fichier VARCHAR(255) NOT NULL
);

CREATE TABLE brochure (
    id_brochure INT PRIMARY KEY REFERENCES contenu(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    sous_titre VARCHAR(255),
    nom_auteur VARCHAR(150),
    module VARCHAR(150),
    date_sortie DATE,
    url_fichier VARCHAR(255) NOT NULL
);

CREATE TABLE sujet_examen (
    id_sujet INT PRIMARY KEY REFERENCES contenu(id) ON DELETE CASCADE,
    annee INT NOT NULL,
    module VARCHAR(150),
    classe VARCHAR(100) NOT NULL,
    url_fichier VARCHAR(255) NOT NULL
);

-- ── INDEX ─────────────────────────────────────────────────────
CREATE INDEX idx_niveau_domaine   ON niveau(id_domaine);
CREATE INDEX idx_matiere_niveau   ON matiere(id_niveau);
CREATE INDEX idx_cours_matiere    ON cours(id_matiere);
CREATE INDEX idx_tuto_matiere     ON tutoriel_video(id_matiere);
CREATE INDEX idx_abo_client       ON abonnement(id_client);
CREATE INDEX idx_abo_statut       ON abonnement(statut, date_fin);
CREATE INDEX idx_client_user      ON client(id_client);

SELECT 'Schema créé ✅' AS message;
