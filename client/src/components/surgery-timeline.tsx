import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Calendar, FileImage, Stethoscope, ClipboardList, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperationTimeline, TimelineEvent } from "@shared/types";

interface SurgeryTimelineProps {
  operationId: string;
  patientId: string;
}

const typeIcons = {
  SURGERY: ClipboardList,
  VISIT: Stethoscope,
  ISQ: Activity,
  RADIO: FileImage,
};

const typeLabels = {
  SURGERY: "Chirurgie",
  VISIT: "Visite",
  ISQ: "Mesure ISQ",
  RADIO: "Radio",
};

const stabilityConfig = {
  low: { label: "Faible", variant: "destructive" as const },
  moderate: { label: "Modérée", variant: "secondary" as const },
  high: { label: "Élevée", variant: "default" as const },
};

export function SurgeryTimeline({ operationId, patientId }: SurgeryTimelineProps) {
  const { data: timeline, isLoading } = useQuery<OperationTimeline>({
    queryKey: ["/api/operations", operationId, "timeline"],
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!timeline || timeline.events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-base font-medium mb-2">Aucun événement</h3>
          <p className="text-xs text-muted-foreground">
            L'historique de cet acte apparaîtra ici
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedEvents: Record<string, TimelineEvent[]> = {};
  timeline.events.forEach((event) => {
    const monthYear = new Date(event.at).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    if (!groupedEvents[monthYear]) {
      groupedEvents[monthYear] = [];
    }
    groupedEvents[monthYear].push(event);
  });

  const renderDelta = (delta: number | undefined) => {
    if (delta === undefined) return null;
    
    if (delta > 0) {
      return (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-mono text-xs">
          <TrendingUp className="h-3 w-3" />
          +{delta}
        </span>
      );
    } else if (delta < 0) {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-mono text-xs">
          <TrendingDown className="h-3 w-3" />
          {delta}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
        <Minus className="h-3 w-3" />
        0
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
        <div key={monthYear}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {monthYear}
          </h3>
          <div className="space-y-3">
            {monthEvents.map((event, index) => {
              const Icon = typeIcons[event.type];
              const isFuture = event.status === "upcoming";
              
              return (
                <Card 
                  key={`${event.type}-${event.at}-${index}`} 
                  data-testid={`timeline-event-${event.type.toLowerCase()}-${index}`}
                  className={isFuture ? "border-primary/30 bg-primary/5" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isFuture ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${isFuture ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-xs">{event.title}</h4>
                          <Badge variant={isFuture ? "default" : "outline"} className="text-[10px]">
                            {typeLabels[event.type]}
                          </Badge>
                          {isFuture && (
                            <Badge variant="secondary" className="text-[10px]">
                              À venir
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(event.at)}
                        </p>
                        
                        {event.description && (
                          <p className="text-xs mt-2 line-clamp-2">{event.description}</p>
                        )}
                        
                        {(event.type === "ISQ" || event.type === "VISIT") && (
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {event.siteFdi && (
                              <span className="text-xs text-muted-foreground">
                                Site {event.siteFdi}
                              </span>
                            )}
                            {event.value !== undefined ? (
                              <>
                                <span className="font-mono font-medium text-xs">
                                  ISQ: {event.value}
                                </span>
                                {event.stability && (
                                  <Badge 
                                    variant={stabilityConfig[event.stability].variant}
                                    className="text-[10px]"
                                  >
                                    {stabilityConfig[event.stability].label}
                                  </Badge>
                                )}
                                {event.delta !== undefined && renderDelta(event.delta)}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Pas de mesure ISQ
                              </span>
                            )}
                          </div>
                        )}
                        
                        {event.implantLabel && event.type !== "ISQ" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Implant: {event.implantLabel}
                          </p>
                        )}
                        
                        {event.surgeryImplantId && patientId && (
                          <Link href={`/patients/${patientId}/implants/${event.surgeryImplantId}`}>
                            <span 
                              className="text-xs text-primary hover:underline cursor-pointer mt-1 inline-block"
                              data-testid={`link-implant-${event.surgeryImplantId}`}
                            >
                              Voir l'implant
                            </span>
                          </Link>
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
