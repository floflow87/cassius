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
- **Google Calendar Integration:**
    - **One-way sync (Cassius to Google):** Exports Cassius appointments to Google Calendar.
    - **Standard OAuth 2.0:** Secure, production-ready integration with automatic token refresh and CSRF protection.
    - **Multi-tenant:** Supports organization-level and user-level OAuth credentials.
    - **Multi-environment:** Configurable for production and staging environments with environment-specific OAuth credentials and redirect URIs.
    - **Two-way sync (Google to Cassius):** Imports Google Calendar events into Cassius, handling conflicts and avoiding re-import of exported events.

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