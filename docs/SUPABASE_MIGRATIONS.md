# Supabase Migrations Guide

Ce guide explique comment appliquer les migrations Supabase vers la base de données de production.

## Structure des fichiers

```
supabase/
├── config.toml          # Configuration Supabase CLI (optionnel)
└── migrations/
    └── 20241230_calendar_integrations.sql   # Migrations SQL idempotentes
```

## Prérequis

1. **Récupérer l'URL de connexion Supabase prod :**
   - Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
   - Sélectionner votre projet
   - Aller dans Settings > Database > Connection string > URI
   - Copier l'URL (format: `postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`)

## Méthode 1 : Via script TypeScript (recommandé)

```bash
# Dans le terminal Replit, définir l'URL de connexion
export SUPABASE_DATABASE_URL="postgresql://postgres.[votre-ref]:[votre-password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

# Exécuter le script de migration
npx tsx script/migrate-supabase-prod.ts
```

Le script :
- Lit tous les fichiers SQL dans `supabase/migrations/`
- Les exécute dans l'ordre alphabétique
- Vérifie que les tables ont été créées

## Méthode 2 : Via Supabase CLI

### Installation de Supabase CLI

```bash
# Installer via npm
npm install -g supabase

# Vérifier l'installation
supabase --version
```

### Lier le projet et pousser les migrations

```bash
# 1. Login à Supabase
supabase login

# 2. Lier au projet prod (récupérer le project-ref depuis le dashboard)
supabase link --project-ref votre-project-ref

# 3. Pousser les migrations
supabase db push
```

## Méthode 3 : Via SQL direct (Supabase Dashboard)

1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Aller dans SQL Editor
4. Copier-coller le contenu de `supabase/migrations/20241230_calendar_integrations.sql`
5. Exécuter

## Vérification post-migration

Exécuter cette requête pour vérifier que les tables existent :

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('calendar_integrations', 'appointment_external_links')
ORDER BY table_name, ordinal_position;
```

## Tables créées

### calendar_integrations

| Colonne | Type | Description |
|---------|------|-------------|
| id | varchar | Clé primaire UUID |
| organisation_id | varchar | FK vers organisations |
| user_id | varchar | FK vers users (nullable) |
| provider | text | "google" |
| is_enabled | boolean | Actif/Inactif |
| target_calendar_id | text | ID du calendrier Google cible |
| target_calendar_name | text | Nom du calendrier |
| access_token | text | Token OAuth |
| refresh_token | text | Token de rafraîchissement |
| token_expires_at | timestamp | Expiration du token |
| scope | text | Scopes OAuth |
| provider_user_email | text | Email du compte Google |
| last_sync_at | timestamp | Dernière synchronisation |
| sync_error_count | integer | Compteur d'erreurs |
| last_sync_error | text | Dernière erreur |
| created_at | timestamp | Date de création |
| updated_at | timestamp | Date de mise à jour |

### appointment_external_links

Table pour le mapping V2 multi-calendriers (réservée pour usage futur).

## Dépannage

### Erreur "relation organisations does not exist"

La table `organisations` doit exister avant de créer `calendar_integrations`. Vérifiez que votre base prod contient bien cette table.

### Erreur "duplicate key value violates unique constraint"

La migration est idempotente. Si l'erreur persiste, la table existe déjà avec des données. Vérifiez la structure actuelle.
