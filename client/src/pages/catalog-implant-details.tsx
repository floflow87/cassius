import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ArrowLeft,
  Activity,
  Pencil,
  CheckCircle2,
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CatalogImplantDetailsSkeleton } from "@/components/page-skeletons";
import { AuditHistory } from "@/components/audit-history";
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
import type { ImplantWithStats, SurgeryImplantWithDetails } from "@shared/schema";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "echec" | "complication" | "ensuivi" | "success" }> = {
  EN_SUIVI: { label: "En suivi", variant: "ensuivi" },
  SUCCES: { label: "Succès", variant: "success" },
  COMPLICATION: { label: "Complication", variant: "complication" },
  ECHEC: { label: "Échec", variant: "echec" },
};

export default function CatalogImplantDetailsPage() {
  const [, params] = useRoute("/catalogue/:id");
  const implantId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canDelete } = useCurrentUser();

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [selectedActs, setSelectedActs] = useState<string[]>([]);

  // Form state for editing implant
  const [editMarque, setEditMarque] = useState("");
  const [editTypeImplant, setEditTypeImplant] = useState<"IMPLANT" | "MINI_IMPLANT" | "PROTHESE">("IMPLANT");
  const [editReferenceFabricant, setEditReferenceFabricant] = useState("");
  const [editTypeProthese, setEditTypeProthese] = useState<"VISSEE" | "SCELLEE" | "">("");
  const [editDiametre, setEditDiametre] = useState<number>(0);
  const [editLongueur, setEditLongueur] = useState<number>(0);

  const { data: implant, isLoading: implantLoading } = useQuery<ImplantWithStats>({
    queryKey: ["/api/catalog-implants", implantId],
    queryFn: async () => {
      const res = await fetch(`/api/catalog-implants/${implantId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch implant");
      return res.json();
    },
    enabled: !!implantId,
  });

  const { data: surgeries, isLoading: surgeriesLoading } = useQuery<SurgeryImplantWithDetails[]>({
    queryKey: ["/api/catalog-implants", implantId, "surgeries"],
    queryFn: async () => {
      const res = await fetch(`/api/catalog-implants/${implantId}/surgeries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch surgeries");
      return res.json();
    },
    enabled: !!implantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/surgery-implants", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-implants", implantId, "surgeries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/implant-counts"] });
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

  const updateMutation = useMutation({
    mutationFn: async (updates: {
      marque?: string;
      typeImplant?: "IMPLANT" | "MINI_IMPLANT" | "PROTHESE";
      referenceFabricant?: string | null;
      diametre?: number;
      longueur?: number;
    }) => {
      return apiRequest("PATCH", `/api/catalog-implants/${implantId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-implants"] });
      setEditSheetOpen(false);
      toast({
        title: "Modifications enregistrées",
        description: "Les informations de l'implant ont été mises à jour",
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

  // Sync form state when implant data loads or edit sheet opens
  useEffect(() => {
    if (implant && editSheetOpen) {
      setEditMarque(implant.marque);
      setEditTypeImplant(implant.typeImplant || "IMPLANT");
      setEditReferenceFabricant(implant.referenceFabricant || "");
      setEditTypeProthese(implant.typeProthese || "");
      setEditDiametre(implant.diametre);
      setEditLongueur(implant.longueur);
    }
  }, [implant, editSheetOpen]);

  // Sync notes content when implant data loads or notes editing starts
  useEffect(() => {
    if (implant && editingNotes) {
      setNotesContent(implant.notes || "");
    }
  }, [implant, editingNotes]);

  const handleSaveNotes = () => {
    updateMutation.mutate({ notes: notesContent || null } as any);
    setEditingNotes(false);
  };

  const handleSaveImplant = () => {
    updateMutation.mutate({
      marque: editMarque,
      typeImplant: editTypeImplant,
      referenceFabricant: editReferenceFabricant || null,
      typeProthese: editTypeImplant === "PROTHESE" ? (editTypeProthese || null) : null,
      diametre: editDiametre,
      longueur: editLongueur,
    } as any);
  };

  const isLoading = implantLoading || surgeriesLoading;

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

  if (isLoading) {
    return <CatalogImplantDetailsSkeleton />;
  }

  if (!implant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Implant non trouvé</h3>
            <Button variant="outline" onClick={() => setLocation("/implants")}>
              Retour aux implants
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPoses = (implant.poseCount ?? 0) > 0;
  const successRate = implant.successRate ?? null;
  const isProthese = implant.typeImplant === "PROTHESE";
  const implantType = isProthese 
    ? "Prothèse" 
    : implant.typeImplant === "MINI_IMPLANT" 
      ? "Mini-implant" 
      : "Implant";
  const typeLabel = implant.referenceFabricant ? implant.referenceFabricant.split("-")[0] : implant.marque;

  const getSuccessRateColor = () => {
    if (successRate === null) return "text-muted-foreground";
    if (successRate >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (successRate >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSuccessRateCardStyle = () => {
    if (!hasPoses || successRate === null) return "";
    if (successRate >= 90) return "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20";
    if (successRate >= 70) return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
    return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/implants")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="text-implant-title">
              {implantType} {implant.marque} {typeLabel}
            </h1>
            {implant.typeImplant === "MINI_IMPLANT" && (
              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Mini
              </Badge>
            )}
          </div>
          {!isProthese && (
            <p className="text-xs text-muted-foreground">
              Ø {implant.diametre}mm × {implant.longueur}mm
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base">Informations {isProthese ? "de la prothèse" : "de l'implant"}</CardTitle>
            <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-edit-implant">
                  <Pencil className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Modifier {isProthese ? "la prothèse" : "l'implant"}</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Marque</Label>
                    <Input 
                      value={editMarque} 
                      onChange={(e) => setEditMarque(e.target.value)} 
                      data-testid="input-edit-marque" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={editTypeImplant} onValueChange={(v) => setEditTypeImplant(v as "IMPLANT" | "MINI_IMPLANT" | "PROTHESE")}>
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IMPLANT">Implant</SelectItem>
                        <SelectItem value="MINI_IMPLANT">Mini-implant</SelectItem>
                        <SelectItem value="PROTHESE">Prothèse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Référence fabricant</Label>
                    <Input 
                      value={editReferenceFabricant} 
                      onChange={(e) => setEditReferenceFabricant(e.target.value)} 
                      data-testid="input-edit-reference" 
                    />
                  </div>
                  {editTypeImplant === "PROTHESE" && (
                    <div className="space-y-2">
                      <Label>Type de prothèse</Label>
                      <Select value={editTypeProthese} onValueChange={(v) => setEditTypeProthese(v as "VISSEE" | "SCELLEE" | "")}>
                        <SelectTrigger data-testid="select-edit-type-prothese">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VISSEE">Vissée</SelectItem>
                          <SelectItem value="SCELLEE">Scellée</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Diamètre (mm)</Label>
                      <Input 
                        type="number" 
                        step="0.1" 
                        value={editDiametre} 
                        onChange={(e) => setEditDiametre(parseFloat(e.target.value) || 0)} 
                        data-testid="input-edit-diametre" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Longueur (mm)</Label>
                      <Input 
                        type="number" 
                        step="0.5" 
                        value={editLongueur} 
                        onChange={(e) => setEditLongueur(parseFloat(e.target.value) || 0)} 
                        data-testid="input-edit-longueur" 
                      />
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button 
                      className="w-full" 
                      onClick={handleSaveImplant}
                      disabled={updateMutation.isPending}
                      data-testid="button-save-implant"
                    >
                      {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Marque</span>
                <p className="text-sm font-medium" data-testid="text-implant-marque">{implant.marque}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Type</span>
                <p className="text-sm font-medium" data-testid="text-implant-type">
                  {isProthese ? "Prothèse" : implant.typeImplant === "MINI_IMPLANT" ? "Mini-implant" : "Implant"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Référence fabricant</span>
                <p className="text-sm font-medium font-mono" data-testid="text-implant-reference">
                  {implant.referenceFabricant || "—"}
                </p>
              </div>
              {isProthese && implant.typeProthese && (
                <div>
                  <span className="text-xs text-muted-foreground">Type de prothèse</span>
                  <p className="text-sm font-medium" data-testid="text-prothese-type">
                    {implant.typeProthese === "VISSEE" ? "Vissée" : implant.typeProthese === "SCELLEE" ? "Scellée" : implant.typeProthese}
                  </p>
                </div>
              )}
              {!isProthese && (
                <>
                  <div>
                    <span className="text-xs text-muted-foreground">Diamètre</span>
                    <p className="text-sm font-medium font-mono" data-testid="text-implant-diametre">{implant.diametre} mm</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Longueur</span>
                    <p className="text-sm font-medium font-mono" data-testid="text-implant-longueur">{implant.longueur} mm</p>
                  </div>
                </>
              )}
              <div>
                <span className="text-xs text-muted-foreground">Numéro de lot</span>
                <p className="text-sm font-medium font-mono">{implant.lot || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={getSuccessRateCardStyle()}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${hasPoses && successRate !== null && successRate >= 90 ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
              Taux de réussite moyen
              {hasPoses && successRate !== null && successRate >= 90 && <CheckCircle2 className="h-5 w-5" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <span className={`text-5xl font-bold ${getSuccessRateColor()}`} data-testid="text-success-rate">
                {hasPoses && successRate !== null ? `${successRate}%` : "—"}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {!hasPoses 
                  ? "Aucune pose enregistrée"
                  : successRate !== null && successRate >= 90 
                    ? "Aucune complication détectée" 
                    : successRate !== null && successRate >= 70 
                      ? "Quelques complications mineures" 
                      : "Attention requise"}
              </p>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Nombre de poses</span>
                <span className="text-xs font-medium">{implant.poseCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Actes chirurgicaux avec {isProthese ? "cette prothèse" : "cet implant"}
            </CardTitle>
            {selectedActs.length > 0 && canDelete && (
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
                      checked={surgeries && surgeries.length > 0 && selectedActs.length === surgeries.length}
                      onCheckedChange={(checked) => {
                        if (checked && surgeries) {
                          setSelectedActs(surgeries.map(s => s.id));
                        } else {
                          setSelectedActs([]);
                        }
                      }}
                      data-testid="checkbox-select-all" 
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type d'intervention</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Chirurgie</TableHead>
                  <TableHead>Greffe</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!surgeries || surgeries.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucun acte chirurgical avec cet implant
                    </TableCell>
                  </TableRow>
                ) : (
                  surgeries.map((surgery) => {
                    const status = statusConfig[surgery.statut] || { label: surgery.statut, variant: "secondary" as const };
                    const interventionType = surgery.surgery?.typeIntervention?.replace(/_/g, " ").toLowerCase() || "—";

                    return (
                      <TableRow 
                        key={surgery.id}
                        className={surgery.patient ? "cursor-pointer hover-elevate" : ""}
                        onClick={() => {
                          if (surgery.patient) {
                            setLocation(`/patients/${surgery.patient.id}/implants/${surgery.id}`);
                          }
                        }}
                        data-testid={`row-surgery-${surgery.id}`}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={selectedActs.includes(surgery.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedActs([...selectedActs, surgery.id]);
                              } else {
                                setSelectedActs(selectedActs.filter(id => id !== surgery.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-surgery-${surgery.id}`} 
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatShortDate(surgery.datePose)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(surgery.datePose).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {surgery.patient ? (
                            <div>
                              <p className="font-medium">{surgery.patient.prenom} {surgery.patient.nom}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                PAT-{surgery.patient.id.substring(0, 8).toUpperCase()}
                              </p>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium capitalize">{interventionType}</p>
                            {surgery.miseEnCharge && (
                              <p className="text-xs text-muted-foreground capitalize">
                                Mise en charge {surgery.miseEnCharge.toLowerCase()}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{surgery.siteFdi}</span>
                        </TableCell>
                        <TableCell>
                          {surgery.surgery?.typeChirurgieTemps ? (
                            <Badge variant="outline" className="text-primary">
                              {surgery.surgery.typeChirurgieTemps === "UN_TEMPS" ? "1 temps" : "2 temps"}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {surgery.greffeOsseuse ? (
                            <Badge variant="secondary">Oui</Badge>
                          ) : (
                            <span className="text-muted-foreground">Non</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
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
                  placeholder="Ajouter des notes..."
                  className="min-h-[120px]"
                  data-testid="textarea-notes"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateMutation.isPending} data-testid="button-save-notes">
                    {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm space-y-3">
                {implant.notes && (
                  <p>{implant.notes}</p>
                )}
                {implant.lastPoseDate ? (
                  <div className="text-muted-foreground">
                    <p className="text-xs mb-1">
                      Dernière pose: {formatDate(implant.lastPoseDate)}
                    </p>
                    <p className="text-xs">
                      Utilisé {implant.poseCount} fois
                      {successRate !== null && ` - Taux de réussite: ${successRate}%`}
                    </p>
                  </div>
                ) : !implant.notes ? (
                  <p className="text-muted-foreground italic">Aucune note pour le moment</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        </div>

      <AuditHistory
        entityType="CATALOG_IMPLANT"
        entityId={implantId || ""}
        title={isProthese ? "Historique de la prothèse" : "Historique de l'implant"}
        maxItems={5}
      />
    </div>
  );
}
