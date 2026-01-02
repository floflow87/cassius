import { forwardRef } from "react";
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronRight as ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CassiusBadgeProps {
  status: "actif" | "en-suivi" | "planifie" | "inactif" | "archive";
  children: React.ReactNode;
  className?: string;
}

export function CassiusBadge({ status, children, className }: CassiusBadgeProps) {
  const statusStyles: Record<string, string> = {
    "actif": "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    "en-suivi": "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    "planifie": "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
    "inactif": "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    "archive": "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        statusStyles[status],
        className
      )}
    >
      {children}
    </span>
  );
}

interface CassiusChipProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export function CassiusChip({ children, onRemove, className }: CassiusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium",
        "bg-primary/10 text-primary border border-primary/20",
        "dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30",
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface CassiusPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function CassiusPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: CassiusPaginationProps) {
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  const goToFirst = () => onPageChange(1);
  const goToPrev = () => onPageChange(Math.max(1, currentPage - 1));
  const goToNext = () => onPageChange(Math.min(totalPages, currentPage + 1));
  const goToLast = () => onPageChange(totalPages);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {totalItems > 0 ? `${startIndex} – ${endIndex} de ${totalItems}` : "0 de 0"}
      </span>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === 1}
          onClick={goToFirst}
          data-testid="button-pagination-first"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === 1}
          onClick={goToPrev}
          data-testid="button-pagination-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={goToNext}
          data-testid="button-pagination-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={goToLast}
          data-testid="button-pagination-last"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface CassiusSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const CassiusSearchInput = forwardRef<HTMLInputElement, CassiusSearchInputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative flex-1">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type="search"
          className={cn(
            "flex h-11 w-full rounded-lg border border-border-gray bg-card px-4 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

CassiusSearchInput.displayName = "CassiusSearchInput";

interface CassiusTableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function CassiusTableRow({ children, onClick, className }: CassiusTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/50 last:border-b-0",
        "hover:bg-muted/30 transition-colors cursor-pointer",
        className
      )}
    >
      {children}
      <td className="px-4 py-4 w-8">
        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
      </td>
    </tr>
  );
}
