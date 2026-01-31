-- Script pour ajouter LOGIN/LOGOUT aux enums d'audit
-- À exécuter sur la base de données de production

-- Ajouter LOGIN et LOGOUT à l'enum audit_action
DO $$
BEGIN
    -- Vérifier si LOGIN existe déjà
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOGIN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')) THEN
        ALTER TYPE audit_action ADD VALUE 'LOGIN';
    END IF;
    
    -- Vérifier si LOGOUT existe déjà
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOGOUT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')) THEN
        ALTER TYPE audit_action ADD VALUE 'LOGOUT';
    END IF;
END $$;

-- Ajouter USER à l'enum audit_entity_type
DO $$
BEGIN
    -- Vérifier si USER existe déjà
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'USER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_entity_type')) THEN
        ALTER TYPE audit_entity_type ADD VALUE 'USER';
    END IF;
END $$;

-- Vérifier que les enums ont été mis à jour
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action');
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_entity_type');
