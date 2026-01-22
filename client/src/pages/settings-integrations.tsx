import { Route, Switch, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Check, RefreshCw, ChevronDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch as SwitchUI } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import GoogleCalendarIntegration from "@/pages/settings-google-calendar";
import googleCalendarIcon from "@assets/Google_Calendar_icon_(2020).svg_1767601723458.png";
import gmailIcon from "@assets/gmail_1767602212820.png";
import outlookIcon from "@assets/Microsoft_Outlook_Icon_(2025–present).svg_1767602593769.png";
import googleMeetIcon from "@assets/google-meet_1767602721784.png";
import googleLogo from "@assets/logo_Google_1767604702248.png";

interface GoogleIntegrationStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
  error?: string;
  integration?: {
    id: string;
    isEnabled: boolean;
    targetCalendarId?: string;
    targetCalendarName?: string;
    lastSyncAt?: string;
    syncErrorCount?: number;
    lastSyncError?: string;
  } | null;
}

function IntegrationsList({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();

  const { data: googleStatus, isLoading: googleLoading } = useQuery<GoogleIntegrationStatus>({
    queryKey: ["/api/integrations/google/status"],
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/connect", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible d'obtenir l'URL d'autorisation");
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/integrations/google/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Google Calendar déconnecté" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sync/trigger");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Synchronisation démarrée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/integrations/google/settings", { isEnabled: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className={embedded ? "" : "p-6"} data-testid="settings-integrations">
      {!embedded && (
        <>
          <h1 className="text-2xl font-semibold mb-2">Intégrations</h1>
          <p className="text-muted-foreground mb-6">Connectez Cassius à vos outils préférés.</p>
        </>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
        {/* Google Calendar - Active Integration */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              {googleStatus?.connected ? (
                <Badge variant="default" className="bg-green-600 text-[11px]" data-testid="badge-google-connected">
                  <Check className="w-3 h-3 mr-1" />
                  Connecté
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]" data-testid="badge-google-disconnected">
                  Non connecté
                </Badge>
              )}
            </div>
            <div className="flex items-start gap-3">
              <img src={googleCalendarIcon} alt="Google Calendar" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Google Calendar</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos rendez-vous avec Google Calendar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {googleLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            ) : googleStatus?.connected ? (
              <div className="space-y-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground" data-testid="button-toggle-google-details">
                      <span>Voir les détails</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 border-t mt-2">
                    {googleStatus.email && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Compte connecté</Label>
                        <p className="font-medium text-xs">{googleStatus.email}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label className="text-xs">Synchronisation automatique</Label>
                        <p className="text-xs text-muted-foreground">
                          Sync activée
                        </p>
                      </div>
                      <SwitchUI
                        checked={googleStatus.integration?.isEnabled ?? false}
                        onCheckedChange={(checked) => toggleSyncMutation.mutate(checked)}
                        disabled={toggleSyncMutation.isPending}
                        data-testid="switch-google-sync"
                      />
                    </div>

                    {googleStatus.integration?.targetCalendarName && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Calendrier cible</Label>
                        <p className="font-medium text-xs flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {googleStatus.integration.targetCalendarName}
                        </p>
                      </div>
                    )}

                    {googleStatus.integration?.lastSyncAt && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Dernière synchronisation</Label>
                        <p className="text-xs">
                          {new Date(googleStatus.integration.lastSyncAt).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    )}

                    {googleStatus.integration?.syncErrorCount && googleStatus.integration.syncErrorCount > 0 && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{googleStatus.integration.syncErrorCount} erreurs</span>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => syncNowMutation.mutate()}
                    disabled={syncNowMutation.isPending}
                    data-testid="button-sync-now"
                  >
                    {syncNowMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Synchroniser
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => disconnectGoogleMutation.mutate()}
                    disabled={disconnectGoogleMutation.isPending}
                    data-testid="button-disconnect-google"
                  >
                    Déconnecter
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                {!googleStatus?.configured && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">L'intégration Google n'est pas configurée. Contactez l'administrateur.</span>
                  </div>
                )}
                <Button
                  onClick={() => connectGoogleMutation.mutate()}
                  disabled={connectGoogleMutation.isPending || !googleStatus?.configured}
                  data-testid="button-connect-google"
                >
                  {connectGoogleMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <img src={googleLogo} alt="Google" className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-xs">Connecter Google Calendar</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gmail - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={gmailIcon} alt="Gmail" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Gmail</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos emails avec Google Gmail</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>

        {/* Google Meet - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={googleMeetIcon} alt="Google Meet" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Google Meet</CardTitle>
                <CardDescription className="text-xs">Intégrez vos visioconférences avec Google Meet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>

        {/* Microsoft Outlook - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={outlookIcon} alt="Microsoft Outlook" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Microsoft Outlook</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos emails avec Microsoft Outlook</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>
      </div>
    </div>
  );
}

export default function IntegrationsPage({ embedded = false }: { embedded?: boolean }) {
  const [location] = useLocation();
  
  if (embedded) {
    return <IntegrationsList embedded />;
  }
  
  return (
    <Switch>
      <Route path="/settings/integrations/google-calendar">
        <GoogleCalendarIntegration />
      </Route>
      <Route path="/settings/integrations">
        <IntegrationsList />
      </Route>
    </Switch>
  );
}

export { IntegrationsList };
