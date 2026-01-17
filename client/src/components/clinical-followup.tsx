import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  Clock, 
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  FileImage,
  FileText,
  History,
  CalendarPlus,
  Link,
  X,
  Plus,
  Upload
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  AppointmentClinicalData, 
  ClinicalFlag, 
  StatusSuggestion,
  ImplantStatusHistoryWithDetails,
  RecommendedAction,
  RecommendedActionType
} from "@shared/types";
import type { Radio, AppointmentRadio } from "@shared/schema";

interface StatusReason {
  id: string;
  organisationId: string | null;
  status: string;
  code: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succes", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "destructive" },
  ECHEC: { label: "Echec", variant: "destructive" },
};

interface SurgeryImplantBasic {
  id: string;
  siteFdi: string;
  marque: string;
  modele?: string;
  statut?: string;
}

interface ClinicalFollowUpProps {
  appointmentId: string;
  appointmentType: string;
  surgeryImplantId?: string | null;
  patientId?: string;
  onStatusChange?: (suggestion: StatusSuggestion) => void;
  onAction?: (actionType: RecommendedActionType, params?: Record<string, unknown>) => void;
}

const typeLabels: Record<string, string> = {
  CONTROLE: "Controle",
  CHIRURGIE: "Chirurgie",
  URGENCE: "Urgence",
  SUIVI: "Suivi",
  CONSULTATION: "Consultation",
  AUTRE: "Autre",
};

const flagIcons: Record<string, typeof AlertTriangle> = {
  ISQ_LOW: AlertTriangle,
  ISQ_DECLINING: TrendingDown,
  NO_RECENT_ISQ: Clock,
  UNSTABLE_ISQ_HISTORY: Activity,
};

const flagColors: Record<string, string> = {
  CRITICAL: "destructive",
  WARNING: "secondary",
  INFO: "outline",
};

const actionIcons: Record<RecommendedActionType, typeof Calendar> = {
  plan_control_14d: CalendarPlus,
  add_or_link_radio: FileImage,
  add_radio_note: FileText,
  open_status_modal: CheckCircle,
  review_isq_history: History,
  schedule_followup: Calendar,
};

function getIsqColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value < 50) return "text-destructive";
  if (value < 60) return "text-orange-500";
  if (value < 70) return "text-yellow-600";
  return "text-green-600";
}

function getIsqLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Non mesuré";
  if (value < 50) return "Critique";
  if (value < 60) return "Faible";
  if (value < 70) return "Modéré";
  return "Élevé";
}

function getISQBadge(value: number | null | undefined): { label: string; className: string } {
  if (value === null || value === undefined) return { 
    label: "Non mesuré", 
    className: "bg-muted text-muted-foreground"
  };
  if (value >= 70) return { 
    label: "Stabilité élevée", 
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  };
  if (value >= 60) return { 
    label: "Stabilité modérée", 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  };
  return { 
    label: "Stabilité faible", 
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  };
}

export function ClinicalFollowUp({ 
  appointmentId, 
  appointmentType,
  surgeryImplantId: propSurgeryImplantId,
  patientId,
  onStatusChange,
  onAction
}: ClinicalFollowUpProps) {
  const { toast } = useToast();
  const [isqValue, setIsqValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false);
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<StatusSuggestion | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string>("");
  const [freeTextReason, setFreeTextReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [linkedRadiosOpen, setLinkedRadiosOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImplantId, setSelectedImplantId] = useState<string | null>(propSurgeryImplantId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const surgeryImplantId = selectedImplantId || propSurgeryImplantId;
  
  // Always fetch patient implants if patientId is available, so user can select an implant
  // even when no implant is linked to the appointment
  const { data: patientImplants, isLoading: patientImplantsLoading } = useQuery<SurgeryImplantBasic[]>({
    queryKey: [`/api/patients/${patientId}/surgery-implants`],
    enabled: !!patientId,
  });

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

  interface AppointmentRadioWithDetails extends AppointmentRadio {
    radio?: Radio;
  }

  const { data: clinicalData, isLoading, refetch } = useQuery<AppointmentClinicalData>({
    queryKey: [`/api/appointments/${appointmentId}/clinical`, surgeryImplantId],
    queryFn: async () => {
      const params = surgeryImplantId && surgeryImplantId !== propSurgeryImplantId 
        ? `?surgeryImplantId=${surgeryImplantId}` 
        : '';
      const res = await fetch(`/api/appointments/${appointmentId}/clinical${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch clinical data');
      return res.json();
    },
    enabled: !!surgeryImplantId,
  });

  const reasonsQuery = useQuery<StatusReason[]>({
    queryKey: ["/api/status-reasons", selectedSuggestion?.suggestedStatus],
    queryFn: async () => {
      const url = selectedSuggestion?.suggestedStatus 
        ? `/api/status-reasons?status=${selectedSuggestion.suggestedStatus}`
        : "/api/status-reasons";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reasons");
      return res.json();
    },
    enabled: !!selectedSuggestion,
  });

  const applyStatusMutation = useMutation({
    mutationFn: async (data: { toStatus: string; fromStatus: string; reasonId?: string; reasonFreeText?: string; evidence?: string }) => {
      const res = await apiRequest("POST", `/api/surgery-implants/${surgeryImplantId}/status`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/surgery-implants/${surgeryImplantId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}/clinical`] });
      toast({ title: "Statut mis a jour", variant: "success" });
      setApplySheetOpen(false);
      setSelectedSuggestion(null);
      setSelectedReasonId("");
      setFreeTextReason("");
      setEvidence("");
      setStatusHistoryOpen(true); // Show history after status change
      refetch();
      if (onStatusChange && selectedSuggestion) {
        onStatusChange(selectedSuggestion);
      }
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le statut.", variant: "destructive" });
    },
  });

  const saveIsqMutation = useMutation({
    mutationFn: async (data: { surgeryImplantId: string; isqValue: number; notes?: string }) => {
      return apiRequest("POST", `/api/appointments/${appointmentId}/isq`, data);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      toast({
        title: "ISQ enregistre",
        description: `Valeur ISQ ${isqValue} enregistree avec succes.`,
        variant: "success",
      });
      setIsqValue("");
      setNotes("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

      if (result.flags && result.flags.length > 0) {
        const criticalFlag = result.flags.find((f: ClinicalFlag) => f.level === "CRITICAL");
        if (criticalFlag) {
          toast({
            title: "Alerte clinique",
            description: criticalFlag.label,
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer la mesure ISQ",
        variant: "destructive",
      });
    },
  });

  const linkedRadiosQuery = useQuery<AppointmentRadioWithDetails[]>({
    queryKey: [`/api/appointments/${appointmentId}/radios`],
    enabled: true,
  });

  const unlinkRadioMutation = useMutation({
    mutationFn: async (radioId: string) => {
      const res = await apiRequest("DELETE", `/api/appointments/${appointmentId}/radios/${radioId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}/radios`] });
      toast({ title: "Radio dissociee", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de dissocier la radio.", variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Erreur", description: "Type de fichier non supporte. Utilisez JPEG, PNG, GIF, WebP ou PDF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Erreur", description: "Le fichier est trop volumineux. Maximum 10 Mo.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const patientId = clinicalData?.appointment?.patientId;
      if (!patientId) throw new Error("Patient non trouve");

      const urlRes = await apiRequest("POST", "/api/radios/upload-url", {
        patientId,
        fileName: file.name,
        mimeType: file.type,
      });
      const urlData = await urlRes.json();
      if (!urlData.signedUrl || !urlData.filePath) throw new Error("Impossible d'obtenir l'URL d'upload");

      const uploadRes = await fetch(urlData.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type, "x-upsert": "true" },
      });
      if (!uploadRes.ok) throw new Error(`Echec du televersement: ${uploadRes.status}`);

      const radioRes = await apiRequest("POST", "/api/radios", {
        patientId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        type: "PANORAMIQUE",
        date: new Date().toISOString().split("T")[0],
        filePath: urlData.filePath,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        operationId: clinicalData?.appointment?.operationId || null,
      });
      const newRadio = await radioRes.json();

      await apiRequest("POST", `/api/appointments/${appointmentId}/radios`, { radioId: newRadio.id });

      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}/radios`] });
      toast({ title: "Radio ajoutee", description: "La radiographie a ete uploade et liee au RDV.", variant: "success" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible d'uploader le fichier.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [appointmentId, clinicalData, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleSaveIsq = () => {
    if (!surgeryImplantId || !isqValue) return;
    
    const value = parseFloat(isqValue);
    if (isNaN(value) || value < 0 || value > 100) {
      toast({
        title: "Valeur invalide",
        description: "L'ISQ doit etre entre 0 et 100",
        variant: "destructive",
      });
      return;
    }

    saveIsqMutation.mutate({
      surgeryImplantId,
      isqValue: value,
      notes: notes || undefined,
    });
  };

  const handleApplySuggestion = (suggestion: StatusSuggestion) => {
    setSelectedSuggestion(suggestion);
    setSelectedReasonId("");
    setFreeTextReason("");
    // Set user notes area to be empty - let user add optional notes
    setEvidence("");
    setApplySheetOpen(true);
  };

  const handleConfirmApply = () => {
    if (!selectedSuggestion || !surgeryImplantId || !clinicalData?.implant) return;
    
    // Build structured evidence with clinical traceability + user notes
    const structuredEvidence = {
      type: "clinical_followup",
      appointmentId,
      measurementId: selectedSuggestion.evidence?.measurementId || null,
      isqValue: selectedSuggestion.evidence?.isqValue ?? null,
      isqDelta: selectedSuggestion.evidence?.isqDelta ?? null,
      reasonCode: selectedSuggestion.reasonCode,
      reasonLabel: selectedSuggestion.reasonLabel,
      clinicianNotes: evidence.trim() || null,
    };
    
    applyStatusMutation.mutate({
      toStatus: selectedSuggestion.suggestedStatus,
      fromStatus: clinicalData.implant.statut || "EN_SUIVI",
      reasonId: selectedReasonId || undefined,
      reasonFreeText: freeTextReason || undefined,
      evidence: JSON.stringify(structuredEvidence),
    });
  };

  const showIsqInput = ["CONTROLE", "CHIRURGIE", "URGENCE", "SUIVI"].includes(appointmentType);
  const isqRequired = appointmentType === "CONTROLE";
  const isqOptional = appointmentType === "CHIRURGIE";

  // Show loading state while fetching patient implants
  if (!surgeryImplantId && patientImplantsLoading) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Chargement des implants...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!surgeryImplantId && patientImplants && patientImplants.length > 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Suivi clinique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sélectionnez l'implant pour ce suivi clinique :
          </p>
          <Select value={selectedImplantId || ""} onValueChange={setSelectedImplantId}>
            <SelectTrigger data-testid="select-implant-trigger">
              <SelectValue placeholder="Choisir un implant..." />
            </SelectTrigger>
            <SelectContent>
              {patientImplants.map((impl) => (
                <SelectItem key={impl.id} value={impl.id} data-testid={`select-implant-${impl.id}`}>
                  Site {impl.siteFdi} - {impl.marque} {impl.modele || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }
  
  if (!surgeryImplantId) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Suivi clinique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Aucun implant disponible pour le suivi
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Le suivi clinique permet d'enregistrer les mesures ISQ et de suivre l'évolution d'un implant posé. 
                Ce patient n'a pas encore d'implant enregistré ou aucun implant n'est associé à ce rendez-vous.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Pour activer le suivi : créez d'abord un acte chirurgical avec un implant posé depuis la fiche patient.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const implant = clinicalData?.implant;
  const lastMeasurement = clinicalData?.lastMeasurement;
  const flags = clinicalData?.flags || [];
  const suggestions = clinicalData?.suggestions || [];
  const measurementHistory = clinicalData?.measurementHistory || [];
  const statusHistory = clinicalData?.statusHistory || [];

  // Get the currently selected implant info from patientImplants if available
  const currentImplantInfo = patientImplants?.find(pi => pi.id === surgeryImplantId);

  return (
    <>
      <Card data-testid="card-clinical-followup">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Suivi clinique
          </div>
          {implant && (
            <Badge variant="outline" className="text-xs">
              Site {implant.siteFdi}
            </Badge>
          )}
        </CardTitle>
        {/* Show linked implant info and allow change if multiple implants available */}
        {implant && patientImplants && patientImplants.length > 1 && (
          <div className="flex items-center justify-between mt-2 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {implant.siteFdi}
                </span>
              </div>
              <div className="text-xs">
                <p className="font-medium">{currentImplantInfo?.marque || implant.implant?.marque}</p>
                <p className="text-muted-foreground">{currentImplantInfo?.modele || ""}</p>
              </div>
            </div>
            <Select value={surgeryImplantId || ""} onValueChange={setSelectedImplantId}>
              <SelectTrigger className="h-7 w-auto text-xs" data-testid="select-change-implant">
                <span className="text-xs">Changer</span>
              </SelectTrigger>
              <SelectContent>
                {patientImplants.map((impl) => (
                  <SelectItem key={impl.id} value={impl.id} data-testid={`select-implant-option-${impl.id}`}>
                    Site {impl.siteFdi} - {impl.marque} {impl.modele || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Show implant info without change option if only one implant */}
        {implant && (!patientImplants || patientImplants.length <= 1) && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded-md">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {implant.siteFdi}
              </span>
            </div>
            <div className="text-xs">
              <p className="font-medium">{currentImplantInfo?.marque || implant.implant?.marque}</p>
              <p className="text-muted-foreground">Implant lié à ce suivi</p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {flags.length > 0 && (
          <div className="space-y-2">
            {flags.map((flag) => {
              const FlagIcon = flagIcons[flag.type] || AlertCircle;
              const primaryActions = flag.recommendedActions?.filter(a => a.priority === "PRIMARY") || [];
              return (
                <div 
                  key={flag.id}
                  className={`p-3 rounded-md border ${
                    flag.level === "CRITICAL" ? "bg-destructive/10 border-destructive/20" :
                    flag.level === "WARNING" ? "bg-orange-500/10 border-orange-500/20" :
                    "bg-muted border-muted"
                  }`}
                  data-testid={`flag-${flag.type.toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <FlagIcon className={`h-4 w-4 shrink-0 ${
                      flag.level === "CRITICAL" ? "text-destructive" :
                      flag.level === "WARNING" ? "text-orange-600" : "text-muted-foreground"
                    }`} />
                    <span className={`text-sm font-medium ${
                      flag.level === "CRITICAL" ? "text-destructive" :
                      flag.level === "WARNING" ? "text-orange-600" : ""
                    }`}>{flag.label}</span>
                    {flag.value !== undefined && (
                      <span className="text-sm ml-auto">ISQ: {flag.value}</span>
                    )}
                    {flag.delta !== undefined && (
                      <span className="text-xs text-muted-foreground">({flag.delta > 0 ? "+" : ""}{flag.delta})</span>
                    )}
                  </div>
                  {primaryActions.length > 0 && onAction && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {primaryActions.map((action) => {
                        const ActionIcon = actionIcons[action.type];
                        return (
                          <Button
                            key={action.type}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onAction(action.type, action.params)}
                            data-testid={`button-action-${action.type}`}
                          >
                            <ActionIcon className="h-3 w-3 mr-1" />
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {lastMeasurement && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Dernier ISQ</span>
              {lastMeasurement.measuredAt && (
                <span className="text-xs text-muted-foreground/70">
                  {new Date(lastMeasurement.measuredAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${getIsqColor(lastMeasurement.isqValue)}`}>
                {lastMeasurement.isqValue ?? "-"}
              </span>
              <Badge className={`text-[10px] ${getISQBadge(lastMeasurement.isqValue).className}`}>
                {getISQBadge(lastMeasurement.isqValue).label}
              </Badge>
            </div>
          </div>
        )}

        {showIsqInput && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="isq-input" className="text-sm font-medium">
                  Mesure ISQ
                </Label>
                {isqRequired && !lastMeasurement && (
                  <Badge variant="secondary" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Recommande
                  </Badge>
                )}
                {isqOptional && (
                  <Badge variant="outline" className="text-xs">Optionnel</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="isq-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0-100"
                  value={isqValue}
                  onChange={(e) => setIsqValue(e.target.value)}
                  className="w-24"
                  data-testid="input-isq-value"
                />
                <Button
                  onClick={handleSaveIsq}
                  disabled={!isqValue || saveIsqMutation.isPending}
                  size="sm"
                  data-testid="button-save-isq"
                >
                  {saveIsqMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Notes (optionnel)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
                rows={2}
                data-testid="textarea-isq-notes"
              />
            </div>
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Suggestions de statut</span>
                  {lastMeasurement?.isqValue !== undefined && (
                    <span className="text-xs text-muted-foreground">(ISQ: {lastMeasurement.isqValue})</span>
                  )}
                </div>
                {statusHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatusHistoryOpen(!statusHistoryOpen)}
                    className="text-xs h-7"
                    data-testid="button-toggle-history"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Historique
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => {
                  const priorityLabel = suggestion.priority === "HIGH" ? "Confiance elevee" : 
                                        suggestion.priority === "MEDIUM" ? "Confiance moderee" : "A evaluer";
                  const secondaryActions = suggestion.recommendedActions?.filter(a => a.priority === "SECONDARY") || [];
                  return (
                    <div 
                      key={suggestion.id}
                      className="p-3 rounded-lg border bg-card space-y-2"
                      data-testid={`suggestion-${suggestion.suggestedStatus.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge 
                            variant={suggestion.suggestedStatus === "ECHEC" ? "echec" : 
                                     suggestion.suggestedStatus === "COMPLICATION" ? "complication" : "default"}
                            className="text-[10px]"
                          >
                            {statusConfig[suggestion.suggestedStatus]?.label || suggestion.suggestedStatus}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          >
                            {priorityLabel}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{suggestion.reasonLabel}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplySuggestion(suggestion)}
                          data-testid={`button-apply-suggestion-${suggestion.id}`}
                        >
                          Appliquer
                        </Button>
                      </div>
                      {secondaryActions.length > 0 && onAction && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                          {secondaryActions.map((action) => {
                            const ActionIcon = actionIcons[action.type];
                            return (
                              <Button
                                key={action.type}
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => onAction(action.type, action.params)}
                                data-testid={`button-suggestion-action-${action.type}`}
                              >
                                <ActionIcon className="h-3 w-3 mr-1" />
                                {action.label}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Radios liees</span>
              {linkedRadiosQuery.data && linkedRadiosQuery.data.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {linkedRadiosQuery.data.length}
                </Badge>
              )}
            </div>
            {onAction && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAction("add_or_link_radio")}
                data-testid="button-link-existing-radio"
              >
                <Link className="h-3 w-3 mr-1" />
                Lier existante
              </Button>
            )}
          </div>
          
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-3 transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
            data-testid="dropzone-radio-upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-radio-file"
            />
            <div className="flex flex-col items-center justify-center gap-1 text-center">
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Telechargement...</p>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Glissez ou cliquez pour ajouter une nouvelle radio
                  </p>
                </>
              )}
            </div>
          </div>
          
          {linkedRadiosQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : linkedRadiosQuery.data && linkedRadiosQuery.data.length > 0 ? (
            <div className="space-y-2">
              {linkedRadiosQuery.data.map((link) => (
                <div 
                  key={link.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded border"
                  data-testid={`linked-radio-${link.radioId}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">
                        {link.radio?.title || "Radio"}
                      </span>
                      {link.radio?.date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(link.radio.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onAction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onAction("add_radio_note", { radioId: link.radioId })}
                        data-testid={`button-radio-note-${link.radioId}`}
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive text-xs"
                      onClick={() => unlinkRadioMutation.mutate(link.radioId)}
                      disabled={unlinkRadioMutation.isPending}
                      data-testid={`button-unlink-radio-${link.radioId}`}
                      title="Dissocier du RDV"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dissocier
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {measurementHistory.length > 1 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-sm">Historique ISQ ({measurementHistory.length} mesures)</span>
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {measurementHistory.map((m) => (
                  <div 
                    key={m.id}
                    className="flex items-center justify-between p-2 text-sm bg-muted/30 rounded"
                  >
                    <span className="text-muted-foreground">
                      {new Date(m.measuredAt).toLocaleDateString("fr-FR")}
                    </span>
                    <span className={`font-medium ${getIsqColor(m.isqValue)}`}>
                      {m.isqValue ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {statusHistory.length > 0 && (
          <Collapsible open={statusHistoryOpen} onOpenChange={setStatusHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-sm">Historique des statuts ({statusHistory.length})</span>
                {statusHistoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {statusHistory.map((entry) => (
                  <div 
                    key={entry.id}
                    className="p-2 bg-muted/30 rounded border text-sm space-y-1"
                    data-testid={`status-history-${entry.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.fromStatus && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {statusConfig[entry.fromStatus]?.label || entry.fromStatus}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge 
                          variant={statusConfig[entry.toStatus]?.variant || "secondary"} 
                          className="text-xs"
                        >
                          {statusConfig[entry.toStatus]?.label || entry.toStatus}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    {entry.reasonLabel && (
                      <p className="text-xs text-muted-foreground">
                        {entry.reasonLabel}
                      </p>
                    )}
                    {entry.reasonFreeText && (
                      <p className="text-xs italic border-l-2 border-muted-foreground/30 pl-2 mt-1">
                        {entry.reasonFreeText}
                      </p>
                    )}
                    {entry.changedByPrenom && entry.changedByNom && (
                      <p className="text-xs text-muted-foreground/70">
                        Par {entry.changedByPrenom} {entry.changedByNom}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {appointmentType === "URGENCE" && (
          <div className="p-2 bg-destructive/10 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Rendez-vous d'urgence</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Verifiez l'etat de l'implant et envisagez un changement de statut si necessaire.
            </p>
          </div>
        )}

        {isqRequired && !lastMeasurement && (
          <div className="p-2 bg-orange-500/10 rounded-md">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">ISQ non mesure</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Une mesure ISQ est recommandee pour ce type de rendez-vous.
            </p>
          </div>
        )}
      </CardContent>
    </Card>

    <Sheet open={applySheetOpen} onOpenChange={setApplySheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Changer le statut de l'implant</SheetTitle>
            <SheetDescription>
              {selectedSuggestion && clinicalData?.implant && (
                <span className="flex items-center gap-2 mt-1">
                  <Badge variant={statusConfig[clinicalData.implant.statut || "EN_SUIVI"]?.variant || "secondary"}>
                    {statusConfig[clinicalData.implant.statut || "EN_SUIVI"]?.label || clinicalData.implant.statut}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant={statusConfig[selectedSuggestion.suggestedStatus]?.variant || "secondary"}>
                    {statusConfig[selectedSuggestion.suggestedStatus]?.label || selectedSuggestion.suggestedStatus}
                  </Badge>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            {selectedSuggestion && (
              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <p className="text-sm text-muted-foreground">Raison suggeree:</p>
                <p className="text-sm font-medium">{selectedSuggestion.reasonLabel}</p>
                {(selectedSuggestion.evidence?.isqValue !== undefined || selectedSuggestion.evidence?.isqDelta !== undefined) && (
                  <div className="flex items-center gap-3 pt-2 border-t text-xs">
                    {selectedSuggestion.evidence?.isqValue !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground">ISQ:</span>
                        <span className={`font-medium ${selectedSuggestion.evidence.isqValue < 60 ? "text-destructive" : "text-foreground"}`}>
                          {selectedSuggestion.evidence.isqValue}
                        </span>
                      </span>
                    )}
                    {selectedSuggestion.evidence?.isqDelta !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground">Delta:</span>
                        <span className={`font-medium ${selectedSuggestion.evidence.isqDelta < 0 ? "text-destructive" : "text-foreground"}`}>
                          {selectedSuggestion.evidence.isqDelta > 0 ? "+" : ""}{selectedSuggestion.evidence.isqDelta}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label>Motif</Label>
              {reasonsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des motifs...
                </div>
              ) : reasonsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Aucun motif predefini disponible
                </p>
              ) : (
                <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                  <SelectTrigger data-testid="select-status-reason">
                    <SelectValue placeholder="Selectionner un motif (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonsQuery.data?.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.label}
                        {reason.isSystem && <Badge variant="outline" className="ml-2 text-xs">Systeme</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Motif personnalise (optionnel)</Label>
              <Textarea
                value={freeTextReason}
                onChange={(e) => setFreeTextReason(e.target.value)}
                placeholder="Ajouter un commentaire libre..."
                className="min-h-[80px]"
                data-testid="textarea-free-text-reason"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes cliniciennes (optionnel)</Label>
              <Textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Ajouter des observations cliniques supplementaires..."
                className="min-h-[80px]"
                data-testid="textarea-clinician-notes"
              />
              <p className="text-xs text-muted-foreground">
                Les donnees ISQ et de mesure seront automatiquement enregistrees.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setApplySheetOpen(false)}>
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmApply}
              disabled={applyStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {applyStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
