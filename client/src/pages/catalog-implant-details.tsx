import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import {
  ArrowLeft,
  Activity,
  Pencil,
  CheckCircle2,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import type { ImplantWithStats, SurgeryImplantWithDetails } from "@shared/schema";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

export default function CatalogImplantDetailsPage() {
  const [, params] = useRoute("/implants/:id");
  const implantId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [selectedActs, setSelectedActs] = useState<string[]>([]);
  const [newActSheetOpen, setNewActSheetOpen] = useState(false);

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
  const implantType = implant.typeImplant === "MINI_IMPLANT" ? "Mini-implant" : "Implant";
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
          <p className="text-sm text-muted-foreground">
            Ø {implant.diametre}mm × {implant.longueur}mm
          </p>
        </div>
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
                    <Input defaultValue={implant.marque} data-testid="input-edit-marque" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select defaultValue={implant.typeImplant || "IMPLANT"}>
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
                    <Input defaultValue={implant.referenceFabricant || ""} data-testid="input-edit-reference" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Diamètre (mm)</Label>
                      <Input type="number" step="0.1" defaultValue={implant.diametre} data-testid="input-edit-diametre" />
                    </div>
                    <div className="space-y-2">
                      <Label>Longueur (mm)</Label>
                      <Input type="number" step="0.5" defaultValue={implant.longueur} data-testid="input-edit-longueur" />
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
                <p className="font-medium" data-testid="text-implant-marque">{implant.marque}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <p className="font-medium" data-testid="text-implant-type">
                  {implant.typeImplant === "MINI_IMPLANT" ? "Mini-implant" : "Implant"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Référence fabricant</span>
                <p className="font-medium font-mono" data-testid="text-implant-reference">
                  {implant.referenceFabricant || "—"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Diamètre</span>
                <p className="font-medium font-mono" data-testid="text-implant-diametre">{implant.diametre} mm</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Longueur</span>
                <p className="font-medium font-mono" data-testid="text-implant-longueur">{implant.longueur} mm</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Numéro de lot</span>
                <p className="font-medium font-mono">{implant.lot || "—"}</p>
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
              <p className="text-sm text-muted-foreground mt-1">
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
                <span className="text-sm text-muted-foreground">Nombre de poses</span>
                <span className="text-sm font-medium">{implant.poseCount || 0}</span>
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
              Actes chirurgicaux avec cet implant
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedActs.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Suppression",
                      description: `${selectedActs.length} acte(s) sélectionné(s) pour suppression`,
                    });
                    setSelectedActs([]);
                  }}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer ({selectedActs.length})
                </Button>
              )}
              <Sheet open={newActSheetOpen} onOpenChange={setNewActSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" data-testid="button-new-act">
                    <Plus className="h-4 w-4 mr-1" />
                    Nouvel acte
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Nouvel acte chirurgical</SheetTitle>
                  </SheetHeader>
                  <div className="py-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Date de l'intervention</Label>
                      <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} data-testid="input-act-date" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type d'intervention</Label>
                      <Select defaultValue="POSE_IMPLANT">
                        <SelectTrigger data-testid="select-act-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POSE_IMPLANT">Pose d'implant</SelectItem>
                          <SelectItem value="GREFFE_OSSEUSE">Greffe osseuse</SelectItem>
                          <SelectItem value="SINUS_LIFT">Sinus lift</SelectItem>
                          <SelectItem value="REPRISE_IMPLANT">Reprise d'implant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Site (notation FDI)</Label>
                      <Input placeholder="Ex: 36" data-testid="input-act-site" />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea placeholder="Notes sur l'intervention..." data-testid="input-act-notes" />
                    </div>
                    <div className="pt-4">
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          setNewActSheetOpen(false);
                          toast({
                            title: "Acte créé",
                            description: "L'acte chirurgical a été créé avec succès",
                          });
                        }}
                        data-testid="button-create-act"
                      >
                        Créer l'acte
                      </Button>
                    </div>
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
                  <Button size="sm" onClick={() => setEditingNotes(false)} data-testid="button-save-notes">
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {implant.lastPoseDate ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Dernière pose: {formatDate(implant.lastPoseDate)}
                    </p>
                    <p>
                      Cet implant a été utilisé {implant.poseCount} fois
                      {successRate !== null && ` avec un taux de réussite de ${successRate}%`}.
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Aucune note pour le moment</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
