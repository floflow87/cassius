import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment, AppointmentType, AppointmentStatus } from "@shared/schema";
import { AlertCircle, Info } from "lucide-react";

const appointmentTypes: { value: AppointmentType; label: string }[] = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "SUIVI", label: "Suivi" },
  { value: "CHIRURGIE", label: "Chirurgie" },
  { value: "CONTROLE", label: "Contrôle" },
  { value: "URGENCE", label: "Urgence" },
  { value: "AUTRE", label: "Autre" },
];

const appointmentStatuses: { value: AppointmentStatus; label: string }[] = [
  { value: "UPCOMING", label: "À venir" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "CANCELLED", label: "Annulé" },
];

const appointmentColors = [
  { value: "#93c5fd", label: "Bleu", class: "bg-blue-300" },
  { value: "#86efac", label: "Vert", class: "bg-green-300" },
  { value: "#fca5a5", label: "Rouge", class: "bg-red-300" },
  { value: "#fde047", label: "Jaune", class: "bg-yellow-300" },
  { value: "#fdba74", label: "Orange", class: "bg-orange-300" },
  { value: "#d1d5db", label: "Gris", class: "bg-gray-300" },
  { value: "#c4b5fd", label: "Violet", class: "bg-violet-300" },
  { value: "#f9a8d4", label: "Rose", class: "bg-pink-300" },
  { value: "#5eead4", label: "Turquoise", class: "bg-teal-300" },
];

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]),
  color: z.string().nullable().optional(),
  dateStart: z.string().min(1, "La date est requise"),
  timeStart: z.string().min(1, "L'heure est requise"),
  description: z.string().optional(),
  isq: z.number().min(0).max(100).nullable().optional(),
  surgeryImplantId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SurgeryImplant {
  id: string;
  siteFdi: string;
  implant?: {
    marque?: string;
    referenceFabricant?: string;
    diametre?: number | null;
    longueur?: number | null;
  };
}

interface AppointmentFormProps {
  patientId: string;
  appointment?: Appointment;
  onSuccess?: () => void;
}

function formatDateForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function formatTimeForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toTimeString().slice(0, 5);
}

export function AppointmentForm({ patientId, appointment, onSuccess }: AppointmentFormProps) {
  const { toast } = useToast();
  const isEditing = !!appointment;

  const { data: surgeryImplants = [], isLoading: implantsLoading } = useQuery<SurgeryImplant[]>({
    queryKey: [`/api/patients/${patientId}/surgery-implants`],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: appointment?.title || "",
      type: appointment?.type || "CONSULTATION",
      status: appointment?.status || "UPCOMING",
      color: (appointment as { color?: string | null })?.color || null,
      dateStart: appointment?.dateStart ? formatDateForInput(appointment.dateStart) : new Date().toISOString().split("T")[0],
      timeStart: appointment?.dateStart ? formatTimeForInput(appointment.dateStart) : "09:00",
      description: appointment?.description || "",
      isq: appointment?.isq ?? null,
      surgeryImplantId: appointment?.surgeryImplantId || null,
    },
  });

  const watchType = form.watch("type");
  const showImplantSelector = ["SUIVI", "CONTROLE"].includes(watchType);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const dateStart = new Date(`${data.dateStart}T${data.timeStart}`).toISOString();
      const res = await apiRequest("POST", `/api/patients/${patientId}/appointments`, {
        title: data.title,
        type: data.type,
        status: data.status,
        color: data.color || null,
        dateStart,
        description: data.description || null,
        isq: data.isq,
        surgeryImplantId: data.surgeryImplantId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "RDV créé",
        description: "Le rendez-vous a été ajouté.",
        variant: "success",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const dateStart = new Date(`${data.dateStart}T${data.timeStart}`).toISOString();
      const res = await apiRequest("PATCH", `/api/appointments/${appointment!.id}`, {
        title: data.title,
        type: data.type,
        status: data.status,
        color: data.color || null,
        dateStart,
        description: data.description || null,
        isq: data.isq,
        surgeryImplantId: data.surgeryImplantId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "RDV mis à jour",
        description: "Le rendez-vous a été modifié.",
        variant: "success",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const getImplantLabel = (implant: SurgeryImplant) => {
    const parts = [`Site ${implant.siteFdi}`];
    if (implant.implant?.marque) parts.push(implant.implant.marque);
    if (implant.implant?.diametre && implant.implant?.longueur) {
      parts.push(`${implant.implant.diametre}x${implant.implant.longueur}mm`);
    }
    if (implant.implant?.referenceFabricant) parts.push(`(${implant.implant.referenceFabricant})`);
    return parts.join(" - ");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titre</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Contrôle post-opératoire" {...field} data-testid="input-appointment-title" />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-xs" data-testid="select-appointment-type">
                      <SelectValue placeholder="Type de RDV" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {appointmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-xs" data-testid="select-appointment-status">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {appointmentStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
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
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Couleur (optionnel)</FormLabel>
              <div className="flex flex-wrap gap-2">
                {appointmentColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => field.onChange(field.value === c.value ? null : c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${c.class} ${
                      field.value === c.value ? "border-foreground ring-2 ring-foreground/20 scale-110" : "border-transparent hover:scale-105"
                    }`}
                    title={c.label}
                    data-testid={`color-${c.value}`}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {showImplantSelector && (
          <FormField
            control={form.control}
            name="surgeryImplantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Implant lié
                  <span className="text-xs text-muted-foreground">(recommandé pour le suivi ISQ)</span>
                </FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                  value={field.value || "none"}
                  disabled={implantsLoading}
                >
                  <FormControl>
                    <SelectTrigger className="text-xs" data-testid="select-surgery-implant">
                      <SelectValue placeholder={implantsLoading ? "Chargement..." : "Sélectionner un implant"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Aucun implant</SelectItem>
                    {surgeryImplants.map((implant) => (
                      <SelectItem key={implant.id} value={implant.id}>
                        {getImplantLabel(implant)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {surgeryImplants.length === 0 && !implantsLoading && (
                  <FormDescription className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    Aucun implant posé pour ce patient
                  </FormDescription>
                )}
                {!field.value && surgeryImplants.length > 0 && (
                  <FormDescription className="flex items-center gap-1 text-blue-600">
                    <Info className="h-3 w-3" />
                    Lier un implant permet le suivi ISQ et les suggestions cliniques
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dateStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-appointment-date" />
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
                  <Input type="time" {...field} data-testid="input-appointment-time" />
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
              <FormLabel>Notes (optionnel)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notes concernant ce rendez-vous..."
                  className="resize-none"
                  {...field}
                  data-testid="textarea-appointment-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-appointment">
            {isPending ? "Enregistrement..." : isEditing ? "Modifier" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
