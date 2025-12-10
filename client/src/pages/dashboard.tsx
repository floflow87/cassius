import { useQuery } from "@tanstack/react-query";
import { Users, Activity, FileImage, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient, Implant, Radio, Operation } from "@shared/schema";

interface Stats {
  totalPatients: number;
  totalImplants: number;
  totalRadios: number;
  totalOperations: number;
  implantsByStatus: Record<string, number>;
  recentOperations: (Operation & { patient?: Patient })[];
}

export default function DashboardPage() {
  const { data: patients, isLoading: loadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const isLoading = loadingPatients || loadingStats;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
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
      EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant",
      REPRISE_IMPLANT: "Reprise d'implant",
      CHIRURGIE_GUIDEE: "Chirurgie guidée",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const statsData = stats || {
    totalPatients: patients?.length || 0,
    totalImplants: 0,
    totalRadios: 0,
    totalOperations: 0,
    implantsByStatus: {},
    recentOperations: [],
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de votre activité
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-patients">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Patients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsData.totalPatients}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-operations">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Opérations
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsData.totalOperations}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-implants">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Implants
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsData.totalImplants}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-radios">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Radios
            </CardTitle>
            <FileImage className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsData.totalRadios}</div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(statsData.implantsByStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Implants par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(statsData.implantsByStatus).map(([status, count]) => {
                const labels: Record<string, string> = {
                  EN_SUIVI: "En suivi",
                  SUCCES: "Succès",
                  COMPLICATION: "Complication",
                  ECHEC: "Échec",
                };
                return (
                  <div key={status} className="p-4 rounded-md bg-muted/50 text-center">
                    <div className="text-2xl font-semibold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {labels[status] || status}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {statsData.recentOperations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opérations récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statsData.recentOperations.slice(0, 5).map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div>
                    <div className="font-medium">
                      {getInterventionLabel(op.typeIntervention)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(op.dateOperation)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {statsData.totalPatients === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Bienvenue sur Cassius</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Commencez par ajouter votre premier patient pour documenter vos opérations
              implantologiques et suivre l'évolution de vos implants.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
