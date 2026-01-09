import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid="empty-state">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      <div className="flex gap-3">
        {primaryAction && (
          <Button 
            onClick={primaryAction.onClick} 
            variant={primaryAction.variant || "default"}
            data-testid="empty-state-primary-action"
          >
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button 
            onClick={secondaryAction.onClick} 
            variant={secondaryAction.variant || "outline"}
            data-testid="empty-state-secondary-action"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
