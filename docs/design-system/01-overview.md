# Cassius Design System - Vue d'ensemble

## Philosophie

Le design system Cassius suit une architecture en couches :

```
Tokens → Composants → Pages
```

1. **Tokens** : Valeurs atomiques (couleurs, espacements, typographie, rayons)
2. **Composants** : Éléments UI réutilisables utilisant les tokens
3. **Pages** : Assemblage de composants pour créer des écrans

## Structure des fichiers

```
client/src/
├── design-system/
│   ├── tokens/           # Valeurs atomiques
│   │   ├── colors.ts     # Couleurs Cassius + sémantiques
│   │   ├── spacing.ts    # Échelle d'espacement
│   │   ├── typography.ts # Polices et styles de texte
│   │   ├── radii.ts      # Border-radius
│   │   └── index.ts      # Export consolidé
│   ├── theme/
│   │   └── index.ts      # Thème central (point d'entrée)
│   ├── components/       # Composants UI du design system
│   └── icons/            # Icônes SVG en composants React
├── components/ui/        # Composants shadcn/ui (base)
└── styles/
    └── globals.css       # Variables CSS globales (si séparé)

client/public/assets/
├── logos/                # Logo Cassius
├── icons/                # Icônes statiques (PNG/SVG)
├── illustrations/        # Illustrations
├── images/               # Images génériques
└── fonts/                # Polices personnalisées

docs/design-system/
├── 01-overview.md        # Ce fichier
├── 02-tokens.md          # Documentation des tokens
├── 03-components.md      # Documentation des composants
└── assets-inventory.md   # Inventaire des assets
```

## Règles de contribution

### Où mettre quoi ?

| Type de fichier | Emplacement |
|-----------------|-------------|
| Nouvelle couleur | `tokens/colors.ts` |
| Nouveau composant UI générique | `design-system/components/` |
| Composant métier (patient, implant...) | `components/` |
| Icône SVG réutilisable | `design-system/icons/` |
| Asset statique (logo, image) | `client/public/assets/` |

### Conventions de nommage

- **Fichiers tokens** : `camelCase` pour les clés, MAJUSCULES pour les constantes
- **Composants** : `PascalCase.tsx`
- **Assets** : `kebab-case.png` ou `snake_case.png`
- **Variables CSS** : `--kebab-case`

## Principes clés

1. **Source unique de vérité** : Les tokens sont définis une seule fois
2. **Pas de hex en dur** : Utiliser les tokens ou classes Tailwind
3. **Dark mode natif** : Toutes les couleurs ont leur variante sombre
4. **Accessibilité** : Contraste minimum WCAG AA

## Import type

```typescript
// Import du thème complet
import { theme } from "@/design-system/theme";

// Import de tokens spécifiques
import { cassiusColors, spacing } from "@/design-system/tokens";

// Accès aux couleurs
const primaryColor = theme.colors.cassius.mainBlue; // "#2563EB"
```
