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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ImplantDetail } from "@shared/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

function getISQBadge(value: number): { label: string; className: string } {
  if (value >= 70) return { label: "Excellent", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (value >= 60) return { label: "Bon", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  if (value >= 50) return { label: "Acceptable", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: "Critique", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
}

export default function ImplantDetailsPage() {
  const [, params] = useRoute("/patients/:patientId/implants/:implantId");
  const patientId = params?.patientId;
  const implantId = params?.implantId;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [addISQSheetOpen, setAddISQSheetOpen] = useState(false);
  const [editPoseInfoSheetOpen, setEditPoseInfoSheetOpen] = useState(false);
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

  const { data: implantData, isLoading } = useQuery<ImplantDetail>({
    queryKey: ["/api/surgery-implants", implantId],
    enabled: !!implantId,
  });

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
    }) => {
      return apiRequest("PATCH", `/api/surgery-implants/${implantId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      setEditPoseInfoSheetOpen(false);
      toast({
        title: "Modifications enregistrées",
        description: "Les informations de pose ont été mises à jour",
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

  const getISQTimeline = () => {
    const points: { 
      label: string; 
      sublabel: string;
      value: number; 
      date: string;
      delta?: number;
    }[] = [];

    if (implantData?.isqPose && implantData?.datePose) {
      points.push({ 
        label: "Pose", 
        sublabel: "Jour de la pose",
        value: implantData.isqPose, 
        date: implantData.datePose 
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
        delta 
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
        delta 
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
        delta 
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
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base">Informations de l'implant</CardTitle>
            <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-edit-implant">
                  <Pencil className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Modifier l'implant</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Marque</Label>
                    <Input defaultValue={implantData.implant.marque} data-testid="input-edit-marque" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select defaultValue={implantData.implant.typeImplant || "IMPLANT"}>
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IMPLANT">Implant</SelectItem>
                        <SelectItem value="MINI_IMPLANT">Mini-implant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Référence fabricant</Label>
                    <Input defaultValue={implantData.implant.referenceFabricant || ""} data-testid="input-edit-reference" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Diamètre (mm)</Label>
                      <Input type="number" step="0.1" defaultValue={implantData.implant.diametre} data-testid="input-edit-diametre" />
                    </div>
                    <div className="space-y-2">
                      <Label>Longueur (mm)</Label>
                      <Input type="number" step="0.5" defaultValue={implantData.implant.longueur} data-testid="input-edit-longueur" />
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button className="w-full" data-testid="button-save-implant">
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
                <Select value={boneLossScore.toString()} onValueChange={(val) => setBoneLossScore(parseInt(val))}>
                  <SelectTrigger data-testid="select-bone-loss">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Excellente (100%)</SelectItem>
                    <SelectItem value="1">1 - Très bonne (80%)</SelectItem>
                    <SelectItem value="2">2 - Bonne (60%)</SelectItem>
                    <SelectItem value="3">3 - Modérée (40%)</SelectItem>
                    <SelectItem value="4">4 - Faible (20%)</SelectItem>
                    <SelectItem value="5">5 - Critique (0%)</SelectItem>
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
                  <Button size="sm" onClick={() => setEditingNotes(false)} data-testid="button-save-notes">
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
          <CardTitle className="text-base">Suivi ISQ (Stabilité)</CardTitle>
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
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} data-testid="input-isq-date" />
                </div>
                <div className="space-y-2">
                  <Label>Valeur ISQ</Label>
                  <Input type="number" min="0" max="100" placeholder="Ex: 75" data-testid="input-isq-value" />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Textarea placeholder="Observations..." data-testid="input-isq-notes" />
                </div>
                <div className="pt-4">
                  <Button className="w-full" onClick={() => setAddISQSheetOpen(false)} data-testid="button-save-isq">
                    Enregistrer
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
            <div className="relative">
              <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-border" />
              <div className="space-y-4">
                {isqTimeline.map((point, index) => {
                  const badge = getISQBadge(point.value);
                  return (
                    <div key={index} className="relative flex items-start gap-4 pl-4" data-testid={`isq-entry-${index}`}>
                      <div className="absolute left-6 w-4 h-4 rounded-full bg-primary border-2 border-background z-10" />
                      <div className="ml-10 flex-1">
                        <div className="flex items-center gap-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground uppercase">{point.label}</span>
                            <span className="text-3xl font-bold text-primary">{point.value}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm">{formatShortDate(point.date)}</span>
                          <span className="text-xs text-muted-foreground">{point.sublabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={badge.className}>{badge.label}</Badge>
                        {point.delta !== undefined && point.delta !== 0 && (
                          <span className={`text-xs font-medium flex items-center gap-0.5 ${point.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            <TrendingUp className={`h-3 w-3 ${point.delta < 0 ? "rotate-180" : ""}`} />
                            {point.delta > 0 ? "+" : ""}{point.delta}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="relative flex items-start gap-4 pl-4 opacity-60" data-testid="isq-next-control">
                  <div className="absolute left-6 w-4 h-4 rounded-full bg-muted border-2 border-background z-10" />
                  <div className="ml-10 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">6 mois</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">{formatShortDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())}</span>
                      <span className="text-xs text-muted-foreground">Prochain contrôle prévu</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    À venir
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Actes chirurgicaux avec cet implant
          </CardTitle>
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
                <TableHead>Statut</TableHead>
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
                    <Badge variant={status.variant}>{status.label}</Badge>
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
