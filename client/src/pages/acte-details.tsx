import { useQuery } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import {
  ArrowLeft,
  Calendar,
  User,
  Stethoscope,
  FileImage,
  Activity,
  ClipboardList,
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
import type { OperationDetail } from "@shared/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
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

export default function ActeDetailsPage() {
  const [, params] = useRoute("/actes/:id");
  const acteId = params?.id;
  const [, setLocation] = useLocation();

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
          <p className="text-sm text-muted-foreground" data-testid="text-acte-date">
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
          </CardHeader>
          <CardContent>
            <Link href={`/patients/${operation.patient.id}`}>
              <div className="hover-elevate p-3 rounded-md -m-3 cursor-pointer">
                <p className="font-medium" data-testid="text-patient-name">
                  {operation.patient.prenom} {operation.patient.nom}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-patient-dob">
                  Né(e) le {formatDate(operation.patient.dateNaissance)}
                </p>
                {operation.patient.telephone && (
                  <p className="text-sm text-muted-foreground">
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
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="text-sm font-medium">
                {typeInterventionLabels[operation.typeIntervention] || operation.typeIntervention}
              </span>
            </div>
            {operation.typeChirurgieApproche && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Approche</span>
                <span className="text-sm">
                  {approchLabels[operation.typeChirurgieApproche] || operation.typeChirurgieApproche}
                </span>
              </div>
            )}
            {operation.typeChirurgieTemps && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Temps</span>
                <span className="text-sm">
                  {tempsLabels[operation.typeChirurgieTemps] || operation.typeChirurgieTemps}
                </span>
              </div>
            )}
            {operation.greffeOsseuse && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Greffe osseuse</span>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                  Oui
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Implants posés ({operation.surgeryImplants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operation.surgeryImplants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun implant posé lors de cette intervention
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>ISQ Pose</TableHead>
                  <TableHead>Statut</TableHead>
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
                      {si.isqPose ? (
                        <span className="font-medium">{si.isqPose}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {si.statut && statusConfig[si.statut] ? (
                        <Badge variant={statusConfig[si.statut].variant} className="text-xs">
                          {statusConfig[si.statut].label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

      {operation.radios.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Radiographies associées ({operation.radios.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {operation.radios.map((radio) => (
                <div
                  key={radio.id}
                  className="border rounded-md p-3 hover-elevate cursor-pointer"
                  data-testid={`card-radio-${radio.id}`}
                >
                  <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                    <FileImage className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium truncate">{radio.title || "Radio"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(radio.date)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
