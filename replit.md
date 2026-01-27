# Cassius - Plateforme de Gestion en Implantologie Dentaire

## Vue d'ensemble

Cassius est une plateforme SaaS complète conçue pour les implantologistes dentaires, permettant de rationaliser la documentation clinique et la gestion des pratiques. L'application offre une gestion complète des patients, un suivi chirurgical détaillé, le stockage des radiographies, le suivi des visites avec mesures ISQ, et une intégration bidirectionnelle avec Google Calendar.

### Fonctionnalités Principales
- **Gestion des Patients** : Dossiers complets avec historique médical, allergies, antécédents
- **Suivi Chirurgical** : Documentation détaillée des opérations et implants posés
- **Mesures ISQ** : Suivi de l'ostéointégration avec alertes automatiques
- **Calendrier Intégré** : Planification des rendez-vous avec sync Google Calendar
- **Alertes Cliniques** : Système de flags automatiques pour le suivi patient
- **Gestion Documentaire** : Stockage et organisation des radiographies et documents
- **Multi-tenant** : Isolation des données par organisation

## Préférences Utilisateur

- **Style de communication** : Langage simple et quotidien
- **Langue** : Français
- **Timezone par défaut** : Europe/Paris

---

## Architecture Technique

### Stack Technologique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Express.js, TypeScript |
| **Base de données** | PostgreSQL (Supabase), Drizzle ORM |
| **Stockage fichiers** | Supabase Storage (Object Storage) |
| **Authentification** | Passport.js, JWT, scrypt |
| **Emails** | Resend (transactional emails) |
| **Calendrier** | FullCalendar, Google Calendar API |

### Structure du Projet

```
cassius/
├── client/                     # Frontend React
│   ├── src/
│   │   ├── components/         # Composants réutilisables
│   │   │   └── ui/             # Composants shadcn/ui
│   │   ├── hooks/              # Hooks React personnalisés
│   │   ├── lib/                # Utilitaires (queryClient, utils)
│   │   ├── pages/              # Pages de l'application
│   │   └── App.tsx             # Point d'entrée React
│   └── index.html
├── server/                     # Backend Express
│   ├── routes.ts               # Définition des routes API
│   ├── storage.ts              # Interface de stockage (Drizzle)
│   ├── googleCalendar.ts       # Intégration Google Calendar
│   ├── emailService.ts         # Service d'envoi d'emails
│   ├── flagDetection.ts        # Détection automatique des alertes
│   └── index.ts                # Point d'entrée serveur
├── shared/                     # Code partagé
│   ├── schema.ts               # Schéma Drizzle (modèles de données)
│   └── types.ts                # Types TypeScript partagés
└── replit.md                   # Cette documentation
```

### Design System

#### Couleurs de Statut
| Statut | Couleur | Usage |
|--------|---------|-------|
| EN_SUIVI | Bleu (#3b82f6) | Patient en cours de suivi |
| SUCCES | Vert (#22c55e) | Traitement réussi |
| COMPLICATION | Orange (#f97316) | Complication détectée |
| ECHEC | Rouge (#ef4444) | Échec du traitement |

#### Typographie
- **Titres de section** : `text-base font-medium`
- **Contenu** : `text-xs`
- **Badges** : `text-[10px]`

---

## Rôles et Permissions

### Collaborateur (Chirurgien)
- Peut créer, modifier et consulter les patients, actes et implants
- Peut ajouter des rendez-vous et des radiographies
- Accès complet aux fonctionnalités cliniques

### Assistant
- Peut consulter les informations des patients et des actes
- Peut gérer les rendez-vous du calendrier
- Accès limité aux fonctionnalités administratives
- Ne peut pas supprimer de données

### Admin (Administrateur)
- Toutes les permissions du Collaborateur
- Peut gérer les membres de l'équipe (inviter, modifier les rôles, supprimer)
- Accès aux paramètres du cabinet et aux intégrations
- Peut configurer les préférences de l'organisation

> **Note** : Le premier utilisateur créé lors de l'inscription est automatiquement marqué comme "Propriétaire" et son rôle Admin ne peut pas être modifié.

---

## Modèle de Données

### Tables Principales

#### organisations
Représente un cabinet dentaire ou une clinique.
- `id` : UUID (PK)
- `nom` : Nom du cabinet
- `adresse`, `telephone`, `email` : Coordonnées
- `timezone` : Fuseau horaire (default: Europe/Paris)
- `settings` : Paramètres personnalisés (JSONB)

#### users
Utilisateurs de l'application.
- `id` : UUID (PK)
- `organisation_id` : FK vers organisations
- `username` : Identifiant unique
- `password` : Hashé avec scrypt
- `role` : ADMIN | CHIRURGIEN | ASSISTANT
- `nom`, `prenom`, `email` : Informations personnelles

#### patients
Dossiers patients.
- `id` : UUID (PK)
- `organisation_id` : FK
- `nom`, `prenom`, `date_naissance`, `sexe`
- `email`, `telephone`, `adresse`
- `notes_medicales`, `allergies[]`, `antecedents[]`
- `statut` : EN_SUIVI | SUCCES | COMPLICATION | ECHEC

#### operations
Interventions chirurgicales.
- `id` : UUID (PK)
- `patient_id` : FK vers patients
- `date`, `type`, `notes`, `notes_postop`
- `chirurgien_id` : FK vers users

#### surgery_implants
Implants posés lors d'une intervention.
- `id` : UUID (PK)
- `operation_id` : FK vers operations
- `implant_id` : FK vers implants (catalogue)
- `position` : Numéro de la dent
- `isq_pose`, `latest_isq`, `isq_trend`
- `isq_values` : Historique des mesures (JSONB)
- `status` : EN_SUIVI | OSTEOINTEGRE | COMPLICATION | ECHEC

#### appointments
Rendez-vous et visites.
- `id` : UUID (PK)
- `patient_id`, `operation_id`, `surgery_implant_id`
- `type` : CONSULTATION | SUIVI | CHIRURGIE | CONTROLE | URGENCE | AUTRE
- `status` : UPCOMING | COMPLETED | CANCELLED
- `date_start`, `date_end`, `title`, `description`
- `isq` : Mesure ISQ si visite de suivi
- `sync_status` : NONE | PENDING | SYNCED | ERROR
- `external_event_id` : ID Google Calendar

#### flags
Alertes cliniques automatiques.
- `id` : UUID (PK)
- `entity_type` : PATIENT | SURGERY_IMPLANT | OPERATION
- `entity_id` : ID de l'entité concernée
- `type` : ISQ_LOW | ISQ_CRITICAL | ISQ_DECLINING | NO_POSTOP_FOLLOWUP...
- `level` : CRITICAL | WARNING | INFO
- `resolved_at`, `resolved_by` : Résolution

#### calendar_integrations
Configuration Google Calendar.
- `id` : UUID (PK)
- `organisation_id`, `user_id`
- `access_token`, `refresh_token` : Tokens OAuth
- `target_calendar_id` : Calendrier cible
- `is_enabled`, `sync_error_count`

---

## API Reference

### Authentification
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login` | POST | Connexion |
| `/api/auth/logout` | POST | Déconnexion |
| `/api/auth/user` | GET | Utilisateur courant |

### Patients
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/patients` | GET/POST | Liste / Créer |
| `/api/patients/:id` | GET/PATCH/DELETE | CRUD |
| `/api/patients/:id/timeline` | GET | Timeline patient |

### Opérations
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/operations` | GET/POST | Liste / Créer |
| `/api/operations/:id` | GET/PATCH | CRUD |
| `/api/operations/:id/timeline` | GET | Timeline opération |

### Rendez-vous
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/appointments` | GET/POST | Liste / Créer |
| `/api/appointments/calendar` | GET | RDV calendrier avec filtres |
| `/api/appointments/:id` | GET/PATCH/DELETE | CRUD |

### Google Calendar
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/integrations/google/connect` | GET | Initier OAuth |
| `/api/integrations/google/status` | GET | Statut intégration |
| `/api/integrations/google/sync-now` | POST | Synchroniser |
| `/api/integrations/google/disconnect` | DELETE | Déconnecter |

### Notifications & Flags
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/notifications` | GET | Liste notifications |
| `/api/notifications/unread-count` | GET | Compteur non-lues |
| `/api/flags` | GET | Alertes actives |
| `/api/flags/:id/resolve` | PATCH | Résoudre alerte |

---

## Configuration

### Variables d'Environnement Requises

```env
# Base de données
DATABASE_URL=postgresql://...
SUPABASE_DB_URL_PROD=postgresql://...

# Authentification
SESSION_SECRET=...
JWT_SECRET=...

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Emails
RESEND_API_KEY=...

# Object Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID=...
```

---

## Déploiement & Migration

### Synchronisation du Schéma

```bash
# Développement
npm run db:push

# Production
DATABASE_URL=$SUPABASE_DB_URL_PROD npm run db:push
```

### Script SQL Manuel (Supabase)

Pour migrer manuellement via l'éditeur SQL de Supabase :

```sql
-- APPOINTMENTS
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'NONE';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_event_id text;

-- USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- ORGANISATIONS
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- CALENDAR_INTEGRATIONS
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_error_count integer DEFAULT 0;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS target_calendar_id text;

-- NOTIFICATION_PREFERENCES
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS organisation_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS in_app_enabled boolean DEFAULT true;
```

---

## Système d'Alertes Cliniques

### Types d'Alertes

| Type | Niveau | Description |
|------|--------|-------------|
| `ISQ_CRITICAL` | CRITICAL | ISQ < 55 |
| `ISQ_LOW` | WARNING | ISQ entre 55-65 |
| `ISQ_DECLINING` | WARNING | Tendance ISQ à la baisse |
| `NO_POSTOP_FOLLOWUP` | WARNING | Pas de suivi post-op après 7 jours |
| `NO_RECENT_ISQ` | INFO | Pas de mesure ISQ récente |

### Déclenchement Automatique
Les alertes sont recalculées à chaque :
- Création/modification de rendez-vous
- Modification d'implant
- Ajout de mesure ISQ

---

## Intégration Google Calendar

### Fonctionnalités
- Synchronisation bidirectionnelle des rendez-vous
- Bouton de sync manuelle sur la page calendrier
- Gestion des conflits de modification
- Support multi-calendrier

### Configuration
1. Paramètres > Intégrations > Connecter Google Calendar
2. Autoriser l'accès OAuth
3. Sélectionner le calendrier cible
4. Activer la synchronisation

### Utilisation
- Cliquer sur le bouton **G** dans la barre du calendrier pour synchroniser
- Les événements Google apparaissent avec un badge distinctif

---

## Dépannage

### Erreur 500 sur les API
**Cause** : Colonnes manquantes en base de données.
**Solution** : Exécuter le script SQL de migration ou `npm run db:push`.

### Page Paramètres qui charge en boucle
**Cause** : Colonnes manquantes dans la table `users`.
**Solution** : Ajouter `email_verified`, `email_verified_at` via SQL.

### Notification fantôme
**Cause** : Mauvais mapping des champs de flags.
**Solution** : Utiliser `flag.level` au lieu de `flag.severity`.

### Google Calendar ne synchronise pas
1. Vérifier l'intégration dans Paramètres > Intégrations
2. Vérifier que la sync est activée (icône verte)
3. Forcer une synchronisation avec le bouton G

---

## Dépendances Externes

- **Supabase PostgreSQL** : Base de données
- **Supabase Storage** : Stockage fichiers
- **Drizzle ORM** : ORM type-safe
- **shadcn/ui** : Composants UI
- **FullCalendar** : Calendrier
- **Resend** : Emails transactionnels
- **Google Calendar API** : Intégration calendrier

---

## Changelog Récent

### Janvier 2026
- **Système d'audit complet** : Traçabilité de toutes les modifications (patients, opérations, implants)
  - Service backend `auditService.ts` avec logging automatique
  - Composant `AuditHistory` réutilisable avec icônes et badges
  - Historique affiché sur fiches patient, implant, acte
  - Card "Activités récentes" sur le dashboard avec drag-and-drop
- **Protection du rôle propriétaire** : Le premier utilisateur (owner) ne peut plus voir son rôle modifié ou être supprimé
- Bouton de synchronisation Google Calendar directe
- Correction du mapping notifications/flags
- Gestion des RDV sans patient valide sur le dashboard
- Scripts SQL de migration pour synchroniser dev/prod

---

## Maintenance

### Vérification de la santé
```sql
SELECT 'patients' as table_name, count(*) FROM patients
UNION ALL SELECT 'operations', count(*) FROM operations
UNION ALL SELECT 'appointments', count(*) FROM appointments;
```

### Nettoyage périodique
```sql
-- Supprimer les flags résolus > 30 jours
DELETE FROM flags WHERE resolved_at < NOW() - INTERVAL '30 days';

-- Supprimer les notifications lues > 90 jours
DELETE FROM notifications WHERE read_at < NOW() - INTERVAL '90 days';
```
