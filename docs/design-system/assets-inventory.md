# Cassius Design System - Inventaire des Assets

## Logos

| Fichier | Type | Usage | Emplacement |
|---------|------|-------|-------------|
| `logo-cassius.png` | Logo | Logo principal de l'application | `client/public/assets/logos/` |

### Variantes prévues (non encore créées)

| Fichier | Type | Usage |
|---------|------|-------|
| `logo-cassius-dark.png` | Logo | Version pour fond sombre |
| `logo-cassius-light.png` | Logo | Version pour fond clair |
| `logo-cassius-mark.png` | Logo | Icône seule (sans texte) |

## Icônes de navigation

| Fichier | Type | Usage | Emplacement |
|---------|------|-------|-------------|
| `home.png` | Icône | Navigation - Accueil/Dashboard | `client/public/assets/icons/` |
| `patient.png` | Icône | Navigation - Patients | `client/public/assets/icons/` |
| `implants.png` | Icône | Navigation - Implants | `client/public/assets/icons/` |
| `visites.png` | Icône | Navigation - Visites de suivi | `client/public/assets/icons/` |
| `actes.png` | Icône | Navigation - Actes/Opérations | `client/public/assets/icons/` |
| `statistiques.png` | Icône | Navigation - Statistiques | `client/public/assets/icons/` |
| `settings.png` | Icône | Navigation - Paramètres | `client/public/assets/icons/` |
| `notif.png` | Icône | Notifications | `client/public/assets/icons/` |

## Stratégie icônes (RÈGLE)

> **Les icônes PNG dans `public/assets/icons/` sont utilisées via `<img src="/assets/icons/...">`**
> **Les icônes génériques utilisent `lucide-react`**

### Quand utiliser quoi ?

| Type | Source | Usage |
|------|--------|-------|
| Navigation métier Cassius | PNG dans `public/assets/icons/` | Sidebar, menus |
| Actions génériques (edit, delete, add) | `lucide-react` | Boutons, actions |
| Indicateurs UI (chevron, check, x) | `lucide-react` | Composants |

### Si on veut des icônes SVG React

Convertir les PNG en composants SVG dans `client/src/design-system/icons/` :
```tsx
// client/src/design-system/icons/ImplantIcon.tsx
export function ImplantIcon({ className }: { className?: string }) {
  return <svg className={className}>...</svg>;
}
```

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
