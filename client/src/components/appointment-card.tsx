import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, Clock, MoreVertical, Pencil, Trash2, CheckCircle, XCircle, Activity, Stethoscope, AlertCircle, ClipboardList, HeartPulse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment, AppointmentType, AppointmentStatus } from "@shared/schema";
import { AppointmentForm } from "./appointment-form";
import { ClinicalFollowUp } from "./clinical-followup";

interface AppointmentCardProps {
  appointment: Appointment;
  patientId: string;
  onEdit?: () => void;
}

const typeLabels: Record<AppointmentType, string> = {
  CONSULTATION: "Consultation",
  SUIVI: "Suivi",
  CHIRURGIE: "Chirurgie",
  CONTROLE: "Controle",
  URGENCE: "Urgence",
  AUTRE: "Autre",
};

const typeIcons: Record<AppointmentType, typeof Stethoscope> = {
  CONSULTATION: Stethoscope,
  SUIVI: Activity,
  CHIRURGIE: ClipboardList,
  CONTROLE: CheckCircle,
  URGENCE: AlertCircle,
  AUTRE: Calendar,
};

const statusLabels: Record<AppointmentStatus, string> = {
  UPCOMING: "A venir",
  COMPLETED: "Termine",
  CANCELLED: "Annule",
};

const statusVariants: Record<AppointmentStatus, "default" | "secondary" | "outline"> = {
  UPCOMING: "default",
  COMPLETED: "secondary",
  CANCELLED: "outline",
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppointmentCard({ appointment, patientId }: AppointmentCardProps) {
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [clinicalOpen, setClinicalOpen] = useState(false);

  const TypeIcon = typeIcons[appointment.type];
  const hasClinicalFollowUp = ["CONTROLE", "CHIRURGIE", "URGENCE", "SUIVI"].includes(appointment.type);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/appointments/${appointment.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "RDV supprime",
        description: "Le rendez-vous a ete supprime.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: AppointmentStatus) => {
      await apiRequest("PATCH", `/api/appointments/${appointment.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "Statut mis a jour",
        description: "Le statut du rendez-vous a ete mis a jour.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card className="group" data-testid={`card-appointment-${appointment.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 p-2 rounded-md bg-muted">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate" data-testid="text-appointment-title">
                    {appointment.title}
                  </span>
                  <Badge variant={statusVariants[appointment.status]} className="text-xs" data-testid="badge-appointment-status">
                    {statusLabels[appointment.status]}
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-appointment-type">
                    {typeLabels[appointment.type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1" data-testid="text-appointment-date">
                    <Calendar className="h-3 w-3" />
                    {formatDate(appointment.dateStart)}
                  </span>
                  <span className="flex items-center gap-1" data-testid="text-appointment-time">
                    <Clock className="h-3 w-3" />
                    {formatTime(appointment.dateStart)}
                  </span>
                  {appointment.isq !== null && (
                    <span className="flex items-center gap-1" data-testid="text-appointment-isq">
                      <Activity className="h-3 w-3" />
                      ISQ: {appointment.isq}
                    </span>
                  )}
                </div>
                {appointment.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2" data-testid="text-appointment-description">
                    {appointment.description}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid="button-appointment-menu">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)} data-testid="menuitem-edit-appointment">
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                {hasClinicalFollowUp && (
                  <DropdownMenuItem 
                    onClick={() => setClinicalOpen(true)}
                    data-testid="menuitem-clinical-followup"
                  >
                    <HeartPulse className="h-4 w-4 mr-2" />
                    Suivi clinique
                  </DropdownMenuItem>
                )}
                {appointment.status === "UPCOMING" && (
                  <DropdownMenuItem 
                    onClick={() => updateStatusMutation.mutate("COMPLETED")}
                    data-testid="menuitem-complete-appointment"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer comme termine
                  </DropdownMenuItem>
                )}
                {appointment.status === "UPCOMING" && (
                  <DropdownMenuItem 
                    onClick={() => updateStatusMutation.mutate("CANCELLED")}
                    data-testid="menuitem-cancel-appointment"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteOpen(true)} 
                  className="text-destructive"
                  data-testid="menuitem-delete-appointment"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le rendez-vous sera definitivement supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le rendez-vous</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            patientId={patientId}
            appointment={appointment}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={clinicalOpen} onOpenChange={setClinicalOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              Suivi clinique
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ClinicalFollowUp
              appointmentId={appointment.id}
              appointmentType={appointment.type}
              surgeryImplantId={appointment.surgeryImplantId}
              onStatusChange={(suggestion) => {
                setClinicalOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
