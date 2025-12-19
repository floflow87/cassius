import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { useState } from "react";
import {
  ArrowLeft,
  Activity,
  Calendar,
  Pencil,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  FileText,
  Trash2,
  Plus,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImplantDetailsSkeleton } from "@/components/page-skeletons";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OperationForm } from "@/components/operation-form";
import type { ImplantDetail } from "@shared/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

type ISQSource = "isqPose" | "isq2m" | "isq3m" | "isq6m" | "visite";

interface ISQPoint {
  label: string; 
  sublabel: string;
  value: number; 
  date: string;
  delta?: number;
  source: ISQSource;
  visiteId?: string;
  notes?: string;
}

function getISQBadge(value: number): { label: string; className: string; pointColor: string } {
  if (value >= 70) return { 
    label: "Stabilité élevée", 
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pointColor: "bg-emerald-500"
  };
  if (value >= 60) return { 
    label: "Stabilité modérée", 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    pointColor: "bg-amber-500"
  };
  return { 
    label: "Stabilité faible", 
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pointColor: "bg-red-500"
  };
}

export default function ImplantDetailsPage() {
  const [, params] = useRoute("/patients/:patientId/implants/:implantId");
  const patientId = params?.patientId;
  const implantId = params?.implantId;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [addISQSheetOpen, setAddISQSheetOpen] = useState(false);
  const [editPoseInfoSheetOpen, setEditPoseInfoSheetOpen] = useState(false);
  const [newOperationSheetOpen, setNewOperationSheetOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [selectedActs, setSelectedActs] = useState<string[]>([]);
  const [boneLossScore, setBoneLossScore] = useState<number>(0);
  
  const [poseFormData, setPoseFormData] = useState({
    positionImplant: "",
    siteFdi: "",
    typeOs: "",
    greffeOsseuse: false,
    typeGreffe: "",
  });

  const [isqFormData, setIsqFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    value: "",
    notes: "",
  });

  const [editingIsqPoint, setEditingIsqPoint] = useState<{
    source: "isqPose" | "isq2m" | "isq3m" | "isq6m" | "visite";
    visiteId?: string;
    value: string;
    date: string;
    notes: string;
  } | null>(null);
  const [editIsqSheetOpen, setEditIsqSheetOpen] = useState(false);

  const { data: implantData, isLoading } = useQuery<ImplantDetail>({
    queryKey: ["/api/surgery-implants", implantId],
    enabled: !!implantId,
  });

  // Initialize boneLossScore and notesContent from implantData when loaded
  const [hasInitializedBoneLoss, setHasInitializedBoneLoss] = useState(false);
  const [hasInitializedNotes, setHasInitializedNotes] = useState(false);
  if (implantData && !hasInitializedBoneLoss) {
    setBoneLossScore(implantData.boneLossScore ?? 0);
    setHasInitializedBoneLoss(true);
  }
  if (implantData && !hasInitializedNotes) {
    setNotesContent(implantData.notes ?? "");
    setHasInitializedNotes(true);
  }

  const handleBoneLossChange = (value: string) => {
    const score = parseInt(value);
    setBoneLossScore(score);
    updatePoseInfoMutation.mutate({ boneLossScore: score });
  };

  const handleOpenPoseInfoSheet = (open: boolean) => {
    if (open && implantData) {
      setPoseFormData({
        positionImplant: implantData.positionImplant || "",
        siteFdi: implantData.siteFdi || "",
        typeOs: implantData.typeOs || "",
        greffeOsseuse: implantData.greffeOsseuse || false,
        typeGreffe: implantData.typeGreffe || "",
      });
    }
    setEditPoseInfoSheetOpen(open);
  };

  const handleSavePoseInfo = () => {
    updatePoseInfoMutation.mutate(poseFormData);
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/surgery-implants", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/implant-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setSelectedActs([]);
      toast({
        title: "Suppression effectuée",
        description: "Les actes sélectionnés ont été supprimés",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression",
        variant: "destructive",
      });
    },
  });

  const updatePoseInfoMutation = useMutation({
    mutationFn: async (data: {
      positionImplant?: string;
      siteFdi?: string;
      typeOs?: string;
      greffeOsseuse?: boolean;
      typeGreffe?: string;
      boneLossScore?: number;
    }) => {
      return apiRequest("PATCH", `/api/surgery-implants/${implantId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-implants"] });
      setEditPoseInfoSheetOpen(false);
      toast({
        title: "Modifications enregistrées",
        description: "Les informations de pose ont été mises à jour",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour",
        variant: "destructive",
      });
    },
  });

  const createIsqMutation = useMutation({
    mutationFn: async (data: { date: string; isq: number; notes?: string }) => {
      return apiRequest("POST", "/api/visites", {
        implantId: implantData?.implant?.id,
        patientId: patientId,
        date: data.date,
        isq: data.isq,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      setAddISQSheetOpen(false);
      setIsqFormData({ date: new Date().toISOString().split('T')[0], value: "", notes: "" });
      toast({
        title: "Mesure enregistrée",
        description: "La mesure ISQ a été ajoutée avec succès",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    },
  });

  const updateIsqMutation = useMutation({
    mutationFn: async (data: { 
      source: "isqPose" | "isq2m" | "isq3m" | "isq6m" | "visite";
      visiteId?: string;
      value: number;
    }) => {
      if (data.source === "visite" && data.visiteId) {
        return apiRequest("PATCH", `/api/visites/${data.visiteId}`, { isq: data.value });
      } else {
        const fieldMap = {
          isqPose: "isqPose",
          isq2m: "isq2m", 
          isq3m: "isq3m",
          isq6m: "isq6m",
        };
        const field = fieldMap[data.source as keyof typeof fieldMap];
        return apiRequest("PATCH", `/api/surgery-implants/${implantId}`, { [field]: data.value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      setEditIsqSheetOpen(false);
      setEditingIsqPoint(null);
      toast({
        title: "Mesure mise à jour",
        description: "La valeur ISQ a été modifiée",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour",
        variant: "destructive",
      });
    },
  });

  const deleteIsqMutation = useMutation({
    mutationFn: async (data: { 
      source: "isqPose" | "isq2m" | "isq3m" | "isq6m" | "visite";
      visiteId?: string;
    }) => {
      if (data.source === "visite" && data.visiteId) {
        return apiRequest("PATCH", `/api/visites/${data.visiteId}`, { isq: null });
      } else {
        const fieldMap = {
          isqPose: "isqPose",
          isq2m: "isq2m",
          isq3m: "isq3m",
          isq6m: "isq6m",
        };
        const field = fieldMap[data.source as keyof typeof fieldMap];
        return apiRequest("PATCH", `/api/surgery-implants/${implantId}`, { [field]: null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      toast({
        title: "Mesure supprimée",
        description: "La valeur ISQ a été supprimée",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression",
        variant: "destructive",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest("PATCH", `/api/surgery-implants/${implantId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      setEditingNotes(false);
      toast({
        title: "Notes enregistrées",
        description: "Les notes ont été mises à jour",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notesContent);
  };

  const handleSaveIsq = () => {
    if (!isqFormData.value) {
      toast({
        title: "Valeur requise",
        description: "Veuillez saisir une valeur ISQ",
        variant: "destructive",
      });
      return;
    }
    createIsqMutation.mutate({
      date: isqFormData.date,
      isq: parseInt(isqFormData.value),
      notes: isqFormData.notes,
    });
  };

  const handleEditIsq = (point: ISQPoint) => {
    setEditingIsqPoint({
      source: point.source,
      visiteId: point.visiteId,
      value: point.value.toString(),
      date: point.date,
      notes: point.sublabel !== "Visite de contrôle" ? point.sublabel : "",
    });
    setEditIsqSheetOpen(true);
  };

  const handleSaveEditIsq = () => {
    if (!editingIsqPoint || !editingIsqPoint.value) {
      toast({
        title: "Valeur requise",
        description: "Veuillez saisir une valeur ISQ",
        variant: "destructive",
      });
      return;
    }
    updateIsqMutation.mutate({
      source: editingIsqPoint.source,
      visiteId: editingIsqPoint.visiteId,
      value: parseInt(editingIsqPoint.value),
    });
  };

  const handleDeleteIsq = (point: ISQPoint) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette mesure ISQ ?")) {
      deleteIsqMutation.mutate({
        source: point.source,
        visiteId: point.visiteId,
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getISQTimeline = (): ISQPoint[] => {
    const points: ISQPoint[] = [];

    if (implantData?.isqPose && implantData?.datePose) {
      points.push({ 
        label: "Pose", 
        sublabel: "Jour de la pose",
        value: implantData.isqPose, 
        date: implantData.datePose,
        source: "isqPose"
      });
    }
    if (implantData?.isq2m && implantData?.datePose) {
      const date2m = new Date(implantData.datePose);
      date2m.setMonth(date2m.getMonth() + 2);
      const delta = implantData.isqPose ? implantData.isq2m - implantData.isqPose : undefined;
      points.push({ 
        label: "2 mois", 
        sublabel: "Contrôle à 2 mois",
        value: implantData.isq2m, 
        date: date2m.toISOString().split('T')[0],
        delta,
        source: "isq2m"
      });
    }
    if (implantData?.isq3m && implantData?.datePose) {
      const date3m = new Date(implantData.datePose);
      date3m.setMonth(date3m.getMonth() + 3);
      const delta = implantData.isq2m ? implantData.isq3m - implantData.isq2m : undefined;
      points.push({ 
        label: "3 mois", 
        sublabel: "Contrôle à 3 mois",
        value: implantData.isq3m, 
        date: date3m.toISOString().split('T')[0],
        delta,
        source: "isq3m"
      });
    }
    if (implantData?.isq6m && implantData?.datePose) {
      const date6m = new Date(implantData.datePose);
      date6m.setMonth(date6m.getMonth() + 6);
      const delta = implantData.isq3m ? implantData.isq6m - implantData.isq3m : undefined;
      points.push({ 
        label: "6 mois", 
        sublabel: "Contrôle à 6 mois",
        value: implantData.isq6m, 
        date: date6m.toISOString().split('T')[0],
        delta,
        source: "isq6m"
      });
    }

    implantData?.visites
      ?.filter(v => v.isq)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((visite, index, arr) => {
        const prevValue = index > 0 ? arr[index - 1].isq : (points.length > 0 ? points[points.length - 1].value : undefined);
        points.push({
          label: formatShortDate(visite.date),
          sublabel: visite.notes || "Visite de contrôle",
          value: visite.isq!,
          date: visite.date,
          delta: prevValue ? visite.isq! - prevValue : undefined,
          source: "visite",
          visiteId: visite.id,
          notes: visite.notes || undefined,
        });
      });

    return points;
  };

  const getSuccessRateFromBoneLoss = (score: number): number => {
    const rates = [100, 80, 60, 40, 20, 0];
    return rates[score] ?? 100;
  };

  const getBoneLossLabel = (score: number): string => {
    const labels = ["Excellente", "Très bonne", "Bonne", "Modérée", "Faible", "Critique"];
    return labels[score] ?? "—";
  };

  if (isLoading) {
    return <ImplantDetailsSkeleton />;
  }

  if (!implantData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Implant non trouvé</h3>
            <Link href={`/patients/${patientId}`}>
              <Button variant="outline">Retour au patient</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[implantData.statut] || statusConfig.EN_SUIVI;
  const isqTimeline = getISQTimeline();
  const successRate = getSuccessRateFromBoneLoss(boneLossScore);
  const implantType = implantData.implant.typeImplant === "MINI_IMPLANT" ? "Mini-implant" : "Implant";
  const typeLabel = implantData.implant.referenceFabricant ? implantData.implant.referenceFabricant.split("-")[0] : implantData.implant.marque;

  const getSuccessRateColor = () => {
    if (successRate >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (successRate >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSuccessRateCardStyle = () => {
    if (successRate >= 80) return "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20";
    if (successRate >= 60) return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
    return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back-to-patient">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="text-implant-title">
              {implantType} {implantData.implant.marque} {typeLabel}
            </h1>
            {implantData.implant.typeImplant === "MINI_IMPLANT" && (
              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Mini
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Ø {implantData.implant.diametre}mm × {implantData.implant.longueur}mm
          </p>
        </div>
        <Badge variant={status.variant} className="text-sm" data-testid="badge-implant-status">
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Informations de l'implant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Marque</span>
                <p className="font-medium" data-testid="text-implant-marque">{implantData.implant.marque}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <p className="font-medium" data-testid="text-implant-type">{typeLabel}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Référence fabricant</span>
                <p className="font-medium font-mono" data-testid="text-implant-reference">
                  {implantData.implant.referenceFabricant || "-"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Diamètre</span>
                <p className="font-medium font-mono" data-testid="text-implant-diametre">{implantData.implant.diametre} mm</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Longueur</span>
                <p className="font-medium font-mono" data-testid="text-implant-longueur">{implantData.implant.longueur} mm</p>
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <Link href={`/implants/${implantData.implant.id}`}>
                <span className="text-sm text-primary flex items-center cursor-pointer hover:underline" data-testid="link-view-catalog-implant">
                  Voir l'implant catalogue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className={getSuccessRateCardStyle()}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${successRate >= 80 ? "text-emerald-700 dark:text-emerald-400" : successRate >= 60 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>
              Taux de réussite
              {successRate >= 80 && <CheckCircle2 className="h-5 w-5" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <span className={`text-5xl font-bold ${getSuccessRateColor()}`} data-testid="text-success-rate">
                {successRate}%
              </span>
              <p className="text-sm text-muted-foreground mt-1">
                {successRate === 100 ? "Aucune perte osseuse" : successRate >= 80 ? "Perte osseuse minimale" : successRate >= 60 ? "Perte osseuse modérée" : "Perte osseuse importante"}
              </p>
            </div>
            <div className="pt-2 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Score de perte osseuse</Label>
                </div>
                <Select 
                  value={boneLossScore.toString()} 
                  onValueChange={handleBoneLossChange}
                  disabled={updatePoseInfoMutation.isPending}
                >
                  <SelectTrigger data-testid="select-bone-loss" className="bg-white dark:bg-white dark:text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-white">
                    <SelectItem value="0" className="cursor-pointer dark:text-black">0 - Excellente (100%)</SelectItem>
                    <SelectItem value="1" className="cursor-pointer dark:text-black">1 - Très bonne (80%)</SelectItem>
                    <SelectItem value="2" className="cursor-pointer dark:text-black">2 - Bonne (60%)</SelectItem>
                    <SelectItem value="3" className="cursor-pointer dark:text-black">3 - Modérée (40%)</SelectItem>
                    <SelectItem value="4" className="cursor-pointer dark:text-black">4 - Faible (20%)</SelectItem>
                    <SelectItem value="5" className="cursor-pointer dark:text-black">5 - Critique (0%)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground text-center">
                  {getBoneLossLabel(boneLossScore)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Informations de pose</CardTitle>
            <Sheet open={editPoseInfoSheetOpen} onOpenChange={handleOpenPoseInfoSheet}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-edit-pose-info">
                  <Pencil className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Modifier les informations de pose</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Position de l'implant</Label>
                    <Select 
                      value={poseFormData.positionImplant} 
                      onValueChange={(val) => setPoseFormData(prev => ({ ...prev, positionImplant: val }))}
                    >
                      <SelectTrigger data-testid="select-edit-position">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANTERIEUR">Antérieur</SelectItem>
                        <SelectItem value="POSTERIEUR">Postérieur</SelectItem>
                        <SelectItem value="MAXILLAIRE">Maxillaire</SelectItem>
                        <SelectItem value="MANDIBULAIRE">Mandibulaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Site FDI</Label>
                    <Input 
                      value={poseFormData.siteFdi}
                      onChange={(e) => setPoseFormData(prev => ({ ...prev, siteFdi: e.target.value }))}
                      data-testid="input-edit-site-fdi" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type d'os</Label>
                    <Select 
                      value={poseFormData.typeOs}
                      onValueChange={(val) => setPoseFormData(prev => ({ ...prev, typeOs: val }))}
                    >
                      <SelectTrigger data-testid="select-edit-type-os">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D1">D1 - Très dense</SelectItem>
                        <SelectItem value="D2">D2 - Dense</SelectItem>
                        <SelectItem value="D3">D3 - Spongieux</SelectItem>
                        <SelectItem value="D4">D4 - Très spongieux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Greffe osseuse</Label>
                    <Select 
                      value={poseFormData.greffeOsseuse ? "oui" : "non"}
                      onValueChange={(val) => setPoseFormData(prev => ({ ...prev, greffeOsseuse: val === "oui" }))}
                    >
                      <SelectTrigger data-testid="select-edit-greffe">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non">Non</SelectItem>
                        <SelectItem value="oui">Oui</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type de greffe</Label>
                    <Input 
                      value={poseFormData.typeGreffe}
                      onChange={(e) => setPoseFormData(prev => ({ ...prev, typeGreffe: e.target.value }))}
                      placeholder="Ex: Autogène" 
                      data-testid="input-edit-type-greffe" 
                    />
                  </div>
                  <div className="pt-4">
                    <Button 
                      className="w-full" 
                      onClick={handleSavePoseInfo}
                      disabled={updatePoseInfoMutation.isPending}
                      data-testid="button-save-pose-info"
                    >
                      {updatePoseInfoMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Position</span>
                <p className="font-medium" data-testid="text-position">
                  {implantData.positionImplant?.replace(/_/g, " ") || "—"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Site FDI</span>
                <p className="font-medium font-mono" data-testid="text-site-fdi">{implantData.siteFdi}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Type d'os</span>
                <p className="font-medium" data-testid="text-type-os">{implantData.typeOs || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Greffe</span>
                <p className="font-medium" data-testid="text-greffe">
                  {implantData.greffeOsseuse ? (implantData.typeGreffe || "Oui") : "Non"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base">Notes</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setEditingNotes(!editingNotes)}
              data-testid="button-edit-notes"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Ajouter des notes cliniques..."
                  className="min-h-[120px]"
                  data-testid="textarea-notes"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes} data-testid="button-save-notes">
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {notesContent ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{formatDate(new Date().toISOString())}</p>
                    <p>{notesContent}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Aucune note pour le moment</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Suivi ISQ (Stabilité)</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center" aria-label="Information sur les seuils ISQ" data-testid="isq-info-tooltip">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="space-y-1 text-xs">
                  <p className="font-medium">Seuils de stabilité ISQ</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>70+ : Stabilité élevée</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>60-69 : Stabilité modérée</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>&lt;60 : Stabilité faible</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <Sheet open={addISQSheetOpen} onOpenChange={setAddISQSheetOpen}>
            <SheetTrigger asChild>
              <Button data-testid="button-add-isq">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter mesure
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Ajouter une mesure ISQ</SheetTitle>
              </SheetHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={isqFormData.date}
                    onChange={(e) => setIsqFormData(prev => ({ ...prev, date: e.target.value }))}
                    data-testid="input-isq-date" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valeur ISQ</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    max="100" 
                    placeholder="Ex: 75" 
                    value={isqFormData.value}
                    onChange={(e) => setIsqFormData(prev => ({ ...prev, value: e.target.value }))}
                    data-testid="input-isq-value" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Textarea 
                    placeholder="Observations..." 
                    value={isqFormData.notes}
                    onChange={(e) => setIsqFormData(prev => ({ ...prev, notes: e.target.value }))}
                    data-testid="input-isq-notes" 
                  />
                </div>
                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    onClick={handleSaveIsq}
                    disabled={createIsqMutation.isPending}
                    data-testid="button-save-isq"
                  >
                    {createIsqMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </CardHeader>
        <CardContent>
          {isqTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2" />
              <p className="text-sm">Aucune mesure ISQ enregistrée</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vertical ISQ Timeline */}
              <div className="relative pl-6">
                {/* Vertical line connecting dots */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-blue-200" />
                
                {/* Timeline entries */}
                <div className="space-y-6">
                  {isqTimeline.map((point, index) => {
                    const badge = getISQBadge(point.value);
                    
                    return (
                      <div 
                        key={index} 
                        className="relative group py-2 -my-2 rounded-md"
                        data-testid={`isq-entry-${index}`}
                      >
                        {/* Dot on vertical line */}
                        <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-blue-500 border-2 border-background z-10" />
                        
                        {/* Content */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Label and ISQ value */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-semibold text-blue-600 uppercase">{point.label}</span>
                              <span className="text-2xl font-bold">{point.value}</span>
                              {point.delta !== undefined && point.delta !== 0 && (
                                <span className={`text-sm font-medium flex items-center ${point.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  <TrendingUp className={`h-4 w-4 ${point.delta < 0 ? "rotate-180" : ""}`} />
                                  {point.delta > 0 ? "+" : ""}{point.delta}
                                </span>
                              )}
                              <Badge className={`${badge.className} text-xs`}>{badge.label}</Badge>
                            </div>
                            
                            {/* Date */}
                            <div className="text-sm text-muted-foreground mt-1">
                              {formatShortDate(point.date)}
                            </div>
                            
                            {/* Notes if any */}
                            {point.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{point.notes}</p>
                            )}
                          </div>
                          
                          {/* Edit/Delete buttons - visible on hover */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditIsq(point)}
                              data-testid={`button-edit-isq-${index}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteIsq(point)}
                              disabled={deleteIsqMutation.isPending}
                              data-testid={`button-delete-isq-${index}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ISQ Gradient Scale/Frise */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Échelle ISQ</span>
                </div>
                <div className="relative h-6 rounded-md overflow-hidden">
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to right, #ef4444 0%, #ef4444 55%, #f59e0b 55%, #f59e0b 65%, #22c55e 65%, #22c55e 100%)"
                    }}
                  />
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 flex items-center justify-center border-r border-white/30">
                      <span className="text-xs font-medium text-white drop-shadow-sm">Instable (0-55)</span>
                    </div>
                    <div className="w-24 flex items-center justify-center border-r border-white/30">
                      <span className="text-xs font-medium text-white drop-shadow-sm">Moyen (55-65)</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs font-medium text-white drop-shadow-sm">Stable (65+)</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">0</span>
                  <span className="text-xs text-muted-foreground">55</span>
                  <span className="text-xs text-muted-foreground">65</span>
                  <span className="text-xs text-muted-foreground">100</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit ISQ Sheet */}
      <Sheet open={editIsqSheetOpen} onOpenChange={setEditIsqSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Modifier la mesure ISQ</SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={editingIsqPoint?.date || ""}
                disabled
                className="bg-muted"
                data-testid="input-edit-isq-date" 
              />
              <p className="text-xs text-muted-foreground">La date ne peut pas être modifiée</p>
            </div>
            <div className="space-y-2">
              <Label>Valeur ISQ</Label>
              <Input 
                type="number" 
                min="0" 
                max="100" 
                placeholder="Ex: 75" 
                value={editingIsqPoint?.value || ""}
                onChange={(e) => setEditingIsqPoint(prev => prev ? { ...prev, value: e.target.value } : null)}
                data-testid="input-edit-isq-value" 
              />
            </div>
            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={handleSaveEditIsq}
                disabled={updateIsqMutation.isPending}
                data-testid="button-save-edit-isq"
              >
                {updateIsqMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Actes chirurgicaux avec cet implant
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedActs.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(selectedActs)}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleteMutation.isPending ? "Suppression..." : `Supprimer (${selectedActs.length})`}
              </Button>
            )}
            <Sheet open={newOperationSheetOpen} onOpenChange={setNewOperationSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" data-testid="button-new-operation">
                  <Plus className="h-4 w-4 mr-1" />
                  Nouvel Acte
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Nouvel acte chirurgical</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <OperationForm 
                    patientId={patientId || ""} 
                    onSuccess={() => {
                      setNewOperationSheetOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
                    }}
                    defaultImplant={implantData ? {
                      catalogImplantId: implantData.implantId,
                      siteFdi: implantData.siteFdi,
                    } : undefined}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox 
                    checked={implantData.surgery && selectedActs.includes(implantData.surgeryId)}
                    onCheckedChange={(checked) => {
                      if (implantData.surgery) {
                        if (checked) {
                          setSelectedActs([implantData.surgeryId]);
                        } else {
                          setSelectedActs([]);
                        }
                      }
                    }}
                    data-testid="checkbox-select-all" 
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Type d'intervention</TableHead>
                <TableHead>Implants posés</TableHead>
                <TableHead>Chirurgie</TableHead>
                <TableHead>Greffe</TableHead>
                <TableHead>Réussite</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {implantData.surgery ? (
                <TableRow data-testid={`operation-row-${implantData.surgeryId}`}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedActs.includes(implantData.surgeryId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedActs([...selectedActs, implantData.surgeryId]);
                        } else {
                          setSelectedActs(selectedActs.filter(id => id !== implantData.surgeryId));
                        }
                      }}
                      data-testid={`checkbox-operation-${implantData.surgeryId}`} 
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatShortDate(implantData.datePose)}</p>
                      <p className="text-xs text-muted-foreground">14:30</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {implantData.patient ? (
                      <div>
                        <p className="font-medium">{implantData.patient.prenom} {implantData.patient.nom}</p>
                        <p className="text-xs text-muted-foreground font-mono">PAT-2024-0156</p>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">Pose d'implants</p>
                      <p className="text-xs text-muted-foreground">Mise en charge différée</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">1</span>
                    <span className="text-muted-foreground text-sm ml-1">({implantData.siteFdi})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-primary">
                      {implantData.surgery?.typeChirurgieTemps === "UN_TEMPS" ? "1 temps" : "2 temps"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {implantData.surgery?.greffeOsseuse ? (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {implantData.surgery.typeGreffe || "Oui"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Non</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Aucun acte chirurgical associé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
