/**
 * Cassius Design System - Button
 * 
 * Wrapper du Button shadcn avec les variants Cassius.
 * Utilise les tokens via les classes Tailwind (bg-primary, bg-secondary).
 * 
 * Usage:
 *   import { CassiusButton } from "@/design-system/components/Button";
 *   <CassiusButton variant="primary">Action</CassiusButton>
 */

import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CassiusButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "destructive";
}

const variantMapping: Record<string, ButtonProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  outline: "outline",
  destructive: "destructive",
};

export function CassiusButton({
  variant = "primary",
  className,
  children,
  ...props
}: CassiusButtonProps) {
  return (
    <Button
      variant={variantMapping[variant]}
      className={cn(className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export default CassiusButton;
