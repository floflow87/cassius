import { useState, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addDays, isSameMonth, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, User, Plus, Check, Pencil, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CalendarAppointment, CalendarFilters, Patient } from "@shared/types";
import type { AppointmentWithDetails } from "@shared/schema";
import type { EventClickArg, EventDropArg, EventContentArg } from "@fullcalendar/core";

const appointmentTypes = [
  { value: "CONSULTATION", label: "Consultation", color: "bg-blue-500" },
  { value: "SUIVI", label: "Suivi", color: "bg-green-500" },
  { value: "CHIRURGIE", label: "Chirurgie", color: "bg-red-500" },
  { value: "CONTROLE", label: "Contrôle", color: "bg-yellow-500" },
  { value: "URGENCE", label: "Urgence", color: "bg-orange-500" },
  { value: "AUTRE", label: "Autre", color: "bg-gray-500" },
];

const appointmentStatuses = [
  { value: "UPCOMING", label: "À venir", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "COMPLETED", label: "Terminé", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "CANCELLED", label: "Annulé", color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
];

function getAppointmentColor(type: string): string {
  const found = appointmentTypes.find(t => t.value === type);
  return found?.color || "bg-gray-500";
}

function getStatusBadge(status: string) {
  const found = appointmentStatuses.find(s => s.value === status);
  return found?.color || "bg-gray-100 text-gray-800";
}

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  appointments: CalendarAppointment[];
}

function MiniCalendar({ selectedDate, onDateSelect, appointments }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate);
  
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }
  
  const appointmentDates = useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(apt => {
      dates.add(format(new Date(apt.dateStart), "yyyy-MM-dd"));
    });
    return dates;
  }, [appointments]);
  
  return (
    <div className="p-3" data-testid="mini-calendar">
      <div className="flex items-center justify-between mb-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          data-testid="mini-calendar-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(viewMonth, "MMMM yyyy", { locale: fr })}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          data-testid="mini-calendar-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground mb-1">
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const dateKey = format(d, "yyyy-MM-dd");
          const hasAppointment = appointmentDates.has(dateKey);
          const isCurrentMonth = isSameMonth(d, viewMonth);
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, new Date());
          
          return (
            <button
              key={i}
              onClick={() => onDateSelect(d)}
              className={`
                relative py-1.5 text-xs rounded-md transition-colors
                ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                ${isSelected ? "bg-primary text-primary-foreground" : "hover-elevate"}
                ${isToday && !isSelected ? "font-bold text-primary" : ""}
              `}
              data-testid={`mini-calendar-day-${dateKey}`}
            >
              {format(d, "d")}
              {hasAppointment && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CalendarSidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  appointments: CalendarAppointment[];
  filters: {
    types: string[];
    statuses: string[];
  };
  onFiltersChange: (filters: { types: string[]; statuses: string[] }) => void;
}

function CalendarSidebar({ selectedDate, onDateSelect, appointments, filters, onFiltersChange }: CalendarSidebarProps) {
  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };
  
  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };
  
  const clearFilters = () => {
    onFiltersChange({ types: [], statuses: [] });
  };
  
  const hasFilters = filters.types.length > 0 || filters.statuses.length > 0;
  
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0" data-testid="calendar-sidebar">
      <MiniCalendar 
        selectedDate={selectedDate} 
        onDateSelect={onDateSelect}
        appointments={appointments}
      />
      
      <div className="border-t px-3 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtres
          </div>
          {hasFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Effacer
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Type de rendez-vous</Label>
            <div className="space-y-1.5">
              {appointmentTypes.map(type => (
                <label 
                  key={type.value}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`filter-type-${type.value}`}
                >
                  <Checkbox
                    checked={filters.types.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value)}
                  />
                  <span className={`w-2 h-2 rounded-full ${type.color}`} />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Statut</Label>
            <div className="space-y-1.5">
              {appointmentStatuses.map(status => (
                <label 
                  key={status.value}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`filter-status-${status.value}`}
                >
                  <Checkbox
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const editFormSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]),
  dateStart: z.string(),
  timeStart: z.string(),
  timeEnd: z.string().optional(),
  description: z.string().optional(),
  isq: z.string().optional(),
});

type EditFormData = z.infer<typeof editFormSchema>;

interface AppointmentDrawerProps {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function AppointmentDrawer({ appointmentId, open, onClose, onUpdated }: AppointmentDrawerProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: appointment, isLoading } = useQuery<AppointmentWithDetails>({
    queryKey: ["/api/appointments", appointmentId],
    enabled: !!appointmentId && open,
  });
  
  const form = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: "",
      type: "CONSULTATION",
      status: "UPCOMING",
      dateStart: "",
      timeStart: "09:00",
      timeEnd: "",
      description: "",
      isq: "",
    },
  });
  
  // Reset form when appointment data loads or editing starts
  const startEditing = () => {
    if (appointment) {
      const dateStart = new Date(appointment.dateStart);
      form.reset({
        title: appointment.title || "",
        type: appointment.type as EditFormData["type"],
        status: appointment.status as EditFormData["status"],
        dateStart: format(dateStart, "yyyy-MM-dd"),
        timeStart: format(dateStart, "HH:mm"),
        timeEnd: appointment.dateEnd ? format(new Date(appointment.dateEnd), "HH:mm") : "",
        description: appointment.description || "",
        isq: appointment.isq?.toString() || "",
      });
    }
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
    form.reset();
  };
  
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("PATCH", `/api/appointments/${appointmentId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onUpdated();
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/appointments/${appointmentId}`);
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous supprimé" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onUpdated();
      onClose();
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });
  
  const markComplete = () => {
    updateMutation.mutate({ status: "COMPLETED" });
  };
  
  const markCancelled = () => {
    updateMutation.mutate({ status: "CANCELLED" });
  };
  
  const onSubmitEdit = (data: EditFormData) => {
    const dateStart = new Date(`${data.dateStart}T${data.timeStart}`).toISOString();
    const dateEnd = data.timeEnd ? new Date(`${data.dateStart}T${data.timeEnd}`).toISOString() : null;
    
    updateMutation.mutate({
      title: data.title,
      type: data.type,
      status: data.status,
      dateStart,
      dateEnd,
      description: data.description || null,
      isq: data.isq ? parseInt(data.isq, 10) : null,
    });
  };
  
  if (!open) return null;
  
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setIsEditing(false); onClose(); }}}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle data-testid="drawer-appointment-title">
              {isLoading ? <Skeleton className="h-6 w-48" /> : (isEditing ? "Modifier le rendez-vous" : (appointment?.title || "Rendez-vous"))}
            </SheetTitle>
            {!isLoading && appointment && !isEditing && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={startEditing}
                data-testid="button-edit-appointment"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <SheetDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : appointment && !isEditing ? (
              <span className="flex items-center gap-2">
                <Badge className={getStatusBadge(appointment.status)} variant="secondary">
                  {appointmentStatuses.find(s => s.value === appointment.status)?.label}
                </Badge>
                <Badge className={`${getAppointmentColor(appointment.type)} text-white`}>
                  {appointmentTypes.find(t => t.value === appointment.type)?.label}
                </Badge>
              </span>
            ) : isEditing ? (
              <span className="text-muted-foreground">Modifiez les informations du rendez-vous</span>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        
        {isLoading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : appointment && isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4 py-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Titre du rendez-vous" data-testid="input-edit-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {appointmentTypes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {appointmentStatuses.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="dateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-edit-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heure début</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-edit-time-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="timeEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heure fin</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-edit-time-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISQ</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} placeholder="Valeur ISQ (optionnel)" data-testid="input-edit-isq" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Notes (optionnel)" rows={3} data-testid="input-edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={cancelEditing}
                  data-testid="button-cancel-edit"
                >
                  Annuler
                </Button>
              </div>
            </form>
          </Form>
        ) : appointment ? (
          <div className="py-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">
                    {format(new Date(appointment.dateStart), "EEEE d MMMM yyyy", { locale: fr })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(appointment.dateStart), "HH:mm", { locale: fr })}
                    {appointment.dateEnd && ` - ${format(new Date(appointment.dateEnd), "HH:mm", { locale: fr })}`}
                  </div>
                </div>
              </div>
              
              {appointment.patient && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">
                      {appointment.patient.prenom} {appointment.patient.nom}
                    </div>
                    {appointment.patient.telephone && (
                      <div className="text-sm text-muted-foreground">{appointment.patient.telephone}</div>
                    )}
                  </div>
                </div>
              )}
              
              {appointment.description && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{appointment.description}</p>
                </div>
              )}
              
              {appointment.isq !== null && appointment.isq !== undefined && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">ISQ mesuré</Label>
                  <p className="text-lg font-mono font-medium mt-1">{appointment.isq}</p>
                </div>
              )}
            </div>
            
            {appointment.status === "UPCOMING" && (
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={markComplete}
                  disabled={updateMutation.isPending}
                  data-testid="button-mark-complete"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Terminer
                </Button>
                <Button 
                  variant="outline" 
                  onClick={markCancelled}
                  disabled={updateMutation.isPending}
                  data-testid="button-mark-cancelled"
                >
                  Annuler
                </Button>
              </div>
            )}
            
            <div className="pt-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-appointment"
              >
                Supprimer le rendez-vous
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            Rendez-vous introuvable
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const quickCreateFormSchema = z.object({
  patientId: z.string().min(1, "Patient requis"),
  title: z.string().min(1, "Titre requis"),
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]),
  dateStart: z.string(),
  timeStart: z.string(),
  description: z.string().optional(),
});

type QuickCreateFormData = z.infer<typeof quickCreateFormSchema>;

interface QuickCreateDialogProps {
  open: boolean;
  onClose: () => void;
  defaultDate: Date | null;
  onCreated: () => void;
}

function QuickCreateDialog({ open, onClose, defaultDate, onCreated }: QuickCreateDialogProps) {
  const { toast } = useToast();
  
  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: open,
  });
  
  const form = useForm<QuickCreateFormData>({
    resolver: zodResolver(quickCreateFormSchema),
    defaultValues: {
      patientId: "",
      title: "",
      type: "CONSULTATION",
      dateStart: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
      timeStart: defaultDate ? format(defaultDate, "HH:mm") : "09:00",
      description: "",
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: QuickCreateFormData) => {
      const dateStart = new Date(`${data.dateStart}T${data.timeStart}`).toISOString();
      return apiRequest("POST", `/api/patients/${data.patientId}/appointments`, {
        title: data.title,
        type: data.type,
        status: "UPCOMING",
        dateStart,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous créé" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onCreated();
      form.reset();
      onClose();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });
  
  const onSubmit = (data: QuickCreateFormData) => {
    createMutation.mutate(data);
  };
  
  if (!open) return null;
  
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nouveau rendez-vous</SheetTitle>
          <SheetDescription>
            {defaultDate && format(defaultDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </SheetDescription>
        </SheetHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6">
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-patient">
                        <SelectValue placeholder="Sélectionner un patient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patientsLoading ? (
                        <SelectItem value="_loading" disabled>Chargement...</SelectItem>
                      ) : patients?.length === 0 ? (
                        <SelectItem value="_empty" disabled>Aucun patient</SelectItem>
                      ) : (
                        patients?.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input placeholder="Titre du rendez-vous" {...field} data-testid="input-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {appointmentTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="timeStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notes optionnelles..." {...field} data-testid="input-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-appointment">
                {createMutation.isPending ? "Création..." : "Créer"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Annuler
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek">("timeGridWeek");
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      end: format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd"),
    };
  });
  const [filters, setFilters] = useState<{ types: string[]; statuses: string[] }>({
    types: [],
    statuses: [],
  });
  
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null);
  
  const calendarFilters: CalendarFilters = useMemo(() => ({
    start: dateRange.start,
    end: dateRange.end,
    types: filters.types.length > 0 ? filters.types : undefined,
    statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
  }), [dateRange, filters]);
  
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("start", calendarFilters.start);
    params.set("end", calendarFilters.end);
    if (calendarFilters.types) {
      calendarFilters.types.forEach(t => params.append("types", t));
    }
    if (calendarFilters.statuses) {
      calendarFilters.statuses.forEach(s => params.append("statuses", s));
    }
    return params.toString();
  }, [calendarFilters]);
  
  const { data: appointments = [], isLoading } = useQuery<CalendarAppointment[]>({
    queryKey: ["/api/appointments/calendar", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/calendar?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });
  
  const events = useMemo(() => {
    return appointments.map(apt => ({
      id: apt.id,
      title: apt.title || `${apt.patientPrenom} ${apt.patientNom}`,
      start: apt.dateStart,
      end: apt.dateEnd || undefined,
      extendedProps: {
        type: apt.type,
        status: apt.status,
        patientNom: apt.patientNom,
        patientPrenom: apt.patientPrenom,
        isq: apt.isq,
      },
      backgroundColor: getAppointmentColor(apt.type).replace("bg-", ""),
      borderColor: "transparent",
      classNames: [getAppointmentColor(apt.type)],
    }));
  }, [appointments]);
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, dateStart, dateEnd }: { id: string; dateStart: Date; dateEnd?: Date }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { dateStart, dateEnd });
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous déplacé" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/calendar"] });
    },
    onError: () => {
      toast({ title: "Erreur lors du déplacement", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/calendar"] });
    },
  });
  
  const handleEventClick = useCallback((info: EventClickArg) => {
    setDrawerAppointmentId(info.event.id);
    setDrawerOpen(true);
  }, []);
  
  const handleDateClick = useCallback((info: { date: Date; dateStr: string }) => {
    setQuickCreateDate(info.date);
    setQuickCreateOpen(true);
  }, []);
  
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const { event } = info;
    updateMutation.mutate({
      id: event.id,
      dateStart: event.start!,
      dateEnd: event.end || undefined,
    });
  }, [updateMutation]);
  
  const handleDatesSet = useCallback((info: { start: Date; end: Date; view: { currentStart: Date } }) => {
    setDateRange({
      start: format(info.start, "yyyy-MM-dd"),
      end: format(info.end, "yyyy-MM-dd"),
    });
    setSelectedDate(info.view.currentStart);
  }, []);
  
  const handleMiniCalendarSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.gotoDate(date);
    }
  }, []);
  
  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.today();
    }
  };
  
  const changeView = (view: typeof currentView) => {
    setCurrentView(view);
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.changeView(view);
    }
  };
  
  const renderEventContent = (eventInfo: EventContentArg) => {
    const { type, status, patientNom, patientPrenom, isq } = eventInfo.event.extendedProps;
    
    return (
      <div className="p-1 text-xs overflow-hidden" data-testid={`calendar-event-${eventInfo.event.id}`}>
        <div className="font-medium truncate text-white">
          {eventInfo.event.title}
        </div>
        {eventInfo.view.type !== "dayGridMonth" && (
          <div className="text-white/80 truncate">
            {patientPrenom} {patientNom}
            {isq !== null && ` • ISQ ${isq}`}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex h-full" data-testid="calendar-page">
      <CalendarSidebar
        selectedDate={selectedDate}
        onDateSelect={handleMiniCalendarSelect}
        appointments={appointments}
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-4 p-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
              Aujourd&apos;hui
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => calendarRef.current?.getApi().prev()}
              data-testid="button-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => calendarRef.current?.getApi().next()}
              data-testid="button-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium" data-testid="text-calendar-title">
              {format(selectedDate, "MMMM yyyy", { locale: fr })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              {[
                { key: "timeGridDay", label: "Jour" },
                { key: "timeGridWeek", label: "Semaine" },
                { key: "dayGridMonth", label: "Mois" },
                { key: "listWeek", label: "Agenda" },
              ].map(v => (
                <Button
                  key={v.key}
                  variant={currentView === v.key ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none first:rounded-l-md last:rounded-r-md"
                  onClick={() => changeView(v.key as typeof currentView)}
                  data-testid={`button-view-${v.key}`}
                >
                  {v.label}
                </Button>
              ))}
            </div>
            
            <Button 
              onClick={() => {
                setQuickCreateDate(new Date());
                setQuickCreateOpen(true);
              }}
              data-testid="button-new-appointment"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={currentView}
              locale="fr"
              headerToolbar={false}
              events={events}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              firstDay={1}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              slotDuration="00:30:00"
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventDrop={handleEventDrop}
              datesSet={handleDatesSet}
              eventContent={renderEventContent}
              height="100%"
              allDaySlot={false}
              nowIndicator={true}
              slotLabelFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              dayHeaderFormat={{
                weekday: "short",
                day: "numeric",
              }}
            />
          )}
        </div>
      </div>
      
      <AppointmentDrawer
        appointmentId={drawerAppointmentId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerAppointmentId(null);
        }}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/appointments/calendar"] });
        }}
      />
      
      <QuickCreateDialog
        open={quickCreateOpen}
        onClose={() => {
          setQuickCreateOpen(false);
          setQuickCreateDate(null);
        }}
        defaultDate={quickCreateDate}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/appointments/calendar"] });
        }}
      />
    </div>
  );
}
