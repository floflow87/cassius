import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MoreVertical, Pencil, Trash2, CheckCircle, XCircle, Activity, Stethoscope, AlertCircle, ClipboardList, HeartPulse, CalendarPlus, Loader2, FileImage, Link as LinkIcon } from "lucide-react";
import type { RecommendedActionType } from "@shared/types";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment, AppointmentType, AppointmentStatus, Radio } from "@shared/schema";
import { AppointmentForm } from "./appointment-form";
import { ClinicalFollowUp } from "./clinical-followup";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  UPCOMING: "À venir",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const statusClasses: Record<AppointmentStatus, string> = {
  UPCOMING: "bg-[#EFF6FF] text-blue-700 hover:bg-[#DBEAFE]",
  COMPLETED: "bg-[#DCFCE7] text-green-700 hover:bg-[#BBF7D0]",
  CANCELLED: "bg-[#FEF2F2] text-red-700 hover:bg-[#FEE2E2]",
};

const typeClasses: Record<AppointmentType, string> = {
  CONSULTATION: "bg-blue-500 text-white",
  SUIVI: "bg-green-500 text-white",
  CHIRURGIE: "bg-red-500 text-white",
  CONTROLE: "bg-yellow-500 text-white",
  URGENCE: "bg-orange-500 text-white",
  AUTRE: "bg-gray-500 text-white",
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
  const [control14dOpen, setControl14dOpen] = useState(false);
  const [control14dDate, setControl14dDate] = useState<Date | null>(null);
  const [linkRadioOpen, setLinkRadioOpen] = useState(false);
  const [radioSearch, setRadioSearch] = useState("");

  const TypeIcon = typeIcons[appointment.type];
  const hasClinicalFollowUp = ["CONTROLE", "CHIRURGIE", "URGENCE", "SUIVI"].includes(appointment.type);
  
  const { data: patientRadios } = useQuery<Radio[]>({
    queryKey: ["/api/patients", patientId, "radios"],
    enabled: linkRadioOpen,
  });

  const linkRadioMutation = useMutation({
    mutationFn: async (radioId: string) => {
      await apiRequest("POST", `/api/appointments/${appointment.id}/radios`, { radioId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", appointment.id, "radios"] });
      toast({
        title: "Radio liée",
        description: "La radiographie a été associée au rendez-vous.",
        variant: "success",
      });
      setLinkRadioOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier la radio",
        variant: "destructive",
      });
    },
  });

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

  const createControl14dMutation = useMutation({
    mutationFn: async () => {
      if (!control14dDate) throw new Error("Date non définie");
      const dateHeure = control14dDate.toISOString();
      await apiRequest("POST", "/api/appointments", {
        patientId,
        type: "CONTROLE",
        dateHeure,
        title: "Contrôle ISQ à 14 jours",
        description: "Contrôle de stabilité de l'implant planifié automatiquement",
        surgeryImplantId: appointment.surgeryImplantId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({
        title: "Contrôle planifié",
        description: "Un rendez-vous de contrôle à 14 jours a été créé.",
        variant: "success",
      });
      setControl14dOpen(false);
      setClinicalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (actionType: RecommendedActionType, params?: Record<string, unknown>) => {
    if (actionType === "plan_control_14d") {
      let targetDate: Date;
      if (params?.targetDate && typeof params.targetDate === 'string') {
        targetDate = new Date(params.targetDate);
      } else {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 14);
        targetDate.setHours(9, 0, 0, 0);
      }
      setControl14dDate(targetDate);
      setControl14dOpen(true);
    } else if (actionType === "open_status_modal") {
      toast({
        title: "Action",
        description: "Ouvrir le modal de statut",
      });
    } else if (actionType === "add_or_link_radio") {
      setLinkRadioOpen(true);
    }
  };
  
  const filteredRadios = patientRadios?.filter(radio => {
    if (!radioSearch) return true;
    const search = radioSearch.toLowerCase();
    return radio.title?.toLowerCase().includes(search) || 
           radio.type?.toLowerCase().includes(search);
  }) || [];

  // Calculate display status based on actual date (not database status)
  const isPast = new Date(appointment.dateStart) <= new Date();
  const displayStatus = isPast ? "COMPLETED" : "UPCOMING";

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
                  <span className="text-sm font-medium truncate" data-testid="text-appointment-title">
                    {appointment.title}
                  </span>
                  <Badge className={`text-[10px] ${statusClasses[displayStatus]}`} data-testid="badge-appointment-status">
                    {statusLabels[displayStatus]}
                  </Badge>
                  <Badge className={`text-[10px] ${typeClasses[appointment.type]}`} data-testid="badge-appointment-type">
                    {typeLabels[appointment.type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
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

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier le rendez-vous</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <AppointmentForm
              patientId={patientId}
              appointment={appointment}
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

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
              patientId={patientId}
              onStatusChange={(suggestion) => {
                setClinicalOpen(false);
              }}
              onAction={handleAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={control14dOpen} onOpenChange={setControl14dOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Planifier un contrôle à 14 jours
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Un rendez-vous de contrôle sera créé pour mesurer la stabilité de l'implant.</p>
              {control14dDate && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium text-foreground">Date proposée :</p>
                  <p className="text-muted-foreground mt-1">
                    {control14dDate.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })} à {control14dDate.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-control-14d">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => createControl14dMutation.mutate()}
              disabled={createControl14dMutation.isPending}
              data-testid="button-confirm-control-14d"
            >
              {createControl14dMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Confirmer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={linkRadioOpen} onOpenChange={setLinkRadioOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Lier une radiographie existante
            </DialogTitle>
            <DialogDescription>
              Sélectionnez une radio du patient à associer à ce rendez-vous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Rechercher une radio..."
              value={radioSearch}
              onChange={(e) => setRadioSearch(e.target.value)}
              data-testid="input-search-radio"
            />
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredRadios.length > 0 ? (
                  filteredRadios.map((radio) => (
                    <div
                      key={radio.id}
                      className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                      onClick={() => linkRadioMutation.mutate(radio.id)}
                      data-testid={`radio-option-${radio.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileImage className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{radio.title || "Radio sans titre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {radio.type} - {radio.date ? new Date(radio.date).toLocaleDateString("fr-FR") : "Sans date"}
                          </p>
                        </div>
                      </div>
                      {linkRadioMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucune radio trouvée</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
