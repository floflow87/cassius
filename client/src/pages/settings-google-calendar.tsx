import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Calendar, Check, AlertTriangle, RefreshCw, Unplug, Settings2, Eye, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  
  // Admin-only env check - fetch to show environment info (returns null for non-admins)
  const { data: envCheck } = useQuery<EnvCheckResult | null>({
    queryKey: ["/api/integrations/google/env-check"],
    enabled: status !== undefined,
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/integrations/google/env-check", { credentials: "include" });
      if (res.status === 403) return null; // Non-admin, silently return null
      if (!res.ok) return null; // Other errors, silently return null
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
      return response.json();
    },
    onSuccess: (data: any) => {
      // Build summary message
      const parts: string[] = [];
      if (data.created > 0) parts.push(`${data.created} créé(s)`);
      if (data.updated > 0) parts.push(`${data.updated} mis à jour`);
      if (data.skipped > 0) parts.push(`${data.skipped} ignoré(s)`);
      if (data.failed > 0) parts.push(`${data.failed} en erreur`);
      
      const summary = parts.length > 0 ? parts.join(", ") : data.message || "Aucun changement";
      
      toast({ 
        title: data.failed > 0 ? "Synchronisation partielle" : "Synchronisation terminée",
        description: summary,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: async (error: any) => {
      // Try to parse error response
      let errorMessage = error.message || "Une erreur est survenue";
      let step = "";
      
      // If error is a Response, try to get JSON
      if (error instanceof Response || (error && typeof error.json === 'function')) {
        try {
          const data = await error.json();
          errorMessage = data.message || data.error || errorMessage;
          step = data.step ? ` (étape: ${data.step})` : "";
        } catch {}
      }
      
      toast({ 
        title: "Erreur de synchronisation", 
        description: `${errorMessage}${step}`,
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
  
  return (
    <div className="p-6" data-testid="settings-google-calendar">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings/integrations">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Google Calendar</h1>
          <p className="text-muted-foreground">Synchronisez vos rendez-vous avec Google Calendar</p>
        </div>
      </div>
      
      <div className="max-w-2xl space-y-6">
        <Card data-testid="card-connection">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Connexion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
            ) : isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Connecté
                  </Badge>
                  {status.email && (
                    <span className="text-sm text-muted-foreground">{status.email}</span>
                  )}
                </div>
                
                {integration?.targetCalendarName && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Calendrier cible: </span>
                    <span className="font-medium">{integration.targetCalendarName}</span>
                  </div>
                )}
                
                {integration?.lastSyncAt && (
                  <div className="text-sm text-muted-foreground">
                    Dernière synchronisation: {new Date(integration.lastSyncAt).toLocaleString('fr-FR')}
                  </div>
                )}
                
                {integration?.lastSyncError && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {integration.lastSyncError}
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncNowMutation.mutate()}
                    disabled={syncNowMutation.isPending}
                    data-testid="button-sync-now"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncNowMutation.isPending ? "animate-spin" : ""}`} />
                    Synchroniser maintenant
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="text-muted-foreground"
                    data-testid="button-disconnect"
                  >
                    <Unplug className="h-4 w-4 mr-2" />
                    Déconnecter
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connectez votre compte Google pour synchroniser automatiquement vos rendez-vous Cassius vers Google Calendar.
                </p>
                
                {status?.error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {status.error}
                  </div>
                )}
                
                {!isConfigured && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      L'intégration Google Calendar n'est pas configurée. Contactez l'administrateur pour configurer les identifiants OAuth.
                    </p>
                    
                    {envCheck && envCheck.missingVariables.length > 0 && (
                      <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Variables manquantes :
                        </p>
                        <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
                          {envCheck.missingVariables.map((variable) => (
                            <li key={variable} className="font-mono text-xs">{variable}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {envCheck && (envCheck.appBaseUrl || envCheck.googleRedirectUri) && (
                      <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Configuration actuelle :
                        </p>
                        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                          {envCheck.appBaseUrl && (
                            <li><span className="text-muted-foreground">APP_BASE_URL:</span> <span className="font-mono text-xs">{envCheck.appBaseUrl}</span></li>
                          )}
                          {envCheck.googleRedirectUri && (
                            <li><span className="text-muted-foreground">GOOGLE_REDIRECT_URI:</span> <span className="font-mono text-xs">{envCheck.googleRedirectUri}</span></li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {isConfigured && envCheck && (envCheck.appBaseUrl || envCheck.googleRedirectUri) && (
                  <div className="p-3 bg-muted/50 border rounded-md">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Environnement actuel :</p>
                    <ul className="text-sm space-y-1">
                      {envCheck.appBaseUrl && (
                        <li className="flex items-center gap-2">
                          <span className="text-muted-foreground">APP_BASE_URL:</span>
                          <Badge variant="secondary" className="font-mono text-xs">{envCheck.appBaseUrl}</Badge>
                        </li>
                      )}
                      {envCheck.googleRedirectUri && (
                        <li className="flex items-center gap-2">
                          <span className="text-muted-foreground">Redirect URI:</span>
                          <Badge variant="secondary" className="font-mono text-xs">{envCheck.googleRedirectUri}</Badge>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={handleConnect}
                    disabled={!isConfigured || isConnecting || connectMutation.isPending}
                    data-testid="button-connect-google"
                  >
                    {(isConnecting || connectMutation.isPending) ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
              </div>
            )}
          </CardContent>
        </Card>
        
        {isConnected && (
          <>
            <Card data-testid="card-sync-options">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Options de synchronisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sync-enabled" className="text-base">
                      Synchroniser les RDV Cassius vers Google
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Les rendez-vous créés ou modifiés dans Cassius seront automatiquement synchronisés
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
                
                <div className="space-y-2">
                  <Label htmlFor="calendar-select">Calendrier cible</Label>
                  {calendarsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
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
                  )}
                  <p className="text-sm text-muted-foreground">
                    Les événements seront créés dans ce calendrier
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-event-preview">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Prévisualisation des événements
                </CardTitle>
                <CardDescription>
                  Voici comment vos rendez-vous apparaîtront dans Google Calendar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md p-4 bg-muted/30">
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Titre</Label>
                      <p className="font-medium">[Cassius] CHIRURGIE - Martin Dupont</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm text-muted-foreground">
                        Rendez-vous Cassius<br />
                        Type: Chirurgie<br />
                        Patient: Martin Dupont
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
