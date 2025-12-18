import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import type { Patient } from "@shared/schema";

const implantFormSchema = z.object({
  patientId: z.string().min(1, "Selectionnez un patient"),
  marque: z.string().min(1, "Marque requise"),
  referenceFabricant: z.string().optional(),
  diametre: z.coerce.number().min(1, "Diametre requis"),
  longueur: z.coerce.number().min(1, "Longueur requise"),
  siteFdi: z.string().min(1, "Site FDI requis"),
  typeOs: z.string().optional(),
  positionImplant: z.string().optional(),
  isqPose: z.coerce.number().optional(),
  datePose: z.string().min(1, "Date de pose requise"),
});

type ImplantFormData = z.infer<typeof implantFormSchema>;

interface ImplantFormProps {
  onSuccess?: () => void;
}

const boneTypes = ["D1", "D2", "D3", "D4"];
const positions = ["CRESTAL", "SOUS_CRESTAL", "SUPRA_CRESTAL"];
const commonBrands = [
  "Straumann",
  "Nobel Biocare",
  "Zimmer Biomet",
  "Dentsply Sirona",
  "BioHorizons",
  "MIS Implants",
  "Osstem",
  "Neodent",
];

export function ImplantForm({ onSuccess }: ImplantFormProps) {
  const { toast } = useToast();
  const [customBrand, setCustomBrand] = useState(false);

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const form = useForm<ImplantFormData>({
    resolver: zodResolver(implantFormSchema),
    defaultValues: {
      patientId: "",
      marque: "",
      referenceFabricant: "",
      diametre: 4,
      longueur: 10,
      siteFdi: "",
      typeOs: "",
      positionImplant: "CRESTAL",
      isqPose: undefined,
      datePose: new Date().toISOString().split("T")[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ImplantFormData) => {
      const operationData = {
        patientId: data.patientId,
        dateOperation: data.datePose,
        typeIntervention: "POSE_IMPLANT",
        typeChirurgieTemps: "UN_TEMPS",
        typeChirurgieApproche: "FLAPLESS",
        greffeOsseuse: false,
        typeMiseEnCharge: "DIFFEREE",
      };

      const implantsData = [{
        marque: data.marque,
        referenceFabricant: data.referenceFabricant || null,
        diametre: data.diametre,
        longueur: data.longueur,
        siteFdi: data.siteFdi,
        typeOs: data.typeOs || null,
        positionImplant: data.positionImplant || "CRESTAL",
        isqPose: data.isqPose || null,
      }];

      const res = await apiRequest("POST", "/api/operations", {
        operation: operationData,
        implants: implantsData,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Implant cree",
        description: "L'implant a ete ajoute avec succes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      form.reset();
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
          name="patientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Patient</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Selectionnez un patient" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.prenom} {patient.nom}
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
          name="datePose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de pose</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-date-pose" />
              </FormControl>
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

        <FormField
          control={form.control}
          name="siteFdi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site FDI</FormLabel>
              <FormControl>
                <Input 
                  placeholder="ex: 36" 
                  {...field} 
                  data-testid="input-site-fdi"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="typeOs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type d'os</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-type-os">
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {boneTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
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
            name="positionImplant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-position">
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos.replace(/_/g, " ")}
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
          name="isqPose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ISQ a la pose</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="ex: 68" 
                  {...field} 
                  value={field.value || ""}
                  data-testid="input-isq-pose"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            data-testid="button-submit-implant"
          >
            {createMutation.isPending ? "Creation..." : "Creer l'implant"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
