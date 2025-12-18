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
- **Visites**: Follow-up appointments, including ISQ measurements and clinical notes.
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