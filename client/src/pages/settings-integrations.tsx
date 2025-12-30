import { Route, Switch, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Check, AlertTriangle, ExternalLink, Plug, Mail, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GoogleCalendarIntegration from "@/pages/settings-google-calendar";

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: typeof Calendar;
  url: string;
  available: boolean;
}

const integrations: IntegrationCard[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronisez vos rendez-vous avec Google Calendar",
    icon: Calendar,
    url: "/settings/integrations/google-calendar",
    available: true,
  },
  {
    id: "doctolib",
    name: "Doctolib",
    description: "Intégration avec Doctolib pour la prise de rendez-vous",
    icon: FileText,
    url: "/settings/integrations/doctolib",
    available: false,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Envoyez des rappels par email automatiquement",
    icon: Mail,
    url: "/settings/integrations/gmail",
    available: false,
  },
];

function IntegrationsList({ embedded = false }: { embedded?: boolean }) {
  const { data: googleStatus, isLoading } = useQuery<{ connected: boolean; email?: string; lastSyncAt?: string }>({
    queryKey: ["/api/integrations/google/status"],
    retry: false,
  });
  
  return (
    <div className={embedded ? "" : "p-6"} data-testid="settings-integrations">
      {!embedded && (
        <>
          <h1 className="text-2xl font-semibold mb-2">Intégrations</h1>
          <p className="text-muted-foreground mb-6">Connectez Cassius à vos outils préférés.</p>
        </>
      )}
      {embedded && (
        <p className="text-muted-foreground mb-6">Connectez Cassius à vos outils préférés.</p>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const isGoogle = integration.id === "google-calendar";
          const isConnected = isGoogle && googleStatus?.connected;
          const lastSync = isGoogle && googleStatus?.lastSyncAt 
            ? new Date(googleStatus.lastSyncAt).toLocaleDateString('fr-FR', { 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            : null;
          
          return (
            <Card 
              key={integration.id} 
              className={!integration.available ? "opacity-60" : ""}
              data-testid={`integration-card-${integration.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <integration.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      {isGoogle && isLoading ? (
                        <Skeleton className="h-4 w-20 mt-1" />
                      ) : isConnected ? (
                        <Badge variant="secondary" className="mt-1 gap-1">
                          <Check className="h-3 w-3" />
                          Connecté
                        </Badge>
                      ) : !integration.available ? (
                        <Badge variant="outline" className="mt-1">Bientôt</Badge>
                      ) : (
                        <Badge variant="outline" className="mt-1">Non connecté</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-3">{integration.description}</CardDescription>
                {lastSync && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Dernière sync: {lastSync}
                  </p>
                )}
                {integration.available ? (
                  <Link href={integration.url}>
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-configure-${integration.id}`}>
                      Configurer
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    Prochainement
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface IntegrationsPageProps {
  embedded?: boolean;
}

export default function IntegrationsPage({ embedded = false }: IntegrationsPageProps) {
  if (embedded) {
    return <IntegrationsList embedded />;
  }
  
  return (
    <Switch>
      <Route path="/settings/integrations/google-calendar" component={GoogleCalendarIntegration} />
      <Route path="/settings/integrations">
        <IntegrationsList />
      </Route>
    </Switch>
  );
}
