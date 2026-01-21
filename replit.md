# Cassius - Dental Implantology Management Platform

## Overview
Cassius is a SaaS platform designed for dental implantologists to streamline clinical documentation. Its primary purpose is to enhance efficiency, accuracy, and compliance in dental implantology practices by managing patient records, surgical operations, implant tracking, radiograph storage, and follow-up visits, including ISQ measurements. Key capabilities include patient management, detailed surgical documentation, radiograph organization, ISQ tracking, timeline views, and clinical notes with predefined tags. The project aims to provide a comprehensive solution for dental implantology workflows, improving clinical outcomes and practice management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
Cassius utilizes a modern full-stack architecture built for scalability and responsiveness, adhering to a medical aesthetic inspired by Carbon Design System.

**UI/UX Decisions:**
- **Design System:** Carbon Design System principles.
- **Styling:** Tailwind CSS with CSS variables for flexible theming (light/dark modes).
- **Components:** `shadcn/ui` (built on Radix primitives) for accessible and customizable UI components.
- **Layouts:** 2-column for settings, 3-column for calendar, unified appointment displays.
- **Typography:** `text-base font-medium` for section titles, `text-xs` for content, `text-[10px]` for badges.
- **Status Colors:** Standardized color palette for status badges (e.g., blue for "EN_SUIVI", green for "SUCCES", amber for "COMPLICATION", red for "ECHEC").

**Technical Implementations:**
- **Frontend:** React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, React Hook Form with Zod for forms, Uppy for file uploads.
- **Backend:** Node.js with TypeScript and Express.js for RESTful APIs.
- **Data Storage:** PostgreSQL managed by Supabase, with Drizzle ORM for type-safe queries. Supabase Storage for object storage.
- **Authentication:** Session-based using Passport.js (LocalStrategy) with scrypt for password hashing and JWT for sessions. Implements role-based access control (CHIRURGIEN, ASSISTANT, ADMIN).
- **Multi-Tenancy:** Supports multiple organizations with data isolation using `organisationId`.
- **Key Data Models:** Organisations, Users, Patients, Operations, Implants, Surgery Implants, Radios, Appointments, Documents, Notes, designed for comprehensive dental implantology workflows.
- **Performance Optimizations:** Request instrumentation, N+1 query elimination, lazy signed URL loading, multi-column indexes, summary endpoints.
- **Timeline Features:** Chronological views of surgery events, ISQ measurements, visits, and radiographs, including ISQ delta calculations.
- **Unified Appointments System:** Manages various visit types (CONSULTATION, SUIVI, CHIRURGIE, CONTROLE, URGENCE, AUTRE) with CRUD APIs and status tracking.
- **Clinical Flag System:** Automated alerts (CRITICAL, WARNING, INFO) for clinical issues and data completeness based on ISQ values and follow-up status.
- **Actes Page:** Features tabbed interface for operations and surgery implants, with search, sorting, filtering, and persistent column reordering.
- **Document Explorer:** Global document management with folder tree navigation, search, sort, document viewer, and detailed radiograph management including notes.
- **Calendar Page:** Professional scheduling page using FullCalendar with day, week, month, and agenda views, drag-and-drop rescheduling, quick appointment creation, and unified display of Cassius and Google Calendar events.
- **Google Calendar Integration:** Bi-directional synchronization with Google Calendar, supporting standard OAuth 2.0, multi-tenant and multi-environment configurations, and conflict resolution.
- **CSV Patient Import:** 5-step wizard for importing patient data with field mapping, data normalization, smart matching with collision detection, idempotent upserts, and error export.
- **Patient Share Links:** Secure, time-limited links for sharing patient implant data externally, with token security, expiration options, revocation, and access tracking.
- **Transactional Email System:** Comprehensive email system for password resets, email verification, collaborator invitations, account notifications, and subscription updates, using 6 professional French medical-themed templates via Resend. Includes robust security features and graceful degradation.
- **Notification System:** In-app notification system with user preferences, categorizing alerts (Clinical, Team, Imports, System) and providing detailed context, including patient information.
- **Onboarding Wizard:** 8-step onboarding process for new organizations covering practice setup, team invitation, data import, first clinical case, calendar integration, notifications, and document upload, with persistent state, auto-save, and progress tracking.

## External Dependencies
- **Supabase PostgreSQL:** Database hosting and management.
- **Supabase Storage:** Cloud storage for files.
- **Drizzle ORM:** Type-safe query builder for PostgreSQL.
- **Radix UI:** Headless UI component primitives.
- **Lucide React:** Icon library.
- **Tailwind CSS:** Utility-first CSS framework.
- **React Hook Form:** Form management library.
- **Zod:** Schema validation library.
- **drizzle-zod:** Zod schema generation from Drizzle.
- **FullCalendar:** JavaScript event calendar.
- **Uppy:** File uploader.
- **Resend:** Transactional email service.