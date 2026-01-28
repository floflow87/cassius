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
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { FaFolder, FaCalendarAlt } from "react-icons/fa";
import { useCurrentUser } from "@/hooks/use-current-user";

import logoIcon from "@assets/logo_Cassius_1765878309061.png";
import logoFull from "@assets/logo_Cassius_Plan_de_travail_1_copie_Plan_de_travail_1_copie_2_1767822114601.png";
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
  reactIcon?: typeof FaFolder;
  hideForAssistant?: boolean;
};

const menuItems: MenuItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: homeIcon },
  { title: "Patients", url: "/patients", icon: patientIcon },
  { title: "Implants", url: "/implants", icon: implantsIcon },
  { title: "Actes", url: "/actes", icon: actesIcon },
  { title: "Documents", url: "/documents", reactIcon: FaFolder },
  { title: "Calendrier", url: "/calendar", reactIcon: FaCalendarAlt },
  { title: "Statistiques", url: "/stats", icon: statsIcon, hideForAssistant: true },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { state, open, setOpen } = useSidebar();
  const { isAssistant } = useCurrentUser();
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
    <Sidebar collapsible="icon" variant="floating" className="border-r-0 overflow-visible relative">

      <SidebarHeader className="bg-sidebar h-16 px-2 rounded-t-[15px]">
        <div className="flex items-center h-full pl-[11px]">
          <a 
            href="/dashboard" 
            onClick={handleNavClick("/dashboard")}
            className="cursor-pointer"
            data-testid="link-logo-home"
          >
            {isExpanded ? (
              <img src={logoFull} alt="Cassius" className="h-11 w-auto" />
            ) : (
              <img src={logoIcon} alt="Cassius" className="h-9 w-9 shrink-0 brightness-0 invert" />
            )}
          </a>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-0 py-0">
        {/* HR separator between logo and menu */}
        <div className="px-3 pt-2 pb-3">
          <hr className="border-t border-white/20" />
        </div>
        <SidebarMenu className="gap-1 px-3 pt-2">
          {menuItems
            .filter(item => !(item.hideForAssistant && isAssistant))
            .map((item) => {
            const active = isActive(item.url);
            
            const linkContent = (
              <a
                href={item.url}
                onClick={handleNavClick(item.url)}
                className={`flex h-10 items-center transition-all ${
                  isExpanded ? 'justify-start px-3 gap-3' : 'justify-center w-full'
                } ${
                  active 
                    ? "bg-sidebar-accent rounded-[50px]" 
                    : "bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] rounded-md"
                }`}
                data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.icon ? (
                  <img 
                    src={item.icon} 
                    alt={item.title}
                    className="h-[18px] w-auto brightness-0 invert shrink-0"
                  />
                ) : item.reactIcon && (
                  <item.reactIcon className="h-[16px] w-[16px] text-white shrink-0" />
                )}
                {isExpanded && (
                  <span className={`text-xs truncate ${active ? 'font-medium text-white' : 'font-light text-white/80'}`}>
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

      <SidebarFooter className="bg-sidebar px-3 py-2 pb-4 mt-auto rounded-b-[15px]">
        <SidebarMenu className="gap-1">
          {/* Support link */}
          <SidebarMenuItem className="px-0">
            {isExpanded ? (
              <a
                href="/support"
                onClick={handleNavClick("/support")}
                className={`flex h-10 items-center justify-start px-3 gap-3 transition-all ${
                  isActive("/support") ? "bg-sidebar-accent rounded-[50px]" : "bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] rounded-md"
                }`}
                data-testid="link-support"
              >
                <HelpCircle className="h-[18px] w-[18px] text-white shrink-0" />
                <span className={`text-xs truncate ${isActive("/support") ? 'font-medium text-white' : 'font-light text-white/80'}`}>
                  Support
                </span>
              </a>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/support"
                    onClick={handleNavClick("/support")}
                    className="flex h-10 items-center justify-center w-full rounded-md bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] transition-all"
                    data-testid="link-support"
                  >
                    <HelpCircle className="h-[18px] w-[18px] text-white" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Support
                </TooltipContent>
              </Tooltip>
            )}
          </SidebarMenuItem>
          
          {/* Settings button */}
          <SidebarMenuItem className="px-0">
            {isExpanded ? (
              <a
                href="/settings"
                onClick={handleNavClick("/settings")}
                className={`flex h-10 items-center justify-start px-3 gap-3 transition-all ${
                  isActive("/settings") ? "bg-sidebar-accent rounded-[50px]" : "bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] rounded-md"
                }`}
                data-testid="link-settings"
              >
                <img 
                  src={settingsIcon} 
                  alt="Paramètres"
                  className="h-[18px] w-auto brightness-0 invert shrink-0"
                />
                <span className={`text-xs truncate ${isActive("/settings") ? 'font-medium text-white' : 'font-light text-white/80'}`}>
                  Paramètres
                </span>
              </a>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/settings"
                    onClick={handleNavClick("/settings")}
                    className="flex h-10 items-center justify-center rounded-md bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] transition-all"
                    data-testid="link-settings"
                  >
                    <img 
                      src={settingsIcon} 
                      alt="Paramètres"
                      className="h-[18px] w-auto brightness-0 invert"
                    />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Paramètres
                </TooltipContent>
              </Tooltip>
            )}
          </SidebarMenuItem>
          
          {/* Toggle sidebar button - separate line */}
          <SidebarMenuItem className="px-0">
            {isExpanded ? (
              <button
                onClick={handleToggle}
                className="flex h-10 w-full items-center justify-start px-3 gap-3 transition-all bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] rounded-md"
                aria-expanded={isExpanded}
                data-testid="button-toggle-sidebar"
              >
                <ChevronLeft className="h-[18px] w-[18px] text-white/80 shrink-0" />
                <span className="text-xs font-light text-white/80 italic truncate">
                  Réduire le menu
                </span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggle}
                    className="flex h-10 w-full items-center justify-center rounded-md bg-transparent hover:bg-sidebar-accent/50 hover:rounded-[50px] transition-all"
                    aria-expanded={isExpanded}
                    data-testid="button-toggle-sidebar"
                  >
                    <ChevronRight className="h-[18px] w-[18px] text-white/80" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                  Agrandir le menu
                </TooltipContent>
              </Tooltip>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
