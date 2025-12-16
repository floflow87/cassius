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
  Pencil,
  AlertTriangle,
  Pill,
  Heart,
  CheckCircle,
  Image as ImageIcon,
  Stethoscope,
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
  const [activeTab, setActiveTab] = useState("overview");

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

  const formatDateShort = (dateInput: string | Date) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
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

  const getStatusBadge = (statut: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      SUCCES: { label: "Succès", variant: "default" },
      EN_SUIVI: { label: "En suivi", variant: "secondary" },
      COMPLICATION: { label: "Complication", variant: "outline" },
      ECHEC: { label: "Echec", variant: "destructive" },
    };
    const config = statusConfig[statut] || statusConfig.EN_SUIVI;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRadioLabel = (type: string) => {
    const labels: Record<string, string> = {
      PANORAMIQUE: "Radiographie panoramique",
      CBCT: "CBCT",
      RETROALVEOLAIRE: "Rétro-alvéolaire",
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

  const implantCount = patient.implants?.length || 0;
  const operationCount = patient.operations?.length || 0;
  const radioCount = patient.radios?.length || 0;
  const visiteCount = patient.implants?.reduce((acc, imp) => acc + (imp.visites?.length || 0), 0) || 0;

  const sortedOperations = [...(patient.operations || [])].sort(
    (a, b) => new Date(b.dateOperation).getTime() - new Date(a.dateOperation).getTime()
  );

  interface TimelineEvent {
    id: string;
    date: Date;
    type: "operation" | "radio" | "visite";
    title: string;
    description?: string;
    badges?: string[];
  }

  const timelineEvents: TimelineEvent[] = [];

  sortedOperations.forEach((op) => {
    timelineEvents.push({
      id: `op-${op.id}`,
      date: new Date(op.dateOperation),
      type: "operation",
      title: getInterventionLabel(op.typeIntervention),
      description: op.notesPerop || `${op.implants?.length || 0} implant(s)`,
      badges: op.implants?.slice(0, 3).map(imp => `Site ${imp.siteFdi}`),
    });
  });

  patient.radios?.forEach((radio) => {
    timelineEvents.push({
      id: `radio-${radio.id}`,
      date: new Date(radio.date),
      type: "radio",
      title: getRadioLabel(radio.type),
      description: "Voir l'image",
    });
  });

  patient.implants?.forEach((imp) => {
    imp.visites?.forEach((visite) => {
      timelineEvents.push({
        id: `visite-${visite.id}`,
        date: new Date(visite.date),
        type: "visite",
        title: "Visite de contrôle",
        description: visite.notes || `ISQ: ${visite.isq || "-"}`,
        badges: visite.isq ? [`ISQ: ${visite.isq}`] : undefined,
      });
    });
  });

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const oldestOperationYear = sortedOperations.length > 0
    ? new Date(sortedOperations[sortedOperations.length - 1].dateOperation).getFullYear()
    : null;

  const successRate = implantCount > 0 
    ? Math.round((patient.implants?.filter(i => i.statut === "SUCCES").length || 0) / implantCount * 100)
    : 0;

  return (
    <div className="p-6 space-y-4 bg-white dark:bg-gray-950 min-h-full">
      <div className="flex items-center gap-4 pb-2">
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
            {calculateAge(patient.dateNaissance)} ans - Depuis {new Date(patient.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger value="overview" className="text-sm" data-testid="tab-overview">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="implants" className="text-sm" data-testid="tab-implants">
            Implants ({implantCount})
          </TabsTrigger>
          <TabsTrigger value="operations" className="text-sm" data-testid="tab-operations">
            Actes chirurgicaux
          </TabsTrigger>
          <TabsTrigger value="radios" className="text-sm" data-testid="tab-radios">
            Radiographies
          </TabsTrigger>
          <TabsTrigger value="visits" className="text-sm" data-testid="tab-visits">
            Suivi & Visites
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-sm" data-testid="tab-notes">
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Informations patient</CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Nom complet</span>
                    <p className="font-medium">{patient.prenom} {patient.nom}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Date de naissance</span>
                    <p>{formatDate(patient.dateNaissance)} ({calculateAge(patient.dateNaissance)} ans)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Sexe</span>
                    <p>{patient.sexe === "HOMME" ? "Homme" : "Femme"}</p>
                  </div>
                  {patient.telephone && (
                    <div>
                      <span className="text-muted-foreground text-xs">Téléphone</span>
                      <p>{patient.telephone}</p>
                    </div>
                  )}
                  {patient.email && (
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p>{patient.email}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-xs">Patient depuis</span>
                    <p>{formatDate(patient.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Contexte médical</CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-red-50 dark:bg-red-950">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Allergies</p>
                      <p className="text-xs text-muted-foreground">Aucune connue</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950">
                      <Pill className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Médicaments</p>
                      <p className="text-xs text-muted-foreground">Aucun traitement en cours</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-950">
                      <Heart className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Conditions</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.contexteMedical || "Aucune condition signalée"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-add-implant">
                        <Activity className="h-4 w-4 text-primary" />
                        Ajouter un implant
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
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Enregistrer un acte
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    Planifier une visite
                  </Button>
                  <Dialog open={radioDialogOpen} onOpenChange={setRadioDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-add-radio">
                        <FileImage className="h-4 w-4 text-primary" />
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
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs">Implants</span>
                    </div>
                    <p className="text-2xl font-semibold">{implantCount}</p>
                    <p className="text-xs text-primary">{successRate}% réussite</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <ClipboardList className="h-4 w-4" />
                      <span className="text-xs">Actes</span>
                    </div>
                    <p className="text-2xl font-semibold">{operationCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {oldestOperationYear ? `Depuis ${oldestOperationYear}` : "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Stethoscope className="h-4 w-4" />
                      <span className="text-xs">Visites</span>
                    </div>
                    <p className="text-2xl font-semibold">{visiteCount}</p>
                    <p className="text-xs text-muted-foreground">Suivi régulier</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-xs">Radios</span>
                    </div>
                    <p className="text-2xl font-semibold">{radioCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.radios?.filter(r => r.type === "PANORAMIQUE").length || 0} panoramiques
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Timeline clinique</CardTitle>
                    <Button 
                      variant="ghost" 
                      className="text-primary text-sm p-0 h-auto"
                      onClick={() => setActiveTab("operations")}
                    >
                      Voir tout
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {timelineEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Aucun événement enregistré
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {timelineEvents.slice(0, 4).map((event, index) => {
                        const getEventIcon = () => {
                          switch (event.type) {
                            case "operation":
                              return <Activity className="h-4 w-4 text-primary" />;
                            case "radio":
                              return <ImageIcon className="h-4 w-4 text-primary" />;
                            case "visite":
                              return <Stethoscope className="h-4 w-4 text-primary" />;
                          }
                        };
                        return (
                          <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="p-2 rounded-full bg-primary/10">
                                {getEventIcon()}
                              </div>
                              {index < Math.min(timelineEvents.length - 1, 3) && (
                                <div className="flex-1 w-px bg-border mt-2" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm">{event.title}</p>
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {event.description}
                                    </p>
                                  )}
                                  {event.badges && event.badges.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      {event.badges.map((badge, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {badge}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateShort(event.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Implants posés</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        className="text-primary text-sm p-0 h-auto"
                        onClick={() => setActiveTab("implants")}
                      >
                        Voir détails
                      </Button>
                      <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-new-act">
                            <Plus className="h-4 w-4 mr-1" />
                            Nouvel acte
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
                  </div>
                </CardHeader>
                <CardContent>
                  {implantCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Aucun implant posé
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patient.implants?.slice(0, 4).map((implant) => (
                        <div key={implant.id} className="border rounded-md p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium">Site {implant.siteFdi}</span>
                            {getStatusBadge(implant.statut)}
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Marque:</span>
                              <p>{implant.marque}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Dimensions:</span>
                              <p>{implant.diametre} x {implant.longueur}mm</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Date pose:</span>
                              <p>{formatDateShort(implant.datePose)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">ISQ actuel:</span>
                              <p className="text-primary font-medium">
                                {implant.isq6m || implant.isq3m || implant.isq2m || implant.isqPose || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="implants" className="mt-4 space-y-4">
          {implantCount === 0 ? (
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

          {operationCount === 0 ? (
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

          {radioCount === 0 ? (
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

        <TabsContent value="visits" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Suivi & Visites</h3>
              <p className="text-sm text-muted-foreground">
                Les visites de suivi apparaîtront ici
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">
                Aucune note pour ce patient
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
