-- ============================================================
-- Migration PRODUCTION: type_intervention enum → text[]
-- À exécuter dans le SQL Editor de Supabase (projet production)
-- ============================================================

-- Étape 1: Créer la colonne temporaire text[]
ALTER TABLE operations ADD COLUMN type_intervention_new text[];

-- Étape 2: Convertir les valeurs enum existantes en tableaux
UPDATE operations SET type_intervention_new = ARRAY[type_intervention::text];

-- Étape 3: Supprimer l'ancienne colonne enum
ALTER TABLE operations DROP COLUMN type_intervention;

-- Étape 4: Renommer la nouvelle colonne
ALTER TABLE operations RENAME COLUMN type_intervention_new TO type_intervention;

-- Étape 5: Appliquer la contrainte NOT NULL
ALTER TABLE operations ALTER COLUMN type_intervention SET NOT NULL;

-- ============================================================
-- Migration PRODUCTION: Ajout des colonnes manquantes sur implants
-- ============================================================

-- Créer les types enum manquants s'ils n'existent pas
DO $$ BEGIN
  CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT', 'PROTHESE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE type_prothese AS ENUM ('VISSEE', 'SCELLEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quantite_prothese AS ENUM ('UNITAIRE', 'PLURALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mobilite_prothese AS ENUM ('AMOVIBLE', 'FIXE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT', 'VISSE', 'SCELLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajouter les colonnes manquantes à la table implants
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_implant type_implant NOT NULL DEFAULT 'IMPLANT';
ALTER TABLE implants ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_prothese type_prothese;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS quantite quantite_prothese;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS mobilite mobilite_prothese;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_pilier type_pilier;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS lot text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================
-- Vérification
-- ============================================================
SELECT 'operations.type_intervention' as col, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'operations' AND column_name = 'type_intervention'
UNION ALL
SELECT 'implants.type_implant', data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'implants' AND column_name = 'type_implant'
UNION ALL
SELECT 'implants.mobilite', data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'implants' AND column_name = 'mobilite';
