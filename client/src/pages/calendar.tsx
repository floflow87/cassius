import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addDays, isSameMonth, isSameDay, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Filter, User, Plus, Check, Pencil, X, Search, Copy, AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

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
  
  // Sync viewMonth when selectedDate changes to a different month (e.g., from main calendar navigation)
  useEffect(() => {
    if (!isSameMonth(selectedDate, viewMonth)) {
      setViewMonth(selectedDate);
    }
  }, [selectedDate]);
  
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
    showOnlyAtRisk: boolean;
  };
  onFiltersChange: (filters: { types: string[]; statuses: string[]; showOnlyAtRisk: boolean }) => void;
}

function CalendarSidebar({ selectedDate, onDateSelect, appointments, filters, onFiltersChange }: CalendarSidebarProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  
  // Load saved state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("calendar-filters-open");
      if (saved !== null) {
        setFiltersOpen(saved === "true");
      }
    }
  }, []);
  
  const handleFiltersOpenChange = (open: boolean) => {
    setFiltersOpen(open);
    if (typeof window !== "undefined") {
      localStorage.setItem("calendar-filters-open", String(open));
    }
  };
  
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
  
  const toggleAtRisk = () => {
    onFiltersChange({ ...filters, showOnlyAtRisk: !filters.showOnlyAtRisk });
  };
  
  const clearFilters = () => {
    onFiltersChange({ types: [], statuses: [], showOnlyAtRisk: false });
  };
  
  const hasFilters = filters.types.length > 0 || filters.statuses.length > 0 || filters.showOnlyAtRisk;
  const filterCount = filters.types.length + filters.statuses.length + (filters.showOnlyAtRisk ? 1 : 0);
  
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0" data-testid="calendar-sidebar">
      <MiniCalendar 
        selectedDate={selectedDate} 
        onDateSelect={onDateSelect}
        appointments={appointments}
      />
      
      <div className="border-t">
        <Collapsible open={filtersOpen} onOpenChange={handleFiltersOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center justify-between w-full px-3 py-3 hover-elevate"
              data-testid="button-toggle-filters"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filtres
                {filterCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {filterCount}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${filtersOpen ? "" : "-rotate-90"}`} />
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-3 pb-3">
              {hasFilters && (
                <div className="flex justify-end mb-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    Effacer
                  </Button>
                </div>
              )}
              
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
                
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Alertes</Label>
                  <label 
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid="filter-at-risk"
                  >
                    <Checkbox
                      checked={filters.showOnlyAtRisk}
                      onCheckedChange={toggleAtRisk}
                    />
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-sm">RDV à risque</span>
                  </label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

interface CalendarSearchProps {
  appointments: CalendarAppointment[];
  onSelectAppointment: (id: string) => void;
  onSelectDate: (date: Date) => void;
  onSelectPatient: (patientId: string) => void;
}

function CalendarSearch({ appointments, onSelectAppointment, onSelectDate, onSelectPatient }: CalendarSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: searchQuery.length > 0,
  });
  
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { appointments: [], patients: [], dateMatch: null };
    
    const query = searchQuery.toLowerCase().trim();
    
    // Try to parse as date
    let dateMatch: Date | null = null;
    const datePatterns = [
      { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: "dd/MM/yyyy" },
      { pattern: /^(\d{1,2})\/(\d{1,2})$/, format: "dd/MM" },
      { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, format: "yyyy-MM-dd" },
    ];
    
    for (const { pattern, format: fmt } of datePatterns) {
      if (pattern.test(searchQuery)) {
        try {
          let parsedDate: Date;
          if (fmt === "dd/MM") {
            const currentYear = new Date().getFullYear();
            parsedDate = parse(`${searchQuery}/${currentYear}`, "dd/MM/yyyy", new Date());
          } else {
            parsedDate = parse(searchQuery, fmt, new Date());
          }
          if (!isNaN(parsedDate.getTime())) {
            dateMatch = parsedDate;
            break;
          }
        } catch {}
      }
    }
    
    // Search appointments
    const matchedAppointments = appointments
      .filter(apt => {
        const title = (apt.title || "").toLowerCase();
        const patientName = `${apt.patientPrenom} ${apt.patientNom}`.toLowerCase();
        return title.includes(query) || patientName.includes(query);
      })
      .slice(0, 5);
    
    // Search patients
    const matchedPatients = patients
      .filter(p => {
        const name = `${p.prenom} ${p.nom}`.toLowerCase();
        return name.includes(query);
      })
      .slice(0, 3);
    
    return {
      appointments: matchedAppointments,
      patients: matchedPatients,
      dateMatch,
    };
  }, [searchQuery, appointments, patients]);
  
  const hasResults = searchResults.appointments.length > 0 || 
                     searchResults.patients.length > 0 || 
                     searchResults.dateMatch !== null;
  
  const handleSelect = (type: "appointment" | "patient" | "date", id?: string, date?: Date) => {
    if (type === "appointment" && id) {
      onSelectAppointment(id);
    } else if (type === "date" && date) {
      onSelectDate(date);
    } else if (type === "patient" && id) {
      onSelectPatient(id);
    }
    setIsOpen(false);
    setSearchQuery("");
  };
  
  return (
    <div className="relative" data-testid="calendar-search">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="pl-9 w-64"
          data-testid="input-calendar-search"
        />
      </div>
      
      {isOpen && searchQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden" data-testid="search-results">
          {!hasResults ? (
            <div className="p-3 text-sm text-muted-foreground text-center" data-testid="text-no-results">
              Aucun résultat
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              {searchResults.dateMatch && (
                <div className="p-2 border-b">
                  <div className="text-xs text-muted-foreground px-2 mb-1">Date</div>
                  <button
                    className="w-full text-left px-2 py-1.5 rounded hover-elevate flex items-center gap-2"
                    onClick={() => handleSelect("date", undefined, searchResults.dateMatch!)}
                    data-testid="search-result-date"
                  >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(searchResults.dateMatch, "EEEE d MMMM yyyy", { locale: fr })}
                    </span>
                  </button>
                </div>
              )}
              
              {searchResults.appointments.length > 0 && (
                <div className="p-2 border-b">
                  <div className="text-xs text-muted-foreground px-2 mb-1">Rendez-vous</div>
                  {searchResults.appointments.map(apt => (
                    <button
                      key={apt.id}
                      className="w-full text-left px-2 py-1.5 rounded hover-elevate"
                      onClick={() => handleSelect("appointment", apt.id)}
                      data-testid={`search-result-appointment-${apt.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getAppointmentColor(apt.type)}`} />
                        <span className="text-sm font-medium truncate">{apt.title || `RDV - ${apt.patientPrenom} ${apt.patientNom}`}</span>
                      </div>
                      <div className="text-xs text-muted-foreground pl-4">
                        {format(new Date(apt.dateStart), "d MMM yyyy HH:mm", { locale: fr })}
                        {" - "}
                        {apt.patientPrenom} {apt.patientNom}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {searchResults.patients.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-muted-foreground px-2 mb-1">Patients</div>
                  {searchResults.patients.map(patient => (
                    <button
                      key={patient.id}
                      className="w-full text-left px-2 py-1.5 rounded hover-elevate flex items-center gap-2"
                      onClick={() => handleSelect("patient", patient.id)}
                      data-testid={`search-result-patient-${patient.id}`}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{patient.prenom} {patient.nom}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
    // Reset to current appointment values, not schema defaults
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
  
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/appointments/${appointmentId}/duplicate`, {});
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous dupliqué" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onUpdated();
    },
    onError: () => {
      toast({ title: "Erreur lors de la duplication", variant: "destructive" });
    },
  });
  
  const markComplete = () => {
    updateMutation.mutate({ status: "COMPLETED" });
  };
  
  const markCancelled = () => {
    updateMutation.mutate({ status: "CANCELLED" });
  };
  
  const markUpcoming = () => {
    updateMutation.mutate({ status: "UPCOMING" });
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
                    <a 
                      href={`/patients/${appointment.patient.id}`}
                      className="font-medium hover:underline flex items-center gap-1"
                      data-testid="link-patient-profile"
                    >
                      {appointment.patient.prenom} {appointment.patient.nom}
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
            
            <div className="flex flex-col gap-3 pt-4 border-t">
              {appointment.status === "UPCOMING" && (
                <div className="flex gap-2">
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
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
              
              {(appointment.status === "COMPLETED" || appointment.status === "CANCELLED") && (
                <Button 
                  variant="outline" 
                  onClick={markUpcoming}
                  disabled={updateMutation.isPending}
                  data-testid="button-reopen"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réouvrir
                </Button>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => duplicateMutation.mutate()}
                  disabled={duplicateMutation.isPending}
                  data-testid="button-duplicate-appointment"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Dupliquer
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-appointment"
                >
                  Supprimer
                </Button>
              </div>
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
  const [patientSearch, setPatientSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientInputRef = useRef<HTMLInputElement>(null);
  
  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: open,
  });
  
  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    if (!patientSearch.trim()) return patients;
    const query = patientSearch.toLowerCase();
    return patients.filter(p => 
      `${p.prenom} ${p.nom}`.toLowerCase().includes(query) ||
      `${p.nom} ${p.prenom}`.toLowerCase().includes(query)
    );
  }, [patients, patientSearch]);
  
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
  
  const watchedPatientId = form.watch("patientId");
  const selectedPatient = useMemo(() => {
    return patients?.find(p => p.id === watchedPatientId);
  }, [patients, watchedPatientId]);
  
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
                <FormItem className="relative z-50">
                  <FormLabel>Patient</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        {selectedPatient ? (
                          <button 
                            type="button"
                            className="flex items-center justify-between h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-9 cursor-pointer text-left"
                            onClick={() => {
                              field.onChange("");
                              setPatientSearch("");
                              setTimeout(() => patientInputRef.current?.focus(), 0);
                            }}
                            data-testid="selected-patient-display"
                          >
                            <span>{selectedPatient.prenom} {selectedPatient.nom}</span>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ) : (
                          <Input
                            ref={patientInputRef}
                            placeholder="Rechercher un patient..."
                            value={patientSearch}
                            onChange={(e) => {
                              setPatientSearch(e.target.value);
                              setPatientDropdownOpen(true);
                            }}
                            onFocus={() => setPatientDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setPatientDropdownOpen(false), 200)}
                            className="pl-9"
                            data-testid="input-patient-search"
                          />
                        )}
                      </div>
                    </FormControl>
                    
                    {patientDropdownOpen && !selectedPatient && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-[100] max-h-48 overflow-auto" data-testid="patient-dropdown">
                        {patientsLoading ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">Chargement...</div>
                        ) : filteredPatients.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">Aucun patient trouvé</div>
                        ) : (
                          filteredPatients.slice(0, 10).map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                              onClick={() => {
                                field.onChange(p.id);
                                setPatientSearch("");
                                setPatientDropdownOpen(false);
                              }}
                              data-testid={`patient-option-${p.id}`}
                            >
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{p.prenom} {p.nom}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
  
  // Use a ref to store the initial date (only set once on mount)
  const initialDateRef = useRef(new Date());
  
  const [selectedDate, setSelectedDate] = useState(() => initialDateRef.current);
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek">("timeGridWeek");
  const [dateRange, setDateRange] = useState(() => {
    const now = initialDateRef.current;
    return {
      start: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      end: format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd"),
    };
  });
  const [filters, setFilters] = useState<{ types: string[]; statuses: string[]; showOnlyAtRisk: boolean }>({
    types: [],
    statuses: [],
    showOnlyAtRisk: false,
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
    let filteredAppointments = appointments;
    
    // Apply at-risk filter if enabled (client-side)
    if (filters.showOnlyAtRisk) {
      filteredAppointments = appointments.filter(apt => apt.hasCriticalFlag);
    }
    
    return filteredAppointments.map(apt => ({
      id: apt.id,
      title: apt.title || (apt.patientPrenom && apt.patientNom ? `${apt.patientPrenom} ${apt.patientNom}` : "Nouveau rdv"),
      start: apt.dateStart,
      end: apt.dateEnd || undefined,
      extendedProps: {
        type: apt.type,
        status: apt.status,
        patientNom: apt.patientNom,
        patientPrenom: apt.patientPrenom,
        isq: apt.isq,
        hasCriticalFlag: apt.hasCriticalFlag,
      },
      backgroundColor: getAppointmentColor(apt.type).replace("bg-", ""),
      borderColor: "transparent",
      classNames: [getAppointmentColor(apt.type)],
    }));
  }, [appointments, filters.showOnlyAtRisk]);
  
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
  
  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
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
    const { type, status, patientNom, patientPrenom, isq, hasCriticalFlag } = eventInfo.event.extendedProps;
    const start = eventInfo.event.start;
    const end = eventInfo.event.end;
    
    // Calculate event duration in minutes for conditional display
    let durationMinutes = 30; // default
    if (start && end) {
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }
    
    // Show time for events >= 45 minutes in time-based views
    const showTime = durationMinutes >= 45 && eventInfo.view.type !== "dayGridMonth" && eventInfo.view.type !== "listWeek";
    
    return (
      <div className="p-1 text-xs overflow-hidden relative" data-testid={`calendar-event-${eventInfo.event.id}`}>
        {hasCriticalFlag && (
          <div className="absolute top-0 right-0 p-0.5" title="Alerte critique">
            <AlertTriangle className="h-3 w-3 text-yellow-300" />
          </div>
        )}
        {showTime && start && (
          <div className="text-white/70 text-[10px]">
            {format(start, "HH:mm")}
            {end && ` - ${format(end, "HH:mm")}`}
          </div>
        )}
        <div className="font-medium truncate text-white pr-4">
          {eventInfo.event.title}
        </div>
        {eventInfo.view.type !== "dayGridMonth" && durationMinutes >= 30 && (
          <div className="text-white/80 truncate">
            {patientPrenom} {patientNom}
            {isq !== null && isq !== undefined && ` • ISQ ${isq}`}
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
            <CalendarSearch
              appointments={appointments}
              onSelectAppointment={(id) => {
                setDrawerAppointmentId(id);
                setDrawerOpen(true);
              }}
              onSelectDate={handleMiniCalendarSelect}
              onSelectPatient={(patientId) => {
                navigate(`/patients/${patientId}`);
              }}
            />
            
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
        
        <div className="flex-1 p-4 overflow-auto relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <div className="space-y-2 w-full max-w-md">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={currentView}
            initialDate={initialDateRef.current}
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
            eventResize={handleEventResize}
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
