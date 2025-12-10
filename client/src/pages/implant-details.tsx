import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  Activity,
  Calendar,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Implant, Visite, Radio } from "@shared/schema";

interface ImplantWithDetails extends Implant {
  visites: Visite[];
  radios: Radio[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

export default function ImplantDetailsPage() {
  const [, params] = useRoute("/patient/:patientId/implant/:implantId");
  const patientId = params?.patientId;
  const implantId = params?.implantId;

  const { data: implant, isLoading } = useQuery<ImplantWithDetails>({
    queryKey: ["/api/implants", implantId],
    enabled: !!implantId,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getISQProgression = () => {
    const points: { label: string; value: number; date?: string }[] = [];
    if (implant?.isqPose) points.push({ label: "Pose", value: implant.isqPose });
    if (implant?.isq2m) points.push({ label: "2M", value: implant.isq2m });
    if (implant?.isq3m) points.push({ label: "3M", value: implant.isq3m });
    if (implant?.isq6m) points.push({ label: "6M", value: implant.isq6m });
    
    implant?.visites?.forEach((visite) => {
      if (visite.isq) {
        points.push({
          label: formatDate(visite.date),
          value: visite.isq,
          date: visite.date,
        });
      }
    });
    
    return points;
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

  if (!implant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Implant non trouvé</h3>
            <Link href={`/patient/${patientId}`}>
              <Button variant="outline">Retour au patient</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[implant.statut] || statusConfig.EN_SUIVI;
  const isqProgression = getISQProgression();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/patient/${patientId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back-to-patient">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-implant-title">
            Implant site {implant.siteFdi}
          </h1>
          <p className="text-sm text-muted-foreground">
            {implant.marque} - {implant.diametre}mm x {implant.longueur}mm
          </p>
        </div>
        <Badge variant={status.variant} className="text-sm">
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Marque</span>
                <p className="font-medium">{implant.marque}</p>
              </div>
              {implant.referenceFabricant && (
                <div>
                  <span className="text-muted-foreground">Référence</span>
                  <p className="font-medium font-mono">{implant.referenceFabricant}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Diamètre</span>
                <p className="font-medium font-mono">{implant.diametre} mm</p>
              </div>
              <div>
                <span className="text-muted-foreground">Longueur</span>
                <p className="font-medium font-mono">{implant.longueur} mm</p>
              </div>
              <div>
                <span className="text-muted-foreground">Site FDI</span>
                <p className="font-medium font-mono">{implant.siteFdi}</p>
              </div>
              {implant.positionImplant && (
                <div>
                  <span className="text-muted-foreground">Position</span>
                  <p className="font-medium">
                    {implant.positionImplant.replace("_", "-").toLowerCase()}
                  </p>
                </div>
              )}
              {implant.typeOs && (
                <div>
                  <span className="text-muted-foreground">Type d'os</span>
                  <p className="font-medium font-mono">{implant.typeOs}</p>
                </div>
              )}
              {implant.miseEnChargePrevue && (
                <div>
                  <span className="text-muted-foreground">Mise en charge</span>
                  <p className="font-medium">
                    {implant.miseEnChargePrevue.charAt(0) + implant.miseEnChargePrevue.slice(1).toLowerCase()}
                  </p>
                </div>
              )}
            </div>
            <div className="pt-3 border-t flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Posé le {formatDate(implant.datePose)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Évolution ISQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isqProgression.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2" />
                <p className="text-sm">Aucune mesure ISQ enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {isqProgression.map((point, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {point.label}
                    </span>
                    <span className="font-mono font-medium text-lg">
                      {point.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Visites de contrôle ({implant.visites?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {implant.visites?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Stethoscope className="h-8 w-8 mb-2" />
              <p className="text-sm">Aucune visite de contrôle</p>
            </div>
          ) : (
            <div className="space-y-3">
              {implant.visites
                ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((visite) => (
                  <div
                    key={visite.id}
                    className="p-4 rounded-md border"
                    data-testid={`visite-${visite.id}`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(visite.date)}</span>
                      </div>
                      {visite.isq && (
                        <Badge variant="secondary" className="font-mono">
                          ISQ: {visite.isq}
                        </Badge>
                      )}
                    </div>
                    {visite.notes && (
                      <p className="text-sm text-muted-foreground">{visite.notes}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
