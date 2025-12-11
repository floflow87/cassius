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
- Basic search functionality

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit (`drizzle-kit push`)
- **Object Storage**: Google Cloud Storage via Replit's sidecar service for radiograph images

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
│   ├── routes.ts        # API endpoint definitions
│   ├── storage.ts       # Database operations interface
│   └── objectStorage.ts # File upload handling
└── shared/              # Shared code
    └── schema.ts        # Drizzle schema and Zod types
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries with automatic schema inference

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