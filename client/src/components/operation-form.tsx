import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Check, ChevronsUpDown, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Implant } from "@shared/schema";
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
  catalogImplantId: z.string().min(1, "Sélectionnez un implant du catalogue"),
  siteFdi: z.string().min(1, "Le site FDI est requis"),
  positionImplant: z.enum(["CRESTAL", "SOUS_CRESTAL", "SUPRA_CRESTAL"]).optional(),
  typeOs: z.enum(["D1", "D2", "D3", "D4"]).optional(),
  miseEnChargePrevue: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).optional(),
  isqPose: z.number().min(0).max(100).optional(),
});

const protheseSchema = z.object({
  catalogProtheseId: z.string().min(1, "Sélectionnez une prothèse du catalogue"),
  siteFdi: z.string().min(1, "Le site FDI est requis"),
  mobilite: z.enum(["AMOVIBLE", "FIXE"]).optional(),
  typePilier: z.enum(["MULTI_UNIT", "DROIT", "ANGULE"]).optional(),
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
    "POSE_PROTHESE",
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
  protheses: z.array(protheseSchema).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface DefaultImplant {
  catalogImplantId: string;
  siteFdi: string;
}

interface OperationFormProps {
  patientId: string;
  onSuccess?: () => void;
  defaultImplant?: DefaultImplant;
}

export function OperationForm({ patientId, onSuccess, defaultImplant }: OperationFormProps) {
  const { toast } = useToast();
  const [accordionValue, setAccordionValue] = useState<string[]>(["procedure"]);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [openProthesePopoverIndex, setOpenProthesePopoverIndex] = useState<number | null>(null);

  const { data: catalogImplants = [], isLoading: isCatalogLoading, isError: isCatalogError } = useQuery<Implant[]>({
    queryKey: ["/api/implants"],
  });

  useEffect(() => {
    if (isCatalogError) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le catalogue d'implants. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  }, [isCatalogError, toast]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateOperation: new Date().toISOString().split("T")[0],
      typeIntervention: "POSE_IMPLANT",
      greffeOsseuse: false,
      implants: [],
      protheses: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "implants",
  });

  const { fields: protheseFields, append: appendProthese, remove: removeProthese } = useFieldArray({
    control: form.control,
    name: "protheses",
  });

  useEffect(() => {
    if (defaultImplant && defaultImplant.catalogImplantId && fields.length === 0) {
      append({
        catalogImplantId: defaultImplant.catalogImplantId,
        siteFdi: defaultImplant.siteFdi,
        positionImplant: undefined,
        typeOs: undefined,
        miseEnChargePrevue: undefined,
        isqPose: undefined,
      });
      setAccordionValue(["procedure", "implants"]);
    }
  }, [defaultImplant, append, fields.length]);

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
    console.log("Form submitted with data:", data);
    const enrichedData = {
      ...data,
      implants: data.implants.map((implant) => {
        const catalogImplant = catalogImplants.find(
          (c) => c.id === implant.catalogImplantId
        );
        return {
          ...implant,
          implantId: implant.catalogImplantId,
          marque: catalogImplant?.marque || "",
          referenceFabricant: catalogImplant?.referenceFabricant || "",
          diametre: catalogImplant?.diametre || 0,
          longueur: catalogImplant?.longueur || 0,
          lot: catalogImplant?.lot || null,
        };
      }),
      protheses: data.protheses.map((prothese) => ({
        implantId: prothese.catalogProtheseId,
        siteFdi: prothese.siteFdi,
        mobilite: prothese.mobilite,
        typePilier: prothese.typePilier,
      })),
    };
    mutation.mutate(enrichedData as unknown as FormData);
  };

  const addImplant = () => {
    append({
      catalogImplantId: "",
      siteFdi: "",
      positionImplant: undefined,
      typeOs: undefined,
      miseEnChargePrevue: undefined,
      isqPose: undefined,
    });
    setAccordionValue([...accordionValue, "implants"]);
  };

  const addProthese = () => {
    appendProthese({
      catalogProtheseId: "",
      siteFdi: "",
      mobilite: undefined,
      typePilier: undefined,
    });
    setAccordionValue([...accordionValue, "protheses"]);
  };

  const getImplantLabel = (implant: Implant) => {
    return `${implant.marque} ${implant.referenceFabricant || ""} - Ø${implant.diametre}mm x ${implant.longueur}mm`.trim();
  };

  const getProtheseLabel = (prothese: Implant) => {
    const parts = [prothese.marque];
    if (prothese.quantite) parts.push(`(${prothese.quantite})`);
    return parts.join(" ");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
        console.log("Form validation errors:", errors);
        if (errors.implants) {
          if (!accordionValue.includes("implants")) {
            setAccordionValue([...accordionValue, "implants"]);
          }
          toast({
            title: "Erreur de validation",
            description: "Veuillez remplir tous les champs requis pour les implants (Site FDI, sélection d'implant)",
            variant: "destructive",
          });
        }
      })} className="space-y-4">
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full"
        >
          <AccordionItem value="procedure" className="border border-primary/20 rounded-md px-4 mb-2">
            <AccordionTrigger className="text-sm font-medium">
              Intervention
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
                          <SelectItem value="POSE_PROTHESE">Pose de prothèse</SelectItem>
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

          <AccordionItem value="implants" className="border border-primary/20 rounded-md px-4 mb-2">
            <AccordionTrigger className="text-sm font-medium">
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`implants.${index}.catalogImplantId`}
                        render={({ field }) => {
                          const selectedImplant = catalogImplants.find(
                            (impl) => impl.id === field.value
                          );
                          return (
                            <FormItem className="flex flex-col">
                              <FormLabel>Implant du catalogue</FormLabel>
                              <Popover
                                open={openPopoverIndex === index}
                                onOpenChange={(open) =>
                                  setOpenPopoverIndex(open ? index : null)
                                }
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      disabled={isCatalogLoading}
                                      className={cn(
                                        "justify-between w-full",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      data-testid={`button-select-implant-${index}`}
                                    >
                                      {isCatalogLoading ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Chargement...
                                        </>
                                      ) : selectedImplant ? (
                                        <span className="truncate">{getImplantLabel(selectedImplant)}</span>
                                      ) : (
                                        "Sélectionner un implant"
                                      )}
                                      {!isCatalogLoading && (
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      )}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start" onWheelCapture={(e) => e.stopPropagation()}>
                                  <Command>
                                    <CommandInput placeholder="Rechercher un implant..." />
                                    <CommandList>
                                      {isCatalogError ? (
                                        <div className="p-4 text-sm text-destructive text-center">
                                          Erreur lors du chargement du catalogue
                                        </div>
                                      ) : catalogImplants.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground text-center">
                                          Aucun implant dans le catalogue. Ajoutez des implants dans la section Catalogue.
                                        </div>
                                      ) : (
                                        <>
                                          <CommandEmpty>Aucun implant trouvé</CommandEmpty>
                                          <CommandGroup>
                                            {[...catalogImplants].sort((a, b) => {
                                              if (a.isFavorite && !b.isFavorite) return -1;
                                              if (!a.isFavorite && b.isFavorite) return 1;
                                              const labelA = `${a.marque} ${a.referenceFabricant || ""} ${a.diametre} ${a.longueur}`;
                                              const labelB = `${b.marque} ${b.referenceFabricant || ""} ${b.diametre} ${b.longueur}`;
                                              return labelA.localeCompare(labelB);
                                            }).map((implant) => (
                                              <CommandItem
                                                key={implant.id}
                                                value={getImplantLabel(implant)}
                                                onSelect={() => {
                                                  field.onChange(implant.id);
                                                  setOpenPopoverIndex(null);
                                                }}
                                                data-testid={`option-implant-${implant.id}`}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    field.value === implant.id
                                                      ? "opacity-100"
                                                      : "opacity-0"
                                                  )}
                                                />
                                                <div className="flex flex-col">
                                                  <span className="font-medium flex items-center gap-1">
                                                    {implant.isFavorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                                                    {implant.marque} {implant.referenceFabricant}
                                                  </span>
                                                  <span className="text-sm text-muted-foreground">
                                                    Ø{implant.diametre}mm x {implant.longueur}mm
                                                    {implant.lot && ` - Lot: ${implant.lot}`}
                                                  </span>
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={form.control}
                        name={`implants.${index}.siteFdi`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
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

          <AccordionItem value="protheses" className="border border-primary/20 rounded-md px-4 mb-2">
            <AccordionTrigger className="text-sm font-medium">
              Prothèses ({protheseFields.length})
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {protheseFields.map((field, index) => {
                const catalogProtheses = catalogImplants.filter(i => i.typeImplant === "PROTHESE");
                const sortedProtheses = [...catalogProtheses].sort((a, b) => {
                  if (a.isFavorite && !b.isFavorite) return -1;
                  if (!a.isFavorite && b.isFavorite) return 1;
                  return a.marque.localeCompare(b.marque);
                });
                const selectedProthese = catalogProtheses.find(p => p.id === form.watch(`protheses.${index}.catalogProtheseId`));

                return (
                  <Card key={field.id} className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeProthese(index)}
                      data-testid={`button-remove-prothese-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Prothèse {index + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`protheses.${index}.catalogProtheseId`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Prothèse du catalogue</FormLabel>
                              <Popover 
                                open={openProthesePopoverIndex === index} 
                                onOpenChange={(open) => setOpenProthesePopoverIndex(open ? index : null)}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "justify-between",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      data-testid={`select-prothese-catalogue-${index}`}
                                    >
                                      {selectedProthese 
                                        ? getProtheseLabel(selectedProthese)
                                        : "Sélectionner une prothèse..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Rechercher une prothèse..." />
                                    <CommandList>
                                      <CommandEmpty>Aucune prothèse trouvée</CommandEmpty>
                                      <CommandGroup heading="Prothèses du catalogue">
                                        {sortedProtheses.map((prothese) => (
                                          <CommandItem
                                            key={prothese.id}
                                            value={`${prothese.marque} ${prothese.quantite || ""}`}
                                            onSelect={() => {
                                              field.onChange(prothese.id);
                                              setOpenProthesePopoverIndex(null);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value === prothese.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <span className="flex items-center gap-1">
                                              {prothese.isFavorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                                              {getProtheseLabel(prothese)}
                                            </span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`protheses.${index}.siteFdi`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Site FDI</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: 16"
                                  {...field}
                                  data-testid={`input-prothese-fdi-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`protheses.${index}.mobilite`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mobilité</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-prothese-mobilite-${index}`}>
                                    <SelectValue placeholder="Sélectionner..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="AMOVIBLE">Amovible</SelectItem>
                                  <SelectItem value="FIXE">Fixe</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`protheses.${index}.typePilier`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type de pilier</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-prothese-pilier-${index}`}>
                                    <SelectValue placeholder="Sélectionner..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="MULTI_UNIT">Multi-unit</SelectItem>
                                  <SelectItem value="DROIT">Droit</SelectItem>
                                  <SelectItem value="ANGULE">Angulé</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addProthese}
                className="w-full"
                data-testid="button-add-prothese"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une prothèse
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="greffe" className="border border-primary/20 rounded-md px-4 mb-2">
            <AccordionTrigger className="text-sm font-medium">
              Greffe osseuse
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="greffeOsseuse"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <FormLabel>Greffe osseuse réalisée</FormLabel>
                        <FormDescription>
                          Indiquez si une greffe a été effectuée
                        </FormDescription>
                      </div>
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

          <AccordionItem value="notes" className="border border-primary/20 rounded-md px-4 mb-2">
            <AccordionTrigger className="text-sm font-medium">
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
        </Accordion>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-operation">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer l'acte"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
