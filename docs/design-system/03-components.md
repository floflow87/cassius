# Cassius Design System - Composants

## Principes

Les composants Cassius étendent les composants shadcn/ui existants. Ils utilisent :
- Les tokens de couleurs (pas de hex en dur)
- Les classes Tailwind configurées
- Le système d'élévation (hover-elevate, active-elevate-2)

## Composants de base (shadcn/ui)

### Button

```tsx
import { Button } from "@/components/ui/button";

// Variants disponibles
<Button variant="default">Primaire</Button>
<Button variant="secondary">Secondaire</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructif</Button>

// Tailles
<Button size="sm">Petit</Button>
<Button size="default">Normal</Button>
<Button size="lg">Grand</Button>
<Button size="icon"><Icon /></Button>
```

### Badge

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Défaut</Badge>
<Badge variant="secondary">Secondaire</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructif</Badge>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Titre</CardTitle>
  </CardHeader>
  <CardContent>
    Contenu de la carte
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

## Composants métier Cassius

### Badge de statut implant

```tsx
import { implantStatusClasses } from "@/design-system/theme";

function StatusBadge({ statut }: { statut: string }) {
  const classes = implantStatusClasses[statut as keyof typeof implantStatusClasses];
  return <span className={`px-2 py-1 rounded-md text-sm ${classes}`}>{statut}</span>;
}
```

### Utilisation des couleurs Cassius

```tsx
// Avec Tailwind (recommandé)
<div className="bg-primary text-primary-foreground">
  Couleur principale Cassius
</div>

// Accès direct aux tokens (si nécessaire)
import { cassiusColors } from "@/design-system/tokens";
const style = { backgroundColor: cassiusColors.mainBlue };
```

## Bonnes pratiques

1. **Ne pas modifier les composants shadcn/ui de base** - Créer des wrappers si nécessaire
2. **Utiliser les variants existants** plutôt que des classes personnalisées
3. **Respecter le système d'élévation** - Ne pas ajouter de hover:bg-* manuellement
4. **Toujours inclure data-testid** pour les tests e2e
