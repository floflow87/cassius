import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import PatientsPage from "@/pages/patients";
import PatientDetailsPage from "@/pages/patient-details";
import ImplantDetailsPage from "@/pages/implant-details";
import DashboardPage from "@/pages/dashboard";

function Router({ searchQuery }: { searchQuery: string }) {
  return (
    <Switch>
      <Route path="/">
        {() => <PatientsPage searchQuery={searchQuery} />}
      </Route>
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patient/:id" component={PatientDetailsPage} />
      <Route path="/patient/:patientId/implant/:implantId" component={ImplantDetailsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background sticky top-0 z-50">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto bg-background">
                <Router searchQuery={searchQuery} />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
