import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, User, Calendar, Shield } from "lucide-react";
import type { PublicPatientShareData } from "@shared/schema";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusBadge(statut: string | null | undefined) {
  switch (statut) {
    case "SUCCES":
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-[11px]">Succès</Badge>;
    case "COMPLICATION":
      return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-[11px]">Complication</Badge>;
    case "ECHEC":
      return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30 text-[11px]">Échec</Badge>;
    default:
      return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px]">En suivi</Badge>;
  }
}

function calculateAge(dateNaissance: string | null | undefined): string {
  if (!dateNaissance) return "";
  const birth = new Date(dateNaissance);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} ans`;
}

export default function PublicSharePage() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<PublicPatientShareData>({
    queryKey: ["/api/public/share", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/share/${token}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Lien invalide ou expiré");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col p-6">
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <Shield className="h-14 w-14 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold">Lien invalide ou expiré</h2>
              <p className="text-[13px] text-muted-foreground">
                Ce lien de partage n'est plus valide. Il a peut-être expiré ou été révoqué.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-8 text-center">
          <img src="/assets/logos/logo-cassius.png" alt="Cassius" className="h-6 mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground italic">
            Propulsé par <a href="https://cassiuspro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Cassius</a>
          </p>
        </div>
      </div>
    );
  }

  const { patient, implants, sharedByUserName, createdAt } = data;

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Données partagées par {sharedByUserName}</span>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg" data-testid="text-patient-name">
                    {patient.prenom} {patient.nom}
                  </CardTitle>
                  {patient.dateNaissance && (
                    <p className="text-[12px] text-muted-foreground flex items-center gap-2 mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Né(e) le {formatDate(patient.dateNaissance)} ({calculateAge(patient.dateNaissance)})
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Implants ({implants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {implants.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-[13px]">
                  Aucun implant enregistré pour ce patient.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {implants.map((implant) => (
                    <div
                      key={implant.id}
                      className="border rounded-md p-4 space-y-3"
                      data-testid={`card-implant-${implant.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[13px]">Site {implant.siteFdi}</span>
                        {getStatusBadge(implant.statut)}
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                        <div>
                          <span className="text-muted-foreground text-[10px]">Marque:</span>
                          <p>{implant.marque || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px]">Dimensions:</span>
                          <p>
                            {implant.diametre && implant.longueur
                              ? `${implant.diametre} x ${implant.longueur}mm`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px]">Date de pose:</span>
                          <p>{formatDate(implant.datePose)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px]">Position:</span>
                          <p>{implant.position || "-"}</p>
                        </div>
                      </div>
                      <div className="border-t pt-3">
                        <span className="text-muted-foreground text-[10px]">Mesures ISQ:</span>
                        <div className="flex gap-4 mt-1 text-[12px]">
                          <div>
                            <span className="text-muted-foreground">Pose:</span>{" "}
                            <span className="font-medium">{implant.isqPose ?? "-"}</span>
                          </div>
                          {implant.isq2m != null && (
                            <div>
                              <span className="text-muted-foreground">2m:</span>{" "}
                              <span className="font-medium">{implant.isq2m}</span>
                            </div>
                          )}
                          {implant.isq3m != null && (
                            <div>
                              <span className="text-muted-foreground">3m:</span>{" "}
                              <span className="font-medium">{implant.isq3m}</span>
                            </div>
                          )}
                          {implant.isq6m != null && (
                            <div>
                              <span className="text-muted-foreground">6m:</span>{" "}
                              <span className="font-medium">{implant.isq6m}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-[11px] text-center text-muted-foreground">
            Lien partagé le {formatDate(createdAt)}. Ces données sont en lecture seule.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <img src="/assets/logos/logo-cassius.png" alt="Cassius" className="h-6 mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground italic">
          Propulsé par <a href="https://cassiuspro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Cassius</a>
        </p>
      </div>
    </div>
  );
}
