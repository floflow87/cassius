/**
 * Cassius Design System - Badge
 * 
 * Badges sémantiques pour statuts et catégories.
 * Utilise les tokens via les classes Tailwind.
 * 
 * Usage:
 *   import { CassiusBadge } from "@/design-system/components/Badge";
 *   <CassiusBadge variant="success">Succès</CassiusBadge>
 */

import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CassiusBadgeProps extends Omit<BadgeProps, "variant"> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "secondary" | "outline";
}

const variantClasses: Record<string, string> = {
  default: "",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  warning: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  secondary: "",
  outline: "",
};

const badgeVariantMapping: Record<string, BadgeProps["variant"]> = {
  default: "default",
  success: "outline",
  warning: "outline",
  error: "outline",
  info: "outline",
  secondary: "secondary",
  outline: "outline",
};

export function CassiusBadge({
  variant = "default",
  className,
  children,
  ...props
}: CassiusBadgeProps) {
  return (
    <Badge
      variant={badgeVariantMapping[variant]}
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </Badge>
  );
}

export default CassiusBadge;
