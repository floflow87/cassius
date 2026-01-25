import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ArrowLeft,
  Calendar,
  User,
  Stethoscope,
  FileImage,
  Activity,
  ClipboardList,
  Pencil,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioUploadForm } from "@/components/radio-upload-form";
import { RadioCard } from "@/components/radio-card";
import { OperationEditForm } from "@/components/operation-edit-form";
import { SurgeryImplantEditSheet } from "@/components/surgery-implant-edit-sheet";
import { SurgeryImplantAddSheet } from "@/components/surgery-implant-add-sheet";
import { SurgeryTimeline } from "@/components/surgery-timeline";
import type { OperationDetail, SurgeryImplantWithDetails } from "@shared/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "echec" | "complication" | "ensuivi" | "success" }> = {
  EN_SUIVI: { label: "En suivi", variant: "ensuivi" },
  SUCCES: { label: "Succès", variant: "success" },
  COMPLICATION: { label: "Complication", variant: "complication" },
  ECHEC: { label: "Échec", variant: "echec" },
};

const typeInterventionLabels: Record<string, string> = {
  POSE_IMPLANT: "Pose d'implant",
  GREFFE_OSSEUSE: "Greffe osseuse",
  SINUS_LIFT: "Sinus lift",
  EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + implant immédiat",
  REPRISE_IMPLANT: "Reprise d'implant",
  CHIRURGIE_GUIDEE: "Chirurgie guidée",
};

const approchLabels: Record<string, string> = {
  LAMBEAU: "Lambeau",
  FLAPLESS: "Flapless",
};

const tempsLabels: Record<string, string> = {
  UN_TEMPS: "Un temps",
  DEUX_TEMPS: "Deux temps",
};

const miseEnChargeLabels: Record<string, string> = {
  IMMEDIATE: "Immédiate",
  PRECOCE: "Précoce",
  DIFFEREE: "Différée",
};

export default function ActeDetailsPage() {
  const [, params] = useRoute("/actes/:id");
  const acteId = params?.id;
  const [, setLocation] = useLocation();
  
  const [radioDialogOpen, setRadioDialogOpen] = useState(false);
  const [editInterventionOpen, setEditInterventionOpen] = useState(false);
  const [addImplantOpen, setAddImplantOpen] = useState(false);
  const [editingImplant, setEditingImplant] = useState<SurgeryImplantWithDetails | null>(null);

  const { data: operation, isLoading } = useQuery<OperationDetail>({
    queryKey: ["/api/operations", acteId],
    enabled: !!acteId,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Acte non trouvé</h3>
            <Link href="/actes">
              <Button variant="outline">Retour aux actes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/actes")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-acte-title">
            {typeInterventionLabels[operation.typeIntervention] || operation.typeIntervention}
          </h1>
          <p className="text-xs text-muted-foreground" data-testid="text-acte-date">
            {formatDate(operation.dateOperation)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Patient
            </CardTitle>
            <Link href={`/patients/${operation.patient.id}`}>
              <Button
                variant="ghost"
                size="icon"
                data-testid="link-patient-profile"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Link href={`/patients/${operation.patient.id}`}>
              <div className="hover-elevate p-3 rounded-md -m-3 cursor-pointer">
                <p className="font-medium text-xs" data-testid="text-patient-name">
                  {operation.patient.prenom} {operation.patient.nom}
                </p>
                <p className="text-[10px] text-muted-foreground" data-testid="text-patient-dob">
                  Né(e) le {formatDate(operation.patient.dateNaissance)}
                </p>
                {operation.patient.telephone && (
                  <p className="text-[10px] text-muted-foreground">
                    {operation.patient.telephone}
                  </p>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Détails de l'intervention
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditInterventionOpen(true)}
              data-testid="button-edit-intervention"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <Badge className="text-[10px] rounded-full bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                {typeInterventionLabels[operation.typeIntervention] || operation.typeIntervention}
              </Badge>
            </div>
            {operation.typeChirurgieApproche && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Approche</span>
                <span className="text-xs">
                  {approchLabels[operation.typeChirurgieApproche] || operation.typeChirurgieApproche}
                </span>
              </div>
            )}
            {operation.typeChirurgieTemps && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Temps</span>
                <span className="text-xs">
                  {tempsLabels[operation.typeChirurgieTemps] || operation.typeChirurgieTemps}
                </span>
              </div>
            )}
            {operation.typeMiseEnCharge && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mise en charge</span>
                <span className="text-xs">
                  {miseEnChargeLabels[operation.typeMiseEnCharge] || operation.typeMiseEnCharge}
                </span>
              </div>
            )}
            {operation.greffeOsseuse && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Greffe osseuse</span>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                  Oui
                </Badge>
              </div>
            )}
            {operation.typeGreffe && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Type de greffe</span>
                <span className="text-xs">{operation.typeGreffe}</span>
              </div>
            )}
            {operation.greffeQuantite && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quantité greffe</span>
                <span className="text-xs">{operation.greffeQuantite}</span>
              </div>
            )}
            {operation.greffeLocalisation && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Localisation greffe</span>
                <span className="text-xs">{operation.greffeLocalisation}</span>
              </div>
            )}
            {operation.conditionsMedicalesPreop && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Conditions préopératoires</span>
                <p className="text-xs mt-1">{operation.conditionsMedicalesPreop}</p>
              </div>
            )}
            {operation.notesPerop && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Notes peropératoires</span>
                <p className="text-xs mt-1">{operation.notesPerop}</p>
              </div>
            )}
            {operation.observationsPostop && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Observations postopératoires</span>
                <p className="text-xs mt-1">{operation.observationsPostop}</p>
              </div>
            )}
            {(() => {
              const implantsWithProthese = operation.surgeryImplants.filter(si => si.implant.typeProthese);
              const hasProthese = implantsWithProthese.length > 0;
              return (
                <>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Prothèse supra-implantaire</span>
                    {hasProthese ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                        {implantsWithProthese.length} implant{implantsWithProthese.length > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non configurée</span>
                    )}
                  </div>
                  {hasProthese && implantsWithProthese.map((si) => (
                    <div key={si.id} className="pl-4 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Site {si.siteFdi}</span>
                        <span>{si.implant.typeProthese === "VISSEE" ? "Vissée" : "Scellée"}</span>
                      </div>
                      {si.implant.quantite && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Quantité</span>
                          <span>{si.implant.quantite === "UNITAIRE" ? "Unitaire" : "Plurale"}</span>
                        </div>
                      )}
                      {si.implant.mobilite && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mobilité</span>
                          <span>{si.implant.mobilite === "FIXE" ? "Fixe" : "Amovible"}</span>
                        </div>
                      )}
                      {si.implant.typePilier && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Type de pilier</span>
                          <span>{si.implant.typePilier.replace(/_/g, " ")}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Implants posés ({operation.surgeryImplants.length})
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setAddImplantOpen(true)}
            data-testid="button-add-implant"
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un implant
          </Button>
        </CardHeader>
        <CardContent>
          {operation.surgeryImplants.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucun implant posé lors de cette intervention
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Type Os</TableHead>
                  <TableHead>Mise en charge</TableHead>
                  <TableHead>ISQ Pose</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operation.surgeryImplants.map((si) => (
                  <TableRow
                    key={si.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setLocation(`/patients/${operation.patient.id}/implants/${si.id}`)}
                    data-testid={`row-implant-${si.id}`}
                  >
                    <TableCell className="font-medium">{si.siteFdi}</TableCell>
                    <TableCell>
                      {si.implant.marque}
                      {si.implant.referenceFabricant && (
                        <span className="text-muted-foreground ml-1">({si.implant.referenceFabricant})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {si.implant.diametre}mm x {si.implant.longueur}mm
                    </TableCell>
                    <TableCell>
                      {si.typeOs ? (
                        <span className="text-xs">{si.typeOs}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {si.miseEnCharge ? (
                        <span className="text-xs">{miseEnChargeLabels[si.miseEnCharge] || si.miseEnCharge}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {si.isqPose ? (
                        <span className="font-medium">{si.isqPose}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {si.statut && statusConfig[si.statut] ? (
                        <Badge variant={statusConfig[si.statut].variant} className="text-[10px]">
                          {statusConfig[si.statut].label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingImplant(si);
                        }}
                        data-testid={`button-edit-implant-${si.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {operation.visites && operation.visites.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Visites de suivi ({operation.visites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>ISQ</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operation.visites.map((visite) => (
                  <TableRow key={visite.id} data-testid={`row-visite-${visite.id}`}>
                    <TableCell className="font-medium">{formatDate(visite.date)}</TableCell>
                    <TableCell>
                      {visite.isq ? (
                        <span className="font-medium">{visite.isq}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {visite.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            Radiographies associées ({operation.radios.length})
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setRadioDialogOpen(true)}
            data-testid="button-add-radio"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle radio
          </Button>
        </CardHeader>
        <CardContent>
          {operation.radios.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucune radiographie associée à cette intervention
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {operation.radios.map((radio) => (
                <RadioCard
                  key={radio.id}
                  radio={radio}
                  patientId={operation.patient.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-timeline">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Historique
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SurgeryTimeline operationId={operation.id} patientId={operation.patient.id} />
        </CardContent>
      </Card>

      <Dialog open={radioDialogOpen} onOpenChange={setRadioDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle radiographie</DialogTitle>
          </DialogHeader>
          <RadioUploadForm
            patientId={operation.patient.id}
            operations={[operation]}
            surgeryImplants={operation.surgeryImplants}
            defaultOperationId={operation.id}
            onSuccess={() => setRadioDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={editInterventionOpen} onOpenChange={setEditInterventionOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l'intervention</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <OperationEditForm
              operation={operation}
              onSuccess={() => setEditInterventionOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <SurgeryImplantEditSheet
        surgeryImplant={editingImplant}
        open={!!editingImplant}
        onOpenChange={(open) => !open && setEditingImplant(null)}
        onSuccess={() => setEditingImplant(null)}
      />

      <SurgeryImplantAddSheet
        operationId={operation.id}
        operationDate={operation.dateOperation}
        open={addImplantOpen}
        onOpenChange={setAddImplantOpen}
        onSuccess={() => setAddImplantOpen(false)}
      />
    </div>
  );
}
