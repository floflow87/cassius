import { useState } from "react";
import { Link } from "wouter";
import { Activity, Calendar, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VisiteForm } from "@/components/visite-form";
import type { Implant, Visite, SurgeryImplantWithDetails } from "@shared/schema";

interface SurgeryImplantWithVisites extends SurgeryImplantWithDetails {
  visites?: Visite[];
}

interface ImplantCardProps {
  surgeryImplant: SurgeryImplantWithVisites;
  patientId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
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
    <Card data-testid={`card-implant-${surgeryImplant.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted font-mono text-sm font-medium">
              {surgeryImplant.siteFdi}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm">{surgeryImplant.implant.marque}</CardTitle>
                {surgeryImplant.implant.typeImplant === "MINI_IMPLANT" && (
                  <Badge variant="outline" className="text-xs h-5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
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
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              ISQ {latestISQ.label}: <span className="font-mono font-medium">{latestISQ.value}</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {surgeryImplant.visites?.length || 0} visite{(surgeryImplant.visites?.length || 0) !== 1 ? "s" : ""} de contrôle
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Dialog open={visiteDialogOpen} onOpenChange={setVisiteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`button-add-visite-${surgeryImplant.id}`}>
                <Plus className="h-3 w-3 mr-1" />
                Visite
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouvelle visite de contrôle</DialogTitle>
              </DialogHeader>
              <VisiteForm
                implantId={surgeryImplant.id}
                patientId={patientId}
                onSuccess={() => setVisiteDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Link href={`/patient/${patientId}/implant/${surgeryImplant.id}`}>
            <Button variant="ghost" size="sm" data-testid={`button-view-implant-${surgeryImplant.id}`}>
              Détails
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
