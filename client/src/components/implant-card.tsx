import { useState } from "react";
import { Link } from "wouter";
import { Activity, Calendar, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisiteForm } from "@/components/visite-form";
import type { Implant, Visite, SurgeryImplantWithDetails } from "@shared/schema";

interface SurgeryImplantWithVisites extends SurgeryImplantWithDetails {
  visites?: Visite[];
}

interface ImplantCardProps {
  surgeryImplant: SurgeryImplantWithVisites;
  patientId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "echec" | "complication" | "ensuivi" }> = {
  EN_SUIVI: { label: "En suivi", variant: "ensuivi" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "complication" },
  ECHEC: { label: "Échec", variant: "echec" },
};

export function ImplantCard({ surgeryImplant, patientId }: ImplantCardProps) {
  const [visiteDialogOpen, setVisiteDialogOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getLatestISQ = () => {
    if (surgeryImplant.isq6m) return { value: surgeryImplant.isq6m, label: "6M" };
    if (surgeryImplant.isq3m) return { value: surgeryImplant.isq3m, label: "3M" };
    if (surgeryImplant.isq2m) return { value: surgeryImplant.isq2m, label: "2M" };
    if (surgeryImplant.isqPose) return { value: surgeryImplant.isqPose, label: "Pose" };
    return null;
  };

  const latestISQ = getLatestISQ();
  const status = statusConfig[surgeryImplant.statut] || statusConfig.EN_SUIVI;

  return (
    <>
      <Card data-testid={`card-implant-${surgeryImplant.id}`}>
        <CardHeader className="pb-1.5 pt-3 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted font-mono text-sm font-medium">
                {surgeryImplant.siteFdi}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <CardTitle className="text-sm">{surgeryImplant.implant.marque}</CardTitle>
                  {surgeryImplant.implant.typeImplant === "MINI_IMPLANT" && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      Mini
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {surgeryImplant.implant.diametre}mm x {surgeryImplant.implant.longueur}mm
                </p>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(surgeryImplant.datePose)}
            </span>
            {surgeryImplant.typeOs && (
              <span className="font-mono">{surgeryImplant.typeOs}</span>
            )}
            {surgeryImplant.positionImplant && (
              <span>{surgeryImplant.positionImplant.replace("_", "-").toLowerCase()}</span>
            )}
          </div>

          {latestISQ && (
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">
                ISQ {latestISQ.label}: <span className="font-mono font-medium">{latestISQ.value}</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {surgeryImplant.visites?.length || 0} visite{(surgeryImplant.visites?.length || 0) !== 1 ? "s" : ""} de contrôle
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1.5 border-t">
            <Button 
              size="sm"
              onClick={() => setVisiteDialogOpen(true)}
              data-testid={`button-add-visite-${surgeryImplant.id}`}
            >
              <Plus className="h-3 w-3 mr-1" />
              Visite
            </Button>
            <Link href={`/patient/${patientId}/implant/${surgeryImplant.id}`}>
              <Button variant="ghost" size="sm" data-testid={`button-view-implant-${surgeryImplant.id}`}>
                Détails
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Sheet open={visiteDialogOpen} onOpenChange={setVisiteDialogOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nouvelle visite de contrôle</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <VisiteForm
              implantId={surgeryImplant.implant.id}
              patientId={patientId}
              onSuccess={() => setVisiteDialogOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
