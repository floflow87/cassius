import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell, Calendar, LogOut } from "lucide-react";
import NotFound from "@/pages/not-found";
import PatientsPage from "@/pages/patients";
import PatientDetailsPage from "@/pages/patient-details";
import ImplantDetailsPage from "@/pages/implant-details";
import PatientReportPage from "@/pages/patient-report";
import DashboardPage from "@/pages/dashboard";
import ImplantsPage from "@/pages/implants";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface UserInfo {
  id: string;
  username: string;
  role: "CHIRURGIEN" | "ASSISTANT" | "ADMIN";
  nom: string | null;
  prenom: string | null;
}

interface PageHeaderProps {
  user: UserInfo;
  onLogout: () => void;
}

function PageHeader({ user, onLogout }: PageHeaderProps) {
  const [location] = useLocation();
  
  const getPageInfo = () => {
    if (location === "/" || location.startsWith("/patient")) {
      return { title: "Patients", subtitle: null };
    }
    if (location === "/implants" || location.includes("/implant/")) {
      return { title: "Implants", subtitle: null };
    }
    if (location === "/dashboard" || location === "/stats") {
      return { title: "Tableau de bord", subtitle: null };
    }
    return { title: "Cassius", subtitle: null };
  };

  const { title } = getPageInfo();
  
  const getUserInitials = () => {
    const first = user.prenom?.[0] || "";
    const last = user.nom?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const roleLabels: Record<string, string> = {
    CHIRURGIEN: "Chirurgien",
    ASSISTANT: "Assistant",
    ADMIN: "Administrateur",
  };

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4 bg-background sticky top-0 z-50 border-b">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground" data-testid="text-page-title">
          {title}
        </h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-calendar">
          <Calendar className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground font-medium text-sm p-0"
              data-testid="button-user-menu"
            >
              {getUserInitials()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user.prenom} {user.nom}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {roleLabels[user.role] || user.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function Router({ searchQuery, setSearchQuery }: { searchQuery: string; setSearchQuery: (q: string) => void }) {
  return (
    <Switch>
      <Route path="/">
        {() => <PatientsPage searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
      </Route>
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/stats" component={DashboardPage} />
      <Route path="/implants" component={ImplantsPage} />
      <Route path="/patient/:id" component={PatientDetailsPage} />
      <Route path="/patient/:id/report" component={PatientReportPage} />
      <Route path="/patient/:patientId/implant/:implantId" component={ImplantDetailsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: user, isLoading, refetch } = useQuery<UserInfo>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetch();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-32 w-32 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/register">
          {() => <RegisterPage onRegisterSuccess={() => refetch()} />}
        </Route>
        <Route>
          {() => <LoginPage onLoginSuccess={() => refetch()} />}
        </Route>
      </Switch>
    );
  }

  const style = {
    "--sidebar-width": "4rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties} defaultOpen={false}>
      <div className="flex h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <PageHeader user={user} onLogout={handleLogout} />
          <main className="flex-1 overflow-auto">
            <Router searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
