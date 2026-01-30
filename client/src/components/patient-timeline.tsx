import { Activity, Calendar, CalendarClock, FileImage, ClipboardList, Stethoscope, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Patient, Operation, Implant, Radio, Visite, SurgeryImplantWithDetails, OperationWithImplants, RendezVous } from "@shared/schema";

interface RadioWithSignedUrl extends Radio {
  signedUrl?: string | null;
}

interface SurgeryImplantWithVisites extends SurgeryImplantWithDetails {
  visites?: Visite[];
}

interface PatientWithDetails extends Patient {
  operations: OperationWithImplants[];
  surgeryImplants: SurgeryImplantWithVisites[];
  radios: RadioWithSignedUrl[];
  upcomingAppointments?: RendezVous[];
}

interface TimelineEvent {
  id: string;
  date: string;
  type: "operation" | "implant" | "radio" | "visite" | "rendezvous";
  title: string;
  description?: string;
  metadata?: Record<string, string | number>;
  radioData?: RadioWithSignedUrl;
  isFuture?: boolean;
  time?: string;
}

interface PatientTimelineProps {
  patient: PatientWithDetails;
  onViewRadio?: (radio: RadioWithSignedUrl) => void;
}

const typeIcons = {
  operation: ClipboardList,
  implant: Activity,
  radio: FileImage,
  visite: Stethoscope,
  rendezvous: CalendarClock,
};

const typeLabels = {
  operation: "Opération",
  implant: "Implant",
  radio: "Radio",
  visite: "Visite",
  rendezvous: "Rendez-vous",
};

const interventionLabels: Record<string, string> = {
  POSE_IMPLANT: "Pose d'implant",
  GREFFE_OSSEUSE: "Greffe osseuse",
  SINUS_LIFT: "Sinus lift",
  EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
  REPRISE_IMPLANT: "Reprise d'implant",
  CHIRURGIE_GUIDEE: "Chirurgie guidée",
  POSE_PROTHESE: "Pose de prothèse",
};

const radioLabels: Record<string, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Rétro-alvéolaire",
};

export function PatientTimeline({ patient, onViewRadio }: PatientTimelineProps) {
  const events: TimelineEvent[] = [];

  patient.operations?.forEach((op) => {
    events.push({
      id: `op-${op.id}`,
      date: op.dateOperation,
      type: "operation",
      title: interventionLabels[op.typeIntervention] || op.typeIntervention,
      description: op.notesPerop || undefined,
      metadata: {
        implants: op.surgeryImplants?.length || 0,
      },
    });
  });

  patient.surgeryImplants?.forEach((surgeryImp) => {
    events.push({
      id: `imp-${surgeryImp.id}`,
      date: surgeryImp.datePose,
      type: "implant",
      title: `Implant ${surgeryImp.siteFdi}`,
      description: `${surgeryImp.implant.marque} - ${surgeryImp.implant.diametre}mm x ${surgeryImp.implant.longueur}mm`,
      metadata: surgeryImp.isqPose ? { isq: surgeryImp.isqPose } : undefined,
    });

    surgeryImp.visites?.forEach((visite) => {
      events.push({
        id: `visite-${visite.id}`,
        date: visite.date,
        type: "visite",
        title: `Contrôle implant ${surgeryImp.siteFdi}`,
        description: visite.notes || undefined,
        metadata: visite.isq ? { isq: visite.isq } : undefined,
      });
    });
  });

  patient.radios?.forEach((radio) => {
    events.push({
      id: `radio-${radio.id}`,
      date: radio.date,
      type: "radio",
      title: radio.title || radioLabels[radio.type] || radio.type,
      radioData: radio,
    });
  });

  patient.upcomingAppointments?.forEach((rdv) => {
    events.push({
      id: `rdv-${rdv.id}`,
      date: rdv.date,
      type: "rendezvous",
      title: rdv.titre || "Rendez-vous",
      description: rdv.description || undefined,
      isFuture: true,
      time: rdv.heureDebut,
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const groupedEvents: Record<string, TimelineEvent[]> = {};
  events.forEach((event) => {
    const monthYear = new Date(event.date).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    if (!groupedEvents[monthYear]) {
      groupedEvents[monthYear] = [];
    }
    groupedEvents[monthYear].push(event);
  });

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Aucun événement</h3>
          <p className="text-sm text-muted-foreground">
            L'historique du patient apparaîtra ici
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
        <div key={monthYear}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {monthYear}
          </h3>
          <div className="space-y-3">
            {monthEvents.map((event) => {
              const Icon = typeIcons[event.type];
              return (
                <Card key={event.id} data-testid={`timeline-event-${event.id}`} className={event.isFuture ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${event.isFuture ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${event.isFuture ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{event.title}</h4>
                          <Badge variant={event.isFuture ? "default" : "outline"} className="text-xs">
                            {typeLabels[event.type]}
                          </Badge>
                          {event.isFuture && (
                            <Badge variant="secondary" className="text-xs">
                              À venir
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(event.date)}{event.time && ` à ${event.time}`}
                        </p>
                        {event.description && (
                          <p className="text-sm mt-2 line-clamp-2">{event.description}</p>
                        )}
                        {event.metadata && (
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            {event.metadata.implants !== undefined && (
                              <span className="text-muted-foreground">
                                {event.metadata.implants} implant
                                {Number(event.metadata.implants) !== 1 ? "s" : ""}
                              </span>
                            )}
                            {event.metadata.isq !== undefined && (
                              <span className="font-mono">
                                ISQ: {event.metadata.isq}
                              </span>
                            )}
                          </div>
                        )}
                        {event.type === "radio" && event.radioData && onViewRadio && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 gap-2"
                            onClick={() => onViewRadio(event.radioData!)}
                            data-testid={`button-view-radio-${event.radioData.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            Voir l'image
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
