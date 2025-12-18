import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Pencil, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImplantWithStats, SurgeryImplantWithDetails } from "@shared/schema";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

const chirurgieTempsConfig: Record<string, { label: string; className: string }> = {
  UN_TEMPS: { label: "1 temps", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  DEUX_TEMPS: { label: "2 temps", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const greffeConfig: Record<string, { label: string; className: string }> = {
  autogene: { label: "Autogène", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  allogene: { label: "Allogène", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  xenogene: { label: "Xénogène", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default function CatalogImplantDetailsPage() {
  const [, params] = useRoute("/implants/:id");
  const implantId = params?.id;
  const [, setLocation] = useLocation();

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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!implant) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Implant non trouvé</h3>
          <Button variant="outline" onClick={() => setLocation("/implants")}>
            Retour aux implants
          </Button>
        </div>
      </div>
    );
  }

  const hasPoses = (implant.poseCount ?? 0) > 0;
  const successRate = implant.successRate ?? null;
  const successRateColor = successRate === null ? "text-muted-foreground" 
    : successRate >= 90 ? "text-emerald-500" 
    : successRate >= 70 ? "text-amber-500" 
    : "text-red-500";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/implants")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-implant-title">
            Implant {implant.marque} {implant.referenceFabricant || ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ø {implant.diametre}mm × {implant.longueur}mm
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base">Informations de l'implant</CardTitle>
              <Button variant="ghost" size="icon" data-testid="button-edit-implant">
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Marque</p>
                  <p className="font-medium">{implant.marque}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{implant.typeImplant === "MINI_IMPLANT" ? "Mini-implant" : "Implant"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Référence fabricant</p>
                  <p className="font-medium">{implant.referenceFabricant || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Diamètre</p>
                  <p className="font-medium">{implant.diametre} mm</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Longueur</p>
                  <p className="font-medium">{implant.longueur} mm</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numéro de lot</p>
                  <p className="font-medium">{implant.lot || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-base font-semibold">Actes chirurgicaux avec cet implant</h2>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-10 px-3 py-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Patient</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Type d'intervention</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Site</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Chirurgie</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Greffe</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Statut</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!surgeries || surgeries.length === 0) ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                          Aucun acte chirurgical avec cet implant
                        </td>
                      </tr>
                    ) : (
                      surgeries.map((surgery) => {
                        const status = statusConfig[surgery.statut] || { label: surgery.statut, variant: "secondary" as const };
                        const chirurgieTemps = surgery.typeChirurgieTemps ? chirurgieTempsConfig[surgery.typeChirurgieTemps] : null;
                        const greffeType = surgery.typeGreffe?.toLowerCase();
                        const greffe = greffeType && greffeConfig[greffeType] ? greffeConfig[greffeType] : null;
                        const interventionType = surgery.surgery?.typeIntervention?.replace(/_/g, " ").toLowerCase() || "—";

                        return (
                          <tr 
                            key={surgery.id} 
                            className={`border-b hover-elevate ${surgery.patient ? "cursor-pointer" : ""}`}
                            onClick={() => {
                              if (surgery.patient) {
                                setLocation(`/patients/${surgery.patient.id}/implants/${surgery.id}`);
                              }
                            }}
                            data-testid={`row-surgery-${surgery.id}`}
                          >
                            <td className="px-3 py-2">
                              <input 
                                type="checkbox" 
                                className="h-4 w-4 rounded border-gray-300"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm font-medium">
                                {new Date(surgery.datePose).toLocaleDateString("fr-FR")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(surgery.datePose).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              {surgery.patient ? (
                                <>
                                  <p className="text-sm font-medium">
                                    {surgery.patient.prenom} {surgery.patient.nom}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    PAT-{surgery.patient.id.substring(0, 8).toUpperCase()}
                                  </p>
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm capitalize">{interventionType}</p>
                              {surgery.miseEnCharge && (
                                <p className="text-xs text-muted-foreground capitalize">
                                  Mise en charge {surgery.miseEnCharge.toLowerCase()}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm font-medium">{surgery.siteFdi}</p>
                            </td>
                            <td className="px-3 py-2">
                              {chirurgieTemps ? (
                                <Badge className={chirurgieTemps.className}>{chirurgieTemps.label}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {surgery.greffeOsseuse && greffe ? (
                                <Badge className={greffe.className}>{greffe.label}</Badge>
                              ) : surgery.greffeOsseuse ? (
                                <Badge variant="secondary">Oui</Badge>
                              ) : (
                                <span className="text-muted-foreground">Non</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Taux de réussite moyen</p>
                  {successRate !== null && successRate >= 90 && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                </div>
                <p className={`text-4xl font-bold ${successRateColor}`} data-testid="text-success-rate">
                  {hasPoses && successRate !== null ? `${successRate}%` : "—"}
                </p>
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
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nombre de poses</span>
                <span className="text-sm font-medium">{implant.poseCount || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {implant.lastPoseDate ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Dernière pose: {new Date(implant.lastPoseDate).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-sm">
                    Cet implant a été utilisé {implant.poseCount} fois avec un taux de réussite de {successRate}%.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune pose enregistrée pour cet implant.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
