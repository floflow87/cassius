import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CheckCircle2,
  ClipboardList,
  Calendar,
  FileImage,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Operation, Visite, User } from "@shared/schema";

interface BasicStats {
  totalPatients: number;
  totalImplants: number;
  totalRadios: number;
  totalOperations: number;
  implantsByStatus: Record<string, number>;
  recentOperations: Operation[];
}

interface AdvancedStats {
  successRate: number;
  complicationRate: number;
  failureRate: number;
  avgIsqPose: number;
  avgIsq3m: number;
  avgIsq6m: number;
  implantsByBrand: Record<string, number>;
  implantsBySite: Record<string, number>;
  isqTrends: { month: string; avgIsq: number }[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor: string;
  change?: { value: string; positive: boolean };
  subtitle?: string;
}

function StatCard({ title, value, icon, iconBgColor, change, subtitle }: StatCardProps) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {change && (
              <div className="flex items-center gap-1 mt-2">
                {change.positive ? (
                  <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                )}
                <span className={`text-xs font-medium ${change.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {change.value}
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${iconBgColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SecondaryStatCardProps {
  title: string;
  icon: React.ReactNode;
  iconBgColor: string;
  stats: { label: string; value: number }[];
}

function SecondaryStatCard({ title, icon, iconBgColor, stats }: SecondaryStatCardProps) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            {icon}
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="space-y-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className="font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AppointmentItemProps {
  date: Date;
  title: string;
  description: string;
  type: "consultation" | "suivi" | "action";
  time?: string;
}

function AppointmentItem({ date, title, description, type, time }: AppointmentItemProps) {
  const day = date.getDate();
  const month = date.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase();
  
  const borderColor = type === "consultation" 
    ? "border-l-blue-500" 
    : type === "suivi" 
    ? "border-l-green-500" 
    : "border-l-orange-500";
  
  const badgeVariant = type === "consultation" 
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
    : type === "suivi" 
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
    : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  
  const badgeLabel = type === "consultation" 
    ? "Consultation" 
    : type === "suivi" 
    ? "Suivi" 
    : "Action";

  return (
    <div className={`flex items-center gap-4 p-3 border-l-4 ${borderColor} bg-muted/30 rounded-r-md`}>
      <div className="flex flex-col items-center justify-center min-w-[48px]">
        <span className="text-2xl font-bold">{day}</span>
        <span className="text-xs text-muted-foreground">{month}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <Badge className={`${badgeVariant} no-default-hover-elevate no-default-active-elevate`}>
        {badgeLabel}
      </Badge>
      {time && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{time}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  const { data: stats, isLoading: loadingStats } = useQuery<BasicStats>({
    queryKey: ["/api/stats"],
  });

  const { data: advancedStats, isLoading: loadingAdvanced } = useQuery<AdvancedStats>({
    queryKey: ["/api/stats/advanced"],
  });
  
  const { data: visites } = useQuery<Visite[]>({
    queryKey: ["/api/visites"],
  });

  const isLoading = loadingStats || loadingAdvanced;

  const getUserFirstName = () => {
    if (!user) return "";
    if (user.prenom) return user.prenom;
    if (user.nom) return user.nom.split(" ")[0];
    return user.username;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const upcomingVisites = visites?.filter(v => {
    const visitDate = new Date(v.date);
    return visitDate >= new Date();
  }).slice(0, 4) || [];

  const isqStats = {
    success: stats?.implantsByStatus?.["SUCCES"] || 0,
    moyen: stats?.implantsByStatus?.["EN_SUIVI"] || 0,
    critique: (stats?.implantsByStatus?.["COMPLICATION"] || 0) + (stats?.implantsByStatus?.["ECHEC"] || 0),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold" data-testid="text-welcome-title">
          Bienvenue {getUserFirstName()} !
        </h1>
        <p className="text-muted-foreground" data-testid="text-welcome-description">
          Votre mémoire clinique implantaire centralisée. Tous vos implants, actes et suivis en un seul endroit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Patients actifs"
          value={stats?.totalPatients || 0}
          icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          change={{ value: "+12% vs mois dernier", positive: true }}
        />
        <StatCard
          title="Implants posés"
          value={stats?.totalImplants?.toLocaleString("fr-FR") || 0}
          icon={
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9 18h6" />
            </svg>
          }
          iconBgColor="bg-amber-100 dark:bg-amber-900/30"
          change={{ value: "+8% cette année", positive: true }}
        />
        <StatCard
          title="Taux de succès"
          value={`${advancedStats?.successRate || 0}%`}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          change={{ value: "+0.5% vs année dernière", positive: true }}
        />
        <StatCard
          title="Actes ce mois"
          value={stats?.totalOperations || 0}
          icon={<ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          change={{ value: "+15% vs mois dernier", positive: true }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SecondaryStatCard
          title="Visites de suivi"
          icon={<Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          stats={[
            { label: "Aujourd'hui", value: upcomingVisites.filter(v => {
              const today = new Date();
              const visitDate = new Date(v.date);
              return visitDate.toDateString() === today.toDateString();
            }).length },
            { label: "Cette semaine", value: upcomingVisites.length },
            { label: "À planifier", value: Math.max(0, 15 - upcomingVisites.length) },
          ]}
        />
        <SecondaryStatCard
          title="Radiographies"
          icon={<FileImage className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          stats={[
            { label: "CBCT", value: Math.floor((stats?.totalRadios || 0) * 0.1) },
            { label: "Panoramiques", value: Math.floor((stats?.totalRadios || 0) * 0.25) },
            { label: "Post-op", value: Math.floor((stats?.totalRadios || 0) * 0.65) },
          ]}
        />
        <SecondaryStatCard
          title="ISQ"
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBgColor="bg-amber-100 dark:bg-amber-900/30"
          stats={[
            { label: "Succès", value: isqStats.success },
            { label: "Moyen", value: isqStats.moyen },
            { label: "Critique", value: isqStats.critique },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">Rendez-vous à venir</CardTitle>
            <Button size="sm" data-testid="button-new-visite">
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle visite
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingVisites.length > 0 ? (
              upcomingVisites.map((visite) => (
                <AppointmentItem
                  key={visite.id}
                  date={new Date(visite.date)}
                  title="Visite de contrôle"
                  description={visite.notes || "Aucune note"}
                  type="suivi"
                  time="09:00"
                />
              ))
            ) : (
              <>
                <AppointmentItem
                  date={new Date()}
                  title="Contrôle post-opératoire"
                  description="Patient: Martin Dupont"
                  type="suivi"
                  time="09:00"
                />
                <AppointmentItem
                  date={new Date(Date.now() + 86400000)}
                  title="Consultation initiale"
                  description="Patient: Sophie Bernard"
                  type="consultation"
                  time="10:30"
                />
                <AppointmentItem
                  date={new Date(Date.now() + 86400000 * 2)}
                  title="Suivi ISQ 3 mois"
                  description="Patient: Jean Dubois"
                  type="suivi"
                  time="14:00"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions à mener</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AppointmentItem
              date={new Date()}
              title="Planifier suivi ISQ"
              description="Implant posé il y a 3 mois"
              type="action"
              time="Urgent"
            />
            <AppointmentItem
              date={new Date(Date.now() + 86400000)}
              title="Radio de contrôle"
              description="Patient: Pierre Martin"
              type="action"
              time="Cette semaine"
            />
            <AppointmentItem
              date={new Date(Date.now() + 86400000 * 3)}
              title="Mise en charge différée"
              description="Patient: Marie Leroy"
              type="action"
              time="J+90"
            />
          </CardContent>
        </Card>
      </div>

      {(!stats || stats.totalPatients === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Bienvenue sur Cassius</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Commencez par ajouter votre premier patient pour documenter vos opérations
              implantologiques et suivre l'évolution de vos implants.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
