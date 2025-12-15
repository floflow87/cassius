# Cassius Design System - Inventaire des Assets

## Logos

| Fichier | Type | Usage | Emplacement |
|---------|------|-------|-------------|
| logo_Cassius_*.png | Logo | Logo principal de l'application | `client/public/assets/logos/` |

## Icônes de navigation

| Fichier | Type | Usage | Emplacement |
|---------|------|-------|-------------|
| home_*.png | Icône | Navigation - Accueil/Dashboard | `client/public/assets/icons/` |
| patient_*.png | Icône | Navigation - Patients | `client/public/assets/icons/` |
| implants_*.png | Icône | Navigation - Implants | `client/public/assets/icons/` |
| visites_*.png | Icône | Navigation - Visites de suivi | `client/public/assets/icons/` |
| actes_*.png | Icône | Navigation - Actes/Opérations | `client/public/assets/icons/` |
| statistiques_*.png | Icône | Navigation - Statistiques | `client/public/assets/icons/` |
| settings_*.png | Icône | Navigation - Paramètres | `client/public/assets/icons/` |
| notif_*.png | Icône | Notifications | `client/public/assets/icons/` |

## Recommandations

### Pour les icônes

- Préférer les icônes de `lucide-react` pour les icônes génériques
- Utiliser les PNG fournis pour les icônes métier spécifiques
- Les icônes doivent être monochromes (s'adaptent au thème)

### Import des assets

```tsx
// Import statique (recommandé pour Vite)
import logoUrl from "@assets/logos/logo_Cassius.png";

// Utilisation
<img src={logoUrl} alt="Cassius Logo" />

// Ou depuis public/
<img src="/assets/logos/logo_Cassius.png" alt="Cassius Logo" />
```

### Conventions de nommage

- `kebab-case` pour les noms de fichiers
- Suffixe explicite pour les variantes : `logo-dark.png`, `icon-small.svg`
- Pas d'espaces ni de caractères spéciaux

## Structure des dossiers

```
client/public/assets/
├── logos/              # Logos Cassius (PNG, SVG)
├── icons/              # Icônes de navigation et UI
├── illustrations/      # Illustrations pour pages vides, onboarding
├── images/             # Photos, backgrounds
└── fonts/              # Polices personnalisées (si non CDN)
```
