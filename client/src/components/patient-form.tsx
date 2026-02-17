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
import { insertPatientSchema } from "@shared/schema";

const formSchema = insertPatientSchema.extend({
  dateNaissance: z.string().min(1, "La date de naissance est requise"),
});

type FormData = z.infer<typeof formSchema>;

interface PatientFormProps {
  onSuccess?: (patientId: string) => void;
}

export function PatientForm({ onSuccess }: PatientFormProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      dateNaissance: "",
      sexe: "HOMME",
      telephone: "",
      email: "",
      ssn: "",
      adresse: "",
      codePostal: "",
      ville: "",
      contexteMedical: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/patients", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      toast({
        title: "Patient créé",
        description: "Le patient a été ajouté avec succès.",
        variant: "success",
      });
      onSuccess?.(data.id);
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="prenom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom</FormLabel>
                <FormControl>
                  <Input placeholder="Jean" {...field} data-testid="input-patient-prenom" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input placeholder="Dupont" {...field} data-testid="input-patient-nom" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dateNaissance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de naissance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-patient-date-naissance" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sexe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sexe</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-patient-sexe">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="HOMME">Homme</SelectItem>
                    <SelectItem value="FEMME">Femme</SelectItem>
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
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="06 12 34 56 78"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-patient-telephone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="jean.dupont@email.com"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-patient-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="ssn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de sécurité sociale</FormLabel>
              <FormControl>
                <Input
                  placeholder="1 23 45 67 890 123 45"
                  {...field}
                  value={field.value || ""}
                  data-testid="input-patient-ssn"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="adresse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Input
                  placeholder="123 Rue de la Paix"
                  {...field}
                  value={field.value || ""}
                  data-testid="input-patient-adresse"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="codePostal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code postal</FormLabel>
                <FormControl>
                  <Input
                    placeholder="75001"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-patient-code-postal"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ville"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Paris"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-patient-ville"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contexteMedical"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contexte médical</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Antécédents médicaux, allergies, traitements en cours..."
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                  data-testid="textarea-patient-contexte"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-patient">
            {mutation.isPending ? "Création..." : "Créer le patient"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
