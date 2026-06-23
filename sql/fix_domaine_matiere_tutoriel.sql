-- =========================================================
-- MIGRATION — Réparation des liens domaine_matiere_tutoriel manquants
-- =========================================================
--
-- Avant ce correctif, créer un tutoriel depuis l'admin n'ajoutait
-- jamais le lien dans `domaine_matiere_tutoriel`, donc les tutoriels
-- existants n'apparaissent pas quand un client filtre par domaine
-- (ils restent visibles uniquement en mode "Tout").
--
-- Cette requête comble rétroactivement les liens manquants pour
-- TOUTES les matières déjà utilisées par un tutoriel existant,
-- en déduisant le domaine via matiere -> niveau -> domaine.

INSERT INTO domaine_matiere_tutoriel (id_domaine, id_matiere)
SELECT DISTINCT n.id_domaine, tv.id_matiere
FROM tutoriel_video tv
JOIN matiere m ON m.id = tv.id_matiere
JOIN niveau n  ON n.id = m.id_niveau
ON CONFLICT DO NOTHING;

SELECT 'Liens domaine_matiere_tutoriel réparés ✅' AS message;
