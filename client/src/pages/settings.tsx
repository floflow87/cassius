import { Route, Switch, useLocation, Link } from "wouter";
import { User, Building2, Plug, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsSections = [
  { title: "Profil", url: "/settings/profile", icon: User },
  { title: "Organisation", url: "/settings/organization", icon: Building2 },
  { title: "Intégrations", url: "/settings/integrations", icon: Plug },
  { title: "Sécurité", url: "/settings/security", icon: Shield },
];

function SettingsSidebar() {
  const [location] = useLocation();
  
  return (
    <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0 p-4" data-testid="settings-sidebar">
      <h2 className="text-lg font-semibold mb-4">Paramètres</h2>
      <nav className="space-y-1">
        {settingsSections.map((section) => {
          const isActive = location === section.url || 
            (section.url !== "/settings" && location.startsWith(section.url));
          
          return (
            <Link key={section.url} href={section.url}>
              <a 
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover-elevate"
                )}
                data-testid={`settings-nav-${section.title.toLowerCase()}`}
              >
                <section.icon className="h-4 w-4" />
                {section.title}
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ProfileSettings() {
  return (
    <div className="p-6" data-testid="settings-profile">
      <h1 className="text-2xl font-semibold mb-6">Profil</h1>
      <p className="text-muted-foreground">Gérez vos informations personnelles.</p>
    </div>
  );
}

function OrganizationSettings() {
  return (
    <div className="p-6" data-testid="settings-organization">
      <h1 className="text-2xl font-semibold mb-6">Organisation</h1>
      <p className="text-muted-foreground">Paramètres de votre cabinet.</p>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="p-6" data-testid="settings-security">
      <h1 className="text-2xl font-semibold mb-6">Sécurité</h1>
      <p className="text-muted-foreground">Gérez la sécurité de votre compte.</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <div className="flex-1 overflow-auto">
        <Switch>
          <Route path="/settings/profile" component={ProfileSettings} />
          <Route path="/settings/organization" component={OrganizationSettings} />
          <Route path="/settings/security" component={SecuritySettings} />
          <Route path="/settings">
            <div className="p-6" data-testid="settings-home">
              <h1 className="text-2xl font-semibold mb-6">Paramètres</h1>
              <p className="text-muted-foreground">Sélectionnez une catégorie dans le menu de gauche.</p>
            </div>
          </Route>
        </Switch>
      </div>
    </div>
  );
}
