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