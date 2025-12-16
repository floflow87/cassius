# Cassius Design Guidelines

## Design Approach

**System Selected**: Carbon Design System (IBM)  
**Rationale**: Medical documentation platform requiring professional aesthetic, high information density, efficient data entry workflows, and enterprise-grade reliability. Carbon's focus on data-heavy applications and clinical clarity makes it ideal for healthcare professionals.

**Design Principles**:
- Clinical precision over visual flair
- Information hierarchy optimized for rapid scanning
- Trust and professionalism in every interaction
- Efficient workflows for time-constrained medical professionals

---

## Typography

**Font Family**: IBM Plex Sans (primary), IBM Plex Mono (data/codes)

**Hierarchy**:
- Page Headers: text-3xl font-semibold (Patient name, Operation details)
- Section Headers: text-xl font-medium (Timeline, Implants List)
- Subsections: text-base font-semibold (Form sections, Card titles)
- Body Text: text-sm font-normal (Form labels, descriptions)
- Data/Metrics: text-sm font-mono (ISQ values, measurements, FDI codes)
- Helper Text: text-xs (Field hints, timestamps)

---

## Layout System

**Spacing Units**: Tailwind 4, 6, 8, 12, 16 for consistent rhythm (p-4, gap-6, mb-8, py-12, mt-16)

**Container Strategy**:
- Main Application: max-w-7xl with side navigation
- Forms: max-w-3xl centered for focused data entry
- Data Tables: Full-width within container for maximum information density
- Modals: max-w-2xl for operation/implant creation

---

## Component Library

### Navigation
- **Sidebar**: Fixed left navigation (w-64) with patient search, main menu (Patients, Operations, Statistics), user profile
- **Top Bar**: Breadcrumb navigation, patient context indicator when viewing patient data, quick actions

### Data Display
- **Patient Card**: Compact header with name, age, gender, contact - expandable for medical context
- **Operation Card**: Date, procedure type badge, implant count, expandable for surgical details
- **Implant Card**: FDI site, manufacturer, status badge (color-coded: success/monitoring/complication), key metrics visible
- **Timeline**: Vertical timeline with date markers, event cards (operations, visits, x-rays), chronological grouping

### Forms
- **Multi-Section Forms**: Accordion-style sections for complex operations (Pre-op → Procedure → Post-op → Implants)
- **Implant Builder**: Inline form within operation creation, ability to add multiple implants sequentially
- **Radio Upload**: Drag-drop zone, type selector, auto-linking to patient/operation/implant context

### Tables
- **Patient List**: Sortable columns (Name, Age, Last Visit, Implant Count), search filter, row actions
- **Implant List**: FDI site, brand, status, ISQ progression, quick view action
- **Visit History**: Date, ISQ value, notes preview, linked x-ray indicator

### Data Visualization
- **ISQ Progression**: Simple line chart showing measurements over time (pose → 2M → 3M → 6M)
- **Status Badges**: Color-coded pills for implant status, operation types, x-ray categories
- **Metrics Dashboard**: Grid of key statistics (total patients, active implants, success rate)

### Interactive Elements
- **Primary Actions**: Solid buttons for critical actions (Create Patient, Save Operation, Upload X-ray)
- **Secondary Actions**: Outlined buttons for navigation, cancel operations
- **Tertiary Actions**: Text links for view details, edit, delete
- **Modals**: Confirmation dialogs, image viewer for x-rays, quick patient lookup
- **Buttons**: All buttons have cursor-pointer for clear interactivity

### Overlays & Dropdowns
- **Dropdown Menus**: Always white background (`bg-white dark:bg-gray-950`) for clarity and consistency
- **Side Panels (Sheet)**: White background, slide-in from right, 540px width for forms
- **Popovers**: White background, subtle shadow for elevation

---

## Functional Patterns

**Search**: Global search in sidebar for patients (by name, ID), filter results by status/date

**Form Validation**: Inline validation for required medical fields, clear error states, confirmation before save

**Loading States**: Skeleton screens for data tables, spinner for image uploads, progress indicators for multi-step forms

**Empty States**: Helpful messages with action prompts ("No implants yet - Add first implant", "Upload x-ray to track progress")

---

## Images

**X-ray Viewer**: Full-width modal with zoom controls, measurement tools, DICOM metadata display - triggered from timeline or implant details

**Profile Photos**: Optional patient photos (circular, 40px thumbnail in lists, 80px in detail view) - placeholder avatar if absent

**No Hero Images**: This is a clinical tool, not a marketing site - dashboard/list views load immediately