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
  CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

export default function GoogleCalendarIntegration() {
  const { toast } = useToast();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const searchParams = useSearch();
  
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
  
  const isConnected = status?.connected === true;
  const isConfigured = status?.configured !== false;
  const integration = status?.integration;
  const currentCalendarId = selectedCalendarId || integration?.targetCalendarId || "";
  
  const formatLastSync = (dateStr: string | null) => {
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
            <p className="text-sm text-muted-foreground">Synchronisation des rendez-vous</p>
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
                      <p className="text-xs text-muted-foreground">Calendrier</p>
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
                      Synchroniser maintenant
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
            {/* Section 2: Sync Rules */}
            <Card data-testid="card-sync-options">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Règles de synchronisation</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            
            {/* Section 3: Target Calendar */}
            <Card data-testid="card-calendar-select">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Calendrier cible</CardTitle>
              </CardHeader>
              <CardContent>
                {calendarsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="space-y-2">
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
                      Les événements seront créés dans ce calendrier
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Section 4: Event Preview */}
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
                  Les événements sont préfixés par [Cassius] pour les identifier facilement
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
