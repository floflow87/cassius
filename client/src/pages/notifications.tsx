import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "wouter";
import { 
  Bell, 
  AlertCircle, 
  Clock, 
  FileText, 
  RefreshCw, 
  Check, 
  CheckCheck, 
  Loader2,
  Settings,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Notification {
  id: string;
  kind: "ALERT" | "REMINDER" | "ACTIVITY" | "IMPORT" | "SYSTEM";
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
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

const KIND_LABELS: Record<string, string> = {
  ALERT: "Alertes",
  REMINDER: "Rappels",
  ACTIVITY: "Activité",
  IMPORT: "Imports",
  SYSTEM: "Système",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-500",
  WARNING: "text-amber-500",
  INFO: "text-blue-500",
};

const SEVERITY_BG: Record<string, string> = {
  CRITICAL: "bg-red-50 dark:bg-red-950/30",
  WARNING: "bg-amber-50 dark:bg-amber-950/30",
  INFO: "bg-blue-50 dark:bg-blue-950/30",
};

function NotificationRow({ 
  notification, 
  selected,
  onSelect,
  onMarkAsRead 
}: { 
  notification: Notification;
  selected: boolean;
  onSelect: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}) {
  const Icon = KIND_ICONS[notification.kind] || Bell;
  const severityColor = SEVERITY_COLORS[notification.severity] || "text-muted-foreground";
  const severityBg = notification.severity === "CRITICAL" ? SEVERITY_BG.CRITICAL : "";
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
  
  return (
    <div 
      className={`flex items-start gap-4 p-4 border-b last:border-b-0 hover-elevate ${severityBg} ${isUnread ? 'bg-accent/20' : ''}`}
      data-testid={`notification-row-${notification.id}`}
    >
      <Checkbox 
        checked={selected}
        onCheckedChange={() => onSelect(notification.id)}
        data-testid={`checkbox-notification-${notification.id}`}
      />
      
      <div className={`mt-0.5 shrink-0 ${severityColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm ${isUnread ? 'font-semibold' : ''}`}>
                {notification.title}
              </span>
              {isUnread && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Nouveau
                </Badge>
              )}
            </div>
            {notification.body && (
              <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {format(new Date(notification.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {KIND_LABELS[notification.kind] || notification.kind}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {link && (
              <Button variant="outline" size="sm" asChild data-testid={`button-view-${notification.id}`}>
                <Link href={link}>Voir</Link>
              </Button>
            )}
            {isUnread && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onMarkAsRead(notification.id)}
                data-testid={`button-mark-read-${notification.id}`}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterUnread, setFilterUnread] = useState<string>("all");
  
  const kindFilter = activeTab === "all" ? undefined : activeTab.toUpperCase();
  
  const { data, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: ['/api/notifications', { kind: kindFilter, pageSize: 50 }],
  });
  
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
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
      setSelectedIds(new Set());
    },
  });
  
  const notifications = data?.notifications || [];
  const unreadCount = unreadData?.count || 0;
  
  const filteredNotifications = notifications.filter(n => {
    if (filterUnread === "unread") return !n.readAt;
    if (filterUnread === "read") return !!n.readAt;
    return true;
  });
  
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };
  
  const selectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };
  
  const countByKind = (kind: string) => {
    return notifications.filter(n => n.kind === kind && !n.readAt).length;
  };
  
  return (
    <div className="p-6 w-full" data-testid="page-notifications">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : "Toutes lues"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending || unreadCount === 0}
            data-testid="button-mark-all-read"
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            Tout marquer lu
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="button-notification-settings">
            <Link href="/settings?tab=notifications">
              <Settings className="h-4 w-4 mr-2" />
              Préférences
            </Link>
          </Button>
        </div>
      </div>
      
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">
                  Toutes
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="alert" data-testid="tab-alert">
                  Alertes
                  {countByKind("ALERT") > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {countByKind("ALERT")}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity" data-testid="tab-activity">Activité</TabsTrigger>
                <TabsTrigger value="import" data-testid="tab-import">Imports</TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system">Système</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterUnread} onValueChange={setFilterUnread}>
                  <SelectTrigger className="w-[140px] h-8" data-testid="select-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="unread">Non lues</SelectItem>
                    <SelectItem value="read">Lues</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-4 p-3 bg-muted rounded-md mb-4">
                <span className="text-sm">
                  {selectedIds.size} notification{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    selectedIds.forEach(id => {
                      const n = notifications.find(n => n.id === id);
                      if (n && !n.readAt) {
                        markAsReadMutation.mutate(id);
                      }
                    });
                    setSelectedIds(new Set());
                  }}
                  data-testid="button-mark-selected-read"
                >
                  Marquer comme lu
                </Button>
              </div>
            )}
            
            {filteredNotifications.length > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b mb-2">
                <Checkbox 
                  checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                  onCheckedChange={selectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm text-muted-foreground">Tout sélectionner</span>
              </div>
            )}
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 p-4">
                    <Skeleton className="h-5 w-5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">Aucune notification</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab !== "all" 
                    ? `Aucune notification de type "${KIND_LABELS[activeTab.toUpperCase()] || activeTab}"`
                    : filterUnread !== "all"
                    ? "Aucune notification correspondant au filtre"
                    : "Vous n'avez pas encore de notifications"
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map(notification => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    selected={selectedIds.has(notification.id)}
                    onSelect={toggleSelect}
                    onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
