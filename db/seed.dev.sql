-- Cassius Development Seed Data
-- Apply ONLY on development: npm run db:dev:seed

-- Default organisation
INSERT INTO organisations (id, nom) 
VALUES ('default-org-001', 'Cabinet par defaut')
ON CONFLICT (id) DO NOTHING;

-- Sample patients for testing
INSERT INTO patients (id, organisation_id, nom, prenom, date_naissance, sexe, telephone, email, contexte_medical)
VALUES 
  ('patient-001', 'default-org-001', 'Dupont', 'Jean', '1965-03-15', 'HOMME', '0612345678', 'jean.dupont@email.fr', 'Diabete type 2 controle'),
  ('patient-002', 'default-org-001', 'Martin', 'Marie', '1978-07-22', 'FEMME', '0623456789', 'marie.martin@email.fr', NULL),
  ('patient-003', 'default-org-001', 'Bernard', 'Pierre', '1952-11-08', 'HOMME', '0634567890', 'pierre.bernard@email.fr', 'Hypertension, sous anticoagulants')
ON CONFLICT (id) DO NOTHING;

-- Sample operation for patient-001
INSERT INTO operations (id, organisation_id, patient_id, date_operation, type_intervention, type_chirurgie_temps, type_chirurgie_approche, type_mise_en_charge)
VALUES 
  ('operation-001', 'default-org-001', 'patient-001', '2024-06-15', 'POSE_IMPLANT', 'UN_TEMPS', 'FLAPLESS', 'DIFFEREE')
ON CONFLICT (id) DO NOTHING;

-- Sample implant for operation-001
INSERT INTO implants (id, organisation_id, operation_id, patient_id, marque, reference_fabricant, diametre, longueur, site_fdi, position_implant, type_os, isq_pose, statut, date_pose)
VALUES 
  ('implant-001', 'default-org-001', 'operation-001', 'patient-001', 'Straumann', 'BLT-4010', 4.0, 10.0, '36', 'CRESTAL', 'D2', 68.0, 'EN_SUIVI', '2024-06-15')
ON CONFLICT (id) DO NOTHING;

-- Sample follow-up visit
INSERT INTO visites (id, organisation_id, implant_id, patient_id, date, isq, notes)
VALUES 
  ('visite-001', 'default-org-001', 'implant-001', 'patient-001', '2024-08-15', 72.0, 'Bonne osteointegration, patient asymptomatique')
ON CONFLICT (id) DO NOTHING;

SELECT 'Seed data applied successfully' AS status;
