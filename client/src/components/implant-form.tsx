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

const implantFormSchema = z.object({
  typeImplant: z.enum(["IMPLANT", "MINI_IMPLANT"]),
  marque: z.string().min(1, "Marque requise"),
  referenceFabricant: z.string().optional(),
  diametre: z.coerce.number().min(1, "Diametre requis"),
  longueur: z.coerce.number().min(1, "Longueur requise"),
});

type ImplantFormData = z.infer<typeof implantFormSchema>;

interface ImplantFormProps {
  onSuccess?: () => void;
}

const commonBrands = [
  "Bredent",
  "BioHorizons",
  "Dentsply Sirona",
  "MIS Implants",
  "Neodent",
  "Nobel Biocare",
  "Osstem",
  "Straumann",
  "Zimmer Biomet",
];

export function ImplantForm({ onSuccess }: ImplantFormProps) {
  const { toast } = useToast();
  const [customBrand, setCustomBrand] = useState(false);

  const form = useForm<ImplantFormData>({
    resolver: zodResolver(implantFormSchema),
    defaultValues: {
      typeImplant: "IMPLANT",
      marque: "",
      referenceFabricant: "",
      diametre: 4,
      longueur: 10,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ImplantFormData) => {
      const implantData = {
        typeImplant: data.typeImplant,
        marque: data.marque,
        referenceFabricant: data.referenceFabricant || null,
        diametre: data.diametre,
        longueur: data.longueur,
      };

      const res = await apiRequest("POST", "/api/implants", implantData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Implant cree",
        description: "L'implant a ete ajoute au catalogue.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
      form.reset();
      setCustomBrand(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de creer l'implant.",
        variant: "destructive",
      });
      console.error("Create implant error:", error);
    },
  });

  const onSubmit = (data: ImplantFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="typeImplant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-type-implant">
                    <SelectValue placeholder="Selectionnez le type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="IMPLANT">Implant</SelectItem>
                  <SelectItem value="MINI_IMPLANT">Mini-implant</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    data-testid="input-marque"
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
                    <SelectTrigger data-testid="select-marque">
                      <SelectValue placeholder="Selectionnez une marque" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {commonBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
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
              <FormLabel>Reference fabricant</FormLabel>
              <FormControl>
                <Input 
                  placeholder="ex: BLT-4010" 
                  {...field} 
                  data-testid="input-reference"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="diametre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diametre (mm)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1" 
                    {...field} 
                    data-testid="input-diametre"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longueur"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longueur (mm)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.5" 
                    {...field} 
                    data-testid="input-longueur"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            data-testid="button-submit-implant"
          >
            {createMutation.isPending ? "Creation..." : "Ajouter au catalogue"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
