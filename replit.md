# Cassius - Plateforme de Gestion en Implantologie Dentaire

## Overview

Cassius is a comprehensive SaaS platform designed for dental implantologists to streamline clinical documentation and practice management. It offers full patient management, detailed surgical tracking, radiography storage, visit tracking with ISQ measurements, and bidirectional Google Calendar integration. The platform aims to provide a complete solution for dental implantology practices, improving efficiency and patient care.

## User Preferences

- **Style de communication** : Langage simple et quotidien
- **Langue** : Français
- **Timezone par défaut** : Europe/Paris

## System Architecture

Cassius utilizes a modern full-stack architecture. The frontend is built with **React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS**, and **shadcn/ui** for a responsive and intuitive user interface. The backend is powered by **Node.js** and **Express.js** with **TypeScript**, providing robust API endpoints.

**Key Architectural Decisions:**

*   **Multi-tenancy:** Data isolation is enforced per organization, ensuring data privacy and security for each dental practice.
*   **Data Layer:** **PostgreSQL** (hosted on Supabase) serves as the primary database, managed by **Drizzle ORM** for type-safe interactions.
*   **Authentication:** Secured using **Passport.js, JWT**, and **scrypt** for password hashing.
*   **Clinical Alert System:** Automated flags (e.g., `ISQ_CRITICAL`, `NO_POSTOP_FOLLOWUP`) are triggered and re-evaluated based on patient and implant data, providing proactive clinical insights.
*   **Google Calendar Integration:** Bidirectional synchronization of appointments with conflict management and multi-calendar support.
*   **Design System:**
    *   **Status Colors:** A defined color palette for clinical statuses (e.g., Blue for `EN_SUIVI`, Green for `SUCCES`, Red for `ECHEC`).
    *   **Typography:** Consistent typographic scale for titles (`text-base font-medium`), content (`text-xs`), and badges (`text-[10px]`).
*   **Roles and Permissions:**
    *   **Collaborator (Chirurgien):** Full clinical access (create/edit patients, operations, implants, appointments).
    *   **Assistant:** View-only access to patient/act info, manages appointments. Limited administrative access.
    *   **Admin (Administrateur):** All Collaborator permissions plus team management, organization settings, and integrations. The initial user is designated "Propriétaire" with unchangeable Admin role.
*   **Data Model Highlights:**
    *   `organisations`: Stores practice details, timezone, and custom settings.
    *   `users`: User authentication and role management.
    *   `patients`: Comprehensive patient records including medical history and status.
    *   `operations`: Detailed surgical intervention records.
    *   `surgery_implants`: Tracks individual implants, ISQ measurements, and status.
    *   `appointments`: Manages all types of patient visits with Google Calendar sync status.
    *   `flags`: Automated clinical alerts linked to entities.
    *   `calendar_integrations`: Stores OAuth tokens and configuration for Google Calendar.

## External Dependencies

*   **Supabase PostgreSQL**: Managed relational database.
*   **Supabase Storage**: Object storage for clinical documents and radiographies.
*   **Drizzle ORM**: Type-safe ORM for database interactions.
*   **shadcn/ui**: UI component library.
*   **FullCalendar**: JavaScript calendar library for appointment display.
*   **Resend**: Service for sending transactional emails.
*   **Google Calendar API**: For bidirectional calendar synchronization.