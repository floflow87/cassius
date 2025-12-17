# Cassius - Dental Implantology Management Platform

## Overview

Cassius is a SaaS platform designed for dental implantologists (oral surgeons specializing in dental implants). The application provides clinical documentation management, including patient records, surgical operations, implant tracking, radiograph storage, and follow-up visit management with ISQ (Implant Stability Quotient) measurements.

The MVP focuses on:
- Patient CRUD operations
- Surgical operation documentation
- Implant tracking with multiple implants per operation
- Radiograph upload and storage
- Follow-up visit management with ISQ progression
- Patient and implant timeline views
- Clinical notes with tags (Consultation, Chirurgie, Suivi, Complication, Administrative)
- Basic search functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (December 16, 2025)

### Production Debugging & Logs
- **Structured auth logs**: All auth endpoints now log `[AUTH] timestamp | env= | route= | action=` with error stacks
- **Smoke test script**: `db/scripts/smoke.ts` for testing DB connection and table counts
- **Logout fix**: Uses `queryClient.setQueryData` for immediate UI update

### Database Commands

```bash
# Test DB connection (checks tables and default org)
APP_ENV=development npx tsx db/scripts/smoke.ts
APP_ENV=production npx tsx db/scripts/smoke.ts

# Apply schema (dev)
APP_ENV=development npx tsx db/scripts/apply-schema.ts

# Apply schema (prod - requires confirmation)
APP_ENV=production CONFIRM_PROD_SCHEMA_APPLY=true npx tsx db/scripts/apply-schema.ts

# Seed dev data
APP_ENV=development npx tsx db/scripts/seed-dev.ts
```

### Required Environment Variables for Production (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENV` | Yes | Must be `production` |
| `SUPABASE_DB_URL_PROD` | Yes | Supabase prod pooler URL (port 6543) |
| `SESSION_SECRET` | Yes | Session encryption key (32+ chars) |
| `JWT_SECRET` | Yes | JWT signing key (32+ chars) |

### Clinical Notes System
- **Table**: `notes` with id, patientId, userId, organisationId, contenu, tag, createdAt
- **Tags enum**: CONSULTATION, CHIRURGIE, SUIVI, COMPLICATION, ADMINISTRATIVE
- **API routes**: GET/POST `/api/patients/:patientId/notes`, PATCH/DELETE `/api/notes/:id`
- **UI**: Note input with tag selection, chronological list with author, colored badges, edit/delete via dropdown

### Radiograph Upload System

#### Architecture Overview
The radiograph upload system uses a client-side upload approach with Replit Object Storage (Google Cloud Storage backend).

#### Data Model (`shared/schema.ts`)
```typescript
export const radios = pgTable("radios", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  operationId: text("operation_id").references(() => operations.id),
  organisationId: text("organisation_id").notNull().references(() => organisations.id),
  type: text("type").notNull(),       // PANORAMIQUE, CBCT, RETROALVEOLAIRE
  title: text("title"),                // Custom title (optional)
  date: timestamp("date").notNull(),
  url: text("url"),                    // Public URL after upload
  notes: text("notes"),
  mimeType: text("mime_type"),         // e.g., "image/jpeg", "image/png"
  sizeBytes: integer("size_bytes"),    // File size in bytes
  fileName: text("file_name"),         // Original filename
});
```

#### Upload Flow

1. **Frontend Component** (`client/src/components/radio-upload-form.tsx`)
   - User selects file via `<input type="file">`
   - Auto-captures: filename as default title, file size, MIME type
   - User can edit title, select type (Panoramique/CBCT/Retroalveolaire), add notes

2. **File Upload** (`server/objectStorage.ts`)
   - Uses Replit sidecar service at `http://127.0.0.1:1106`
   - Files stored in `.private/radios/` directory
   - Returns signed public URL valid for 7 days

3. **Database Record** (`server/routes.ts`)
   - POST `/api/patients/:patientId/radios`
   - Validates metadata with Zod schema
   - Creates record with all metadata fields

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients/:patientId/radios` | List all radios for a patient |
| POST | `/api/patients/:patientId/radios` | Create new radio record |
| PATCH | `/api/radios/:id` | Update radio (rename title) |
| DELETE | `/api/radios/:id` | Delete radio record and file |
| POST | `/api/upload/signed-url` | Get signed URL for upload |

#### Frontend Components

- **RadioUploadForm**: Sheet dialog with file input, title, type selector, notes
- **RadioCard**: Displays thumbnail with menu (rename, download, delete)
- **RadioViewer**: Full-screen modal with zoom controls (+/-), download button

#### Key Features
- Auto-capture of file metadata (name, size, MIME type)
- Title field with filename as default value
- Loading states for all mutations (upload, rename, delete)
- Error handling with toast notifications
- Timeline integration with clickable "Voir l'image" links
- Responsive grid layout (2-5 columns based on screen size)

### UI Refactoring - Sidebar and Patients Page
- **Sidebar**: Refactored to use Shadcn primitives (Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton)
- **Color tokens**: Updated CSS variables for Cassius mainBlue (#2563EB / 217 91% 60%) in both light and dark modes
- **Icons**: Using custom PNG icons for navigation (home, patient, implants, actes, stats, settings)
- **Active state**: White semi-transparent background (bg-white/20) with full opacity icons
- **Tooltips**: Added to sidebar navigation items

### Design Tokens
- **Primary (mainBlue)**: #2563EB - HSL 217 91% 60%
- **Secondary Blue**: #0D5C94
- **Sidebar width**: 4.5rem (72px)
- **Sidebar background**: Uses --sidebar CSS variable which is now mainBlue

### Patients Page Structure
- Uses semantic HTML table (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`) for accessibility
- Columns: Patient (name + ID), Date de naissance, Contact, Implants, Dernière visite, Statut
- Features: Search, filters with badges, pagination, patient selection checkboxes
- Status badges: Actif (green), En traitement (blue), Suivi (yellow), Inactif (gray)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui (Radix primitives + Tailwind CSS)
- **Design System**: Carbon Design System principles (IBM) for professional medical aesthetic
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **File Uploads**: Uppy with AWS S3 integration

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **API Style**: RESTful endpoints under `/api/*`
- **Build Tool**: esbuild for server bundling, Vite for client

### Data Storage
- **Database**: Two Supabase PostgreSQL projects (cassius-dev, cassius-prod)
- **Connection**: Session pooler (port 6543) for Replit compatibility
- **ORM**: Drizzle ORM with type-safe queries
- **Schema Location**: `shared/schema.ts` (Drizzle) + `db/schema.sql` (raw SQL)
- **Migrations**: `tsx db/scripts/apply-schema.ts` (idempotent)
- **Object Storage**: Google Cloud Storage via Replit's sidecar service for radiograph images

### Environment Variables
- **APP_ENV**: `development` or `production` (selects which DB to use)
- **SUPABASE_DB_URL_DEV**: Supabase dev database URI (pooler)
- **SUPABASE_DB_URL_PROD**: Supabase prod database URI (pooler)
- **DB_SSL**: Enable SSL (default: true)
- **DB_POOL_MAX**: Max pool connections (default: 5)
- **DB_CONN_TIMEOUT_MS**: Connection timeout (default: 60000)

### Authentication
- **Session-based auth**: Passport.js with LocalStrategy
- **Password hashing**: scrypt with random salt
- **Role-based access**: CHIRURGIEN, ASSISTANT, ADMIN roles
- **Protected routes**: All /api/* routes require authentication
- **Session secret**: Required via SESSION_SECRET environment variable

### Multi-Tenant Architecture
- **Organisations**: Each cabinet/clinic has its own isolated data
- All data tables include `organisationId` for tenant isolation
- Users are linked to organisations, ensuring data separation
- Default organisation: "Cabinet par défaut" (ID: default-org-001)

### Key Data Models
- **Organisations**: Multi-tenant containers (id, nom, createdAt)
- **Users**: Authentication with username, hashed password, role, and organisationId
- **Patients**: Core entity with personal info, medical context, and organisationId
- **Operations**: Surgical interventions linked to patients and organisations
- **Implants**: Individual implants with manufacturer details, positioning, ISQ tracking, and organisationId
- **Radios**: Radiograph images (panoramic, CBCT, retroalveolar) with organisationId
- **Visites**: Follow-up visits with ISQ measurements, notes, and organisationId

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (forms, cards, timeline)
│   ├── pages/           # Route pages (patients, patient-details, implant-details, dashboard)
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── db.ts            # Database connection (Pool singleton, SSL, health check)
│   ├── routes.ts        # API endpoint definitions
│   ├── storage.ts       # Database operations interface
│   └── objectStorage.ts # File upload handling
├── db/                  # Database management
│   ├── schema.sql       # Source of truth for DB structure
│   ├── seed.dev.sql     # Test data (dev only)
│   ├── scripts/         # Migration scripts
│   └── README.md        # DB documentation
├── docs/                # Documentation
│   └── setup.md         # Environment setup guide
└── shared/              # Shared code
    └── schema.ts        # Drizzle schema and Zod types
```

## External Dependencies

### Database
- **Supabase PostgreSQL**: Two separate projects (cassius-dev, cassius-prod)
- **Connection**: Via session pooler (port 6543) - required for Replit IPv6 compatibility
- **Drizzle ORM**: Type-safe database queries with automatic schema inference
- **Health Check**: GET /api/health/db returns connection status and latency

### Object Storage
- **Google Cloud Storage**: Radiograph image storage via Replit sidecar at `http://127.0.0.1:1106`
- **Uppy + AWS S3**: Client-side upload handling with signed URLs

### UI Libraries
- **Radix UI**: Accessible component primitives (dialog, popover, select, tabs, etc.)
- **Lucide React**: Icon library
- **Tailwind CSS**: Utility-first styling

### Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation shared between client and server
- **drizzle-zod**: Automatic Zod schema generation from Drizzle tables

### Development
- **Vite**: Development server with HMR
- **esbuild**: Production bundling for server
- **TypeScript**: Full type safety across the stack