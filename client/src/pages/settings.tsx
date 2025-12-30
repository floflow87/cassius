import { useState } from "react";
import { useLocation } from "wouter";
import { User, Building2, Plug, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsIntegrationsPage from "./settings-integrations";

function ProfileSettings() {
  return (
    <div data-testid="settings-profile">
      <p className="text-sm text-muted-foreground">Gérez vos informations personnelles.</p>
    </div>
  );
}

function OrganizationSettings() {
  return (
    <div data-testid="settings-organization">
      <p className="text-sm text-muted-foreground">Paramètres de votre cabinet.</p>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div data-testid="settings-security">
      <p className="text-sm text-muted-foreground">Gérez la sécurité de votre compte.</p>
    </div>
  );
}

export default function SettingsPage() {
  const [location] = useLocation();
  
  const getInitialTab = () => {
    if (location.startsWith("/settings/integrations")) return "integrations";
    if (location === "/settings/profile") return "profile";
    if (location === "/settings/organization") return "organization";
    if (location === "/settings/security") return "security";
    return "profile";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent p-0 h-auto gap-6 border-b-0">
            <TabsTrigger 
              value="profile" 
              className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
              data-testid="tab-profile"
            >
              <User className="h-4 w-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger 
              value="organization" 
              className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
              data-testid="tab-organization"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Organisation
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
              data-testid="tab-integrations"
            >
              <Plug className="h-4 w-4 mr-2" />
              Intégrations
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
              data-testid="tab-security"
            >
              <Shield className="h-4 w-4 mr-2" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileSettings />
          </TabsContent>
          
          <TabsContent value="organization" className="mt-6">
            <OrganizationSettings />
          </TabsContent>
          
          <TabsContent value="integrations" className="mt-6">
            <SettingsIntegrationsPage embedded />
          </TabsContent>
          
          <TabsContent value="security" className="mt-6">
            <SecuritySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
