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
  ReferenceLine,
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

// Design System Color Tokens - using CSS variables
const STATS_COLORS = {
  primary: "hsl(var(--stats-primary))",
  primarySoft: "hsl(var(--stats-primary-soft))",
  success: "hsl(var(--stats-success))",
  successBg: "hsl(var(--stats-success-bg))",
  warning: "hsl(var(--stats-warning))",
  warningBg: "hsl(var(--stats-warning-bg))",
  danger: "hsl(var(--stats-danger))",
  dangerBg: "hsl(var(--stats-danger-bg))",
  grayMuted: "hsl(var(--stats-gray-muted))",
  border: "hsl(var(--stats-border))",
  textSecondary: "hsl(var(--stats-text-secondary))",
  // Desaturated ISQ colors
  isqHigh: "hsl(var(--stats-isq-high))",
  isqMedium: "hsl(var(--stats-isq-medium))",
  isqLow: "hsl(var(--stats-isq-low))",
};

const STATUS_COLORS = {
  success: STATS_COLORS.success,
  complication: STATS_COLORS.warning,
  failure: STATS_COLORS.danger,
};

const ISQ_COLORS = {
  "Faible (<55)": STATS_COLORS.isqLow,
  "Modéré (55-70)": STATS_COLORS.isqMedium,
  "Élevé (>70)": STATS_COLORS.isqHigh,
};

type SearchSuggestion = {
  id: string;
  type: "patient" | "operation";
  label: string;
  sublabel?: string;
};

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState("patient");
  const [period, setPeriod] = useState("3m");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<SearchSuggestion[]>([]);
  const [isqDistributionFilter, setIsqDistributionFilter] = useState<string>("all");
  const [isqEvolutionFilter, setIsqEvolutionFilter] = useState<string>("all");
  const [successRateDimension, setSuccessRateDimension] = useState<string>("marque");
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

  // Fetch surgery implants for success rate by dimension
  interface SurgeryImplantForStats {
    id: string;
    siteFdi: string;
    typeOs: string | null;
    miseEnCharge: string | null;
    greffeOsseuse: boolean | null;
    typeChirurgieTemps: string | null;
    statut: string;
    isqPose: number | null;
    datePose: string | null;
    implant: {
      marque: string;
      diametre: number;
    };
  }
  const { data: surgeryImplantsData = [] } = useQuery<SurgeryImplantForStats[]>({
    queryKey: ["/api/surgery-implants"],
    queryFn: async () => {
      const res = await fetch("/api/surgery-implants", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch surgery implants");
      return res.json();
    },
  });

  // Filter surgery implants by selected period
  const filteredSurgeryImplants = useMemo(() => {
    if (!surgeryImplantsData) return [];
    const fromDate = new Date(dateRange.from);
    // Set toDate to end of day (23:59:59.999) to include all implants on the end date
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);
    return surgeryImplantsData.filter((implant) => {
      if (!implant.datePose) return true; // Include implants without date
      const implantDate = new Date(implant.datePose);
      return implantDate >= fromDate && implantDate <= toDate;
    });
  }, [surgeryImplantsData, dateRange.from, dateRange.to]);

  // Calculate success rate by dimension
  // Success is defined as: SUCCES or EN_SUIVI (healthy implants in follow-up)
  // Failure is: ECHEC or COMPLICATION
  const successRateByDimension = useMemo(() => {
    if (!filteredSurgeryImplants || filteredSurgeryImplants.length === 0) return [];

    const groupBy = (key: string): Map<string, { total: number; success: number; avgIsq: number; isqCount: number }> => {
      const groups = new Map<string, { total: number; success: number; avgIsq: number; isqCount: number }>();
      
      filteredSurgeryImplants.forEach((implant) => {
        let groupValue: string;
        switch (key) {
          case "marque":
            groupValue = implant.implant?.marque || "Non spécifié";
            break;
          case "diametre":
            groupValue = implant.implant?.diametre ? `${implant.implant.diametre}mm` : "Non spécifié";
            break;
          case "localisation":
            groupValue = implant.siteFdi || "Non spécifié";
            break;
          case "greffe":
            groupValue = implant.greffeOsseuse === true ? "Avec greffe" : implant.greffeOsseuse === false ? "Sans greffe" : "Non spécifié";
            break;
          case "miseEnCharge":
            groupValue = implant.miseEnCharge === "IMMEDIATE" ? "Immédiate" : 
                        implant.miseEnCharge === "PRECOCE" ? "Précoce" :
                        implant.miseEnCharge === "DIFFEREE" ? "Différée" : "Non spécifié";
            break;
          case "chirurgie":
            groupValue = implant.typeChirurgieTemps === "UN_TEMPS" ? "Chirurgie simple" :
                        implant.typeChirurgieTemps === "DEUX_TEMPS" ? "Deux temps" :
                        implant.typeChirurgieTemps === "STIMULATION_ENDOSTEE" ? "Stimulation endostée" : "Non spécifié";
            break;
          case "typeOs":
            groupValue = implant.typeOs || "Non spécifié";
            break;
          default:
            groupValue = "Non spécifié";
        }
        
        const current = groups.get(groupValue) || { total: 0, success: 0, avgIsq: 0, isqCount: 0 };
        current.total += 1;
        // Count SUCCES and EN_SUIVI as successful outcomes
        if (implant.statut === "SUCCES" || implant.statut === "EN_SUIVI") {
          current.success += 1;
        }
        if (implant.isqPose !== null && implant.isqPose > 0) {
          current.avgIsq += implant.isqPose;
          current.isqCount += 1;
        }
        groups.set(groupValue, current);
      });
      
      return groups;
    };

    const groups = groupBy(successRateDimension);
    return Array.from(groups.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
        avgIsq: data.isqCount > 0 ? Math.round(data.avgIsq / data.isqCount) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredSurgeryImplants, successRateDimension]);

  // Filter patient stats - only show patients with at least one implant
  // Also filter by selected patient IDs from the search bar
  const filteredPatientStats = useMemo(() => {
    return patientStatsData.filter(p => {
      // Only include patients with at least one implant
      if (p.totalImplants === 0) return false;
      
      // Filter by selected patients from search bar
      const matchesSelectedPatients = selectedPatientIds.length === 0 || 
        selectedPatientIds.includes(p.patientId);
      
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
        (patientAgeFilter === "0-20" && p.age >= 0 && p.age <= 20) ||
        (patientAgeFilter === "21-40" && p.age >= 21 && p.age <= 40) ||
        (patientAgeFilter === "41-60" && p.age >= 41 && p.age <= 60) ||
        (patientAgeFilter === "61-80" && p.age >= 61 && p.age <= 80) ||
        (patientAgeFilter === "81+" && p.age >= 81);

      return matchesSelectedPatients && matchesSearch && matchesAlert && matchesSuccess && matchesAge;
    });
  }, [patientStatsData, patientSearch, patientAlertFilter, patientSuccessFilter, patientAgeFilter, selectedPatientIds]);

  // Count of all patients with implants (before search/filter)
  const totalPatientsWithImplants = useMemo(() => {
    return patientStatsData.filter(p => p.totalImplants > 0).length;
  }, [patientStatsData]);

  // Sort and group flags by level
  // Also filter by selected patient IDs from the search bar
  const sortedFlags = useMemo(() => {
    return [...flagsData]
      .filter(f => !f.resolvedAt)
      .filter(f => selectedPatientIds.length === 0 || (f.patientId && selectedPatientIds.includes(f.patientId)))
      .sort((a, b) => {
        const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
        return levelOrder[a.level] - levelOrder[b.level];
      });
  }, [flagsData, selectedPatientIds]);

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

  // Donut chart: success green + light gray only (premium, less aggressive)
  const successValue = stats?.successRate || 0;
  const otherValue = 100 - successValue;
  const outcomeData = [
    { name: "Succès", value: successValue, color: STATS_COLORS.success },
    { name: "Autre", value: otherValue, color: STATS_COLORS.grayMuted },
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
              <div className="p-3 rounded-lg bg-stats-primary/10">
                <Activity className="h-5 w-5 text-stats-primary" />
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
              <div className="p-3 rounded-lg bg-stats-success-bg">
                <CheckCircle2 className="h-5 w-5 text-stats-success" />
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
              <div className="p-3 rounded-lg bg-stats-success-bg">
                <TrendingUp className="h-5 w-5 text-stats-success" />
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
              <div className="p-3 rounded-lg bg-stats-primary/10">
                <Clock className="h-5 w-5 text-stats-primary" />
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
            <Popover open={searchOpen && searchQuery.length > 0} onOpenChange={(open) => {
              if (!open) setSearchOpen(false);
            }} modal={false}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer par patient ou acte..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.length > 0) {
                        setSearchOpen(true);
                      } else {
                        setSearchOpen(false);
                      }
                    }}
                    className="pl-9 bg-white dark:bg-zinc-900"
                    data-testid="input-stats-search"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={STATS_COLORS.border} strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={{ stroke: STATS_COLORS.border }} tickLine={false} />
                  <YAxis tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: `1px solid ${STATS_COLORS.border}`,
                      borderRadius: "6px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="count" name="Actes" fill={STATS_COLORS.primarySoft} radius={[4, 4, 0, 0]} />
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
                          style={{ backgroundColor: index === 0 ? STATS_COLORS.primary : index === 1 ? STATS_COLORS.success : index === 2 ? STATS_COLORS.warning : STATS_COLORS.grayMuted }}
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
                    <CartesianGrid strokeDasharray="3 3" stroke={STATS_COLORS.border} strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={{ stroke: STATS_COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: `1px solid ${STATS_COLORS.border}`,
                        borderRadius: "6px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Implants"
                      stroke={STATS_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: STATS_COLORS.primary, strokeWidth: 0, r: 4 }}
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
                    <AlertTriangle className="h-5 w-5 text-stats-warning" />
                    Implants sans suivi
                  </CardTitle>
                  <CardDescription>Plus de 3 mois sans visite</CardDescription>
                </div>
                {stats?.implantsWithoutFollowup && stats.implantsWithoutFollowup.length > 0 && (
                  <Badge variant="outline" className="text-stats-warning border-stats-warning/30">
                    {stats.implantsWithoutFollowup.length}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {!stats?.implantsWithoutFollowup || stats.implantsWithoutFollowup.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-stats-success" />
                    <p>Tous les implants ont un suivi récent</p>
                  </div>
                ) : (
                  <div className="h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    <div className="space-y-2 pr-2">
                      {stats.implantsWithoutFollowup.slice(0, 20).map((item) => (
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
                              className={item.daysSinceVisit === null || item.daysSinceVisit > 180 ? "text-stats-danger border-stats-danger/30" : "text-stats-warning border-stats-warning/30"}
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
                  </div>
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
                <CartesianGrid strokeDasharray="3 3" stroke={STATS_COLORS.border} strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={{ stroke: STATS_COLORS.border }} tickLine={false} />
                <YAxis domain={[40, 90]} tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={60} stroke={STATS_COLORS.grayMuted} strokeDasharray="5 5" strokeOpacity={0.7} />
                <ReferenceLine y={70} stroke={STATS_COLORS.grayMuted} strokeDasharray="5 5" strokeOpacity={0.7} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: `1px solid ${STATS_COLORS.border}`,
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="avgIsq"
                  name="ISQ moyen"
                  stroke={STATS_COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: STATS_COLORS.primary, strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

          {/* Taux de réussite par dimension */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Taux de réussite et ISQ
                </CardTitle>
                <CardDescription>Analyse des implants par critère</CardDescription>
              </div>
              <Select value={successRateDimension} onValueChange={setSuccessRateDimension}>
                <SelectTrigger className="w-56 bg-white dark:bg-zinc-900" data-testid="select-success-dimension">
                  <SelectValue placeholder="Afficher par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marque">Marque d'implant</SelectItem>
                  <SelectItem value="diametre">Diamètre</SelectItem>
                  <SelectItem value="localisation">Localisation (site FDI)</SelectItem>
                  <SelectItem value="greffe">Greffe ou non</SelectItem>
                  <SelectItem value="miseEnCharge">Mise en charge</SelectItem>
                  <SelectItem value="chirurgie">Type de chirurgie</SelectItem>
                  <SelectItem value="typeOs">Type d'os (D1-D4)</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {successRateByDimension.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2" />
                  <p>Aucune donnée disponible</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={successRateByDimension} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={STATS_COLORS.border} strokeOpacity={0.5} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={{ stroke: STATS_COLORS.border }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: STATS_COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: `1px solid ${STATS_COLORS.border}`,
                        borderRadius: "6px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="p-2 bg-card border rounded-md shadow-lg">
                            <p className="font-medium text-sm">{label}</p>
                            <p className="text-sm text-muted-foreground">{data.total} implants</p>
                            <p className="text-sm text-stats-success">Taux de réussite: {data.successRate}%</p>
                            {data.avgIsq > 0 && (
                              <p className="text-sm text-stats-primary">ISQ moyen: {data.avgIsq}</p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="successRate" name="Taux de réussite" fill={STATS_COLORS.success} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {successRateByDimension.map((item) => (
                  <div key={item.name} className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground truncate" title={item.name}>{item.name}</p>
                    <p className="text-sm font-semibold">{item.total} implants</p>
                  </div>
                ))}
              </div>
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
                <Select value={patientAgeFilter} onValueChange={setPatientAgeFilter}>
                  <SelectTrigger className="w-32 bg-white dark:bg-zinc-900" data-testid="select-age-filter">
                    <SelectValue placeholder="Âge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous âges</SelectItem>
                    <SelectItem value="0-20">0-20 ans</SelectItem>
                    <SelectItem value="21-40">21-40 ans</SelectItem>
                    <SelectItem value="41-60">41-60 ans</SelectItem>
                    <SelectItem value="61-80">61-80 ans</SelectItem>
                    <SelectItem value="81+">81+ ans</SelectItem>
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
                        <th className="text-left py-2 px-3 font-medium">Patient</th>
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
