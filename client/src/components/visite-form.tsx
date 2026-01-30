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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function calculateWeightedISQ(vestibulaire?: number, mesial?: number, distal?: number): number | undefined {
  if (vestibulaire === undefined && mesial === undefined && distal === undefined) {
    return undefined;
  }
  const v = vestibulaire ?? 0;
  const m = mesial ?? 0;
  const d = distal ?? 0;
  const count = (vestibulaire !== undefined ? 2 : 0) + (mesial !== undefined ? 1 : 0) + (distal !== undefined ? 1 : 0);
  if (count === 0) return undefined;
  return Math.round(((vestibulaire !== undefined ? v * 2 : 0) + (mesial !== undefined ? m : 0) + (distal !== undefined ? d : 0)) / count * 10) / 10;
}

const formSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  isqVestibulaire: z.number().min(0).max(100).optional(),
  isqMesial: z.number().min(0).max(100).optional(),
  isqDistal: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface VisiteFormProps {
  implantId: string;
  patientId: string;
  onSuccess?: () => void;
}

export function VisiteForm({ implantId, patientId, onSuccess }: VisiteFormProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const watchedValues = form.watch(["isqVestibulaire", "isqMesial", "isqDistal"]);
  const calculatedISQ = calculateWeightedISQ(watchedValues[0], watchedValues[1], watchedValues[2]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const isq = calculateWeightedISQ(data.isqVestibulaire, data.isqMesial, data.isqDistal);
      const res = await apiRequest("POST", "/api/visites", {
        ...data,
        isq,
        implantId,
        patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/summary"] });
      toast({
        title: "Visite enregistrée",
        description: "La visite de contrôle a été ajoutée.",
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
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de la visite</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-visite-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel className="text-sm font-medium">Mesures ISQ</FormLabel>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="isqVestibulaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Vestibulaire (×2)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Ex: 75"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      data-testid="input-visite-isq-vestibulaire"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isqMesial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Mésial</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Ex: 72"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      data-testid="input-visite-isq-mesial"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isqDistal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Distal</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Ex: 70"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      data-testid="input-visite-isq-distal"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {calculatedISQ !== undefined && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <span className="text-xs text-muted-foreground">ISQ calculé :</span>
              <span className="text-sm font-semibold text-primary">{calculatedISQ}</span>
              <span className="text-xs text-muted-foreground">(moyenne pondérée)</span>
            </div>
          )}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observations cliniques..."
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                  data-testid="textarea-visite-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-visite">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer la visite"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
