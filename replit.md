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

## Règles de Suggestion de Statut d'Implant (15 règles)

Le système analyse automatiquement les mesures ISQ et le statut actuel pour suggérer des changements de statut. Voici les 15 règles implémentées :

| # | Statut actuel | Condition ISQ | Suggestion | Confiance |
|---|---------------|---------------|------------|-----------|
| 1 | Tous | ISQ 6 mois ≥ 70 | SUCCES | Haute |
| 2 | Tous | ISQ 3 mois ≥ 60 stable | SUCCES | Moyenne |
| 3 | Tous | Chute ISQ > 15 pts | COMPLICATION | Haute |
| 4 | Tous | ISQ ≤ 50 | ECHEC | Haute |
| 5 | Tous | ISQ 51-59 | COMPLICATION | Moyenne |
| 6 | ECHEC | ISQ ≥ 60 | EN_SUIVI | Moyenne |
| 7 | ECHEC | ISQ ≥ 65 | SUCCES | Basse |
| 8 | COMPLICATION | ISQ ≥ 70 | SUCCES | Moyenne |
| 9 | COMPLICATION | ISQ 60-69 | EN_SUIVI | Moyenne |
| 10 | SUCCES | ISQ < 60 | COMPLICATION | Haute |
| 11 | SUCCES | ISQ 60-69 | EN_SUIVI | Moyenne |
| 12 | EN_SUIVI | ISQ ≥ 70 | SUCCES | Haute |
| 13 | EN_SUIVI | ISQ 65-69 + 3 mois | SUCCES | Moyenne |
| 14 | EN_SUIVI | ISQ 60-64 + 6 mois | SUCCES | Basse |
| 15 | EN_SUIVI | ISQ 60-69 | SUCCES | Basse/Moyenne |

Les suggestions sont affichées sur le détail de l'implant et peuvent être appliquées en un clic.