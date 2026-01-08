# Cassius - Dental Implantology Management Platform

## Overview
Cassius is a SaaS platform designed for dental implantologists to streamline clinical documentation. Its primary purpose is to enhance efficiency, accuracy, and compliance in dental implantology practices by managing patient records, surgical operations, implant tracking, radiograph storage, and follow-up visits, including ISQ measurements. Key capabilities include patient management, detailed surgical documentation, radiograph organization, ISQ tracking, timeline views, and clinical notes with predefined tags.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
Cassius utilizes a modern full-stack architecture built for scalability and responsiveness.

**UI/UX Decisions:**
- **Design System:** Adheres to Carbon Design System principles for a medical aesthetic.
- **Styling:** Uses Tailwind CSS with CSS variables for flexible theming (light/dark modes).
- **Components:** `shadcn/ui` (built on Radix primitives) for accessible and customizable UI components.
- **Layouts:** Features 2-column layouts for settings, 3-column layouts for the calendar, and unified appointment displays.

**Technical Implementations:**
- **Frontend:** React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, React Hook Form with Zod for forms. Uppy for file uploads.
- **Backend:** Node.js with TypeScript and Express.js for RESTful APIs.
- **Data Storage:** PostgreSQL managed by Supabase, with Drizzle ORM for type-safe queries. Supabase Storage for object storage (radiographs, documents).
- **Authentication:** Session-based using Passport.js (LocalStrategy) with scrypt for password hashing and JWT for sessions. Implements role-based access control (CHIRURGIEN, ASSISTANT, ADMIN).
- **Multi-Tenancy:** Supports multiple organizations with data isolation using `organisationId`.
- **Key Data Models:** Includes Organisations, Users, Patients, Operations, Implants, Surgery Implants, Radios, Appointments, Documents, and Notes, all designed to support comprehensive dental implantology workflows.
- **Performance Optimizations:** Includes request instrumentation, N+1 query elimination, lazy signed URL loading for object storage, multi-column indexes, and summary endpoints.
- **Timeline Features:** Provides chronological views of surgery events, ISQ measurements, visits, and radiographs, including ISQ delta calculations.
- **Unified Appointments System:** Manages various visit types (CONSULTATION, SUIVI, CHIRURGIE, CONTROLE, URGENCE, AUTRE) with CRUD APIs and status tracking.
- **Clinical Flag System:** Automated alerts (CRITICAL, WARNING, INFO) for clinical issues and data completeness (e.g., ISQ_LOW, NO_POSTOP_FOLLOWUP).
- **Document Explorer:** Global document management with folder tree navigation, search, sort, and a document viewer, allowing documents to be linked to operations.
- **Calendar Page:** Professional scheduling page using FullCalendar, supporting day, week, month, and agenda views, with drag-and-drop rescheduling and quick appointment creation.
    - **Unified Calendar View:** Displays both Cassius appointments and Google Calendar events in a single view.
    - **Source Filters:** Filter by source (All | Cassius | Google | Conflicts) in the sidebar.
    - **Google Badge:** Google events display a Google icon badge for easy identification.
    - **Event Drawer:** Click on Google events to view details with link to open in Google Calendar.
    - **Conflict Resolution:** View and resolve sync conflicts directly from the calendar.
    - **Persistent Toggle:** "Afficher Google" toggle persisted in localStorage.
- **Google Calendar Integration:**
    - **One-way sync (Cassius to Google):** Exports Cassius appointments to Google Calendar.
    - **Standard OAuth 2.0:** Secure, production-ready integration with automatic token refresh and CSRF protection.
    - **Multi-tenant:** Supports organization-level and user-level OAuth credentials.
    - **Multi-environment:** Configurable for production and staging environments with environment-specific OAuth credentials and redirect URIs.
    - **Two-way sync (Google to Cassius):** Imports Google Calendar events into Cassius, handling conflicts and avoiding re-import of exported events.
    - **API Endpoints:** GET /api/google/imported-events, GET /api/sync/conflicts, PATCH /api/sync/conflicts/:id
- **CSV Patient Import:**
    - **5-step wizard:** Upload, Validate, Review, Import, Complete workflow.
    - **Field mapping:** Supports French column names (Nom, Prénom, Date de naissance, Sexe, Téléphone, Email, Numéro de dossier, NIR, Adresse, Code postal, Ville, Pays).
    - **Normalization:** SSN strips spaces/dots, dates parsed jj/mm/aaaa → ISO, email lowercased.
    - **Smart matching:** file_number → name+DOB → email with collision detection.
    - **Idempotent upserts:** Creates new patients or updates existing with conflict handling.
    - **Error export:** Download CSV of failed rows for correction.
    - **Migration required:** Tables import_jobs, import_job_rows (migration 20241230_008).
- **Patient Share Links:**
    - **Secure sharing:** Generate time-limited links to share patient implant data externally.
    - **Token security:** Tokens hashed with scrypt and unique salt before storage.
    - **Expiration options:** Links can expire after 1, 7, 30, 90 days, or never.
    - **Revocation:** Active links can be revoked at any time.
    - **Access tracking:** Access count and last accessed timestamp tracked.
    - **Public page:** Unauthenticated access to shared data at /share/:token.
    - **API Endpoints:** POST /api/patients/:id/share-links, GET /api/patients/:id/share-links, DELETE /api/patients/:id/share-links/:linkId, GET /api/public/share/:token.

## External Dependencies
- **Supabase PostgreSQL:** Database hosting and management.
- **Supabase Storage:** Cloud storage for files (radiographs, documents).
- **Drizzle ORM:** Type-safe query builder for PostgreSQL.
- **Radix UI:** Headless UI component primitives.
- **Lucide React:** Icon library.
- **Tailwind CSS:** Utility-first CSS framework.
- **React Hook Form:** Library for form management.
- **Zod:** Schema validation library.
- **drizzle-zod:** Integration for generating Zod schemas from Drizzle.
- **FullCalendar:** JavaScript event calendar.
- **Uppy:** File uploader.
- **Resend:** Transactional email service for password resets, email verification, and invitations.

## Transactional Email System
The application includes a comprehensive email system with 6 professional French medical-themed templates using Resend:

**Email Types:**
- **Password Reset:** 1-hour expiry token, scrypt hashing, email enumeration protection
- **Email Verification:** 24-hour expiry token for new account verification
- **Collaborator Invitation:** 7-day expiry token for organization invitations
- **Account Created:** Welcome email for new users
- **Password Changed:** Security notification after password change
- **Subscription Notifications:** Plan upgrade/downgrade notifications

**Security Features:**
- Token hashing uses scrypt with hex encoding and type-specific salts (salt_pw_reset, salt_email_verify, salt_invitation)
- Email enumeration protection: forgot-password always returns success regardless of email existence
- All tokens invalidated after use or when new tokens are generated

**Graceful Degradation:**
All email functions handle missing Resend credentials gracefully - they return success with 'skipped-no-resend' messageId when RESEND_API_KEY is not configured, allowing development without email service.

**Frontend Pages:**
- `/forgot-password` - Password reset request form
- `/reset-password` - Password reset form (with token validation)
- `/accept-invitation` - Invitation acceptance form (with token validation)
- `/verify-email` - Email verification page

## Notification System
The application includes a comprehensive in-app notification system with user preferences:

**Notification Categories:**
- **ALERTS_REMINDERS:** Clinical alerts (ISQ low, ISQ declining, unstable ISQ history)
- **TEAM_ACTIVITY:** Team updates (radio/document uploads, patient updates, role changes)
- **IMPORTS:** Import completion notifications
- **SYSTEM:** Technical notifications (sync errors, integration issues)

**Notification Types (15+):**
- Clinical: ISQ_LOW, ISQ_DECLINING, UNSTABLE_ISQ_HISTORY
- Team: RADIO_ADDED, DOCUMENT_UPLOADED, PATIENT_UPDATED, NEW_MEMBER, ROLE_CHANGED, INVITATION_SENT
- System: SYNC_ERROR, IMPORT_COMPLETED

**Notification Triggers:**
- ISQ < 60: Creates low ISQ alert
- ISQ drop ≥ 10 points: Creates ISQ declining alert
- 3+ consecutive low ISQs: Creates unstable ISQ history alert
- Radio/document uploads: Notifies other team members
- Patient updates: Notifies other team members
- Role changes: Notifies all admins
- New member joins: Notifies all admins
- Google Calendar sync errors: Notifies the user
- CSV import completion: Notifies the importer

**API Endpoints:**
- GET /api/notifications - List notifications (with pagination, filtering)
- GET /api/notifications/unread-count - Get unread count
- PATCH /api/notifications/:id/read - Mark as read
- PATCH /api/notifications/read-all - Mark all as read
- GET /api/notifications/preferences - Get user preferences
- PUT /api/notifications/preferences - Update user preferences

## Onboarding Wizard
The application includes a comprehensive onboarding wizard for new organizations:

**Wizard Steps (8 steps, 0-7):**
- **Step 0 - Welcome:** Practice type (SOLO/CABINET), timezone, language
- **Step 1 - Clinic & Security (required):** Clinic name, phone, address
- **Step 2 - Team & Roles (optional):** Invite collaborators
- **Step 3 - Data (required):** CSV import, demo mode, or manual entry
- **Step 4 - First Clinical Case (required):** Create first operation with implant
- **Step 5 - Calendar (optional):** Google Calendar integration
- **Step 6 - Notifications (optional):** Configure notification preferences
- **Step 7 - Documents (optional):** Upload first document

**Features:**
- Persistent state stored in `onboarding_state` table per organization
- Auto-save with debounce on each action
- Step completion tracking with required/optional distinction
- Skip functionality for optional steps
- Resume from any step via checklist on dashboard
- Progress bar showing overall completion percentage

**API Endpoints:**
- GET /api/onboarding - Get/create onboarding state
- PATCH /api/onboarding - Update step progress and data
- POST /api/onboarding/complete - Mark onboarding as completed

**Frontend:**
- `/onboarding` - Full-screen wizard page
- `<OnboardingChecklist />` - Dashboard component for incomplete onboarding

## Database Configuration
**Important:** The application uses `SUPABASE_DB_URL_DEV` (Supabase PostgreSQL) for development, NOT `DATABASE_URL` (Replit PostgreSQL). 
- `drizzle.config.ts` uses `DATABASE_URL` for migrations
- `server/db.ts` uses `SUPABASE_DB_URL_DEV` for development
- Schema changes must be applied to both databases or use `psql "$SUPABASE_DB_URL_DEV"` to apply directly