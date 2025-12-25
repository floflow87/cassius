# Cassius - Dental Implantology Management Platform

## Overview

Cassius is a SaaS platform designed for dental implantologists, providing a comprehensive solution for clinical documentation management. It streamlines patient record keeping, surgical operation logging, implant tracking, radiograph storage, and follow-up visit management, including ISQ measurements.

The platform's core capabilities include:
- Managing patient demographics and clinical histories.
- Documenting surgical procedures with detailed implant information.
- Storing and organizing radiographs and other clinical images.
- Tracking implant stability over time with ISQ measurements.
- Providing timeline views for patients and implants.
- Facilitating clinical notes with predefined tags for various medical contexts.
- Offering basic search functionalities for efficient data retrieval.

Cassius aims to enhance efficiency, accuracy, and compliance in dental implantology practices, offering a robust tool for modern oral surgeons.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

Cassius employs a modern full-stack architecture designed for scalability, maintainability, and a responsive user experience.

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter for lightweight client-side navigation.
- **State Management**: TanStack React Query handles server state.
- **UI Components**: shadcn/ui (built on Radix primitives and Tailwind CSS) ensures accessible and customizable components.
- **Design System**: Follows Carbon Design System principles for a professional medical aesthetic.
- **Styling**: Tailwind CSS with CSS variables supports theming, including light/dark modes.
- **Forms**: React Hook Form with Zod for robust form management and validation.
- **File Uploads**: Uppy with AWS S3 integration is used for client-side file uploads.

### Backend Architecture
- **Runtime**: Node.js with TypeScript.
- **Framework**: Express.js for RESTful API endpoints under `/api/*`.
- **Build Tools**: esbuild for server bundling and Vite for client development.

### Data Storage
- **Database**: PostgreSQL, managed by Supabase, with separate projects for development and production environments.
- **ORM**: Drizzle ORM provides type-safe queries and schema management.
- **Schema**: Defined in `shared/schema.ts` (Drizzle) and `db/schema.sql` (raw SQL).
- **Object Storage**: Supabase Storage is utilized for storing radiographs and other documents, replacing Replit Object Storage.

### Authentication
- **Mechanism**: Session-based authentication using Passport.js with LocalStrategy.
- **Security**: Passwords hashed with scrypt, and JWT for secure sessions.
- **Access Control**: Role-based access for CHIRURGIEN, ASSISTANT, and ADMIN roles.
- **Protected Routes**: All `/api/*` routes require authentication.

### Multi-Tenant Architecture
- **Organisations**: The platform supports multi-tenancy, isolating data for each dental cabinet/clinic.
- All core data tables include an `organisationId` to enforce tenant isolation.

### Key Data Models
- **Organisations**: Top-level entities for tenant isolation.
- **Users**: Authenticated individuals with specific roles within an organization.
- **Patients**: Central entity, storing personal and medical data.
- **Operations (Surgeries)**: Records of surgical interventions.
- **Implants**: Product catalog - implant specifications (brand, diameter, length, reference, lot).
- **Surgery Implants**: Implants placed during surgery - links surgeries to implants with placement data (site FDI, status, ISQ measurements, bone type, loading, notes).
- **Radios**: Stored radiograph images (panoramic, CBCT, retroalveolar).
- **Appointments** (NEW - December 2025): Unified appointment system replacing separate "visites" and "rendez-vous". Supports multiple types (CONSULTATION, SUIVI, CHIRURGIE, CONTROLE, URGENCE, AUTRE) and statuses (UPCOMING, COMPLETED, CANCELLED). Can be linked to operations and surgery implants for ISQ tracking.
- **Visites** (LEGACY): Follow-up appointments migrated to appointments table. Old visites data preserved as COMPLETED SUIVI appointments.
- **Documents**: General PDF document management (quotes, consents, reports).
- **Notes**: Clinical notes with customizable tags (Consultation, Chirurgie, Suivi, Complication, Administrative).

### Data Model Architecture
The implant tracking uses a two-table design:
- **implants** (catalog): Contains product information - typeImplant, marque, referenceFabricant, diametre, longueur, lot
- **surgery_implants** (placement): Contains placement data - surgeryId, implantId, siteFdi, positionImplant, typeOs, miseEnCharge, greffe, isqPose, isqContrôle, statut, datePose, notes

Patient implant access path: patients → surgeries → surgery_implants → implants (via joins)

Frontend components use `SurgeryImplantWithDetails` type which includes the full implant details via the `implant` property.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend, including database and storage interfaces.
- `db/`: Database schema, seeding, and migration scripts.
- `shared/`: Shared Drizzle schema and Zod types.

## External Dependencies

### Database
- **Supabase PostgreSQL**: Used for both development (`cassius-dev`) and production (`cassius-prod`) databases. Connection is established via a session pooler (port 6543) for compatibility.
- **Drizzle ORM**: Integrated for type-safe database interactions and schema management.

### Object Storage
- **Supabase Storage**: Utilized for storing patient radiographs and PDF documents. This provides dynamic signed URLs for secure access and direct frontend uploads.

### UI Libraries
- **Radix UI**: Provides accessible and unstyled component primitives.
- **Lucide React**: Icon library for consistent iconography.
- **Tailwind CSS**: Employed for utility-first styling and responsive design.

### Form Handling
- **React Hook Form**: Manages form state and validation.
- **Zod**: Used for schema validation, ensuring data integrity across client and server.
- **drizzle-zod**: Generates Zod schemas directly from Drizzle tables.

### Development Tools
- **Vite**: Powers the frontend development server with Hot Module Replacement (HMR).
- **esbuild**: Used for fast server-side code bundling.
- **TypeScript**: Ensures type safety throughout the entire codebase.

## Performance Optimizations (December 2025)

### Request Instrumentation
- **Timing Middleware**: All requests tracked with X-Response-Time header
- **Query Counting**: AsyncLocalStorage-based context for monitoring database queries per request
- **Diagnostic Endpoints**: `/api/perf/stats`, `/api/perf/all`, `/api/perf/reset` for performance analysis
- **Slow Request Detection**: [SLOW] and [MANY_QUERIES] flags logged for requests exceeding thresholds

### N+1 Query Elimination
The following methods in `server/storage.ts` were refactored from nested loops to efficient JOIN queries:
- `getPatientWithDetails`: Uses 4 batched queries instead of 1 + N + N*M queries
- `getPatientSurgeryImplants`: Single 3-table JOIN (surgeryImplants → implants → operations)
- `getSurgeryImplantsByCatalogImplant`: Single 3-table JOIN
- `getAllSurgeryImplants`: Single 4-table JOIN
- `filterSurgeryImplants`: Single 4-table JOIN with WHERE conditions
- `getSurgeryImplantWithDetails`: Single 4-table JOIN (surgeryImplants → implants → operations → patients) + parallel visites/radios fetch. Reduced from 3 sequential round trips to 2 batches. Includes timing logs: `[IMPLANT-DETAIL] id=X total=Xms join=Xms visites+radios=Xms`

### Lazy Signed URL Loading
- List endpoints (`/api/patients/:id`, `/api/patients/:patientId/radios`, `/api/patients/:patientId/documents`) return `signedUrl: null`
- Frontend uses `fetchFreshSignedUrl` helper for on-demand URL generation when viewing individual files
- Reduces Supabase Storage API calls significantly

### Database Indexes
Multi-column indexes added to `db/migrate-supabase.sql` for query optimization:
- `idx_surgery_implants_org_surgery`: ON surgery_implants(organisation_id, surgery_id)
- `idx_surgery_implants_org_implant`: ON surgery_implants(organisation_id, implant_id)
- `idx_operations_org_patient`: ON operations(organisation_id, patient_id)
- `idx_radios_org_patient`: ON radios(organisation_id, patient_id)
- `idx_radios_org_implant`: ON radios(organisation_id, implant_id) - for implant details page queries
- `idx_patients_org`: ON patients(organisation_id)
- `idx_visites_org_implant`: ON visites(organisation_id, implant_id)
- `idx_documents_org_patient`: ON documents(organisation_id, patient_id)

### Summary Endpoints
- `GET /api/patients/summary`: Returns combined patient list with operation counts and last visit dates in 3 parallel queries
- Frontend patient list uses summary endpoint instead of 3 separate API calls

## Timeline Features (December 2025)

### Surgery Timeline
- **Endpoint**: `GET /api/operations/:id/timeline` - Returns chronological events for a surgery
- **Component**: `SurgeryTimeline` in `client/src/components/surgery-timeline.tsx`
- **Types**: `OperationTimeline`, `TimelineEvent` in `shared/types.ts`

Event types aggregated:
- **SURGERY**: The operation itself with intervention type and notes
- **ISQ**: Initial ISQ measurements from surgery implants (isqPose)
- **VISIT**: Follow-up appointments linked to the operation or surgery implants (uses new appointments table)
- **RADIO**: Radiographs linked to the operation

ISQ Delta Calculation:
- Delta is calculated from the previous ISQ measurement (not just initial isqPose)
- ISQ history is tracked per catalog implant to compute accurate deltas
- Stability indicators: low (<55), moderate (55-70), high (>70)

Appointment-to-SurgeryImplant Mapping:
- Appointments are linked directly to surgery implants (via `appointments.surgeryImplantId`) or operations (via `appointments.operationId`)
- Timeline uses SQL TO_CHAR for date formatting to avoid timezone issues

## Unified Appointments System (December 2025)

### API Endpoints
- `GET /api/patients/:patientId/appointments` - List all appointments for a patient (supports ?status filter)
- `POST /api/patients/:patientId/appointments` - Create new appointment
- `PATCH /api/appointments/:id` - Update appointment (including status changes)
- `DELETE /api/appointments/:id` - Delete appointment

### Appointment Schema
```typescript
{
  id, organisationId, patientId,
  operationId?,      // Optional link to surgery
  surgeryImplantId?, // Optional link for ISQ tracking
  type: CONSULTATION | SUIVI | CHIRURGIE | CONTROLE | URGENCE | AUTRE,
  status: UPCOMING | COMPLETED | CANCELLED,
  title, description?,
  dateStart, dateEnd?,
  isq?,              // ISQ measurement (0-100)
  radioId?           // Optional link to radiograph
}
```

### Frontend Components
- `AppointmentCard` (`client/src/components/appointment-card.tsx`): Displays appointment with dropdown menu (edit, complete, cancel, delete)
- `AppointmentForm` (`client/src/components/appointment-form.tsx`): Create/edit appointment form with type/status selection and ISQ field
- Patient details "Rendez-vous" tab shows upcoming appointments and completed history

### Data Migration
- Legacy visites data migrated to appointments via `db/migrate-visites-to-appointments.sql`
- 51 visites converted to COMPLETED SUIVI appointments with proper surgeryImplantId and operationId links