import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, differenceInYears } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Activity,
  Users,
  Clock,
  ChevronRight,
  ExternalLink,
  Filter,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Link } from "wouter";
import type { ClinicalStats } from "@shared/types";
import type { FlagWithEntity } from "@shared/schema";
import { FlagBadge } from "@/components/flag-badge";
import { formatDistanceToNow } from "date-fns";

const PERIOD_OPTIONS = [
  { value: "1m", label: "Ce mois" },
  { value: "3m", label: "3 derniers mois" },
  { value: "6m", label: "6 derniers mois" },
  { value: "12m", label: "12 derniers mois" },
  { value: "all", label: "Toujours" },
  { value: "custom", label: "Période personnalisée" },
];

const TYPE_LABELS: Record<string, string> = {
  POSE_IMPLANT: "Pose d'implant",
  EXTRACTION: "Extraction",
  GREFFE: "Greffe osseuse",
  MISE_EN_CHARGE: "Mise en charge",
  AUTRE: "Autre",
};

const STATUS_COLORS = {
  success: "hsl(142, 76%, 36%)",
  complication: "hsl(38, 92%, 50%)",
  failure: "hsl(0, 84%, 60%)",
};

const ISQ_COLORS = {
  "Faible (<55)": "hsl(0, 84%, 60%)",
  "Modéré (55-70)": "hsl(38, 92%, 50%)",
  "Élevé (>70)": "hsl(142, 76%, 36%)",
};

export default function StatsPage() {
  const [period, setPeriod] = useState("1m");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);
  const [selectedImplantModel, setSelectedImplantModel] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientAlertFilter, setPatientAlertFilter] = useState<string>("all");
  const [patientSuccessFilter, setPatientSuccessFilter] = useState<string>("all");

  const getDateRange = () => {
    const now = new Date();
    if (period === "custom" && customFrom && customTo) {
      return {
        from: format(customFrom, "yyyy-MM-dd"),
        to: format(customTo, "yyyy-MM-dd"),
      };
    }
    if (period === "all") {
      return {
        from: "2000-01-01",
        to: format(now, "yyyy-MM-dd"),
      };
    }
    const months = period === "1m" ? 1 : period === "3m" ? 3 : period === "12m" ? 12 : 6;
    return {
      from: format(subMonths(now, months), "yyyy-MM-dd"),
      to: format(now, "yyyy-MM-dd"),
    };
  };

  const dateRange = getDateRange();

  const { data: stats, isLoading } = useQuery<ClinicalStats>({
    queryKey: ["/api/stats/clinical", dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/stats/clinical?from=${dateRange.from}&to=${dateRange.to}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch clinical stats");
      return res.json();
    },
    enabled: period !== "custom" || (!!customFrom && !!customTo),
  });

  // Fetch all active flags with entity info
  const { data: flagsData = [] } = useQuery<FlagWithEntity[]>({
    queryKey: ["/api/flags", "withEntity"],
    queryFn: async () => {
      const res = await fetch("/api/flags?withEntity=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flags");
      return res.json();
    },
  });

  // Sort and group flags by level
  const sortedFlags = [...flagsData].filter(f => !f.resolvedAt).sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  const criticalCount = sortedFlags.filter(f => f.level === "CRITICAL").length;
  const warningCount = sortedFlags.filter(f => f.level === "WARNING").length;
  const infoCount = sortedFlags.filter(f => f.level === "INFO").length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Statistiques cliniques</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const activityData = stats?.activityByPeriod.map((d) => ({
    ...d,
    month: format(new Date(d.period + "-01"), "MMM", { locale: fr }),
  })) || [];

  const implantData = stats?.implantsByPeriod.map((d) => ({
    ...d,
    month: format(new Date(d.period + "-01"), "MMM", { locale: fr }),
  })) || [];

  const outcomeData = [
    { name: "Succès", value: stats?.successRate || 0, color: STATUS_COLORS.success },
    { name: "Complications", value: stats?.complicationRate || 0, color: STATUS_COLORS.complication },
    { name: "Échecs", value: stats?.failureRate || 0, color: STATUS_COLORS.failure },
  ];

  const isqData = stats?.isqDistribution || [];
  const isqEvolutionData = stats?.isqEvolution.map((d) => ({
    ...d,
    month: format(new Date(d.period + "-01"), "MMM", { locale: fr }),
  })) || [];

  const typeData = stats?.actsByType.map((d) => ({
    type: TYPE_LABELS[d.type] || d.type,
    count: d.count,
    implants: d.implants || [],
  })) || [];

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Statistiques cliniques</h1>
          <p className="text-muted-foreground">
            Analyse de l'activité et des résultats cliniques
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 bg-white dark:bg-zinc-900" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="default" data-testid="button-date-from">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customFrom ? format(customFrom, "dd/MM/yyyy") : "Du"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customFrom}
                    onSelect={(date) => {
                      setCustomFrom(date);
                      setFromCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="default" data-testid="button-date-to">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customTo ? format(customTo, "dd/MM/yyyy") : "Au"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customTo}
                    onSelect={(date) => {
                      setCustomTo(date);
                      setToCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-card-activity">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Actes chirurgicaux</p>
                <p className="text-3xl font-bold">{stats?.activityByPeriod.reduce((sum, d) => sum + d.count, 0) || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">sur la période</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-implants">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Implants posés</p>
                <p className="text-3xl font-bold">{stats?.totalImplantsInPeriod || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">sur la période</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-success">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Taux de succès</p>
                <p className="text-3xl font-bold">{stats?.successRate || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.complicationRate || 0}% complications
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-followup">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Délai 1ère visite</p>
                <p className="text-3xl font-bold">
                  {stats?.avgDelayToFirstVisit != null ? `${stats.avgDelayToFirstVisit}j` : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">en moyenne</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Activité par mois
              </CardTitle>
              <CardDescription>Nombre d'actes chirurgicaux réalisés</CardDescription>
            </div>
            <Link href={`/actes?from=${dateRange.from}&to=${dateRange.to}`}>
              <Button variant="outline" size="sm" data-testid="button-view-operations">
                Voir les actes
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="count" name="Actes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Implants posés par mois
            </CardTitle>
            <CardDescription>Évolution du nombre d'implants</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={implantData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Implants"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Résultats cliniques</CardTitle>
            <CardDescription>Répartition des issues</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={outcomeData.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {outcomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {outcomeData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution ISQ</CardTitle>
            <CardDescription>Stabilité des implants à la pose</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isqData.map((item) => {
                const total = isqData.reduce((sum, d) => sum + d.count, 0);
                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.category}</span>
                      <span className="font-medium">{item.count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: ISQ_COLORS[item.category as keyof typeof ISQ_COLORS] || "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Types d'interventions</CardTitle>
            <CardDescription>Répartition par type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {typeData.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)` }}
                    />
                    <span className="text-sm">{item.type}</span>
                  </div>
                  {item.implants && item.implants.length > 0 ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Badge variant="secondary" className="cursor-pointer" data-testid={`badge-type-count-${index}`}>
                          {item.count}
                        </Badge>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80" align="end">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Implants posés ({item.implants.length})</h4>
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {item.implants.map((imp) => (
                                <Link
                                  key={imp.id}
                                  href={`/implants/${imp.id}`}
                                  className="flex items-center justify-between p-2 rounded hover-elevate bg-muted/50 text-sm"
                                  data-testid={`link-implant-${imp.id}`}
                                >
                                  <div>
                                    <span className="font-medium">{imp.patientPrenom} {imp.patientNom}</span>
                                    <p className="text-xs text-muted-foreground">Site {imp.siteFdi} - {imp.marque}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </Link>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <Badge variant="secondary">{item.count}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution ISQ moyen
            </CardTitle>
            <CardDescription>Stabilité moyenne des implants par mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={isqEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[40, 90]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="avgIsq"
                  name="ISQ moyen"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Implants sans suivi récent
              </CardTitle>
              <CardDescription>Plus de 3 mois sans visite de contrôle</CardDescription>
            </div>
            {stats?.implantsWithoutFollowup && stats.implantsWithoutFollowup.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                {stats.implantsWithoutFollowup.length} implant(s)
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {!stats?.implantsWithoutFollowup || stats.implantsWithoutFollowup.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>Tous les implants ont un suivi récent</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.implantsWithoutFollowup.map((item) => (
                  <div
                    key={item.implantId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`row-followup-${item.implantId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {item.patientNom} {item.patientPrenom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Site {item.siteFdi} - {item.marque} - Posé le {format(new Date(item.datePose), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          item.daysSinceVisit === null
                            ? "text-red-600 border-red-300"
                            : item.daysSinceVisit > 180
                            ? "text-red-600 border-red-300"
                            : "text-amber-600 border-amber-300"
                        }
                      >
                        {item.daysSinceVisit === null
                          ? "Jamais"
                          : `${item.daysSinceVisit}j`}
                      </Badge>
                      <Button variant="ghost" size="icon" asChild data-testid={`button-view-implant-${item.implantId}`}>
                        <Link href={`/implants/${item.implantId}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild data-testid={`button-view-patient-${item.implantId}`}>
                        <Link href={`/patients/${item.patientId}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Flags actifs section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Flags actifs
            </CardTitle>
            <CardDescription>Alertes cliniques et points d'attention</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critique{criticalCount > 1 ? "s" : ""}</Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-orange-500 text-white">{warningCount} warning{warningCount > 1 ? "s" : ""}</Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary">{infoCount} info{infoCount > 1 ? "s" : ""}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sortedFlags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Aucun flag actif</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Niveau</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Entité</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Créé</th>
                    <th className="text-left py-2 px-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFlags.slice(0, 20).map((flag) => (
                    <tr key={flag.id} className="border-b hover:bg-muted/30" data-testid={`row-flag-${flag.id}`}>
                      <td className="py-2 px-3">
                        <FlagBadge flag={flag} compact />
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{flag.label}</td>
                      <td className="py-2 px-3">
                        {flag.patientNom ? (
                          <span className="font-medium">{flag.patientPrenom} {flag.patientNom}</span>
                        ) : (
                          <span className="text-muted-foreground">{flag.entityName || flag.entityType}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-xs truncate">{flag.description}</td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                        {flag.createdAt ? formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true, locale: fr }) : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {flag.patientId ? (
                          <Link href={`/patients/${flag.patientId}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-flag-${flag.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedFlags.length > 20 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Affichage des 20 premiers flags sur {sortedFlags.length} au total
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
