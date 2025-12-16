import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Phone,
  Mail,
  User,
  Activity,
  FileImage,
  ClipboardList,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OperationForm } from "@/components/operation-form";
import { ImplantCard } from "@/components/implant-card";
import { RadioCard } from "@/components/radio-card";
import { PatientTimeline } from "@/components/patient-timeline";
import { RadioUploadForm } from "@/components/radio-upload-form";
import type { Patient, Operation, Implant, Radio, Visite } from "@shared/schema";

interface PatientWithDetails extends Patient {
  operations: (Operation & { implants: Implant[] })[];
  implants: (Implant & { visites: Visite[] })[];
  radios: Radio[];
}

export default function PatientDetailsPage() {
  const [, params] = useRoute("/patients/:id");
  const patientId = params?.id;
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [radioDialogOpen, setRadioDialogOpen] = useState(false);

  const { data: patient, isLoading } = useQuery<PatientWithDetails>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const calculateAge = (dateNaissance: string) => {
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateInput: string | Date) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getInterventionLabel = (type: string) => {
    const labels: Record<string, string> = {
      POSE_IMPLANT: "Pose d'implant",
      GREFFE_OSSEUSE: "Greffe osseuse",
      SINUS_LIFT: "Sinus lift",
      EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
      REPRISE_IMPLANT: "Reprise d'implant",
      CHIRURGIE_GUIDEE: "Chirurgie guidée",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Patient non trouvé</h3>
            <Link href="/patients">
              <Button variant="outline">Retour à la liste</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="icon" data-testid="button-back-to-patients">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-patient-name">
            {patient.prenom} {patient.nom}
          </h1>
          <p className="text-sm text-muted-foreground">
            Patient depuis {formatDate(patient.createdAt)}
          </p>
        </div>
        <Link href={`/patients/${patientId}/report`}>
          <Button variant="outline" data-testid="button-print-report">
            <Printer className="h-4 w-4 mr-2" />
            Rapport
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted text-muted-foreground font-semibold text-xl shrink-0">
              {patient.prenom[0]}{patient.nom[0]}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {patient.sexe === "HOMME" ? "Homme" : "Femme"} - {calculateAge(patient.dateNaissance)} ans
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {patient.implants?.length || 0} implant{(patient.implants?.length || 0) !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(patient.dateNaissance)}</span>
                </div>
                {patient.telephone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{patient.telephone}</span>
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{patient.email}</span>
                  </div>
                )}
              </div>
              {patient.contexteMedical && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Contexte médical
                  </p>
                  <p className="text-sm">{patient.contexteMedical}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Activity className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <ClipboardList className="h-4 w-4 mr-2" />
            Opérations
          </TabsTrigger>
          <TabsTrigger value="implants" data-testid="tab-implants">
            <Activity className="h-4 w-4 mr-2" />
            Implants
          </TabsTrigger>
          <TabsTrigger value="radios" data-testid="tab-radios">
            <FileImage className="h-4 w-4 mr-2" />
            Radios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <PatientTimeline patient={patient} />
        </TabsContent>

        <TabsContent value="operations" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-operation">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle opération
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle opération</DialogTitle>
                </DialogHeader>
                <OperationForm
                  patientId={patient.id}
                  onSuccess={() => setOperationDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {patient.operations?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune opération</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ajoutez la première opération pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {patient.operations?.map((operation) => (
                <Card key={operation.id} data-testid={`card-operation-${operation.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {getInterventionLabel(operation.typeIntervention)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(operation.dateOperation)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {operation.implants?.length || 0} implant{(operation.implants?.length || 0) !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {operation.typeChirurgieTemps && (
                        <div>
                          <span className="text-muted-foreground">Temps: </span>
                          {operation.typeChirurgieTemps === "UN_TEMPS" ? "1 temps" : "2 temps"}
                        </div>
                      )}
                      {operation.typeChirurgieApproche && (
                        <div>
                          <span className="text-muted-foreground">Approche: </span>
                          {operation.typeChirurgieApproche === "LAMBEAU" ? "Lambeau" : "Flapless"}
                        </div>
                      )}
                      {operation.typeMiseEnCharge && (
                        <div>
                          <span className="text-muted-foreground">Mise en charge: </span>
                          {operation.typeMiseEnCharge.charAt(0) + operation.typeMiseEnCharge.slice(1).toLowerCase()}
                        </div>
                      )}
                      {operation.greffeOsseuse && (
                        <div>
                          <span className="text-muted-foreground">Greffe: </span>
                          {operation.typeGreffe || "Oui"}
                        </div>
                      )}
                    </div>
                    {operation.notesPerop && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Notes per-op</p>
                        <p className="text-sm">{operation.notesPerop}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="implants" className="mt-4 space-y-4">
          {patient.implants?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun implant</h3>
                <p className="text-sm text-muted-foreground">
                  Les implants seront ajoutés lors de la création d'une opération
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patient.implants?.map((implant) => (
                <ImplantCard key={implant.id} implant={implant} patientId={patient.id} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="radios" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={radioDialogOpen} onOpenChange={setRadioDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-new-radio">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une radio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Ajouter une radiographie</DialogTitle>
                </DialogHeader>
                <RadioUploadForm
                  patientId={patient.id}
                  operations={patient.operations || []}
                  implants={patient.implants || []}
                  onSuccess={() => setRadioDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {patient.radios?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune radio</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ajoutez des radiographies pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {patient.radios?.map((radio) => (
                <RadioCard key={radio.id} radio={radio} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
