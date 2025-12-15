# Cassius Design System - Tokens

## Couleurs principales

### Palette Cassius

| Token | Valeur HEX | HSL | Usage |
|-------|-----------|-----|-------|
| `mainBlue` | #2563EB | 217 91% 60% | CTA principal, boutons primaires, liens actifs |
| `secondaryBlue` | #0D5C94 | 203 83% 32% | Accents, éléments secondaires, hover |
| `lightBlue` | #DBEAFE | 214 95% 93% | Backgrounds légers, états hover subtils |
| `paleBlue` | #EFF6FF | 214 100% 97% | Backgrounds très subtils |

### Règles d'usage

#### Boutons

- **Primaire** : `bg-primary` (mainBlue) - Action principale de la page
- **Secondaire** : `bg-secondary` (secondaryBlue) - Actions secondaires
- **Ghost** : Transparent avec texte primary - Actions tertiaires
- **Destructive** : Rouge - Actions dangereuses (suppression)

#### États

- **Hover** : Utiliser les classes `hover-elevate` (défini dans index.css)
- **Active** : Utiliser `active-elevate-2`
- **Disabled** : Opacité réduite automatique

### Couleurs sémantiques

| Type | Couleur | Usage |
|------|---------|-------|
| Success | Vert (#22C55E) | Confirmations, statut succès |
| Warning | Orange (#F59E0B) | Alertes, complications |
| Error | Rouge (#EF4444) | Erreurs, échecs |
| Info | Bleu (#3B82F6) | Informations, en suivi |

### Statuts implants

```typescript
EN_SUIVI:     bg-blue-100    text-blue-700
SUCCES:       bg-green-100   text-green-700
COMPLICATION: bg-orange-100  text-orange-700
ECHEC:        bg-red-100     text-red-700
```

## Espacement

Échelle basée sur 4px (0.25rem) :

| Token | Valeur | Pixels | Usage typique |
|-------|--------|--------|---------------|
| 1 | 0.25rem | 4px | Micro-espacement |
| 2 | 0.5rem | 8px | Padding boutons sm |
| 4 | 1rem | 16px | Gap formulaires |
| 6 | 1.5rem | 24px | Padding cartes |
| 8 | 2rem | 32px | Marges sections |

## Typographie

### Police principale

**Poppins** - Police sans-serif moderne et lisible

### Échelle de tailles

| Token | Taille | Usage |
|-------|--------|-------|
| xs | 12px | Captions, légendes |
| sm | 14px | Labels, texte secondaire |
| base | 16px | Texte corps |
| lg | 18px | Sous-titres |
| xl | 20px | Titres section |
| 2xl | 24px | Titres page |
| 3xl | 30px | Grands titres |

## Border-radius

| Token | Valeur | Usage |
|-------|--------|-------|
| sm | 3px | Badges, inputs |
| md | 6px | Boutons, cartes |
| lg | 9px | Modales |
| full | 9999px | Avatars, pills |

## Variables CSS

Toutes les couleurs sont exposées en variables CSS dans `index.css` :

```css
:root {
  --primary: 217 91% 60%;        /* mainBlue */
  --secondary: 203 83% 32%;      /* secondaryBlue */
  --primary-foreground: 0 0% 100%;
  --secondary-foreground: 0 0% 100%;
}
```

Usage Tailwind : `bg-primary`, `text-primary`, `border-primary`
