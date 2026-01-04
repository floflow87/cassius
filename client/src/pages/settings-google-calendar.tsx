import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { 
  ArrowLeft, 
  Calendar, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Unplug, 
  ExternalLink,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  CalendarDays,
  Download,
  Eye,
  AlertCircle,
  ChevronRight,
  FileText,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
  error?: string;
  integration?: {
    id: string;
    isEnabled: boolean;
    targetCalendarId: string | null;
    targetCalendarName: string | null;
    lastSyncAt: string | null;
    syncErrorCount?: number;
    lastSyncError?: string | null;
  };
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

interface EnvCheckResult {
  hasGoogleClientId: boolean;
  hasGoogleClientSecret: boolean;
  hasGoogleRedirectUri: boolean;
  hasAppBaseUrl: boolean;
  hasStateSecret: boolean;
  expectedVariables: string[];
  missingVariables: string[];
  appBaseUrl?: string;
  googleRedirectUri?: string;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  message?: string;
}

interface ImportPreviewResult {
  mode: "preview" | "import";
  total: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  failed: number;
  events?: Array<{
    id: string;
    summary: string;
    start: Date;
    end: Date;
    allDay: boolean;
    status: string;
    location?: string;
  }>;
  conflicts: Array<{ eventId: string; summary: string; reason: string }>;
  failures: Array<{ eventId: string; reason: string }>;
}

interface ImportStatus {
  connected: boolean;
  importEnabled: boolean;
  sourceCalendarId?: string;
  sourceCalendarName?: string;
  lastImportAt?: string;
  importedEventsCount: number;
}

interface SyncConflict {
  id: string;
  source: "google" | "cassius";
  entityType: string;
  externalId?: string;
  internalId?: string;
  reason: string;
  payload?: any;
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  resolvedAt?: string;
}

interface ImportedEvent {
  id: string;
  googleEventId: string;
  summary?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  status?: string;
  htmlLink?: string;
  location?: string;
}

type RangePreset = "7d" | "30d" | "month" | "custom";

export default function GoogleCalendarIntegration() {
  const { toast } = useToast();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const searchParams = useSearch();
  
  // Import V2 state
  const [importEnabled, setImportEnabled] = useState(false);
  const [sourceCalendarId, setSourceCalendarId] = useState<string>("");
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [previewDone, setPreviewDone] = useState(false);
  const [conflictFilter, setConflictFilter] = useState<"open" | "resolved" | "ignored">("open");
  const [importedEventsModalOpen, setImportedEventsModalOpen] = useState(false);
  const [importedEvents, setImportedEvents] = useState<ImportedEvent[]>([]);
  const [loadingImportedEvents, setLoadingImportedEvents] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const connected = params.get("connected");
    const error = params.get("error");
    
    if (connected === "1") {
      toast({ 
        title: "Google Calendar connecté", 
        description: "Votre compte Google a été lié avec succès." 
      });
      window.history.replaceState({}, '', window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "Vous avez refusé l'accès à Google Calendar.",
        missing_params: "Paramètres OAuth manquants.",
        invalid_state: "Session expirée ou invalide. Veuillez réessayer.",
        token_exchange_failed: "Erreur lors de l'authentification. Veuillez réessayer.",
      };
      toast({ 
        title: "Erreur de connexion", 
        description: errorMessages[error] || "Une erreur est survenue.",
        variant: "destructive" 
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, toast]);
  
  const { data: status, isLoading: statusLoading } = useQuery<GoogleStatus>({
    queryKey: ["/api/integrations/google/status"],
    retry: false,
  });
  
  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<GoogleCalendar[]>({
    queryKey: ["/api/integrations/google/calendars"],
    enabled: status?.connected === true,
    retry: false,
  });
  
  const { data: envCheck } = useQuery<EnvCheckResult | null>({
    queryKey: ["/api/integrations/google/env-check"],
    enabled: status !== undefined,
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/integrations/google/env-check", { credentials: "include" });
      if (res.status === 403) return null;
      if (!res.ok) return null;
      return res.json();
    },
  });
  
  const { data: importStatus } = useQuery<ImportStatus>({
    queryKey: ["/api/google/import/status"],
    enabled: status?.connected === true,
    retry: false,
  });
  
  // Hydrate import settings from backend
  useEffect(() => {
    if (importStatus) {
      setImportEnabled(importStatus.importEnabled ?? false);
      if (importStatus.sourceCalendarId) {
        setSourceCalendarId(importStatus.sourceCalendarId);
      }
    }
  }, [importStatus]);
  
  const { data: conflicts = [], refetch: refetchConflicts } = useQuery<SyncConflict[]>({
    queryKey: ["/api/sync/conflicts", conflictFilter],
    enabled: status?.connected === true && !migrationRequired,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/sync/conflicts?status=${conflictFilter}`, { credentials: "include" });
      if (res.status === 503) {
        const data = await res.json();
        if (data.error === "MIGRATION_REQUIRED") {
          setMigrationRequired(true);
          return [];
        }
      }
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/integrations/google/connect");
      const data = await response.json();
      return data as { authUrl: string };
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      setIsConnecting(false);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de démarrer la connexion.",
        variant: "destructive" 
      });
    },
  });
  
  const updateIntegrationMutation = useMutation({
    mutationFn: async (data: { isEnabled?: boolean; targetCalendarId?: string; targetCalendarName?: string }) => {
      return apiRequest("PATCH", "/api/integrations/google/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Paramètres mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });
  
  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/integrations/google/sync-now");
      return response.json() as Promise<SyncResult>;
    },
    onSuccess: (data: SyncResult) => {
      const total = data.created + data.updated;
      
      if (data.failed > 0) {
        toast({ 
          title: "Synchronisation partielle",
          description: `${total} événement(s) synchronisé(s), ${data.failed} en erreur`,
          variant: "destructive",
        });
      } else if (total > 0) {
        toast({ 
          title: "Synchronisation réussie",
          description: `${total} événement(s) synchronisé(s) avec Google Calendar`,
        });
      } else {
        toast({ 
          title: "Synchronisation terminée",
          description: "Aucun événement à synchroniser",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur de synchronisation", 
        description: error?.message || "Une erreur est survenue",
        variant: "destructive" 
      });
    },
  });
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/integrations/google/disconnect");
    },
    onSuccess: () => {
      toast({ title: "Intégration déconnectée" });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de la déconnexion", 
        description: error.message || "Une erreur est survenue",
        variant: "destructive" 
      });
    },
  });
  
  // Import V2 mutations
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { timeMin, timeMax } = getDateRange();
      const response = await apiRequest("POST", "/api/google/import", {
        calendarId: sourceCalendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        mode: "preview",
      });
      return response.json() as Promise<ImportPreviewResult>;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setPreviewDone(true);
      toast({ 
        title: "Prévisualisation réussie",
        description: `${data.total} événement(s) trouvé(s)`,
      });
    },
    onError: (error: any) => {
      if (error?.error === "MIGRATION_REQUIRED") {
        setMigrationRequired(true);
        return;
      }
      toast({ 
        title: "Erreur de prévisualisation", 
        description: error?.message || "Une erreur est survenue",
        variant: "destructive" 
      });
    },
  });
  
  const importMutation = useMutation({
    mutationFn: async () => {
      const { timeMin, timeMax } = getDateRange();
      const response = await apiRequest("POST", "/api/google/import", {
        calendarId: sourceCalendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        mode: "import",
      });
      return response.json() as Promise<ImportPreviewResult>;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      toast({ 
        title: "Import terminé",
        description: `${data.created} créé(s), ${data.updated} mis à jour, ${data.skipped} ignoré(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/google/import/status"] });
      refetchConflicts();
    },
    onError: (error: any) => {
      if (error?.error === "MIGRATION_REQUIRED") {
        setMigrationRequired(true);
        return;
      }
      toast({ 
        title: "Erreur d'import", 
        description: error?.message || "Une erreur est survenue",
        variant: "destructive" 
      });
    },
  });
  
  const resolveConflictMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: "resolved" | "ignored"; resolution?: string }) => {
      return apiRequest("PATCH", `/api/sync/conflicts/${id}`, { status, resolution });
    },
    onSuccess: () => {
      toast({ title: "Conflit résolu" });
      refetchConflicts();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error?.message || "Impossible de résoudre le conflit",
        variant: "destructive" 
      });
    },
  });
  
  const updateImportSettingsMutation = useMutation({
    mutationFn: async (data: { importEnabled?: boolean; sourceCalendarId?: string; sourceCalendarName?: string }) => {
      return apiRequest("PATCH", "/api/integrations/google/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Paramètres d'import mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/google/import/status"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });
  
  const handleToggleImportEnabled = (enabled: boolean) => {
    setImportEnabled(enabled);
    updateImportSettingsMutation.mutate({ importEnabled: enabled });
  };
  
  const handleSourceCalendarChange = (calendarId: string) => {
    const calendar = calendars.find(c => c.id === calendarId);
    setSourceCalendarId(calendarId);
    updateImportSettingsMutation.mutate({
      sourceCalendarId: calendarId,
      sourceCalendarName: calendar?.summary || undefined,
    });
  };
  
  const openImportedEventsModal = async () => {
    await loadImportedEvents();
    setImportedEventsModalOpen(true);
  };
  
  const isCustomDateRangeValid = () => {
    if (rangePreset !== "custom") return true;
    if (!customStartDate || !customEndDate) return false;
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
  };
  
  const loadImportedEvents = async () => {
    setLoadingImportedEvents(true);
    try {
      const { timeMin, timeMax } = getDateRange();
      const res = await fetch(
        `/api/google/imported-events?start=${timeMin.toISOString()}&end=${timeMax.toISOString()}`,
        { credentials: "include" }
      );
      if (res.status === 503) {
        const data = await res.json();
        if (data.error === "MIGRATION_REQUIRED") {
          setMigrationRequired(true);
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setImportedEvents(data);
      }
    } catch (error) {
      console.error("Error loading imported events:", error);
    } finally {
      setLoadingImportedEvents(false);
    }
  };
  
  const handleConnect = () => {
    setIsConnecting(true);
    connectMutation.mutate();
  };
  
  const handleCalendarChange = (calendarId: string) => {
    const calendar = calendars.find(c => c.id === calendarId);
    setSelectedCalendarId(calendarId);
    updateIntegrationMutation.mutate({
      targetCalendarId: calendarId,
      targetCalendarName: calendar?.summary || undefined,
    });
  };
  
  const handleToggleEnabled = (enabled: boolean) => {
    updateIntegrationMutation.mutate({ isEnabled: enabled });
  };
  
  const getDateRange = () => {
    const now = new Date();
    let timeMin: Date;
    let timeMax: Date;
    
    switch (rangePreset) {
      case "7d":
        timeMin = subDays(now, 1);
        timeMax = addDays(now, 7);
        break;
      case "30d":
        timeMin = subDays(now, 1);
        timeMax = addDays(now, 30);
        break;
      case "month":
        timeMin = startOfMonth(now);
        timeMax = endOfMonth(now);
        break;
      case "custom":
        timeMin = customStartDate ? new Date(customStartDate) : now;
        timeMax = customEndDate ? new Date(customEndDate) : addDays(now, 7);
        break;
      default:
        timeMin = now;
        timeMax = addDays(now, 7);
    }
    
    return { timeMin, timeMax };
  };
  
  const isConnected = status?.connected === true;
  const isConfigured = status?.configured !== false;
  const integration = status?.integration;
  const currentCalendarId = selectedCalendarId || integration?.targetCalendarId || "";
  
  const canPreview = isConnected && sourceCalendarId && isCustomDateRangeValid();
  const canImport = isConnected && sourceCalendarId && previewDone && (previewResult?.total ?? 0) > 0 && isCustomDateRangeValid();
  
  const formatLastSync = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  
  const openConflictsCount = conflicts.filter(c => c.status === "open").length;

  return (
    <div className="p-6" data-testid="settings-google-calendar">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/settings/integrations">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Google Calendar</h1>
            <p className="text-sm text-muted-foreground">Synchronisation bidirectionnelle</p>
          </div>
        </div>
      </div>
      
      <div className="max-w-2xl space-y-6">
        
        {/* Section 1: Connection Status */}
        <Card data-testid="card-connection">
          <CardContent className="pt-6">
            {statusLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ) : isConnected ? (
              <div className="space-y-4">
                {/* Connected Status Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-950">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Compte connecté</span>
                        <Badge 
                          variant="secondary" 
                          className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Actif
                        </Badge>
                      </div>
                      {status.email && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {status.email}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="text-muted-foreground"
                    data-testid="button-disconnect"
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <Separator />
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Calendrier cible</p>
                      <p className="text-sm font-medium truncate">
                        {integration?.targetCalendarName || "Non sélectionné"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dernière sync</p>
                      <p className="text-sm font-medium">
                        {formatLastSync(integration?.lastSyncAt ?? null) || "Jamais"}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Sync Error Alert */}
                {integration?.lastSyncError && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {integration.lastSyncError}
                    </p>
                  </div>
                )}
                
                {/* Sync Button */}
                <Button 
                  onClick={() => syncNowMutation.mutate()}
                  disabled={syncNowMutation.isPending}
                  className="w-full"
                  data-testid="button-sync-now"
                >
                  {syncNowMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Synchronisation en cours...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchroniser vers Google
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Disconnected State */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                    <XCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Non connecté</p>
                    <p className="text-sm text-muted-foreground">
                      Liez votre compte Google pour synchroniser vos rendez-vous
                    </p>
                  </div>
                </div>
                
                {status?.error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {status.error}
                  </div>
                )}
                
                {!isConfigured && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      L'intégration n'est pas configurée. Contactez l'administrateur.
                    </p>
                    
                    {envCheck && envCheck.missingVariables.length > 0 && (
                      <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Variables manquantes :
                        </p>
                        <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300">
                          {envCheck.missingVariables.map((variable) => (
                            <li key={variable} className="font-mono">{variable}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <Button 
                  onClick={handleConnect}
                  disabled={!isConfigured || isConnecting || connectMutation.isPending}
                  className="w-full"
                  data-testid="button-connect-google"
                >
                  {(isConnecting || connectMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connecter Google Calendar
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {isConnected && (
          <>
            {/* Section 2: Sync Rules (Cassius -> Google) */}
            <Card data-testid="card-sync-options">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Export Cassius vers Google</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="sync-enabled" className="text-sm font-normal">
                      Synchronisation automatique
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Envoie les RDV Cassius vers Google Calendar
                    </p>
                  </div>
                  <Switch
                    id="sync-enabled"
                    checked={integration?.isEnabled ?? true}
                    onCheckedChange={handleToggleEnabled}
                    disabled={updateIntegrationMutation.isPending}
                    data-testid="switch-sync-enabled"
                  />
                </div>
                
                <Separator />
                
                {/* Target Calendar */}
                {calendarsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm">Calendrier cible</Label>
                    <Select
                      value={currentCalendarId}
                      onValueChange={handleCalendarChange}
                      disabled={updateIntegrationMutation.isPending}
                    >
                      <SelectTrigger id="calendar-select" data-testid="select-calendar">
                        <SelectValue placeholder="Sélectionnez un calendrier" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((cal) => (
                          <SelectItem key={cal.id} value={cal.id}>
                            {cal.summary} {cal.primary && "(Principal)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Les événements Cassius seront créés avec le préfixe [Cassius]
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Section 3: Import from Google (V2) */}
            <Card data-testid="card-import">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-medium">Import Google vers Cassius</CardTitle>
                  <div className="flex items-center gap-2">
                    {importStatus && importStatus.importedEventsCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {importStatus.importedEventsCount} importé(s)
                      </Badge>
                    )}
                    <Switch
                      checked={importEnabled}
                      onCheckedChange={handleToggleImportEnabled}
                      disabled={updateImportSettingsMutation.isPending}
                      data-testid="switch-import-enabled"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Migration Required Alert */}
                {migrationRequired && (
                  <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-300">Migration requise</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                          Les tables d'import Google Calendar ne sont pas disponibles. 
                          Exécutez la migration <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">20241230_005_google_events_import.sql</code> sur Supabase.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Source Calendar */}
                <div className="space-y-2">
                  <Label className="text-sm">Calendrier source</Label>
                  {calendarsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={sourceCalendarId}
                      onValueChange={(val) => {
                        handleSourceCalendarChange(val);
                        setPreviewResult(null);
                        setPreviewDone(false);
                      }}
                    >
                      <SelectTrigger data-testid="select-source-calendar">
                        <SelectValue placeholder="Sélectionnez un calendrier à importer" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((cal) => (
                          <SelectItem key={cal.id} value={cal.id}>
                            {cal.summary} {cal.primary && "(Principal)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-sm">Période d'import</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={rangePreset === "7d" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangePreset("7d");
                        setPreviewResult(null);
                        setPreviewDone(false);
                      }}
                      data-testid="button-range-7d"
                    >
                      7 jours
                    </Button>
                    <Button
                      variant={rangePreset === "30d" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangePreset("30d");
                        setPreviewResult(null);
                        setPreviewDone(false);
                      }}
                      data-testid="button-range-30d"
                    >
                      30 jours
                    </Button>
                    <Button
                      variant={rangePreset === "month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangePreset("month");
                        setPreviewResult(null);
                        setPreviewDone(false);
                      }}
                      data-testid="button-range-month"
                    >
                      Mois en cours
                    </Button>
                    <Button
                      variant={rangePreset === "custom" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangePreset("custom");
                        setPreviewResult(null);
                        setPreviewDone(false);
                      }}
                      data-testid="button-range-custom"
                    >
                      Personnalisé
                    </Button>
                  </div>
                  
                  {rangePreset === "custom" && (
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Début</Label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                          data-testid="input-start-date"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Fin</Label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                          data-testid="input-end-date"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => previewMutation.mutate()}
                    disabled={!canPreview || previewMutation.isPending}
                    className="flex-1"
                    data-testid="button-preview"
                  >
                    {previewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Prévisualiser
                  </Button>
                  <Button
                    onClick={() => importMutation.mutate()}
                    disabled={!canImport || importMutation.isPending}
                    className="flex-1"
                    data-testid="button-import"
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Importer maintenant
                  </Button>
                </div>
                
                {/* Preview/Import Results */}
                {previewResult && (
                  <div className="p-4 rounded-md bg-muted/50 space-y-3" data-testid="import-results">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {previewResult.mode === "preview" ? "Prévisualisation" : "Import terminé"}
                      </span>
                      <Badge variant="secondary">{previewResult.total} événement(s)</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Créés:</span>
                        <span className="font-medium">{previewResult.created}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Mis à jour:</span>
                        <span className="font-medium">{previewResult.updated}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-muted-foreground">Ignorés:</span>
                        <span className="font-medium">{previewResult.skipped}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Erreurs:</span>
                        <span className="font-medium">{previewResult.failed}</span>
                      </div>
                    </div>
                    
                    {previewResult.failures.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-destructive mb-1">Erreurs :</p>
                        <ul className="text-xs space-y-1">
                          {previewResult.failures.slice(0, 3).map((f, i) => (
                            <li key={i} className="text-muted-foreground">
                              {f.eventId}: {f.reason}
                            </li>
                          ))}
                          {previewResult.failures.length > 3 && (
                            <li className="text-muted-foreground">
                              ... et {previewResult.failures.length - 3} autre(s)
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Import Status */}
                {importStatus && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Dernier import: {formatLastSync(importStatus.lastImportAt) || "Jamais"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={openImportedEventsModal}
                      className="text-xs"
                      data-testid="button-view-imported"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Voir les événements
                    </Button>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Les événements [Cassius] sont automatiquement ignorés pour éviter les boucles.
                </p>
              </CardContent>
            </Card>
            
            {/* Section 4: Conflicts */}
            <Card data-testid="card-conflicts">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-medium">Conflits de synchronisation</CardTitle>
                  {openConflictsCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {openConflictsCount} ouvert(s)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter Tabs */}
                <div className="flex gap-1 p-1 bg-muted rounded-md">
                  <Button
                    variant={conflictFilter === "open" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setConflictFilter("open")}
                    className="flex-1 text-xs"
                    data-testid="button-filter-open"
                  >
                    Ouverts
                  </Button>
                  <Button
                    variant={conflictFilter === "resolved" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setConflictFilter("resolved")}
                    className="flex-1 text-xs"
                    data-testid="button-filter-resolved"
                  >
                    Résolus
                  </Button>
                  <Button
                    variant={conflictFilter === "ignored" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setConflictFilter("ignored")}
                    className="flex-1 text-xs"
                    data-testid="button-filter-ignored"
                  >
                    Ignorés
                  </Button>
                </div>
                
                {/* Conflicts List */}
                {conflicts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun conflit {conflictFilter === "open" ? "en attente" : conflictFilter === "resolved" ? "résolu" : "ignoré"}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[240px]">
                    <div className="space-y-2">
                      {conflicts.map((conflict) => (
                        <div
                          key={conflict.id}
                          className="p-3 rounded-md border bg-card"
                          data-testid={`conflict-${conflict.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {conflict.source === "google" ? "Google" : "Cassius"}
                                </Badge>
                                <span className="text-sm font-medium truncate">
                                  {conflict.reason}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(conflict.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                              </p>
                            </div>
                            
                            {conflict.status === "open" && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resolveConflictMutation.mutate({ 
                                    id: conflict.id, 
                                    status: "resolved",
                                    resolution: "keep_google"
                                  })}
                                  disabled={resolveConflictMutation.isPending}
                                  className="text-xs h-7 px-2"
                                  title="Garder Google"
                                  data-testid={`button-keep-google-${conflict.id}`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resolveConflictMutation.mutate({ 
                                    id: conflict.id, 
                                    status: "ignored" 
                                  })}
                                  disabled={resolveConflictMutation.isPending}
                                  className="text-xs h-7 px-2"
                                  title="Ignorer"
                                  data-testid={`button-ignore-${conflict.id}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            
            {/* Section 5: Event Preview */}
            <Card data-testid="card-event-preview">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Aperçu dans Google Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <div className="space-y-3">
                    {/* Event Title */}
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          [Cassius] CHIRURGIE - Martin Dupont
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Mardi 14 janvier 2025
                        </p>
                      </div>
                    </div>
                    
                    {/* Time */}
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-4 w-4 text-blue-600/70 dark:text-blue-400/70 shrink-0" />
                      <span className="text-blue-800 dark:text-blue-200">09:00 - 11:00</span>
                    </div>
                    
                    {/* Patient */}
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-blue-600/70 dark:text-blue-400/70 shrink-0" />
                      <span className="text-blue-800 dark:text-blue-200">Patient: Martin Dupont</span>
                    </div>
                    
                    {/* Calendar indicator */}
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-blue-600/70 dark:text-blue-400/70 shrink-0" />
                      <span className="text-blue-800 dark:text-blue-200">
                        {integration?.targetCalendarName || "Calendrier principal"}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Les événements exportés sont préfixés par [Cassius] pour les identifier
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Imported Events Modal */}
      <Dialog open={importedEventsModalOpen} onOpenChange={setImportedEventsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Événements importés</DialogTitle>
            <DialogDescription>
              Liste des événements Google Calendar importés dans Cassius
            </DialogDescription>
          </DialogHeader>
          
          {loadingImportedEvents ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : importedEvents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun événement importé pour cette période</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {importedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-md border bg-card"
                    data-testid={`imported-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {event.summary || "Sans titre"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {event.startAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(event.startAt), "dd MMM HH:mm", { locale: fr })}
                            </span>
                          )}
                          {event.status && (
                            <Badge variant="outline" className="text-xs">
                              {event.status}
                            </Badge>
                          )}
                        </div>
                        {event.location && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {event.location}
                          </p>
                        )}
                      </div>
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
