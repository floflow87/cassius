import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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

const appointmentTypes: { value: AppointmentType; label: string }[] = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "SUIVI", label: "Suivi" },
  { value: "CHIRURGIE", label: "Chirurgie" },
  { value: "CONTROLE", label: "Controle" },
  { value: "URGENCE", label: "Urgence" },
  { value: "AUTRE", label: "Autre" },
];

const appointmentStatuses: { value: AppointmentStatus; label: string }[] = [
  { value: "UPCOMING", label: "À venir" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "CANCELLED", label: "Annulé" },
];

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]),
  dateStart: z.string().min(1, "La date est requise"),
  timeStart: z.string().min(1, "L'heure est requise"),
  description: z.string().optional(),
  isq: z.number().min(0).max(100).nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: appointment?.title || "",
      type: appointment?.type || "CONSULTATION",
      status: appointment?.status || "UPCOMING",
      dateStart: appointment?.dateStart ? formatDateForInput(appointment.dateStart) : new Date().toISOString().split("T")[0],
      timeStart: appointment?.dateStart ? formatTimeForInput(appointment.dateStart) : "09:00",
      description: appointment?.description || "",
      isq: appointment?.isq ?? null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const dateStart = new Date(`${data.dateStart}T${data.timeStart}`).toISOString();
      const res = await apiRequest("POST", `/api/patients/${patientId}/appointments`, {
        title: data.title,
        type: data.type,
        status: data.status,
        dateStart,
        description: data.description || null,
        isq: data.isq,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "RDV cree",
        description: "Le rendez-vous a ete ajoute.",
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
        dateStart,
        description: data.description || null,
        isq: data.isq,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "appointments"] });
      toast({
        title: "RDV mis a jour",
        description: "Le rendez-vous a ete modifie.",
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
                <Input placeholder="Ex: Controle post-operatoire" {...field} data-testid="input-appointment-title" />
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
                    <SelectTrigger data-testid="select-appointment-type">
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
                    <SelectTrigger data-testid="select-appointment-status">
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
