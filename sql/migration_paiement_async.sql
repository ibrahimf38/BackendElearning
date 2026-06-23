-- =========================================================
-- MIGRATION — Support du flux de paiement asynchrone
-- (Orange Money WebPay + Moov Money push USSD)
-- =========================================================

-- 1. Ajoute id_client directement sur `paiement`, car l'abonnement
--    n'existe pas encore au moment où le paiement est initié
--    (il n'est créé qu'après confirmation par le fournisseur).
ALTER TABLE paiement
  ADD COLUMN IF NOT EXISTS id_client INT REFERENCES client(id_client) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_paiement_client ON paiement(id_client);

-- 2. Ajoute pay_token sur orange_money, nécessaire pour vérifier
--    le statut d'une transaction WebPay après son initiation.
ALTER TABLE orange_money
  ADD COLUMN IF NOT EXISTS pay_token VARCHAR(255);

SELECT 'Migration paiement asynchrone appliquée ✅' AS message;
