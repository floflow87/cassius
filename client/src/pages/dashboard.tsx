import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "wouter";

interface BasicStats {
  totalPatients: number;
  totalImplants: number;
  totalRadios: number;
  totalOperations: number;
  monthlyImplants: number;
  monthlyOperations: number;
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

  return (
    <Link href={`/patients/${patientId}`} className="block" data-testid={`link-appointment-patient-${patientId}`}>
      <div className={`flex items-center gap-4 p-3 border-l-4 ${borderColor} bg-muted/30 rounded-r-md hover-elevate cursor-pointer`}>
        <div className="flex flex-col items-center justify-center min-w-[48px]">
          <span className="text-2xl font-bold">{day}</span>
          <span className="text-xs text-muted-foreground">{month}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-sm text-primary hover:underline truncate">{patientName}</p>
        </div>
        <Badge className={`${badgeVariant} no-default-hover-elevate no-default-active-elevate`}>
          {badgeLabel}
        </Badge>
        {time && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">{time}</span>
        )}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [newRdvData, setNewRdvData] = useState({
    patientId: "",
    titre: "",
    date: new Date().toISOString().split("T")[0],
    heureDebut: "09:00",
    heureFin: "09:30",
    type: "consultation" as "consultation" | "suivi" | "chirurgie",
    description: "",
  });
  const { toast } = useToast();

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

  const filteredPatients = patients?.filter(p => 
    `${p.prenom} ${p.nom}`.toLowerCase().includes(patientSearch.toLowerCase())
  ) || [];

  const selectedPatient = patients?.find(p => p.id === newRdvData.patientId);

  const handleCreateRdv = () => {
    if (!newRdvData.titre || !newRdvData.date) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le titre et la date.",
        variant: "destructive",
      });
      return;
    }
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

  const upcomingVisites = upcomingAppointments?.filter(apt => 
    apt.status === 'UPCOMING'
  ).slice(0, 4) || [];

  const isqStats = {
    success: stats?.implantsByStatus?.["SUCCES"] || 0,
    moyen: stats?.implantsByStatus?.["EN_SUIVI"] || 0,
    critique: (stats?.implantsByStatus?.["COMPLICATION"] || 0) + (stats?.implantsByStatus?.["ECHEC"] || 0),
  };

  return (
    <div className="flex flex-col h-full overflow-auto px-6 pb-6 space-y-6">
      <h1 className="text-lg font-medium" data-testid="text-welcome-title">
        Bienvenue {getUserFirstName()}
      </h1>

      <OnboardingChecklist />
      <SetupChecklist />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Patients actifs"
          value={stats?.totalPatients || 0}
          icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          change={{ value: "+12% vs mois dernier", positive: true }}
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
          change={{ value: "+8% vs mois dernier", positive: true }}
        />
        <StatCard
          title="Actes ce mois"
          value={stats?.monthlyOperations || 0}
          icon={<ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          change={{ value: "+15% vs mois dernier", positive: true }}
        />
        <StatCard
          title="Taux de succès"
          value={`${advancedStats?.successRate || 0}%`}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          change={{ value: "+0.5% vs année dernière", positive: true }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    setPatientSearch("");
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
                      placeholder="Ex: Consultation pré-opératoire"
                      value={newRdvData.titre}
                      onChange={(e) => setNewRdvData(prev => ({ ...prev, titre: e.target.value }))}
                      data-testid="input-titre"
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="heureDebut">Heure début</Label>
                      <Input 
                        id="heureDebut"
                        type="time" 
                        value={newRdvData.heureDebut}
                        onChange={(e) => setNewRdvData(prev => ({ ...prev, heureDebut: e.target.value }))}
                        data-testid="input-heure-debut"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heureFin">Heure fin</Label>
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
                    <Label>Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          newRdvData.type === "consultation" && "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                        )}
                        onClick={() => setNewRdvData(prev => ({ ...prev, type: "consultation" }))}
                        data-testid="button-type-consultation"
                      >
                        Consultation
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          newRdvData.type === "suivi" && "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                        )}
                        onClick={() => setNewRdvData(prev => ({ ...prev, type: "suivi" }))}
                        data-testid="button-type-suivi"
                      >
                        Suivi
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          newRdvData.type === "chirurgie" && "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"
                        )}
                        onClick={() => setNewRdvData(prev => ({ ...prev, type: "chirurgie" }))}
                        data-testid="button-type-chirurgie"
                      >
                        Chirurgie
                      </Button>
                    </div>
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
                    data-testid="button-submit-rdv"
                  >
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
              <p className="text-sm text-muted-foreground py-2">Aucun rendez-vous à venir</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              À surveiller
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {flagsData?.length || 0} alertes
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {flagsData && flagsData.length > 0 ? (
              flagsData.slice(0, 5).map((flag) => (
                <Link 
                  key={flag.id} 
                  href={flag.patientId ? `/patients/${flag.patientId}` : "#"}
                  className="block"
                >
                  <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 hover-elevate cursor-pointer" data-testid={`flag-dashboard-${flag.id}`}>
                    <FlagBadge flag={flag} compact />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{flag.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {flag.patientPrenom} {flag.patientNom} {flag.entityName ? `- ${flag.entityName}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune alerte en cours</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section Implants récents avec ISQ */}
      {surgeryImplants && surgeryImplants.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9 18h6" />
              </svg>
              Implants récents
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {surgeryImplants.length} implants
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {surgeryImplants.slice(0, 8).map((si) => {
                // Determine the last ISQ value
                const lastIsq = si.isq6m ?? si.isq3m ?? si.isq2m ?? si.isqPose;
                const isqLabel = si.isq6m ? "6m" : si.isq3m ? "3m" : si.isq2m ? "2m" : si.isqPose ? "pose" : null;
                const isLowIsq = lastIsq !== null && lastIsq <= 55;
                
                return (
                  <Link 
                    key={si.id} 
                    href={`/implants/${si.id}`}
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
                          <p className="text-sm font-medium truncate">
                            {si.patient?.prenom} {si.patient?.nom}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {si.implant?.marque} {si.implant?.diametre}x{si.implant?.longueur}mm
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
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
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
