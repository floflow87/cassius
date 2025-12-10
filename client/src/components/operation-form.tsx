import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const implantSchema = z.object({
  marque: z.string().min(1, "La marque est requise"),
  referenceFabricant: z.string().optional(),
  diametre: z.number().min(0.1, "Le diamètre doit être positif"),
  longueur: z.number().min(0.1, "La longueur doit être positive"),
  siteFdi: z.string().min(1, "Le site FDI est requis"),
  positionImplant: z.enum(["CRESTAL", "SOUS_CRESTAL", "SUPRA_CRESTAL"]).optional(),
  typeOs: z.enum(["D1", "D2", "D3", "D4"]).optional(),
  miseEnChargePrevue: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).optional(),
  isqPose: z.number().min(0).max(100).optional(),
});

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
  typeChirurgieTemps: z.enum(["UN_TEMPS", "DEUX_TEMPS"]).optional(),
  typeChirurgieApproche: z.enum(["LAMBEAU", "FLAPLESS"]).optional(),
  greffeOsseuse: z.boolean().default(false),
  typeGreffe: z.string().optional(),
  greffeQuantite: z.string().optional(),
  greffeLocalisation: z.string().optional(),
  typeMiseEnCharge: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).optional(),
  conditionsMedicalesPreop: z.string().optional(),
  notesPerop: z.string().optional(),
  observationsPostop: z.string().optional(),
  implants: z.array(implantSchema).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface OperationFormProps {
  patientId: string;
  onSuccess?: () => void;
}

export function OperationForm({ patientId, onSuccess }: OperationFormProps) {
  const { toast } = useToast();
  const [accordionValue, setAccordionValue] = useState<string[]>(["procedure"]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateOperation: new Date().toISOString().split("T")[0],
      typeIntervention: "POSE_IMPLANT",
      greffeOsseuse: false,
      implants: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "implants",
  });

  const watchGreffeOsseuse = form.watch("greffeOsseuse");

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/operations", {
        ...data,
        patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({
        title: "Opération créée",
        description: "L'opération a été enregistrée avec succès.",
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

  const addImplant = () => {
    append({
      marque: "",
      referenceFabricant: "",
      diametre: 4.0,
      longueur: 10,
      siteFdi: "",
      positionImplant: undefined,
      typeOs: undefined,
      miseEnChargePrevue: undefined,
      isqPose: undefined,
    });
    setAccordionValue([...accordionValue, "implants"]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full"
        >
          <AccordionItem value="procedure">
            <AccordionTrigger className="text-base font-medium">
              Procédure
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dateOperation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de l'opération</FormLabel>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type-intervention">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="POSE_IMPLANT">Pose d'implant</SelectItem>
                          <SelectItem value="GREFFE_OSSEUSE">Greffe osseuse</SelectItem>
                          <SelectItem value="SINUS_LIFT">Sinus lift</SelectItem>
                          <SelectItem value="EXTRACTION_IMPLANT_IMMEDIATE">Extraction + Implant immédiat</SelectItem>
                          <SelectItem value="REPRISE_IMPLANT">Reprise d'implant</SelectItem>
                          <SelectItem value="CHIRURGIE_GUIDEE">Chirurgie guidée</SelectItem>
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
                          <SelectItem value="UN_TEMPS">1 temps</SelectItem>
                          <SelectItem value="DEUX_TEMPS">2 temps</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="greffe">
            <AccordionTrigger className="text-base font-medium">
              Greffe osseuse
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="greffeOsseuse"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Greffe osseuse réalisée</FormLabel>
                      <FormDescription>
                        Indiquez si une greffe a été effectuée
                      </FormDescription>
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
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="typeGreffe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de greffe</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Autogène, xénogreffe..."
                            {...field}
                            value={field.value || ""}
                          />
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
                          <Input
                            placeholder="Ex: 0.5cc"
                            {...field}
                            value={field.value || ""}
                          />
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
                          <Input
                            placeholder="Ex: Vestibulaire 16"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger className="text-base font-medium">
              Notes cliniques
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="conditionsMedicalesPreop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions pré-opératoires</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="État général du patient, médication..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
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
                    <FormLabel>Notes per-opératoires</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Déroulement de l'intervention..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-notes-perop"
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
                    <FormLabel>Observations post-opératoires</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Suites opératoires, recommandations..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="implants">
            <AccordionTrigger className="text-base font-medium">
              Implants ({fields.length})
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-sm">Implant {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-implant-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`implants.${index}.marque`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Marque</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Straumann, Nobel..."
                                {...field}
                                data-testid={`input-implant-marque-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.referenceFabricant`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Référence</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Réf. fabricant"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.siteFdi`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site FDI</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: 16"
                                {...field}
                                data-testid={`input-implant-fdi-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`implants.${index}.diametre`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diamètre (mm)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid={`input-implant-diametre-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.longueur`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longueur (mm)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.5"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid={`input-implant-longueur-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.positionImplant`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Position</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Position" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="CRESTAL">Crestal</SelectItem>
                                <SelectItem value="SOUS_CRESTAL">Sous-crestal</SelectItem>
                                <SelectItem value="SUPRA_CRESTAL">Supra-crestal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.typeOs`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type d'os</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="D1-D4" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="D1">D1</SelectItem>
                                <SelectItem value="D2">D2</SelectItem>
                                <SelectItem value="D3">D3</SelectItem>
                                <SelectItem value="D4">D4</SelectItem>
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
                        name={`implants.${index}.miseEnChargePrevue`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mise en charge prévue</FormLabel>
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
                        name={`implants.${index}.isqPose`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ISQ à la pose</FormLabel>
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
                                data-testid={`input-implant-isq-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addImplant}
                className="w-full"
                data-testid="button-add-implant"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un implant
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-operation">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer l'opération"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
