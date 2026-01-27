import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { History, UserCircle, Clock, FileEdit, Plus, Trash2, Eye, Archive, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  metadata: string | null;
  createdAt: string;
  userName: string | null;
  userPrenom: string | null;
  userNom: string | null;
}

interface AuditHistoryProps {
  entityType: "PATIENT" | "OPERATION" | "SURGERY_IMPLANT" | "CATALOG_IMPLANT" | "DOCUMENT" | "RADIO" | "APPOINTMENT";
  entityId: string;
  title?: string;
  maxItems?: number;
  showCard?: boolean;
}

const actionIcons: Record<string, typeof History> = {
  CREATE: Plus,
  UPDATE: FileEdit,
  DELETE: Trash2,
  VIEW: Eye,
  ARCHIVE: Archive,
  RESTORE: RotateCcw,
};

const actionLabels: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  VIEW: "Consultation",
  ARCHIVE: "Archivage",
  RESTORE: "Restauration",
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  VIEW: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  ARCHIVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  RESTORE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function AuditLogItem({ log }: { log: AuditLog }) {
  const Icon = actionIcons[log.action] || History;
  const label = actionLabels[log.action] || log.action;
  const colorClass = actionColors[log.action] || "bg-gray-100 text-gray-700";
  
  const userName = log.userPrenom && log.userNom
    ? `${log.userPrenom} ${log.userNom}`
    : log.userName || "Utilisateur inconnu";

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0 border-border/50">
      <div className={`p-1.5 rounded-full ${colorClass}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] font-normal">
            {label}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <UserCircle className="w-3 h-3" />
            {userName}
          </span>
        </div>
        {log.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {log.details}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          {format(new Date(log.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}
        </div>
      </div>
    </div>
  );
}

function AuditHistoryContent({ 
  entityType, 
  entityId, 
  maxItems 
}: { 
  entityType: string; 
  entityId: string; 
  maxItems?: number;
}) {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: [`/api/audit/${entityType}/${entityId}`],
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        <History className="w-6 h-6 mx-auto mb-2 opacity-50" />
        Aucun historique disponible
      </div>
    );
  }

  const displayLogs = maxItems ? logs.slice(0, maxItems) : logs;

  return (
    <div className="divide-y divide-border/50">
      {displayLogs.map((log) => (
        <AuditLogItem key={log.id} log={log} />
      ))}
      {maxItems && logs.length > maxItems && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          +{logs.length - maxItems} autres entrées
        </div>
      )}
    </div>
  );
}

export function AuditHistory({ 
  entityType, 
  entityId, 
  title = "Historique des modifications",
  maxItems = 10,
  showCard = true,
}: AuditHistoryProps) {
  if (!showCard) {
    return (
      <AuditHistoryContent 
        entityType={entityType} 
        entityId={entityId} 
        maxItems={maxItems} 
      />
    );
  }

  return (
    <Card data-testid="audit-history-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <AuditHistoryContent 
          entityType={entityType} 
          entityId={entityId} 
          maxItems={maxItems} 
        />
      </CardContent>
    </Card>
  );
}
