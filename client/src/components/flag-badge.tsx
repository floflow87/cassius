import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Flag, FlagWithEntity } from "@shared/schema";
import type { TopFlag } from "@shared/types";

interface FlagBadgeProps {
  flag: Flag | FlagWithEntity;
  showResolve?: boolean;
  compact?: boolean;
  onResolved?: () => void;
}

const levelConfig = {
  CRITICAL: {
    icon: AlertTriangle,
    className: "bg-destructive text-destructive-foreground",
    label: "Critique",
  },
  WARNING: {
    icon: AlertCircle,
    className: "bg-orange-500 text-white dark:bg-orange-600",
    label: "Attention",
  },
  INFO: {
    icon: Info,
    className: "bg-blue-500 text-white dark:bg-blue-600",
    label: "Information",
  },
};

const typeLabels: Record<string, string> = {
  ISQ_LOW: "ISQ faible",
  ISQ_DECLINING: "ISQ en déclin",
  LOW_SUCCESS_RATE: "Taux de succès bas",
  NO_RECENT_ISQ: "Pas d'ISQ récent",
  NO_POSTOP_FOLLOWUP: "Pas de suivi post-op",
  NO_RECENT_APPOINTMENT: "Sans visite récente",
  IMPLANT_NO_OPERATION: "Implant sans opération",
  MISSING_DOCUMENT: "Document manquant",
  INCOMPLETE_DATA: "Données incomplètes",
};

export function FlagBadge({ flag, showResolve = false, compact = false, onResolved }: FlagBadgeProps) {
  const config = levelConfig[flag.level];
  const Icon = config.icon;

  const resolveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/flags/${flag.id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flags"] });
      onResolved?.();
    },
  });

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`${config.className} gap-1 cursor-default`}
            data-testid={`flag-badge-${flag.id}`}
          >
            <Icon className="w-3 h-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="z-[99999] bg-white dark:bg-zinc-900 border shadow-lg">
          <p className="font-medium">{flag.label}</p>
          {flag.description && <p className="text-xs text-muted-foreground">{flag.description}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-md border bg-card"
      data-testid={`flag-item-${flag.id}`}
    >
      <Badge
        variant="secondary"
        className={`${config.className} gap-1`}
      >
        <Icon className="w-3 h-3" />
        <span>{typeLabels[flag.type] || flag.type}</span>
      </Badge>
      <span className="text-sm text-muted-foreground flex-1">{flag.description || flag.label}</span>
      {showResolve && !flag.resolvedAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              data-testid={`button-resolve-flag-${flag.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Marquer comme résolu</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface FlagListProps {
  flags: Flag[];
  showResolve?: boolean;
  onResolved?: () => void;
}

export function FlagList({ flags, showResolve = false, onResolved }: FlagListProps) {
  if (flags.length === 0) {
    return null;
  }

  const criticalFlags = flags.filter((f) => f.level === "CRITICAL");
  const warningFlags = flags.filter((f) => f.level === "WARNING");
  const infoFlags = flags.filter((f) => f.level === "INFO");

  return (
    <div className="space-y-2" data-testid="flag-list">
      {criticalFlags.map((flag) => (
        <FlagBadge key={flag.id} flag={flag} showResolve={showResolve} onResolved={onResolved} />
      ))}
      {warningFlags.map((flag) => (
        <FlagBadge key={flag.id} flag={flag} showResolve={showResolve} onResolved={onResolved} />
      ))}
      {infoFlags.map((flag) => (
        <FlagBadge key={flag.id} flag={flag} showResolve={showResolve} onResolved={onResolved} />
      ))}
    </div>
  );
}

interface CompactFlagListProps {
  flags: Flag[];
  maxVisible?: number;
}

export function CompactFlagList({ flags, maxVisible = 3 }: CompactFlagListProps) {
  if (flags.length === 0) {
    return null;
  }

  const sortedFlags = [...flags].sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  const visibleFlags = sortedFlags.slice(0, maxVisible);
  const remainingFlags = sortedFlags.slice(maxVisible);
  const remainingCount = remainingFlags.length;

  return (
    <div className="flex items-center gap-1" data-testid="compact-flag-list">
      {visibleFlags.map((flag) => (
        <FlagBadge key={flag.id} flag={flag} compact />
      ))}
      {remainingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-pointer">
              +{remainingCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm z-[99999] bg-white dark:bg-zinc-900 border shadow-lg">
            <div className="space-y-2">
              {remainingFlags.map((flag) => {
                const IconComponent = levelConfig[flag.level].icon;
                return (
                  <div key={flag.id} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`${levelConfig[flag.level].className} text-xs`}
                      >
                        <IconComponent className="w-2.5 h-2.5 mr-1" />
                        {typeLabels[flag.type] || flag.type}
                      </Badge>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground pl-1">{flag.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface TopFlagSummaryProps {
  topFlag?: TopFlag;
  activeFlagCount?: number;
}

export function TopFlagSummary({ topFlag, activeFlagCount = 0 }: TopFlagSummaryProps) {
  if (!topFlag || activeFlagCount === 0) {
    return null;
  }

  const config = levelConfig[topFlag.level];
  const Icon = config.icon;
  const typeLabel = typeLabels[topFlag.type] || topFlag.label;

  return (
    <div className="flex items-center gap-1" data-testid="top-flag-summary">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`${config.className} gap-1 cursor-default`}
            data-testid="top-flag-badge"
          >
            <Icon className="w-3 h-3" />
            <span className="text-xs">{typeLabel}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="z-[99999] bg-white dark:bg-zinc-900 border shadow-lg">
          <p className="font-medium">{topFlag.label}</p>
        </TooltipContent>
      </Tooltip>
      {activeFlagCount > 1 && (
        <Badge variant="outline" className="text-xs">
          +{activeFlagCount - 1}
        </Badge>
      )}
    </div>
  );
}

interface FlagsTooltipBadgeProps {
  flags: Flag[];
  variant?: "dark" | "default";
}

export function FlagsTooltipBadge({ flags, variant = "default" }: FlagsTooltipBadgeProps) {
  if (flags.length === 0) {
    return null;
  }

  const sortedFlags = [...flags].sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3);
  });

  const topFlag = sortedFlags[0];
  const topConfig = levelConfig[topFlag.level];
  const TopIcon = topConfig.icon;

  const badgeClass = variant === "dark" 
    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 gap-1 cursor-default"
    : `${topConfig.className} gap-1 cursor-default`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className={badgeClass}
          data-testid="flags-tooltip-badge"
        >
          <TopIcon className="w-3 h-3" />
          <span className="text-xs">{flags.length}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs z-[99999] bg-white dark:bg-zinc-900 border shadow-lg">
        <div className="space-y-2">
          {sortedFlags.map((flag) => {
            const config = levelConfig[flag.level];
            const IconComponent = config.icon;
            return (
              <div key={flag.id} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`${config.className} text-xs gap-1`}
                  >
                    <IconComponent className="w-2.5 h-2.5" />
                    {typeLabels[flag.type] || flag.type}
                  </Badge>
                </div>
                {flag.description && (
                  <p className="text-xs text-muted-foreground pl-1">{flag.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
