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
  Package,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ClinicalStats, PatientStats } from "@shared/types";
import type { FlagWithEntity } from "@shared/schema";
import { FlagBadge } from "@/components/flag-badge";
import { formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  GREFFE_OSSEUSE: "Greffe osseuse",
  SINUS_LIFT: "Sinus lift",
  EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + implant immédiat",
  REPRISE_IMPLANT: "Reprise d'implant",
  CHIRURGIE_GUIDEE: "Chirurgie guidée",
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

type SearchSuggestion = {
  id: string;
  type: "patient" | "operation";
  label: string;
  sublabel?: string;
};

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState("patient");
  const [period, setPeriod] = useState("1m");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<SearchSuggestion[]>([]);
  const [isqDistributionFilter, setIsqDistributionFilter] = useState<string>("all");
  const [isqEvolutionFilter, setIsqEvolutionFilter] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientAlertFilter, setPatientAlertFilter] = useState<string>("all");
  const [patientSuccessFilter, setPatientSuccessFilter] = useState<string>("all");
  const [patientAgeFilter, setPatientAgeFilter] = useState<string>("all");

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

  // Fetch patients for search suggestions (endpoint returns object with patients array)
  const { data: patientsResponse } = useQuery<{ patients: Array<{id: string; nom: string; prenom: string}> }>({
    queryKey: ["/api/patients/summary"],
  });
  const patientsData = patientsResponse?.patients || [];

  // Fetch operations for search suggestions  
  const { data: operationsResponse } = useQuery<Array<{id: string; patientNom: string; patientPrenom: string; dateOperation: string; typeIntervention: string}>>({
    queryKey: ["/api/operations/summary"],
  });
  const operationsData = operationsResponse || [];

  // Build search suggestions from patients and operations
  const searchSuggestions = useMemo(() => {
    const suggestions: SearchSuggestion[] = [];
    
    if (Array.isArray(patientsData)) {
      patientsData.forEach(p => {
        suggestions.push({
          id: p.id,
          type: "patient",
          label: `${p.prenom} ${p.nom}`,
          sublabel: "Patient",
        });
      });
    }
    
    if (Array.isArray(operationsData)) {
      operationsData.forEach(op => {
        const typeLabel = TYPE_LABELS[op.typeIntervention] || op.typeIntervention;
        suggestions.push({
          id: op.id,
          type: "operation",
          label: `${op.patientPrenom} ${op.patientNom} - ${typeLabel}`,
          sublabel: op.dateOperation ? format(new Date(op.dateOperation), "dd/MM/yyyy") : undefined,
        });
      });
    }
    
    return suggestions.filter(s => 
      searchQuery === "" || 
      s.label.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [patientsData, operationsData, searchQuery]);

  // Extract selected patient and operation IDs for filtering
  const selectedPatientIds = selectedFilters.filter(f => f.type === "patient").map(f => f.id);
  const selectedOperationIds = selectedFilters.filter(f => f.type === "operation").map(f => f.id);

  // Main stats query (with optional patient/operation filters)
  const { data: stats, isLoading } = useQuery<ClinicalStats>({
    queryKey: ["/api/stats/clinical", dateRange.from, dateRange.to, selectedPatientIds, selectedOperationIds],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
      });
      if (selectedPatientIds.length > 0) {
        params.append("patientIds", selectedPatientIds.join(","));
      }
      if (selectedOperationIds.length > 0) {
        params.append("operationIds", selectedOperationIds.join(","));
      }
      const res = await fetch(`/api/stats/clinical?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch clinical stats");
      return res.json();
    },
    enabled: period !== "custom" || (!!customFrom && !!customTo),
  });

  // Separate query for ISQ Distribution (filtered by model + patient/operation filters)
  const { data: isqDistributionStats } = useQuery<ClinicalStats>({
    queryKey: ["/api/stats/clinical", dateRange.from, dateRange.to, "isq-distribution", isqDistributionFilter, selectedPatientIds, selectedOperationIds],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
      });
      if (isqDistributionFilter && isqDistributionFilter !== "all") {
        params.append("implantModelId", isqDistributionFilter);
      }
      if (selectedPatientIds.length > 0) {
        params.append("patientIds", selectedPatientIds.join(","));
      }
      if (selectedOperationIds.length > 0) {
        params.append("operationIds", selectedOperationIds.join(","));
      }
      const res = await fetch(`/api/stats/clinical?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch ISQ distribution stats");
      return res.json();
    },
    enabled: (period !== "custom" || (!!customFrom && !!customTo)) && isqDistributionFilter !== "all",
  });

  // Separate query for ISQ Evolution (filtered by model + patient/operation filters)
  const { data: isqEvolutionStats } = useQuery<ClinicalStats>({
    queryKey: ["/api/stats/clinical", dateRange.from, dateRange.to, "isq-evolution", isqEvolutionFilter, selectedPatientIds, selectedOperationIds],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
      });
      if (isqEvolutionFilter && isqEvolutionFilter !== "all") {
        params.append("implantModelId", isqEvolutionFilter);
      }
      if (selectedPatientIds.length > 0) {
        params.append("patientIds", selectedPatientIds.join(","));
      }
      if (selectedOperationIds.length > 0) {
        params.append("operationIds", selectedOperationIds.join(","));
      }
      const res = await fetch(`/api/stats/clinical?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch ISQ evolution stats");
      return res.json();
    },
    enabled: (period !== "custom" || (!!customFrom && !!customTo)) && isqEvolutionFilter !== "all",
  });

  // Use filtered data when filter is applied, otherwise use main stats
  const isqDistributionData = isqDistributionFilter !== "all" 
    ? (isqDistributionStats?.isqDistribution || [])
    : (stats?.isqDistribution || []);
  
  const isqEvolutionData = isqEvolutionFilter !== "all"
    ? (isqEvolutionStats?.isqEvolution || [])
    : (stats?.isqEvolution || []);

  // Fetch all active flags with entity info
  const { data: flagsData = [] } = useQuery<FlagWithEntity[]>({
    queryKey: ["/api/flags", "withEntity"],
    queryFn: async () => {
      const res = await fetch("/api/flags?withEntity=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flags");
      return res.json();
    },
  });

  // Fetch patient stats
  const { data: patientStatsData = [] } = useQuery<PatientStats[]>({
    queryKey: ["/api/stats/patients"],
    queryFn: async () => {
      const res = await fetch("/api/stats/patients", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patient stats");
      return res.json();
    },
  });

  // Filter patient stats - only show patients with at least one implant
  const filteredPatientStats = useMemo(() => {
    return patientStatsData.filter(p => {
      // Only include patients with at least one implant
      if (p.totalImplants === 0) return false;
      
      const matchesSearch = patientSearch === "" || 
        `${p.nom} ${p.prenom}`.toLowerCase().includes(patientSearch.toLowerCase());
      
      const matchesAlert = patientAlertFilter === "all" ||
        (patientAlertFilter === "with-alerts" && p.activeAlerts > 0) ||
        (patientAlertFilter === "no-alerts" && p.activeAlerts === 0);

      const matchesSuccess = patientSuccessFilter === "all" ||
        (patientSuccessFilter === "high" && p.successRate >= 80) ||
        (patientSuccessFilter === "medium" && p.successRate >= 50 && p.successRate < 80) ||
        (patientSuccessFilter === "low" && p.successRate < 50);

      const matchesAge = patientAgeFilter === "all" ||
        (patientAgeFilter === "0-30" && p.age >= 0 && p.age <= 30) ||
        (patientAgeFilter === "31-50" && p.age >= 31 && p.age <= 50) ||
        (patientAgeFilter === "51-70" && p.age >= 51 && p.age <= 70) ||
        (patientAgeFilter === "70+" && p.age > 70);

      return matchesSearch && matchesAlert && matchesSuccess && matchesAge;
    });
  }, [patientStatsData, patientSearch, patientAlertFilter, patientSuccessFilter, patientAgeFilter]);

  // Count of all patients with implants (before search/filter)
  const totalPatientsWithImplants = useMemo(() => {
    return patientStatsData.filter(p => p.totalImplants > 0).length;
  }, [patientStatsData]);

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

  const isqData = isqDistributionData;
  const isqEvolutionChartData = isqEvolutionData.map((d) => ({
    ...d,
    month: format(new Date(d.period + "-01"), "MMM", { locale: fr }),
  }));

  const typeData = stats?.actsByType.map((d) => ({
    type: TYPE_LABELS[d.type] || d.type,
    count: d.count,
    implants: d.implants || [],
  })) || [];

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Summary stat cards - always visible */}
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

      {/* Tabs for different stat views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent p-0 h-auto gap-6 border-b-0">
          <TabsTrigger 
            value="patient" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-patient"
          >
            Patients
          </TabsTrigger>
          <TabsTrigger 
            value="implant" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-implant"
          >
            Implants
          </TabsTrigger>
          <TabsTrigger 
            value="activite" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-activite"
          >
            Activités
          </TabsTrigger>
        </TabsList>

        {/* Search and Period selector - below tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Multi-select search for patients and operations */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer par patient ou acte..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!searchOpen) setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    className="pl-9 bg-white dark:bg-zinc-900"
                    data-testid="input-stats-search"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2">
                  {searchSuggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">Aucun résultat</p>
                  ) : (
                    <div className="space-y-1">
                      {searchSuggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.type}-${suggestion.id}`}
                          className="flex items-center justify-between p-2 rounded hover-elevate cursor-pointer"
                          onClick={() => {
                            if (!selectedFilters.find(f => f.id === suggestion.id && f.type === suggestion.type)) {
                              setSelectedFilters([...selectedFilters, suggestion]);
                            }
                            setSearchQuery("");
                            setSearchOpen(false);
                          }}
                          data-testid={`suggestion-${suggestion.type}-${suggestion.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{suggestion.label}</p>
                            {suggestion.sublabel && (
                              <p className="text-xs text-muted-foreground">{suggestion.sublabel}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.type === "patient" ? "Patient" : "Acte"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected filter badges */}
          {selectedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {selectedFilters.map((filter) => (
                <Badge
                  key={`${filter.type}-${filter.id}`}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => setSelectedFilters(selectedFilters.filter(f => !(f.id === filter.id && f.type === filter.type)))}
                  data-testid={`filter-badge-${filter.type}-${filter.id}`}
                >
                  {filter.label}
                  <span className="text-muted-foreground hover:text-foreground ml-1">x</span>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFilters([])}
                className="text-muted-foreground h-6 px-2"
                data-testid="button-clear-filters"
              >
                Effacer tout
              </Button>
            </div>
          )}

          {/* Spacer to push period selector to the right */}
          <div className="flex-1" />

          {/* Period selector */}
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

        {/* ========== ONGLET ACTIVITÉS ========== */}
        <TabsContent value="activite" className="space-y-6">
          {/* Full width activity chart */}
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

          {/* Half-width row: Types d'interventions + Implants par mois */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Types d'interventions */}
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

            {/* Implants posés par mois */}
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
        </TabsContent>

        {/* ========== ONGLET IMPLANT ========== */}
        <TabsContent value="implant" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Résultats cliniques */}
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

            {/* Distribution ISQ */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Distribution ISQ</CardTitle>
                  <CardDescription>Stabilité des implants à la pose</CardDescription>
                </div>
                <Select value={isqDistributionFilter} onValueChange={setIsqDistributionFilter}>
                  <SelectTrigger className="w-48 bg-white dark:bg-zinc-900" data-testid="select-isq-model">
                    <SelectValue placeholder="Tous les implants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les implants</SelectItem>
                    {stats?.availableImplantModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.marque} {model.referenceFabricant ? `- ${model.referenceFabricant}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Implants sans suivi récent */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Implants sans suivi
                  </CardTitle>
                  <CardDescription>Plus de 3 mois sans visite</CardDescription>
                </div>
                {stats?.implantsWithoutFollowup && stats.implantsWithoutFollowup.length > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {stats.implantsWithoutFollowup.length}
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
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {stats.implantsWithoutFollowup.slice(0, 10).map((item) => (
                        <div
                          key={item.implantId}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                          data-testid={`row-followup-${item.implantId}`}
                        >
                          <div>
                            <p className="font-medium">{item.patientNom} {item.patientPrenom}</p>
                            <p className="text-xs text-muted-foreground">Site {item.siteFdi} - {item.marque}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={item.daysSinceVisit === null || item.daysSinceVisit > 180 ? "text-red-600 border-red-300" : "text-amber-600 border-amber-300"}
                            >
                              {item.daysSinceVisit === null ? "Jamais" : `${item.daysSinceVisit}j`}
                            </Badge>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/surgery-implants/${item.implantId}`}>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Évolution ISQ moyen */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Évolution ISQ moyen
                </CardTitle>
                <CardDescription>Stabilité moyenne des implants par mois</CardDescription>
              </div>
              <Select value={isqEvolutionFilter} onValueChange={setIsqEvolutionFilter}>
              <SelectTrigger className="w-48 bg-white dark:bg-zinc-900" data-testid="select-isq-evolution-model">
                <SelectValue placeholder="Tous les implants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les implants</SelectItem>
                {stats?.availableImplantModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.marque} {model.referenceFabricant ? `- ${model.referenceFabricant}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={isqEvolutionChartData}>
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
        </TabsContent>

        {/* ========== ONGLET PATIENTS ========== */}
        <TabsContent value="patient" className="space-y-6">
          {/* Patient stats table - FIRST */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Patients avec implants
                </CardTitle>
                <CardDescription>
                  {filteredPatientStats.length} patient{filteredPatientStats.length > 1 ? "s" : ""} sur {totalPatientsWithImplants} au total
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9 w-48 bg-white dark:bg-zinc-900"
                    data-testid="input-patient-search"
                  />
                </div>
                <Select value={patientAgeFilter} onValueChange={setPatientAgeFilter}>
                  <SelectTrigger className="w-32 bg-white dark:bg-zinc-900" data-testid="select-age-filter">
                    <SelectValue placeholder="Âge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous âges</SelectItem>
                    <SelectItem value="0-30">0-30 ans</SelectItem>
                    <SelectItem value="31-50">31-50 ans</SelectItem>
                    <SelectItem value="51-70">51-70 ans</SelectItem>
                    <SelectItem value="70+">70+ ans</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={patientAlertFilter} onValueChange={setPatientAlertFilter}>
                  <SelectTrigger className="w-40 bg-white dark:bg-zinc-900" data-testid="select-alert-filter">
                    <SelectValue placeholder="Alertes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes alertes</SelectItem>
                    <SelectItem value="with-alerts">Avec alertes</SelectItem>
                    <SelectItem value="no-alerts">Sans alerte</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={patientSuccessFilter} onValueChange={setPatientSuccessFilter}>
                  <SelectTrigger className="w-40 bg-white dark:bg-zinc-900" data-testid="select-success-filter">
                    <SelectValue placeholder="Taux succès" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous taux</SelectItem>
                    <SelectItem value="high">80%+</SelectItem>
                    <SelectItem value="medium">50-79%</SelectItem>
                    <SelectItem value="low">0-49%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPatientStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2" />
                  <p>Aucun patient avec implants</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead className="text-center">Âge</TableHead>
                        <TableHead className="text-center">Implants</TableHead>
                        <TableHead className="text-center">Taux succès</TableHead>
                        <TableHead className="text-center">Alertes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatientStats.slice(0, 50).map((p) => (
                        <TableRow key={p.patientId} className="cursor-pointer hover-elevate" data-testid={`row-patient-${p.patientId}`}>
                          <TableCell>
                            <Link href={`/patients/${p.patientId}`} className="hover:underline">
                              <span className="font-medium">{p.prenom} {p.nom}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {p.age > 0 ? `${p.age} ans` : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Badge variant="secondary" className="cursor-pointer">
                                  {p.totalImplants}
                                </Badge>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72" align="center">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Implants ({p.totalImplants})</h4>
                                  <ScrollArea className="h-32">
                                    <div className="space-y-1">
                                      {p.implants.map((imp) => (
                                        <div key={imp.id} className="flex items-center justify-between text-sm p-1 rounded bg-muted/50">
                                          <span>Site {imp.siteFdi} - {imp.marque}</span>
                                          <Badge variant={
                                            imp.statut === "SUCCES" ? "default" :
                                            imp.statut === "COMPLICATION" ? "outline" :
                                            imp.statut === "ECHEC" ? "destructive" : "secondary"
                                          } className="text-xs">
                                            {imp.statut}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={p.successRate >= 80 ? "default" : p.successRate >= 50 ? "outline" : "destructive"}
                              className={p.successRate >= 80 ? "bg-green-600" : ""}
                            >
                              {p.successRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {p.activeAlerts > 0 ? (
                              <Badge variant="destructive">{p.activeAlerts}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredPatientStats.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Affichage des 50 premiers patients sur {filteredPatientStats.length}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flags actifs section - SECOND */}
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
                            {flag.patientId ? (
                              <Link href={`/patients/${flag.patientId}`} className="hover:underline">
                                <span className="font-medium">{flag.patientPrenom} {flag.patientNom}</span>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">{flag.entityName || flag.entityType}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground max-w-xs truncate">{flag.description}</td>
                          <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                            {flag.createdAt ? formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true, locale: fr }) : "-"}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
