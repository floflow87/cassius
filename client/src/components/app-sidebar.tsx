import { forwardRef } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
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
import homeIcon from "/assets/icons/home.png";
import patientIcon from "/assets/icons/patient.png";
import implantsIcon from "/assets/icons/implants.png";
import actesIcon from "/assets/icons/actes.png";
import statsIcon from "/assets/icons/statistiques.png";
import settingsIcon from "/assets/icons/settings.png";

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
    <Sidebar collapsible="icon" className="border-r-0 overflow-visible">
      <SidebarHeader className="bg-white dark:bg-gray-950 flex items-center justify-center p-3 pt-4 pb-4">
        <img src={logoIcon} alt="Cassius" className="h-9 w-9" />
      </SidebarHeader>

      <SidebarContent className="bg-primary px-0 py-2">
        <SidebarMenu className="gap-0">
          {menuItems.map((item) => {
            const active = isActive(item.url);
            
            return (
              <SidebarMenuItem key={item.title} className="px-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={`h-12 w-full rounded-none justify-center ${
                        active 
                          ? "bg-secondary" 
                          : "bg-transparent hover:bg-white/10"
                      }`}
                    >
                      <NavLink href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <img 
                          src={item.icon} 
                          alt={item.title}
                          className="h-6 w-6 brightness-0 invert"
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

      <SidebarFooter className="bg-primary px-0 py-2 pb-4 mt-auto">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem className="px-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  asChild
                  className="h-12 w-full rounded-none justify-center bg-transparent hover:bg-white/10"
                >
                  <NavLink href="/settings" data-testid="link-settings">
                    <img 
                      src={settingsIcon} 
                      alt="Paramètres"
                      className="h-6 w-6 brightness-0 invert"
                    />
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
