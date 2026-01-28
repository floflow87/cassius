import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
  Check,
  ChevronsUpDown,
  Loader2,
  Settings,
  GripVertical,
  History,
  UserCircle,
  FileEdit,
  Trash2,
  Eye,
  Archive,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/page-skeletons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Operation, Appointment, User, Patient, SurgeryImplantWithDetails, FlagWithEntity, AppointmentWithPatient } from "@shared/schema";
import { FlagBadge } from "@/components/flag-badge";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { SetupChecklist } from "@/components/setup-checklist";
import { OperationForm } from "@/components/operation-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";

// Dashboard block definitions
const DASHBOARD_BLOCKS = [
  { id: "stats-primary", label: "Statistiques principales" },
  { id: "stats-secondary", label: "Statistiques secondaires" },
  { id: "rdv-upcoming", label: "Rendez-vous à venir" },
  { id: "alerts", label: "Patients à surveiller" },
  { id: "recent-implants", label: "Implants récents avec ISQ" },
  { id: "recent-activities", label: "Activités récentes" },
] as const;

type BlockId = typeof DASHBOARD_BLOCKS[number]["id"];

interface DashboardPreferences {
  blockOrder: BlockId[];
  hiddenBlocks: BlockId[];
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  blockOrder: ["stats-primary", "stats-secondary", "rdv-upcoming", "alerts", "recent-implants", "recent-activities"],
  hiddenBlocks: [],
};

const STORAGE_KEY = "cassius-dashboard-preferences";

function loadPreferences(): DashboardPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        blockOrder: parsed.blockOrder || DEFAULT_PREFERENCES.blockOrder,
        hiddenBlocks: parsed.hiddenBlocks || DEFAULT_PREFERENCES.hiddenBlocks,
      };
    }
  } catch (e) {
    console.error("Failed to load dashboard preferences:", e);
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: DashboardPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to save dashboard preferences:", e);
  }
}

// Sortable item for the drawer
function SortableBlockItem({ 
  id, 
  label, 
  visible, 
  onToggle 
}: { 
  id: string; 
  label: string; 
  visible: boolean; 
  onToggle: (visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-muted/30 rounded-md"
    >
      <button
        className="cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="flex-1 text-xs">{label}</span>
      <Switch
        checked={visible}
        onCheckedChange={onToggle}
        data-testid={`switch-block-${id}`}
      />
    </div>
  );
}

interface BasicStats {
  totalPatients: number;
  totalImplants: number;
  totalRadios: number;
  totalOperations: number;
  monthlyImplants: number;
  monthlyOperations: number;
  previousMonthImplants: number;
  previousMonthOperations: number;
  previousMonthPatients: number;
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
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
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
          <h3 className="font-semibold text-xs">{title}</h3>
        </div>
        <div className="space-y-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="font-semibold text-xs">{stat.value}</span>
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
  patientName: string;
  patientId: string;
  type: "consultation" | "suivi" | "action";
  time?: string;
}

function AppointmentItem({ date, title, patientName, patientId, type, time }: AppointmentItemProps) {
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

  const content = (
    <div className={`flex items-center gap-4 p-3 border-l-4 ${borderColor} bg-muted/30 rounded-r-md ${patientId ? "hover-elevate cursor-pointer" : ""}`}>
      <div className="flex flex-col items-center justify-center min-w-[48px]">
        <span className="text-2xl font-bold">{day}</span>
        <span className="text-xs text-muted-foreground">{month}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{title}</p>
        <p className={`text-xs truncate ${patientId ? "text-primary hover:underline" : "text-muted-foreground"}`}>{patientName}</p>
      </div>
      <Badge className={`${badgeVariant} no-default-hover-elevate no-default-active-elevate`}>
        {badgeLabel}
      </Badge>
      {time && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{time}</span>
      )}
    </div>
  );

  if (!patientId) {
    return <div className="block" data-testid="appointment-no-patient">{content}</div>;
  }

  return (
    <Link href={`/patients/${patientId}`} className="block" data-testid={`link-appointment-patient-${patientId}`}>
      {content}
    </Link>
  );
}

export default function DashboardPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Nouvel acte sheet
  const [newActeSheetOpen, setNewActeSheetOpen] = useState(false);
  const [selectedPatientForActe, setSelectedPatientForActe] = useState<string | null>(null);
  const [actePatientPopoverOpen, setActePatientPopoverOpen] = useState(false);
  const [preferences, setPreferences] = useState<DashboardPreferences>(loadPreferences);
  const [newRdvData, setNewRdvData] = useState({
    patientId: "",
    titre: "",
    date: new Date().toISOString().split("T")[0],
    heureDebut: "09:00",
    heureFin: "09:30",
    type: "consultation" as string,
    description: "",
  });
  const { toast } = useToast();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = preferences.blockOrder.indexOf(active.id as BlockId);
      const newIndex = preferences.blockOrder.indexOf(over.id as BlockId);
      const newOrder = arrayMove(preferences.blockOrder, oldIndex, newIndex);
      const newPrefs = { ...preferences, blockOrder: newOrder };
      setPreferences(newPrefs);
      savePreferences(newPrefs);
    }
  };

  // Toggle block visibility
  const toggleBlockVisibility = (blockId: BlockId, visible: boolean) => {
    const newHidden = visible
      ? preferences.hiddenBlocks.filter(id => id !== blockId)
      : [...preferences.hiddenBlocks, blockId];
    const newPrefs = { ...preferences, hiddenBlocks: newHidden };
    setPreferences(newPrefs);
    savePreferences(newPrefs);
  };

  // Check if block is visible
  const isBlockVisible = (blockId: BlockId) => !preferences.hiddenBlocks.includes(blockId);

  // Get visible blocks in order
  const visibleBlocksInOrder = preferences.blockOrder.filter(id => isBlockVisible(id));

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  const { data: stats, isLoading: loadingStats } = useQuery<BasicStats>({
    queryKey: ["/api/stats"],
  });

  const { data: advancedStats, isLoading: loadingAdvanced } = useQuery<AdvancedStats>({
    queryKey: ["/api/stats/advanced"],
  });
  
  const { data: upcomingAppointments } = useQuery<AppointmentWithPatient[]>({
    queryKey: ["/api/appointments?status=UPCOMING&withPatient=true"],
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: surgeryImplants } = useQuery<SurgeryImplantWithDetails[]>({
    queryKey: ["/api/surgery-implants"],
  });

  const { data: flagsData } = useQuery<FlagWithEntity[]>({
    queryKey: ["/api/flags", "withEntity"],
    queryFn: async () => {
      const res = await fetch("/api/flags?withEntity=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flags");
      return res.json();
    },
  });

  const { data: recentActivities, isLoading: loadingActivities } = useQuery<any[]>({
    queryKey: ["/api/audit/recent"],
    retry: false,
  });

  const filteredPatients = patients?.filter(p => 
    `${p.prenom} ${p.nom}`.toLowerCase().includes(patientSearch.toLowerCase())
  ) || [];

  const selectedPatient = patients?.find(p => p.id === newRdvData.patientId);

  // Mutation to create appointment via API
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
      patientId: string;
      title: string;
      type: string;
      dateStart: string;
      dateEnd: string;
      description?: string;
    }) => {
      const res = await apiRequest("POST", `/api/patients/${data.patientId}/appointments`, {
        title: data.title,
        type: data.type.toUpperCase(),
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        description: data.description || null,
        status: "UPCOMING",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la création");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all appointment queries to refresh lists everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/appointments?status=UPCOMING&withPatient=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/calendar"] });
      setSheetOpen(false);
      setPatientPopoverOpen(false);
      setPatientSearch("");
      setNewRdvData({
        patientId: "",
        titre: "",
        date: new Date().toISOString().split("T")[0],
        heureDebut: "09:00",
        heureFin: "09:30",
        type: "consultation",
        description: "",
      });
      toast({
        title: "Rendez-vous créé",
        description: "Le nouveau rendez-vous a été enregistré.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le rendez-vous.",
        variant: "destructive",
      });
    },
  });

  const handleCreateRdv = () => {
    if (!newRdvData.patientId) {
      toast({
        title: "Patient requis",
        description: "Veuillez sélectionner un patient.",
        variant: "destructive",
      });
      return;
    }
    if (!newRdvData.titre || !newRdvData.date) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le titre et la date.",
        variant: "destructive",
      });
      return;
    }
    
    // Build ISO datetime strings
    const dateStart = `${newRdvData.date}T${newRdvData.heureDebut}:00`;
    const dateEnd = `${newRdvData.date}T${newRdvData.heureFin}:00`;
    
    createAppointmentMutation.mutate({
      patientId: newRdvData.patientId,
      title: newRdvData.titre,
      type: newRdvData.type,
      dateStart,
      dateEnd,
      description: newRdvData.description,
    });
  };

  const isLoading = loadingStats || loadingAdvanced;

  const getUserFirstName = () => {
    if (!user) return "";
    if (user.prenom) return user.prenom;
    if (user.nom) return user.nom.split(" ")[0];
    return user.username;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const now = new Date();
  const upcomingVisites = upcomingAppointments?.filter(apt => {
    const aptDate = new Date(apt.dateStart);
    return apt.status === 'UPCOMING' && aptDate >= now;
  }).sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())
    .slice(0, 4) || [];

  const isqStats = {
    success: stats?.implantsByStatus?.["SUCCES"] || 0,
    moyen: stats?.implantsByStatus?.["EN_SUIVI"] || 0,
    critique: (stats?.implantsByStatus?.["COMPLICATION"] || 0) + (stats?.implantsByStatus?.["ECHEC"] || 0),
  };

  const calculateChange = (current: number, previous: number): { value: string; positive: boolean } | undefined => {
    if (previous === 0) {
      if (current > 0) {
        return { value: `+${current} ce mois`, positive: true };
      }
      return undefined;
    }
    const percentChange = ((current - previous) / previous) * 100;
    const sign = percentChange >= 0 ? "+" : "";
    return {
      value: `${sign}${percentChange.toFixed(0)}% vs mois dernier`,
      positive: percentChange >= 0,
    };
  };

  const implantChange = calculateChange(stats?.monthlyImplants || 0, stats?.previousMonthImplants || 0);
  const operationChange = calculateChange(stats?.monthlyOperations || 0, stats?.previousMonthOperations || 0);

  // Render block by ID
  const renderBlock = (blockId: BlockId) => {
    switch (blockId) {
      case "stats-primary":
        return (
          <div key={blockId} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Patients actifs"
              value={stats?.totalPatients || 0}
              icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              title="Implants posés ce mois"
              value={stats?.monthlyImplants?.toLocaleString("fr-FR") || 0}
              icon={
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9 18h6" />
                </svg>
              }
              iconBgColor="bg-amber-100 dark:bg-amber-900/30"
              change={implantChange}
            />
            <StatCard
              title="Actes ce mois"
              value={stats?.monthlyOperations || 0}
              icon={<ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
              iconBgColor="bg-orange-100 dark:bg-orange-900/30"
              change={operationChange}
            />
            <StatCard
              title="Taux de succès"
              value={`${advancedStats?.successRate || 0}%`}
              icon={<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
              iconBgColor="bg-green-100 dark:bg-green-900/30"
            />
          </div>
        );
      case "stats-secondary":
        return (
          <div key={blockId} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SecondaryStatCard
              title="Visites de suivi"
              icon={<Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              iconBgColor="bg-blue-100 dark:bg-blue-900/30"
              stats={[
                { label: "Aujourd'hui", value: upcomingVisites.filter(apt => {
                  const today = new Date();
                  const visitDate = new Date(apt.dateStart);
                  return visitDate.toDateString() === today.toDateString();
                }).length },
                { label: "Cette semaine", value: upcomingVisites.length },
                { label: "Total planifiées", value: upcomingVisites.length },
              ]}
            />
            <SecondaryStatCard
              title="Radiographies"
              icon={<FileImage className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
              iconBgColor="bg-orange-100 dark:bg-orange-900/30"
              stats={[
                { label: "CBCT", value: stats?.radiosByType?.["CBCT"] || 0 },
                { label: "Panoramiques", value: stats?.radiosByType?.["PANORAMIQUE"] || 0 },
                { label: "Rétroalvéolaires", value: stats?.radiosByType?.["RETROALVEOLAIRE"] || 0 },
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
        );
      case "rdv-upcoming":
        return (
          <Card key={blockId}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Rendez-vous à venir</CardTitle>
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" data-testid="button-new-rdv">
                    <Plus className="h-4 w-4 mr-1" />
                    Nouveau rdv
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Nouveau rendez-vous</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Patient</Label>
                      <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={patientPopoverOpen}
                            className="w-full justify-between"
                            data-testid="button-select-patient"
                          >
                            {selectedPatient
                              ? `${selectedPatient.prenom} ${selectedPatient.nom}`
                              : "Sélectionner un patient..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Rechercher un patient..." 
                              value={patientSearch}
                              onValueChange={setPatientSearch}
                              data-testid="input-patient-search"
                            />
                            <CommandList>
                              <CommandEmpty>Aucun patient trouvé.</CommandEmpty>
                              <CommandGroup>
                                {filteredPatients.slice(0, 10).map((patient) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={`${patient.prenom} ${patient.nom}`}
                                    onSelect={() => {
                                      setNewRdvData(prev => ({ ...prev, patientId: patient.id }));
                                      setPatientPopoverOpen(false);
                                    }}
                                    data-testid={`patient-option-${patient.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newRdvData.patientId === patient.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {patient.prenom} {patient.nom}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="titre">Titre</Label>
                      <Input 
                        id="titre"
                        placeholder="Ex: Contrôle implant"
                        value={newRdvData.titre}
                        onChange={(e) => setNewRdvData(prev => ({ ...prev, titre: e.target.value }))}
                        data-testid="input-titre"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input 
                          id="date"
                          type="date"
                          value={newRdvData.date}
                          onChange={(e) => setNewRdvData(prev => ({ ...prev, date: e.target.value }))}
                          data-testid="input-date"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="heureDebut">Début</Label>
                        <Input 
                          id="heureDebut"
                          type="time"
                          value={newRdvData.heureDebut}
                          onChange={(e) => setNewRdvData(prev => ({ ...prev, heureDebut: e.target.value }))}
                          data-testid="input-heure-debut"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="heureFin">Fin</Label>
                        <Input 
                          id="heureFin"
                          type="time"
                          value={newRdvData.heureFin}
                          onChange={(e) => setNewRdvData(prev => ({ ...prev, heureFin: e.target.value }))}
                          data-testid="input-heure-fin"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={newRdvData.type}
                        onValueChange={(value) => setNewRdvData(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultation" data-testid="select-type-consultation">Consultation</SelectItem>
                          <SelectItem value="suivi" data-testid="select-type-suivi">Suivi</SelectItem>
                          <SelectItem value="chirurgie" data-testid="select-type-chirurgie">Chirurgie</SelectItem>
                          <SelectItem value="controle" data-testid="select-type-controle">Contrôle</SelectItem>
                          <SelectItem value="urgence" data-testid="select-type-urgence">Urgence</SelectItem>
                          <SelectItem value="autre" data-testid="select-type-autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optionnelle)</Label>
                      <Textarea 
                        id="description"
                        placeholder="Informations complémentaires..."
                        value={newRdvData.description}
                        onChange={(e) => setNewRdvData(prev => ({ ...prev, description: e.target.value }))}
                        data-testid="input-description"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleCreateRdv}
                      disabled={createAppointmentMutation.isPending}
                      data-testid="button-submit-rdv"
                    >
                      {createAppointmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Créer le rendez-vous
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingVisites.length > 0 ? (
                upcomingVisites.map((apt) => (
                  <AppointmentItem
                    key={apt.id}
                    date={new Date(apt.dateStart)}
                    title={apt.title}
                    patientName={`${apt.patientPrenom || ""} ${apt.patientNom || ""}`.trim() || "Patient"}
                    patientId={apt.patientId}
                    type={apt.type.toLowerCase() === "chirurgie" ? "action" : apt.type.toLowerCase() as "consultation" | "suivi" | "action"}
                    time={new Date(apt.dateStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2">Aucun rendez-vous à venir</p>
              )}
            </CardContent>
          </Card>
        );
      case "alerts":
        return (
          <Card key={blockId}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Patients à surveiller
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {flagsData?.length || 0} alertes
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {flagsData && flagsData.length > 0 ? (
                [...flagsData]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((flag) => {
                    const isIsqFlag = ['ISQ_LOW', 'ISQ_DECLINING', 'UNSTABLE_ISQ_HISTORY'].includes(flag.type);
                    const isqMatch = flag.description?.match(/ISQ[^=]*=?\s*(\d+)/);
                    const isqValue = isqMatch ? isqMatch[1] : null;
                    
                    return (
                      <Link 
                        key={flag.id} 
                        href={flag.patientId ? `/patients/${flag.patientId}` : "#"}
                        className="block"
                      >
                        <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 hover-elevate cursor-pointer" data-testid={`flag-dashboard-${flag.id}`}>
                          <FlagBadge flag={flag} compact />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-medium truncate">{flag.label}</p>
                              {isIsqFlag && isqValue && (
                                <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  ISQ {isqValue}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {flag.patientPrenom} {flag.patientNom} {flag.entityName ? `- ${flag.entityName}` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {format(new Date(flag.createdAt), "dd MMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune alerte en cours</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "recent-implants":
        if (!surgeryImplants || surgeryImplants.length === 0) {
          return (
            <Card key={blockId}>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9 18h6" />
                  </svg>
                  Implants récents
                </CardTitle>
                <Sheet open={newActeSheetOpen} onOpenChange={(open) => {
                  setNewActeSheetOpen(open);
                  if (!open) {
                    setSelectedPatientForActe(null);
                  }
                }}>
                  <SheetTrigger asChild>
                    <Button size="sm" data-testid="button-new-acte-dashboard-empty">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nouvel acte
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Nouvel acte chirurgical</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Patient</label>
                        <Popover open={actePatientPopoverOpen} onOpenChange={setActePatientPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={actePatientPopoverOpen}
                              className="w-full justify-between"
                              data-testid="select-patient-acte-trigger-empty"
                            >
                              {selectedPatientForActe
                                ? patients?.find((p) => p.id === selectedPatientForActe)
                                  ? `${patients.find((p) => p.id === selectedPatientForActe)?.prenom} ${patients.find((p) => p.id === selectedPatientForActe)?.nom}`
                                  : "Sélectionner un patient..."
                                : "Sélectionner un patient..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Rechercher un patient..." data-testid="input-search-patient-acte-empty" />
                              <CommandList>
                                <CommandEmpty>Aucun patient trouvé.</CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-[200px]">
                                    {patients?.map((patient) => (
                                      <CommandItem
                                        key={patient.id}
                                        value={`${patient.prenom} ${patient.nom}`}
                                        onSelect={() => {
                                          setSelectedPatientForActe(patient.id);
                                          setActePatientPopoverOpen(false);
                                        }}
                                        data-testid={`select-patient-acte-empty-${patient.id}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPatientForActe === patient.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {patient.prenom} {patient.nom}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {selectedPatientForActe && (
                        <OperationForm 
                          patientId={selectedPatientForActe}
                          onSuccess={() => {
                            setNewActeSheetOpen(false);
                            setSelectedPatientForActe(null);
                            queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants"] });
                          }}
                        />
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Commencez par ajouter votre premier acte pour documenter vos opérations et suivre l'évolution de vos implants.
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card key={blockId}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9 18h6" />
                </svg>
                Implants récents
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {surgeryImplants.length} implants
                </Badge>
                <Sheet open={newActeSheetOpen} onOpenChange={(open) => {
                  setNewActeSheetOpen(open);
                  if (!open) {
                    setSelectedPatientForActe(null);
                  }
                }}>
                  <SheetTrigger asChild>
                    <Button size="sm" data-testid="button-new-acte-dashboard">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nouvel acte
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Nouvel acte chirurgical</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Patient</label>
                        <Popover open={actePatientPopoverOpen} onOpenChange={setActePatientPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={actePatientPopoverOpen}
                              className="w-full justify-between"
                              data-testid="select-patient-acte-trigger"
                            >
                              {selectedPatientForActe
                                ? patients?.find((p) => p.id === selectedPatientForActe)
                                  ? `${patients.find((p) => p.id === selectedPatientForActe)?.prenom} ${patients.find((p) => p.id === selectedPatientForActe)?.nom}`
                                  : "Sélectionner un patient..."
                                : "Sélectionner un patient..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Rechercher un patient..." data-testid="input-search-patient-acte" />
                              <CommandList>
                                <CommandEmpty>Aucun patient trouvé.</CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-[200px]">
                                    {patients?.map((patient) => (
                                      <CommandItem
                                        key={patient.id}
                                        value={`${patient.prenom} ${patient.nom}`}
                                        onSelect={() => {
                                          setSelectedPatientForActe(patient.id);
                                          setActePatientPopoverOpen(false);
                                        }}
                                        data-testid={`select-patient-acte-${patient.id}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPatientForActe === patient.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {patient.prenom} {patient.nom}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {selectedPatientForActe && (
                        <OperationForm 
                          patientId={selectedPatientForActe}
                          onSuccess={() => {
                            setNewActeSheetOpen(false);
                            setSelectedPatientForActe(null);
                            queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants"] });
                          }}
                        />
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {surgeryImplants.slice(0, 10).map((si) => {
                  const lastIsq = si.isq6m ?? si.isq3m ?? si.isq2m ?? si.isqPose;
                  const isqLabel = si.isq6m ? "6m" : si.isq3m ? "3m" : si.isq2m ? "2m" : si.isqPose ? "pose" : null;
                  const isLowIsq = lastIsq !== null && lastIsq <= 55;
                  const patientId = si.patient?.id;
                  const datePose = si.datePose ? new Date(si.datePose).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : null;
                  
                  const statutLabels: Record<string, { label: string; className: string }> = {
                    EN_SUIVI: { label: "En suivi", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    SUCCES: { label: "Succès", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                    COMPLICATION: { label: "Complication", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                    ECHEC: { label: "Échec", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
                  };
                  const statutInfo = statutLabels[si.statut || "EN_SUIVI"] || statutLabels.EN_SUIVI;
                  
                  return (
                    <Link 
                      key={si.id} 
                      href={patientId ? `/patients/${patientId}/implants/${si.id}` : "#"}
                      className="block"
                    >
                      <div 
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover-elevate cursor-pointer"
                        data-testid={`implant-dashboard-${si.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                              {si.siteFdi}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {si.patient?.prenom} {si.patient?.nom}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {si.implant?.marque} {si.implant?.diametre}x{si.implant?.longueur}mm
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-3">
                          <Badge className={`text-[10px] border-0 ${statutInfo.className}`}>
                            {statutInfo.label}
                          </Badge>
                          {lastIsq !== null ? (
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="secondary" 
                                className={isLowIsq 
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" 
                                  : lastIsq >= 70 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                }
                              >
                                ISQ {lastIsq}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ({isqLabel})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          {datePose && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {datePose}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      case "recent-activities":
        return (
          <Card key={blockId} data-testid="card-recent-activities">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Activités récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivities ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : recentActivities && recentActivities.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.slice(0, 5).map((activity: any) => {
                    const actionIconComponents: Record<string, any> = {
                      CREATE: Plus,
                      UPDATE: FileEdit,
                      DELETE: Trash2,
                      VIEW: Eye,
                      ARCHIVE: Archive,
                      RESTORE: RotateCcw,
                    };
                    const actionLabels: Record<string, string> = {
                      CREATE: "Création",
                      UPDATE: "Modification",
                      DELETE: "Suppression",
                      VIEW: "Consultation",
                      ARCHIVE: "Archivage",
                      RESTORE: "Restauration",
                    };
                    const actionColors: Record<string, string> = {
                      CREATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      VIEW: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
                      ARCHIVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                      RESTORE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                    };
                    
                    const userName = activity.user?.prenom && activity.user?.nom
                      ? `${activity.user.prenom} ${activity.user.nom}`
                      : activity.user?.username || "Utilisateur inconnu";
                    
                    const ActionIcon = actionIconComponents[activity.action] || History;
                    const label = actionLabels[activity.action] || activity.action;
                    const colorClass = actionColors[activity.action] || "bg-gray-100 text-gray-700";
                    
                    return (
                      <div key={activity.id} className="flex items-start gap-3 py-2 border-b last:border-b-0 border-border/50" data-testid={`activity-item-${activity.id}`}>
                        <div className={`p-1.5 rounded-full ${colorClass}`}>
                          <ActionIcon className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {label}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <UserCircle className="w-3 h-3" />
                              {userName}
                            </span>
                          </div>
                          {activity.details && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {activity.details}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(activity.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Aucune activité récente
                </p>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto px-6 pb-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium" data-testid="text-welcome-title">
          Bienvenue {getUserFirstName()}
        </h1>
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-dashboard-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Personnaliser le tableau de bord</SheetTitle>
              <SheetDescription>
                Glissez-déposez pour réorganiser, activez ou désactivez les blocs.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={preferences.blockOrder}
                  strategy={verticalListSortingStrategy}
                >
                  {preferences.blockOrder.map((blockId) => {
                    const block = DASHBOARD_BLOCKS.find(b => b.id === blockId);
                    if (!block) return null;
                    return (
                      <SortableBlockItem
                        key={blockId}
                        id={blockId}
                        label={block.label}
                        visible={isBlockVisible(blockId)}
                        onToggle={(visible) => toggleBlockVisibility(blockId, visible)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {!user?.wasInvited && (
        <>
          <OnboardingChecklist />
          <SetupChecklist />
        </>
      )}

      {/* Dynamic block rendering based on user preferences */}
      {visibleBlocksInOrder.map((blockId, index) => {
        // Group rdv-upcoming and alerts in a 2-column grid
        if (blockId === "rdv-upcoming" || blockId === "alerts") {
          // Find if both are visible and consecutive
          const otherBlockId = blockId === "rdv-upcoming" ? "alerts" : "rdv-upcoming";
          const otherIndex = visibleBlocksInOrder.indexOf(otherBlockId);
          const bothVisible = otherIndex !== -1;
          const areConsecutive = bothVisible && Math.abs(otherIndex - index) === 1;
          
          // If both are consecutive, only render grid on the first one
          if (areConsecutive && index > otherIndex) {
            return null; // Skip, already rendered in the grid
          }
          
          if (areConsecutive) {
            // Render both in a grid
            const firstBlock = index < otherIndex ? blockId : otherBlockId;
            const secondBlock = index < otherIndex ? otherBlockId : blockId;
            return (
              <div key="rdv-alerts-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderBlock(firstBlock)}
                {renderBlock(secondBlock)}
              </div>
            );
          }
          
          // Render single block in a half-width grid (allows empty space beside)
          return (
            <div key={`${blockId}-grid`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderBlock(blockId)}
            </div>
          );
        }
        
        // Render recent-activities in half-width
        if (blockId === "recent-activities") {
          return (
            <div key={`${blockId}-grid`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderBlock(blockId)}
            </div>
          );
        }
        
        return renderBlock(blockId);
      })}

    </div>
  );
}
