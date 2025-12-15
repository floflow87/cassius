import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
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

interface UserInfo {
  id: string;
  username: string;
  role: "CHIRURGIEN" | "ASSISTANT" | "ADMIN";
  nom: string | null;
  prenom: string | null;
}

function Router({ searchQuery }: { searchQuery: string }) {
  return (
    <Switch>
      <Route path="/">
        {() => <PatientsPage searchQuery={searchQuery} />}
      </Route>
      <Route path="/dashboard" component={DashboardPage} />
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

  const roleLabels: Record<string, string> = {
    CHIRURGIEN: "Chirurgien",
    ASSISTANT: "Assistant",
    ADMIN: "Administrateur",
  };

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <User className="h-4 w-4" />
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
                  <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Router searchQuery={searchQuery} />
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
