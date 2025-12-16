import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
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
import type { Patient } from "@shared/schema";

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
  patientCount?: number;
}

function PageHeader({ user, onLogout, patientCount }: PageHeaderProps) {
  const [location] = useLocation();
  
  const getPageInfo = () => {
    if (location === "/patients" || location.startsWith("/patients/")) {
      return { 
        title: "Patients", 
        subtitle: null 
      };
    }
    if (location === "/implants" || location.startsWith("/implants/")) {
      return { title: "Implants", subtitle: null };
    }
    if (location === "/dashboard" || location === "/" || location === "/stats") {
      return { title: "Tableau de bord", subtitle: null };
    }
    if (location === "/actes") {
      return { title: "Actes", subtitle: null };
    }
    return { title: "Cassius", subtitle: null };
  };

  const { title, subtitle } = getPageInfo();
  
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
    <header className="flex items-center justify-between gap-4 px-6 h-16 bg-white dark:bg-gray-950 sticky top-0 z-50 border-b shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground" data-testid="text-page-title">
          {title}
        </h1>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
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
            <DropdownMenuItem onSelect={onLogout} data-testid="button-logout">
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
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/register">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/login">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/patient/:id">
        {(params) => <Redirect to={`/patients/${params.id}`} />}
      </Route>
      <Route path="/patient/:patientId/implant/:implantId">
        {(params) => <Redirect to={`/patients/${params.patientId}/implants/${params.implantId}`} />}
      </Route>
      <Route path="/patients">
        {() => <PatientsPage searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
      </Route>
      <Route path="/patients/:id" component={PatientDetailsPage} />
      <Route path="/patients/:id/report" component={PatientReportPage} />
      <Route path="/patients/:patientId/implants/:implantId" component={ImplantDetailsPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/stats" component={DashboardPage} />
      <Route path="/implants" component={ImplantsPage} />
      <Route path="/actes" component={DashboardPage} />
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

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: !!user,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      // Clear user data immediately to trigger unauthenticated state
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 bg-muted/30">
          <PageHeader user={user} onLogout={handleLogout} patientCount={patients?.length} />
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
