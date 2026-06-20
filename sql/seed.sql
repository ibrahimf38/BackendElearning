-- =========================================================
-- SEED — Données initiales Elearning-Mali
-- =========================================================

-- Mot de passe par défaut : Admin@2024
-- À CHANGER IMMÉDIATEMENT en production !
-- Hash bcrypt de "Admin@2024" (12 rounds)
DO $$
DECLARE
  v_admin_id INT;
BEGIN
  -- Compte admin
  INSERT INTO utilisateur (telephone, mot_de_passe, est_actif)
  VALUES ('+22300000000', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oOeR2Hj6W', TRUE)
  ON CONFLICT (telephone) DO NOTHING
  RETURNING id INTO v_admin_id;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO admin (id_admin, email)
    VALUES (v_admin_id, 'admin@elearning-mali.com')
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- 6 Domaines
INSERT INTO domaine (nom_domaine) VALUES
  ('Fondamental'),
  ('Secondaire'),
  ('Universitaire'),
  ('Technique'),
  ('Art-culture'),
  ('Defense')
ON CONFLICT (nom_domaine) DO NOTHING;

-- Niveaux Fondamental
INSERT INTO niveau (id_domaine, nom_niveau)
SELECT d.id, n.nom FROM domaine d, (VALUES ('1ere'),('2eme'),('3eme'),('4eme'),('5eme'),('6eme')) AS n(nom)
WHERE d.nom_domaine = 'Fondamental'
ON CONFLICT DO NOTHING;

-- Niveaux Secondaire
INSERT INTO niveau (id_domaine, nom_niveau)
SELECT d.id, n.nom FROM domaine d, (VALUES ('1ere'),('2eme'),('3eme'),('Terminal')) AS n(nom)
WHERE d.nom_domaine = 'Secondaire'
ON CONFLICT DO NOTHING;

-- Niveaux Universitaire
INSERT INTO niveau (id_domaine, nom_niveau)
SELECT d.id, n.nom FROM domaine d, (VALUES ('Licence 1'),('Licence 2'),('Licence 3'),('Master 1'),('Master 2')) AS n(nom)
WHERE d.nom_domaine = 'Universitaire'
ON CONFLICT DO NOTHING;

-- Niveaux Technique
INSERT INTO niveau (id_domaine, nom_niveau)
SELECT d.id, n.nom FROM domaine d, (VALUES ('CAP 1'),('CAP 2'),('BT 1'),('BT 2')) AS n(nom)
WHERE d.nom_domaine = 'Technique'
ON CONFLICT DO NOTHING;

-- Matières Fondamental 1ere
INSERT INTO matiere (id_niveau, nom_matiere)
SELECT n.id, m.nom
FROM niveau n
JOIN domaine d ON d.id = n.id_domaine
CROSS JOIN (VALUES
  ('Language'),('Lecture'),('Chante'),('Calcule'),('Ortographe'),('Compte'),('Ecriture')
) AS m(nom)
WHERE d.nom_domaine = 'Fondamental' AND n.nom_niveau = '1ere'
ON CONFLICT DO NOTHING;

-- Matières Secondaire 2eme
INSERT INTO matiere (id_niveau, nom_matiere)
SELECT n.id, m.nom
FROM niveau n
JOIN domaine d ON d.id = n.id_domaine
CROSS JOIN (VALUES
  ('Mathematique'),('Physique'),('Chimie'),('SVT'),('Francais'),('Anglais'),('Histoire-Geographie')
) AS m(nom)
WHERE d.nom_domaine = 'Secondaire' AND n.nom_niveau = '2eme'
ON CONFLICT DO NOTHING;

-- Association Domaine-Matiere-Tutoriel (Secondaire → Mathématique, Chimie, Physique)
INSERT INTO domaine_matiere_tutoriel (id_domaine, id_matiere)
SELECT d.id, m.id
FROM domaine d, matiere m
JOIN niveau n ON n.id = m.id_niveau
WHERE d.nom_domaine = 'Secondaire'
  AND n.id_domaine = d.id
  AND m.nom_matiere IN ('Mathematique','Physique','Chimie','Francais','Anglais')
ON CONFLICT DO NOTHING;

SELECT 'Seed terminé ✅' AS message;
