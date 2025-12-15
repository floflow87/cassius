/**
 * Cassius Design System - Card
 * 
 * Carte avec header/content/footer standardisés.
 * Réexporte les composants shadcn avec des styles Cassius cohérents.
 * 
 * Usage:
 *   import { CassiusCard, CassiusCardHeader, CassiusCardContent } from "@/design-system/components/Card";
 *   <CassiusCard>
 *     <CassiusCardHeader title="Patient" />
 *     <CassiusCardContent>Contenu</CassiusCardContent>
 *   </CassiusCard>
 */

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CassiusCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CassiusCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CassiusCard({ className, children, ...props }: CassiusCardProps) {
  return (
    <Card className={cn("", className)} {...props}>
      {children}
    </Card>
  );
}

export function CassiusCardHeader({
  title,
  description,
  action,
  className,
  ...props
}: CassiusCardHeaderProps) {
  return (
    <CardHeader className={cn("flex flex-row items-center justify-between gap-4", className)} {...props}>
      <div>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {action && <div>{action}</div>}
    </CardHeader>
  );
}

export function CassiusCardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardContent className={cn("", className)} {...props}>
      {children}
    </CardContent>
  );
}

export function CassiusCardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardFooter className={cn("flex justify-end gap-2", className)} {...props}>
      {children}
    </CardFooter>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default CassiusCard;
