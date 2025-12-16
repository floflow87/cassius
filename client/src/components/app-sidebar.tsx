import { forwardRef } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import logoIcon from "@assets/logo_Cassius_1765878309061.png";
import homeIcon from "@assets/home_1765878309061.png";
import patientIcon from "@assets/patient_1765878309061.png";
import implantsIcon from "@assets/implants_1765878309061.png";
import actesIcon from "@assets/actes_1765878309062.png";
import statsIcon from "@assets/statistiques_1765878309062.png";
import settingsIcon from "@assets/settings_1765878309060.png";

const menuItems = [
  {
    title: "Accueil",
    url: "/dashboard",
    icon: homeIcon,
  },
  {
    title: "Patients",
    url: "/patients",
    icon: patientIcon,
  },
  {
    title: "Implants",
    url: "/implants",
    icon: implantsIcon,
  },
  {
    title: "Actes",
    url: "/actes",
    icon: actesIcon,
  },
  {
    title: "Statistiques",
    url: "/stats",
    icon: statsIcon,
  },
];

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ href, children, ...props }, ref) => {
    const [, setLocation] = useLocation();
    
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setLocation(href);
    };
    
    return (
      <a ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }
);
NavLink.displayName = "NavLink";

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/patients") {
      return location === "/patients" || location.startsWith("/patients/");
    }
    if (url === "/implants") {
      return location === "/implants" || location.startsWith("/implants/");
    }
    return location === url || location.startsWith(url + "/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex items-center justify-center p-3 pt-4">
        <img src={logoIcon} alt="Cassius" className="h-8 w-8" />
      </div>

      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {menuItems.map((item) => {
            const active = isActive(item.url);
            
            return (
              <SidebarMenuItem key={item.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={`h-11 w-11 mx-auto justify-center rounded-lg ${
                        active 
                          ? "bg-white/20" 
                          : "bg-transparent hover:bg-white/10"
                      }`}
                    >
                      <NavLink href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <img 
                          src={item.icon} 
                          alt={item.title} 
                          className={`h-5 w-5 ${active ? "opacity-100" : "opacity-70"}`}
                        />
                      </NavLink>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  asChild
                  className="h-11 w-11 mx-auto justify-center rounded-lg bg-transparent hover:bg-white/10"
                >
                  <NavLink href="/settings" data-testid="link-settings">
                    <img src={settingsIcon} alt="Paramètres" className="h-5 w-5 opacity-70" />
                  </NavLink>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                Paramètres
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
