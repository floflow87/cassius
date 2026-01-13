import { useState } from "react";
import { Bell, Check, CheckCheck, Loader2, AlertCircle, Clock, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Notification {
  id: string;
  kind: "ALERT" | "REMINDER" | "ACTIVITY" | "IMPORT" | "SYSTEM";
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  patientName?: string;
  patientId?: string;
  createdAt: string;
  readAt?: string;
}

const KIND_ICONS: Record<string, typeof AlertCircle> = {
  ALERT: AlertCircle,
  REMINDER: Clock,
  ACTIVITY: RefreshCw,
  IMPORT: FileText,
  SYSTEM: Bell,
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-500",
  WARNING: "text-amber-500",
  INFO: "text-blue-500",
};

function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icon = KIND_ICONS[notification.kind] || Bell;
  const severityColor = SEVERITY_COLORS[notification.severity] || "text-muted-foreground";
  const isUnread = !notification.readAt;
  
  const getEntityLink = () => {
    if (!notification.entityType || !notification.entityId) return null;
    switch (notification.entityType) {
      case "PATIENT":
        return `/patients/${notification.entityId}`;
      case "APPOINTMENT":
        return "/calendar";
      case "IMPORT":
        return "/patients/import";
      case "DOCUMENT":
        return "/documents";
      default:
        return null;
    }
  };
  
  const link = getEntityLink();
  
  const content = (
    <div 
      className={`flex gap-3 p-3 hover-elevate cursor-pointer ${isUnread ? 'bg-accent/30' : ''}`}
      onClick={() => isUnread && onMarkAsRead(notification.id)}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className={`mt-0.5 ${severityColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs ${isUnread ? 'font-medium' : ''}`}>{notification.title}</p>
          {isUnread && (
            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
          )}
        </div>
        {notification.patientName && (
          <Link 
            href={notification.patientId ? `/patients/${notification.patientId}` : "#"}
            className="text-xs text-primary hover:underline mt-0.5 block"
            onClick={(e) => e.stopPropagation()}
          >
            {notification.patientName}
          </Link>
        )}
        {notification.body && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
        </p>
      </div>
    </div>
  );
  
  return link ? (
    <Link href={link} className="block" data-testid={`notification-link-${notification.id}`}>
      {content}
    </Link>
  ) : content;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });
  
  const { data: notificationsData, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: ['/api/notifications'],
    queryFn: () => fetch('/api/notifications?pageSize=10').then(r => r.json()),
    enabled: open,
  });
  
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });
  
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });
  
  const unreadCount = unreadData?.count || 0;
  const notifications = notificationsData?.notifications || [];
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-primary bg-primary/10 hover:bg-primary/20 rounded-full" 
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 text-[10px] font-bold bg-primary text-primary-foreground"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <h4 className="font-medium text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Tout marquer lu
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t p-2">
          <Button 
            variant="ghost" 
            className="w-full text-xs h-8"
            asChild
            onClick={() => setOpen(false)}
            data-testid="link-view-all-notifications"
          >
            <Link href="/notifications">Voir toutes les notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
