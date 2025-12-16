# Cassius Database Management

## Structure

- `schema.sql` - Source de verite pour la structure de la base de donnees
- `seed.dev.sql` - Donnees de test (developpement uniquement)

## Configuration requise

### Variables d'environnement

```bash
APP_ENV=development          # ou "production"
SUPABASE_DB_URL_DEV=...      # URI Supabase dev (pooler recommande)
SUPABASE_DB_URL_PROD=...     # URI Supabase prod
DB_SSL=true                  # Activer SSL (defaut: true)
DB_POOL_MAX=5                # Max connections (defaut: 5)
DB_CONN_TIMEOUT_MS=60000     # Timeout connexion (defaut: 60s)
```

### Obtenir l'URI Supabase

1. Aller dans **Supabase Dashboard** > **Project Settings** > **Database**
2. Copier l'**URI** depuis la section **Connection string**
3. Pour Replit, utiliser le **Session pooler** (port 6543)
4. S'assurer que le mot de passe est **alphanumerique** (pas de @, #, %)

## Commandes

### Appliquer le schema

```bash
# Developpement
npm run db:dev:apply

# Production (avec garde-fou)
CONFIRM_PROD_SCHEMA_APPLY=true npm run db:prod:apply
```

### Appliquer les donnees de test

```bash
npm run db:dev:seed
```

## Notes importantes

- **Ne jamais** executer `db:prod:apply` sans `CONFIRM_PROD_SCHEMA_APPLY=true`
- **Ne jamais** executer `db:dev:seed` sur la production
- Les migrations sont idempotentes (peuvent etre rejouees sans erreur)
- Utiliser le pooler Supabase sur Replit (IPv6 non supporte)
