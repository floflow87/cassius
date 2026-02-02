import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const protheseFormSchema = z.object({
  marque: z.string().min(1, "Marque requise"),
  referenceFabricant: z.string().optional(),
  typeProthese: z.enum(["VISSEE", "SCELLEE"]),
});

type ProtheseFormData = z.infer<typeof protheseFormSchema>;

interface ProtheseFormProps {
  onSuccess?: () => void;
}

const commonBrands = [
  "3M ESPE",
  "BioHorizons",
  "Bredent",
  "Dentsply Sirona",
  "Ivoclar",
  "MIS Implants",
  "Neodent",
  "Nobel Biocare",
  "Osstem",
  "Straumann",
  "Zimmer Biomet",
];

export function ProtheseForm({ onSuccess }: ProtheseFormProps) {
  const { toast } = useToast();
  const [customBrand, setCustomBrand] = useState(false);

  const form = useForm<ProtheseFormData>({
    resolver: zodResolver(protheseFormSchema),
    defaultValues: {
      marque: "",
      referenceFabricant: "",
      typeProthese: "VISSEE",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProtheseFormData) => {
      const protheseData = {
        typeImplant: "PROTHESE" as const,
        marque: data.marque,
        referenceFabricant: data.referenceFabricant || null,
        diametre: 0,
        longueur: 0,
        typeProthese: data.typeProthese,
      };

      const res = await apiRequest("POST", "/api/implants", protheseData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prothèse créée",
        description: "La prothèse a été ajoutée au catalogue.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
      form.reset();
      setCustomBrand(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la prothèse.",
        variant: "destructive",
      });
      console.error("Create prothese error:", error.message);
    },
  });

  const onSubmit = (data: ProtheseFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="marque"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marque</FormLabel>
              {customBrand ? (
                <FormControl>
                  <Input 
                    placeholder="Entrez la marque" 
                    {...field} 
                    data-testid="input-marque-prothese"
                  />
                </FormControl>
              ) : (
                <Select onValueChange={(v) => {
                  if (v === "__custom__") {
                    setCustomBrand(true);
                    field.onChange("");
                  } else {
                    field.onChange(v);
                  }
                }} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-marque-prothese">
                      <SelectValue placeholder="Sélectionnez une marque" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {commonBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Autre...</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="referenceFabricant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Référence fabricant (optionnel)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ex: PRO-2024" 
                  {...field} 
                  data-testid="input-reference-prothese"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="typeProthese"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de prothèse</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-type-prothese">
                    <SelectValue placeholder="Sélectionnez le type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="VISSEE">Vissée</SelectItem>
                  <SelectItem value="SCELLEE">Scellée</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={createMutation.isPending}
          data-testid="button-submit-prothese"
        >
          {createMutation.isPending ? "Création..." : "Créer la prothèse"}
        </Button>
      </form>
    </Form>
  );
}
