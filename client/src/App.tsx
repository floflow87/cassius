import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Calendar, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import NotFound from "@/pages/not-found";
import PatientsPage from "@/pages/patients";
import PatientDetailsPage from "@/pages/patient-details";
import ImplantDetailsPage from "@/pages/implant-details";
import CatalogImplantDetailsPage from "@/pages/catalog-implant-details";
import PatientReportPage from "@/pages/patient-report";
import DashboardPage from "@/pages/dashboard";
import StatsPage from "@/pages/stats";
import ImplantsPage from "@/pages/implants";
import ActesPage from "@/pages/actes";
import ActeDetailsPage from "@/pages/acte-details";
import DocumentsPage from "@/pages/documents";
import CalendarPage from "@/pages/calendar";
import SettingsPage from "@/pages/settings";
import IntegrationsPage from "@/pages/settings-integrations";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AcceptInvitationPage from "@/pages/accept-invitation";
import VerifyEmailPage from "@/pages/verify-email";
import ImportPatientsPage from "@/pages/import-patients";
import NotificationsPage from "@/pages/notifications";
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
import { GlobalSearch } from "@/components/global-search";
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
  const [location, setLocation] = useLocation();
  
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
    if (location === "/dashboard" || location === "/") {
      return { title: "Tableau de bord", subtitle: null };
    }
    if (location === "/stats") {
      return { title: "Statistiques", subtitle: null };
    }
    if (location === "/actes") {
      return { title: "Actes", subtitle: null };
    }
    if (location === "/documents") {
      return { title: "Documents", subtitle: null };
    }
    if (location === "/calendar") {
      return { title: "Calendrier", subtitle: null };
    }
    if (location.startsWith("/settings")) {
      return { title: "Paramètres", subtitle: null };
    }
    if (location === "/notifications") {
      return { title: "Notifications", subtitle: null };
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
    <header className="flex items-center justify-between gap-4 px-6 h-[59px] bg-white dark:bg-gray-950 sticky top-2 z-50 shrink-0 mx-6 rounded-[15px]">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold text-foreground" data-testid="text-page-title">
          {title}
        </h1>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
      
      <GlobalSearch className="flex-1 max-w-md" />
      
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-primary bg-primary/10 hover:bg-primary/20 rounded-full" 
          data-testid="button-calendar"
          onClick={() => setLocation("/calendar")}
        >
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
      <Route path="/patients/import" component={ImportPatientsPage} />
      <Route path="/patients/:id" component={PatientDetailsPage} />
      <Route path="/patients/:id/report" component={PatientReportPage} />
      <Route path="/patients/:patientId/implants/:implantId" component={ImplantDetailsPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/implants">
        {() => <ImplantsPage />}
      </Route>
      <Route path="/implants/:id" component={CatalogImplantDetailsPage} />
      <Route path="/actes">
        {() => <ActesPage />}
      </Route>
      <Route path="/actes/:id" component={ActeDetailsPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/settings/integrations/:rest*">
        <IntegrationsPage />
      </Route>
      <Route path="/settings/integrations">
        <IntegrationsPage />
      </Route>
      <Route path="/settings/:section" component={SettingsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Read initial sidebar state from localStorage (default to expanded)
const getInitialSidebarState = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cassius.sidebarCollapsed');
    return stored !== 'true'; // true = expanded (default), false = collapsed
  }
  return true;
};

function AuthenticatedApp() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);

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
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/accept-invitation" component={AcceptInvitationPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route>
          {() => <LoginPage onLoginSuccess={() => refetch()} />}
        </Route>
      </Switch>
    );
  }

  // Persist sidebar state to localStorage when changed
  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('cassius.sidebarCollapsed', open ? 'false' : 'true');
  };

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4.5rem",
  };

  return (
    <SidebarProvider 
      style={style as React.CSSProperties} 
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
    >
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 bg-muted/30 pt-2">
          <PageHeader user={user} onLogout={handleLogout} patientCount={patients?.length} />
          <main className="flex-1 overflow-auto pt-4">
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
