# Cassius - Dental Implantology Management Platform

## Overview

Cassius is a SaaS platform for dental implantologists, providing clinical documentation management. It supports patient records, surgical operations, implant tracking, radiograph storage, and follow-up visit management with ISQ measurements.

Key capabilities include patient and implant timeline views, clinical notes with categorized tags (Consultation, Chirurgie, Suivi, Complication, Administrative), and basic search functionality. The platform aims to streamline dental implantology practice through comprehensive digital record-keeping and data visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (Radix primitives + Tailwind CSS)
- **Design System**: Carbon Design System principles for a professional medical aesthetic
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)
- **Forms**: React Hook Form with Zod validation
- **File Uploads**: Uppy for client-side uploads

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for RESTful API endpoints
- **Build Tools**: esbuild for server, Vite for client

### Data Storage
- **Database**: Supabase PostgreSQL (two isolated projects for DEV/STAGING and PROD)
- **ORM**: Drizzle ORM for type-safe queries, with schema defined in `shared/schema.ts`
- **Object Storage**: Supabase Storage for radiographs, replacing previous Replit Object Storage. Files are stored in a structured path (`org/{orgId}/patients/{patientId}/radiographies/{docId}/{filename}`), accessed via dynamically generated signed URLs.

### Authentication
- **Session-based**: Passport.js with LocalStrategy
- **Security**: scrypt for password hashing, role-based access control (CHIRURGIEN, ASSISTANT, ADMIN)
- **Environment Variables**: `SESSION_SECRET` and `JWT_SECRET` are critical for security.

### Multi-Tenancy
- Designed for multiple organizations, with all core data tables including an `organisationId` for strict data isolation.

### Core Features
- **Radiograph Management**: Supports various types (PANORAMIQUE, CBCT, RETROALVEOLAIRE). Uploads are direct to Supabase Storage via signed URLs.
- **Clinical Notes**: Records notes with predefined tags, linked to patients.
- **Environment Separation**: Strict isolation between development/staging and production environments using distinct Supabase projects and environment variables.

### Project Structure
Organized into `client/` (React frontend), `server/` (Express backend), `db/` (database scripts/schemas), `docs/`, and `shared/` (common code).

## External Dependencies

- **Supabase PostgreSQL**: Primary database for all application data.
- **Supabase Storage**: Used for storing patient radiograph images.
- **Radix UI**: Provides accessible and unstyled component primitives for UI.
- **Lucide React**: Icon library for the UI.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **React Hook Form**: Library for managing form state and validation.
- **Zod**: Schema declaration and validation library, used for both frontend and backend.
- **Drizzle ORM**: Type-safe ORM for interacting with PostgreSQL.
- **Uppy**: Client-side file upload library.