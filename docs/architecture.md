# Cassius Architecture

## Vue d'ensemble

Cassius est une application SaaS multi-tenant pour la gestion de cabinet dentaire implantologie.

## Structure du projet

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants UI réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── hooks/          # Hooks React personnalisés
│   │   └── lib/            # Utilitaires frontend
│   └── index.html
│
├── server/                 # Backend Node.js/Express
│   ├── modules/            # Modules métier (pattern vertical slice)
│   │   ├── patients/       # Gestion des patients
│   │   ├── implants/       # Catalogue d'implants
│   │   ├── operations/     # Interventions chirurgicales
│   │   ├── appointments/   # Rendez-vous
│   │   ├── documents/      # Gestion documentaire ✅ Migré
│   │   ├── flags/          # Alertes cliniques
│   │   ├── notifications/  # Système de notifications
│   │   ├── integrations/   # Intégrations externes
│   │   │   └── google-calendar/
│   │   └── auth/           # Authentification
│   ├── lib/                # Utilitaires transverses
│   │   ├── env.ts          # Variables d'environnement
│   │   ├── logger.ts       # Logging structuré
│   │   ├── db.ts           # Connexion DB
│   │   ├── errors.ts       # Classes d'erreurs
│   │   └── pagination.ts   # Helpers pagination
│   ├── jobs/               # Tâches async/cron
│   │   ├── index.ts        # Registre des jobs
│   │   ├── email_outbox.worker.ts
│   │   ├── digests.cron.ts
│   │   └── google_sync.worker.ts
│   ├── routes.ts           # Agrégateur de routes (legacy + modules)
│   ├── storage.ts          # Interface storage (legacy, à migrer)
│   └── index.ts            # Point d'entrée
│
├── shared/                 # Code partagé client/serveur
│   └── schema.ts           # Schéma Drizzle (source de vérité)
│
├── migrations/             # Migrations SQL (drizzle-kit)
│
└── docs/                   # Documentation
    └── architecture.md     # Ce fichier
```

## Patterns architecturaux

### Modules (Vertical Slice)

Chaque module contient :
- `routes.ts` - Définition des routes Express, validation
- `service.ts` - Logique métier, orchestration
- `repo.ts` - Accès données (requêtes Drizzle)
- `schemas.ts` - Schémas Zod pour validation
- `types.ts` - Types TypeScript
- `index.ts` - Exports publics

### Base de données

- **ORM** : Drizzle ORM
- **Source de vérité** : `shared/schema.ts`
- **Migrations** : Générées via `drizzle-kit`
- **Multi-tenant** : Filtrage par `organisation_id`

### Authentification

- Sessions via Passport.js (LocalStrategy)
- JWT pour API stateless
- RBAC : ADMIN, CHIRURGIEN, ASSISTANT

### Stockage fichiers

- Supabase Storage pour documents et radiographies
- Signed URLs pour accès sécurisé

## Conventions

### Nommage

- Routes : `/api/{ressource}` (kebab-case)
- Tables : snake_case
- Colonnes : snake_case
- Types TS : PascalCase

### Gestion d'erreurs

Utiliser les classes d'erreurs de `server/lib/errors.ts` :
- `NotFoundError` (404)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ValidationError` (400)
- `ConflictError` (409)

### Logging

Utiliser le logger de `server/lib/logger.ts` :
```typescript
logger.info("Message", { key: "value" });
logger.error("Error occurred", { error: err.message });
```

## Migration progressive

L'application est en cours de refactoring du monolithe (`routes.ts`, `storage.ts`) vers une architecture modulaire. Les nouveaux développements doivent :

1. Créer le module dans `server/modules/`
2. Exposer les routes via une factory function
3. Importer et monter dans `server/routes.ts`

## Jobs / Tâches asynchrones

Les jobs sont définis dans `server/jobs/` et enregistrés au démarrage.
En développement : `setInterval`
En production : Possibilité d'utiliser un système de queue externe.

## Smoke Tests

Pour exécuter les smoke tests :
```bash
npx tsx scripts/smoke-test.ts
```

Ou avec une URL personnalisée :
```bash
BASE_URL=https://www.app.cassiuspro.com npx tsx scripts/smoke-test.ts
```
