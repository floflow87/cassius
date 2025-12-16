# Configuration de Cassius

## Architecture Base de Donnees

Cassius utilise deux projets Supabase distincts :
- **cassius-dev** : Base de developpement
- **cassius-prod** : Base de production

## Variables d'Environnement Requises

### Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `APP_ENV` | Environnement (`development` ou `production`) | `development` |
| `SUPABASE_DB_URL_DEV` | URI Supabase pour dev | `postgresql://postgres.xxx:password@...` |
| `SUPABASE_DB_URL_PROD` | URI Supabase pour prod | `postgresql://postgres.xxx:password@...` |

### Optionnelles

| Variable | Description | Defaut |
|----------|-------------|--------|
| `DB_SSL` | Activer SSL | `true` |
| `DB_POOL_MAX` | Max connexions pool | `5` |
| `DB_CONN_TIMEOUT_MS` | Timeout connexion (ms) | `60000` |
| `SESSION_SECRET` | Secret pour sessions Express | (requis) |
| `JWT_SECRET` | Secret pour tokens JWT | (requis) |

## Obtenir les URIs Supabase

### Etape 1 : Acceder au Dashboard
1. Connectez-vous a [Supabase Dashboard](https://app.supabase.com)
2. Selectionnez votre projet (cassius-dev ou cassius-prod)

### Etape 2 : Recuperer l'URI
1. Allez dans **Project Settings** > **Database**
2. Dans la section **Connection string**, selectionnez **URI**
3. **Important pour Replit** : Utilisez le **Session pooler** (port 6543)
   - Le mode "Direct" (port 5432) ne fonctionne pas sur Replit (IPv6 non supporte)

### Etape 3 : Mot de passe
- Si vous avez oublie le mot de passe, cliquez sur **Reset database password**
- **Important** : Utilisez un mot de passe **alphanumerique uniquement**
- Evitez les caracteres speciaux (@, #, %, etc.) qui causent des erreurs de parsing

### Etape 4 : Copier l'URI complete
Ne reconstruisez JAMAIS l'URI manuellement. Copiez-la directement depuis le Dashboard.

Format attendu :
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Configuration dans Replit

1. Ouvrez l'onglet **Secrets** dans Replit
2. Ajoutez les variables suivantes :

```
APP_ENV=development
SUPABASE_DB_URL_DEV=postgresql://postgres.xxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
SUPABASE_DB_URL_PROD=postgresql://postgres.yyy:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
DB_SSL=true
SESSION_SECRET=votre-secret-session
JWT_SECRET=votre-secret-jwt
```

## Initialisation de la Base de Donnees

### Appliquer le schema

```bash
# Developpement
tsx db/scripts/apply-schema.ts

# Production (avec confirmation)
CONFIRM_PROD_SCHEMA_APPLY=true APP_ENV=production tsx db/scripts/apply-schema.ts
```

### Ajouter des donnees de test (dev uniquement)

```bash
tsx db/scripts/seed-dev.ts
```

## Verification

### Endpoint de sante
```bash
curl https://votre-app.replit.app/api/health/db
```

Reponse attendue :
```json
{
  "ok": true,
  "db": "connected",
  "latencyMs": 42,
  "env": "development"
}
```

## Depannage

### Erreur "Tenant or user not found"
- Verifiez que le projet Supabase n'est pas en pause
- Verifiez le Reference ID du projet
- Regenerez le mot de passe (alphanumerique uniquement)

### Erreur de timeout
- Augmentez `DB_CONN_TIMEOUT_MS` (ex: 120000 pour 2 minutes)
- Verifiez votre connexion internet

### Erreur SSL
- Assurez-vous que `DB_SSL=true` est defini
- Utilisez le pooler Supabase (port 6543)
