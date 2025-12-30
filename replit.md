# Cassius - Dental Implantology Management Platform

## Overview
Cassius is a SaaS platform for dental implantologists, designed to streamline clinical documentation. It manages patient records, surgical operations, implant tracking, radiograph storage, and follow-up visits, including ISQ measurements. The platform aims to enhance efficiency, accuracy, and compliance in dental implantology practices. Key capabilities include patient management, detailed surgical documentation, radiograph organization, ISQ tracking, timeline views, and clinical notes with predefined tags.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
Cassius uses a modern full-stack architecture focusing on scalability and responsiveness.

### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui (Radix primitives, Tailwind CSS).
- **Design System**: Carbon Design System principles.
- **Styling**: Tailwind CSS with CSS variables for theming.
- **Forms**: React Hook Form with Zod validation.
- **File Uploads**: Uppy with AWS S3 integration.

### Backend
- **Runtime**: Node.js with TypeScript.
- **Framework**: Express.js for RESTful APIs.
- **Build Tools**: esbuild (server), Vite (client).

### Data Storage
- **Database**: PostgreSQL, managed by Supabase.
- **ORM**: Drizzle ORM for type-safe queries.
- **Object Storage**: Supabase Storage for radiographs and documents.

### Authentication
- **Mechanism**: Session-based using Passport.js (LocalStrategy).
- **Security**: scrypt for password hashing, JWT for sessions.
- **Access Control**: Role-based (CHIRURGIEN, ASSISTANT, ADMIN).
- **Protected Routes**: All `/api/*` routes require authentication.

### Multi-Tenancy
- Supports multiple organizations with data isolation via `organisationId` in core tables.

### Key Data Models
- **Organisations**: Top-level tenant entities.
- **Users**: Authenticated individuals with roles.
- **Patients**: Personal and medical data.
- **Operations**: Records of surgical interventions.
- **Implants**: Product catalog (type, brand, reference, dimensions, lot).
- **Surgery Implants**: Placement data for implants during surgery (site, status, ISQ, bone type, loading, notes).
- **Radios**: Stored radiograph images.
- **Appointments**: Unified system for all visit types (CONSULTATION, SUIVI, CHIRURGIE, CONTROLE, URGENCE, AUTRE) and statuses (UPCOMING, COMPLETED, CANCELLED). Can link to operations and surgery implants for ISQ tracking.
- **Documents**: General PDF management.
- **Notes**: Clinical notes with customizable tags.

### Data Model Architecture
Implant tracking uses `implants` (catalog) and `surgery_implants` (placement data linked to surgeries). Patient implant access is via patients → surgeries → surgery_implants → implants.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend, database, storage interfaces.
- `db/`: Database schema, seeding, migrations.
- `shared/`: Shared Drizzle schema, Zod types.

### UI/UX Decisions
- Carbon Design System principles for medical aesthetic.
- Tailwind CSS with CSS variables for flexible theming (light/dark modes).
- `shadcn/ui` for accessible and customizable components.

### Technical Implementations
- **Performance Optimizations**:
    - Request instrumentation with timing and query counting.
    - N+1 query elimination through efficient JOINs in `server/storage.ts`.
    - Lazy signed URL loading for object storage.
    - Multi-column database indexes for query optimization.
    - Summary endpoints for efficient data retrieval.
- **Timeline Features**:
    - `GET /api/operations/:id/timeline` endpoint for chronological surgery events.
    - Event types: SURGERY, ISQ, VISIT, RADIO.
    - ISQ delta calculation and stability indicators.
    - Appointments linked to surgery implants or operations.
- **Unified Appointments System**:
    - CRUD API endpoints for appointments.
    - Comprehensive schema including type, status, dates, ISQ, and optional links to operations/radios.
    - Frontend components for appointment display and forms.
    - Migration of legacy `visites` data to the new appointments table.
- **Clinical Flag System**:
    - Automated alerts (CRITICAL, WARNING, INFO) for clinical issues and data completeness.
    - Flag types include `ISQ_LOW`, `ISQ_DECLINING`, `NO_RECENT_ISQ`, `NO_POSTOP_FOLLOWUP`, `MISSING_DOCUMENT`, etc.
    - API endpoints for listing, creating, resolving, and detecting flags.
    - New `/api/patients/:patientId/flags` endpoint returns `{ patientFlags, implantFlagsById }`.
    - `server/flagEngine.ts` for detection logic.
    - Frontend components for displaying flags on patient cards, details, and dashboards.
    - Flags are associated with entities like PATIENT, OPERATION, IMPLANT.
    - Patient details: Header shows patient-level alerts with tooltip; implant table shows per-implant flags.
    - Notes tab: Alerts interleaved chronologically with clinical notes, colored by severity.
- **Document Explorer**:
    - Global Documents page at `/documents` with folder tree navigation.
    - Virtual folders: Patients (grouped by patient), Actes (grouped by operation), Non classés (unlinked).
    - Backend: `getDocumentTree()` and `getDocumentsFiltered()` storage methods.
    - API: `GET /api/documents/tree` for folder structure, `GET /api/documents` with filters.
    - Shared types: `DocumentTree`, `DocumentTreeNode`, `DocumentFilters` in `shared/types.ts`.
    - Features: breadcrumb navigation, search, sort (date/name/size), document actions (view, download, rename, delete).
    - Document viewer modal for inline viewing of images and PDFs.
    - Documents can optionally link to operations via `operationId` foreign key.
- **Calendar Page**:
    - Professional scheduling page at `/calendar` using FullCalendar library.
    - Views: Day, Week, Month, and Agenda (list) views with toggle buttons.
    - 3-column layout: Filters sidebar (mini calendar, type/status filters), main calendar grid, appointment details drawer.
    - API: `GET /api/appointments/calendar` with date range filtering (start, end) and optional filters (types[], statuses[], patientId, operationId).
    - Shared types: `CalendarAppointment`, `CalendarFilters` in `shared/types.ts`.
    - Features: Drag-and-drop rescheduling, quick appointment creation on date click, event click opens detail drawer.
    - Appointment types with color coding: CONSULTATION (blue), SUIVI (green), CHIRURGIE (red), CONTROLE (yellow), URGENCE (orange), AUTRE (gray).
    - AppointmentDrawer: View details, mark complete/cancelled, delete appointments.
    - QuickCreateDialog: Inline form for rapid appointment creation with patient selection.
    - Custom CSS styling for FullCalendar matching the design system with dark mode support.
    - Navigation: Sidebar link and header calendar button.
    - Google Calendar sync indicator in header showing connection status.
- **Google Calendar Integration (OAuth 2.0)**:
    - One-way sync: Cassius appointments automatically sync to Google Calendar.
    - **Standard OAuth 2.0 implementation** (production-ready, replaces Replit connector):
        - OAuth tokens (access_token, refresh_token) stored in `calendar_integrations` table.
        - Automatic token refresh when tokens expire (5-minute buffer).
        - CSRF protection via HMAC-signed state parameter (15-minute expiry).
    - Multi-tenant architecture: Each organization stores their own OAuth credentials.
        - Org-level: `userId=null`, shared across all users in organisation.
        - User-level: `userId` set, overrides org-level for that specific user (Phase B ready).
    - **Multi-Environment Setup (Prod/Staging)**:
        - Each environment (production, staging) requires its own OAuth credentials.
        - Google Cloud Console setup:
            1. Create separate OAuth 2.0 credentials for each environment.
            2. Add environment-specific redirect URIs to each credential:
                - Production: `https://app.cassiuspro.com/api/integrations/google/callback`
                - Staging: `https://staging.cassiuspro.com/api/integrations/google/callback`
        - Environment variables per environment:
            - `GOOGLE_CLIENT_ID` - Environment-specific OAuth client ID.
            - `GOOGLE_CLIENT_SECRET` - Environment-specific OAuth client secret.
            - `GOOGLE_REDIRECT_URI` - Must match the callback URL for that environment.
            - `APP_BASE_URL` - Base URL for that environment (used for post-OAuth redirects).
        - The `/api/integrations/google/env-check` endpoint (admin-only) shows:
            - Which variables are configured.
            - Masked URLs for `APP_BASE_URL` and `GOOGLE_REDIRECT_URI` to verify correct environment.
        - OAuth callback redirects to `${APP_BASE_URL}/settings/integrations/google-calendar?connected=1`.
    - Required environment variables:
        - `GOOGLE_CLIENT_ID` - OAuth client ID from Google Cloud Console.
        - `GOOGLE_CLIENT_SECRET` - OAuth client secret from Google Cloud Console.
        - `GOOGLE_REDIRECT_URI` - Callback URL (e.g., `https://your-app.replit.app/api/integrations/google/callback`).
        - `APP_BASE_URL` - Base URL for redirects (e.g., `https://your-app.replit.app`).
    - Settings page at `/settings/integrations/google-calendar` for configuration.
    - Backend: `server/googleCalendar.ts` for OAuth flow and API interactions.
    - Database:
        - `calendar_integrations` table with OAuth token columns: `accessToken`, `refreshToken`, `tokenExpiresAt`, `scope`, `providerUserEmail`.
        - `appointment_external_links` table for future V2 multi-calendar mapping.
        - Integration-level sync tracking: `syncErrorCount`, `lastSyncError`, `lastSyncAt`.
    - Appointments track sync status via `externalEventId`, `syncStatus`, `lastSyncedAt`, `syncError` fields.
    - API endpoints:
        - `GET /api/integrations/google/connect` - Generate OAuth authorization URL.
        - `GET /api/integrations/google/callback` - Handle OAuth callback, exchange code for tokens.
        - `GET /api/integrations/google/status` - Connection status and integration info.
        - `GET /api/integrations/google/env-check` - Admin-only endpoint showing env vars status and masked URLs.
        - `GET /api/integrations/google/calendars` - List available calendars.
        - `PATCH /api/integrations/google/settings` - Update integration settings.
        - `POST /api/integrations/google/sync-now` - Trigger manual sync with structured response:
            - Returns `{ created, updated, skipped, failed, failures[], total, message? }`.
            - Individual failure tracking with `{ appointmentId, reason, googleCode? }`.
            - Structured logging with `[SYNC]` prefix for debugging.
            - Explicit error codes: `INTEGRATION_NOT_FOUND`, `NOT_CONNECTED`, `TOKEN_INVALID`, etc.
            - Google API error parsing: 401 (expired), 403 (permissions), 404 (calendar not found), 429 (rate limit).
        - `DELETE /api/integrations/google/disconnect` - Clear tokens and disconnect.
    - Features: Connect/disconnect Google account, select target calendar, enable/disable sync, manual sync trigger, error display.
    - Events created with `[Cassius]` prefix and extendedProperties.cassiusAppointmentId for identification.
- **Settings Pages**:
    - 2-column layout with sidebar navigation (Profile, Organization, Integrations, Security).
    - `/settings/integrations` lists available integrations as cards.
    - Integration configuration pages under `/settings/integrations/{provider}`.

## External Dependencies

### Database
- **Supabase PostgreSQL**: For development and production databases.
- **Drizzle ORM**: For type-safe database interactions.

### Object Storage
- **Supabase Storage**: For storing patient radiographs and PDF documents.

### UI Libraries
- **Radix UI**: For accessible component primitives.
- **Lucide React**: Icon library.
- **Tailwind CSS**: For utility-first styling.

### Form Handling
- **React Hook Form**: For form state and validation.
- **Zod**: For schema validation.
- **drizzle-zod**: For generating Zod schemas from Drizzle tables.

### Development Tools
- **Vite**: Frontend development server.
- **esbuild**: Server-side code bundling.
- **TypeScript**: Type safety across the codebase.