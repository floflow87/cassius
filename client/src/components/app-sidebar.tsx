import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FolderClosed, Calendar } from "lucide-react";

import logoIcon from "@assets/logo_Cassius_1765878309061.png";
import logoFull from "@assets/logo_Cassius_Plan_de_travail_1_copie_1765897934649.png";
import homeIcon from "/assets/icons/home.png";
import patientIcon from "/assets/icons/patient.png";
import implantsIcon from "/assets/icons/implants.png";
import actesIcon from "/assets/icons/actes.png";
import statsIcon from "/assets/icons/statistiques.png";
import settingsIcon from "/assets/icons/settings.png";

type MenuItem = {
  title: string;
  url: string;
  icon?: string;
  lucideIcon?: typeof FolderClosed;
};

const menuItems: MenuItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: homeIcon },
  { title: "Patients", url: "/patients", icon: patientIcon },
  { title: "Implants", url: "/implants", icon: implantsIcon },
  { title: "Actes", url: "/actes", icon: actesIcon },
  { title: "Documents", url: "/documents", lucideIcon: FolderClosed },
  { title: "Calendrier", url: "/calendar", lucideIcon: Calendar },
  { title: "Statistiques", url: "/stats", icon: statsIcon },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { state, open, setOpen } = useSidebar();
  const isExpanded = state === "expanded";

  const handleToggle = () => {
    setOpen(!open);
  };

  const isActive = (url: string) => {
    if (url === "/patients") {
      return location === "/patients" || location.startsWith("/patients/");
    }
    if (url === "/implants") {
      return location === "/implants" || location.startsWith("/implants/");
    }
    return location === url || location.startsWith(url + "/");
  };

  const handleNavClick = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 overflow-visible">
      <SidebarHeader className="bg-white dark:bg-gray-950 flex items-center justify-center h-16 px-4 border-b">
        <a 
          href="/dashboard" 
          onClick={handleNavClick("/dashboard")}
          className="flex items-center justify-center w-full cursor-pointer"
          data-testid="link-logo-home"
        >
          {isExpanded ? (
            <img src={logoFull} alt="Cassius" className="h-8 w-auto" />
          ) : (
            <img src={logoIcon} alt="Cassius" className="h-8 w-8 shrink-0" />
          )}
        </a>
      </SidebarHeader>

      <SidebarContent className="bg-primary px-0 py-0">
        <SidebarMenu className="gap-1 px-2 pt-2">
          {menuItems.map((item) => {
            const active = isActive(item.url);
            
            const linkContent = (
              <a
                href={item.url}
                onClick={handleNavClick(item.url)}
                className={`flex h-10 items-center rounded-[5px] ${
                  isExpanded ? 'justify-start px-3 gap-3' : 'justify-center w-full'
                } ${
                  active 
                    ? "bg-secondary" 
                    : "bg-transparent hover:bg-white/10"
                }`}
                data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.icon ? (
                  <img 
                    src={item.icon} 
                    alt={item.title}
                    className="h-5 w-auto brightness-0 invert shrink-0"
                  />
                ) : item.lucideIcon && (
                  <item.lucideIcon className="h-5 w-5 text-white shrink-0" />
                )}
                {isExpanded && (
                  <span className="text-sm font-medium text-white truncate">
                    {item.title}
                  </span>
                )}
              </a>
            );
            
            return (
              <SidebarMenuItem key={item.title} className="px-0">
                {isExpanded ? (
                  linkContent
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="bg-primary px-2 py-2 pb-4 mt-auto">
        <SidebarMenu className="gap-1">
          {/* Toggle button - first */}
          <SidebarMenuItem className="px-0">
            {isExpanded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggle}
                    className="flex h-10 w-full items-center justify-end px-3 text-white hover:bg-white/10"
                    aria-expanded={isExpanded}
                    aria-label="Réduire le menu"
                    data-testid="button-toggle-sidebar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Réduire le menu
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggle}
                    className="flex h-10 w-full items-center justify-center text-white hover:bg-white/10"
                    aria-expanded={isExpanded}
                    aria-label="Agrandir le menu"
                    data-testid="button-toggle-sidebar"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Agrandir le menu
                </TooltipContent>
              </Tooltip>
            )}
          </SidebarMenuItem>

          {/* Settings button - second */}
          <SidebarMenuItem className="px-0">
            {isExpanded ? (
              <a
                href="/settings"
                onClick={handleNavClick("/settings")}
                className="flex h-10 w-full items-center justify-start px-3 gap-3 rounded-[5px] bg-transparent hover:bg-white/10"
                data-testid="link-settings"
              >
                <img 
                  src={settingsIcon} 
                  alt="Paramètres"
                  className="h-5 w-auto brightness-0 invert shrink-0"
                />
                <span className="text-sm font-medium text-white truncate">
                  Paramètres
                </span>
              </a>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/settings"
                    onClick={handleNavClick("/settings")}
                    className="flex h-10 w-full items-center justify-center rounded-[5px] bg-transparent hover:bg-white/10"
                    data-testid="link-settings"
                  >
                    <img 
                      src={settingsIcon} 
                      alt="Paramètres"
                      className="h-5 w-auto brightness-0 invert"
                    />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Paramètres
                </TooltipContent>
              </Tooltip>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
