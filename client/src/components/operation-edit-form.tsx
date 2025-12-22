import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { OperationDetail } from "@shared/types";

const formSchema = z.object({
  dateOperation: z.string().min(1, "La date est requise"),
  typeIntervention: z.enum([
    "POSE_IMPLANT",
    "GREFFE_OSSEUSE",
    "SINUS_LIFT",
    "EXTRACTION_IMPLANT_IMMEDIATE",
    "REPRISE_IMPLANT",
    "CHIRURGIE_GUIDEE",
  ]),
  typeChirurgieTemps: z.enum(["UN_TEMPS", "DEUX_TEMPS"]).optional().nullable(),
  typeChirurgieApproche: z.enum(["LAMBEAU", "FLAPLESS"]).optional().nullable(),
  greffeOsseuse: z.boolean().default(false),
  typeGreffe: z.string().optional().nullable(),
  greffeQuantite: z.string().optional().nullable(),
  greffeLocalisation: z.string().optional().nullable(),
  typeMiseEnCharge: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).optional().nullable(),
  conditionsMedicalesPreop: z.string().optional().nullable(),
  notesPerop: z.string().optional().nullable(),
  observationsPostop: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface OperationEditFormProps {
  operation: OperationDetail;
  onSuccess?: () => void;
}

export function OperationEditForm({ operation, onSuccess }: OperationEditFormProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateOperation: operation.dateOperation,
      typeIntervention: operation.typeIntervention,
      typeChirurgieTemps: operation.typeChirurgieTemps || undefined,
      typeChirurgieApproche: operation.typeChirurgieApproche || undefined,
      greffeOsseuse: operation.greffeOsseuse || false,
      typeGreffe: operation.typeGreffe || "",
      greffeQuantite: operation.greffeQuantite || "",
      greffeLocalisation: operation.greffeLocalisation || "",
      typeMiseEnCharge: operation.typeMiseEnCharge || undefined,
      conditionsMedicalesPreop: operation.conditionsMedicalesPreop || "",
      notesPerop: operation.notesPerop || "",
      observationsPostop: operation.observationsPostop || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("PATCH", `/api/operations/${operation.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operation.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", operation.patientId] });
      toast({
        title: "Modifications enregistrées",
        description: "L'intervention a été mise à jour.",
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

  const watchGreffeOsseuse = form.watch("greffeOsseuse");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="dateOperation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de l'intervention</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-operation-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="typeIntervention"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type d'intervention</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-intervention-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="POSE_IMPLANT">Pose d'implant</SelectItem>
                  <SelectItem value="GREFFE_OSSEUSE">Greffe osseuse</SelectItem>
                  <SelectItem value="SINUS_LIFT">Sinus lift</SelectItem>
                  <SelectItem value="EXTRACTION_IMPLANT_IMMEDIATE">Extraction + implant immédiat</SelectItem>
                  <SelectItem value="REPRISE_IMPLANT">Reprise d'implant</SelectItem>
                  <SelectItem value="CHIRURGIE_GUIDEE">Chirurgie guidée</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="typeChirurgieApproche"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Approche chirurgicale</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LAMBEAU">Lambeau</SelectItem>
                    <SelectItem value="FLAPLESS">Flapless</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="typeChirurgieTemps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temps chirurgical</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="UN_TEMPS">Un temps</SelectItem>
                    <SelectItem value="DEUX_TEMPS">Deux temps</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="typeMiseEnCharge"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mise en charge</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Immédiate</SelectItem>
                  <SelectItem value="PRECOCE">Précoce</SelectItem>
                  <SelectItem value="DIFFEREE">Différée</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="greffeOsseuse"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Greffe osseuse</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-greffe"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {watchGreffeOsseuse && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <FormField
              control={form.control}
              name="typeGreffe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de greffe</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Ex: Autogène, Xénogreffe..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="greffeQuantite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Ex: 0.5g" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="greffeLocalisation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Localisation</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Ex: Vestibulaire" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="conditionsMedicalesPreop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conditions préopératoires</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="Notes sur les conditions médicales..."
                  className="min-h-[80px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notesPerop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes peropératoires</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="Notes pendant l'intervention..."
                  className="min-h-[80px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observationsPostop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observations postopératoires</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="Observations après l'intervention..."
                  className="min-h-[80px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-operation">
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
