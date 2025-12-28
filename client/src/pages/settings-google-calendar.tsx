import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Calendar, Check, AlertTriangle, RefreshCw, Unplug, Settings2, Eye } from "lucide-react";
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
  email?: string;
  error?: string;
  integration?: {
    id: string;
    isEnabled: boolean;
    targetCalendarId: string | null;
    targetCalendarName: string | null;
    lastSyncAt: string | null;
  };
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

export default function GoogleCalendarIntegration() {
  const { toast } = useToast();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  
  const { data: status, isLoading: statusLoading } = useQuery<GoogleStatus>({
    queryKey: ["/api/integrations/google/status"],
    retry: false,
  });
  
  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<GoogleCalendar[]>({
    queryKey: ["/api/integrations/google/calendars"],
    enabled: status?.connected === true,
    retry: false,
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
      return apiRequest("POST", "/api/integrations/google/sync-now");
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Synchronisation terminée", 
        description: `${data.synced || 0} événement(s) synchronisé(s)` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur de synchronisation", 
        description: error.message || "Une erreur est survenue",
        variant: "destructive" 
      });
    },
  });
  
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
                
                <p className="text-sm text-muted-foreground">
                  La connexion Google Calendar est gérée via les paramètres Replit. 
                  Si vous voyez ce message, veuillez reconnecter l'intégration dans les paramètres de l'application.
                </p>
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
