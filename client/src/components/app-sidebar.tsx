import { Link, useLocation } from "wouter";
import { Home, Users, Settings, BarChart3 } from "lucide-react";
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

function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C9.5 2 7.5 4 7.5 6.5c0 1.5.7 2.8 1.8 3.7L8.5 14c-.3 1.5-.5 3-.5 4.5 0 1.9 1.6 3.5 3.5 3.5h1c1.9 0 3.5-1.6 3.5-3.5 0-1.5-.2-3-.5-4.5l-.8-3.8c1.1-.9 1.8-2.2 1.8-3.7C16.5 4 14.5 2 12 2zm0 2c1.4 0 2.5 1.1 2.5 2.5S13.4 9 12 9s-2.5-1.1-2.5-2.5S10.6 4 12 4z"/>
    </svg>
  );
}

function ImplantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C10.34 2 9 3.34 9 5v1H7v2h2v2H7v2h2v2H7v2h2v1c0 1.66 1.34 3 3 3s3-1.34 3-3v-1h2v-2h-2v-2h2v-2h-2V8h2V6h-2V5c0-1.66-1.34-3-3-3zm-1 3c0-.55.45-1 1-1s1 .45 1 1v12c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
    </svg>
  );
}

const menuItems = [
  {
    title: "Accueil",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Patients",
    url: "/",
    icon: Users,
  },
  {
    title: "Implants",
    url: "/implants",
    icon: ImplantIcon,
  },
  {
    title: "Statistiques",
    url: "/stats",
    icon: BarChart3,
  },
];

interface AppSidebarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function AppSidebar({ searchQuery, onSearchChange }: AppSidebarProps) {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") {
      return location === "/" || location.startsWith("/patient");
    }
    if (url === "/implants") {
      return location === "/implants" || location.includes("/implant/");
    }
    return location === url || location.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Logo */}
      <div className="flex items-center justify-center p-3 pt-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
          <ToothIcon className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>

      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.url);
            
            return (
              <SidebarMenuItem key={item.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={`h-10 w-10 mx-auto justify-center rounded-lg ${
                        active 
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <Icon className="h-5 w-5" />
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
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
                  className="h-10 w-10 mx-auto justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  data-testid="button-settings"
                >
                  <Settings className="h-5 w-5" />
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="right">
                Paramètres
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
