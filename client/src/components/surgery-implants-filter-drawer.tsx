import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, Plus, Trash2, X, Save, Star } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedFilter } from "@shared/schema";

export type SurgeryImplantFilterField = 
  | "datePose"
  | "statut"
  | "marque"
  | "siteFdi"
  | "isqPose"
  | "isq2m"
  | "isq3m"
  | "isq6m"
  | "diametre"
  | "longueur";

export type SurgeryImplantFilterOperator = 
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "is_null"
  | "is_not_null";

export interface SurgeryImplantFilterRule {
  id: string;
  field: SurgeryImplantFilterField;
  operator: SurgeryImplantFilterOperator;
  value: string | number | boolean | null;
  value2?: string | number | null;
}

export interface SurgeryImplantFilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: SurgeryImplantFilterRule[];
}

interface SurgeryImplantFilterFieldConfig {
  field: SurgeryImplantFilterField;
  label: string;
  type: "text" | "number" | "date" | "enum";
  operators: SurgeryImplantFilterOperator[];
  enumValues?: { value: string; label: string }[];
}

const STATUT_OPTIONS = [
  { value: "EN_SUIVI", label: "En suivi" },
  { value: "SUCCES", label: "Succès" },
  { value: "COMPLICATION", label: "Complication" },
  { value: "ECHEC", label: "Échec" },
];

const SURGERY_IMPLANT_FILTER_CONFIGS: SurgeryImplantFilterFieldConfig[] = [
  { field: "datePose", label: "Date de pose", type: "date", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "statut", label: "Statut", type: "enum", operators: ["equals", "not_equals"], enumValues: STATUT_OPTIONS },
  { field: "marque", label: "Marque", type: "text", operators: ["equals", "contains"] },
  { field: "siteFdi", label: "Position (Site FDI)", type: "text", operators: ["equals", "contains"] },
  { field: "isqPose", label: "ISQ Pose", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between", "is_null", "is_not_null"] },
  { field: "isq2m", label: "ISQ 2 mois", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between", "is_null", "is_not_null"] },
  { field: "isq3m", label: "ISQ 3 mois", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between", "is_null", "is_not_null"] },
  { field: "isq6m", label: "ISQ 6 mois", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between", "is_null", "is_not_null"] },
  { field: "diametre", label: "Diamètre (mm)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "longueur", label: "Longueur (mm)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
];

const OPERATOR_LABELS: Record<SurgeryImplantFilterOperator, string> = {
  equals: "est égal à",
  not_equals: "n'est pas égal à",
  contains: "contient",
  greater_than: "supérieur à",
  greater_than_or_equal: "supérieur ou égal à",
  less_than: "inférieur à",
  less_than_or_equal: "inférieur ou égal à",
  between: "entre",
  is_null: "est vide",
  is_not_null: "n'est pas vide",
};

interface SurgeryImplantsFilterDrawerProps {
  filters: SurgeryImplantFilterGroup | null;
  onFiltersChange: (filters: SurgeryImplantFilterGroup | null) => void;
  activeFilterCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRule(): SurgeryImplantFilterRule {
  return {
    id: generateId(),
    field: "statut",
    operator: "equals",
    value: "",
  };
}

function createEmptyGroup(): SurgeryImplantFilterGroup {
  return {
    id: generateId(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function SurgeryImplantsFilterDrawer({ filters, onFiltersChange, activeFilterCount }: SurgeryImplantsFilterDrawerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<SurgeryImplantFilterGroup>(() => 
    filters || createEmptyGroup()
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const { data: savedFilters = [], isLoading: isLoadingFilters } = useQuery<SavedFilter[]>({
    queryKey: ["/api/saved-filters/surgery-implants"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; pageType: string; filterData: string }) => {
      const res = await apiRequest("POST", "/api/saved-filters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/surgery-implants"] });
      toast({ title: "Favori enregistré", description: "Le filtre a été ajouté à vos favoris." });
      setSaveDialogOpen(false);
      setFilterName("");
    },
    onError: (error: Error) => {
      console.error("Save filter error:", error);
      toast({ title: "Erreur", description: error.message || "Impossible de sauvegarder le filtre.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/saved-filters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/surgery-implants"] });
      toast({ title: "Favori supprimé", description: "Le filtre a été retiré de vos favoris." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le filtre.", variant: "destructive" });
    },
  });

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;
    saveMutation.mutate({
      name: filterName.trim(),
      pageType: "surgery-implants",
      filterData: JSON.stringify(localFilters),
    });
  };

  const handleLoadFilter = (filter: SavedFilter, combineMode?: "AND" | "OR" | null) => {
    try {
      const parsedFilters = JSON.parse(filter.filterData) as SurgeryImplantFilterGroup;
      
      if (combineMode && filters && filters.rules.length > 0 && parsedFilters.rules.length > 0) {
        const combinedFilters: SurgeryImplantFilterGroup = {
          id: generateId(),
          operator: combineMode,
          rules: [...filters.rules, ...parsedFilters.rules],
        };
        onFiltersChange(combinedFilters);
        setIsOpen(false);
        toast({ title: "Filtres combinés", description: `"${filter.name}" combiné avec ${combineMode === "AND" ? "ET" : "OU"}.` });
        return;
      }
      
      onFiltersChange(parsedFilters);
      setIsOpen(false);
      toast({ title: "Favori appliqué", description: `"${filter.name}" a été appliqué.` });
    } catch {
      toast({ title: "Erreur", description: "Format de filtre invalide.", variant: "destructive" });
    }
  };

  const handleDeleteFilter = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleOpen = useCallback((open: boolean) => {
    if (open) {
      setLocalFilters(filters || createEmptyGroup());
    }
    setIsOpen(open);
  }, [filters]);

  const handleApply = useCallback(() => {
    const validRules = localFilters.rules.filter(rule => {
      const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
      
      if (rule.operator === "is_null" || rule.operator === "is_not_null") {
        return true;
      }
      
      if (rule.value === "" || rule.value === null) return false;
      
      if (fieldConfig?.type === "number") {
        const numValue = Number(rule.value);
        if (isNaN(numValue)) return false;
        if (rule.operator === "between" && (rule.value2 === "" || rule.value2 === null || isNaN(Number(rule.value2)))) {
          return false;
        }
      }
      
      if (fieldConfig?.type === "date" && rule.operator === "between") {
        if (rule.value2 === "" || rule.value2 === null) return false;
      }
      
      return true;
    }).map(rule => {
      const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
      if (fieldConfig?.type === "number" && rule.operator !== "is_null" && rule.operator !== "is_not_null") {
        return {
          ...rule,
          value: Number(rule.value),
          value2: rule.value2 !== undefined && rule.value2 !== null && rule.value2 !== "" ? Number(rule.value2) : undefined,
        };
      }
      return rule;
    });

    if (validRules.length === 0) {
      onFiltersChange(null);
    } else {
      onFiltersChange({
        ...localFilters,
        rules: validRules,
      });
    }
    setIsOpen(false);
  }, [localFilters, onFiltersChange]);

  const handleClear = useCallback(() => {
    setLocalFilters(createEmptyGroup());
    onFiltersChange(null);
    setIsOpen(false);
  }, [onFiltersChange]);

  const addRule = useCallback(() => {
    setLocalFilters(prev => ({
      ...prev,
      rules: [...prev.rules, createEmptyRule()],
    }));
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId),
    }));
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<SurgeryImplantFilterRule>) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r),
    }));
  }, []);

  const toggleGroupOperator = useCallback(() => {
    setLocalFilters(prev => ({
      ...prev,
      operator: prev.operator === "AND" ? "OR" : "AND",
    }));
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="default" className="bg-white dark:bg-zinc-900" data-testid="button-surgery-implant-advanced-filters">
          <Filter className="h-4 w-4 mr-2" />
          Filtres avancés
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtres avancés - Implants posés</SheetTitle>
          <SheetDescription>
            Créez des filtres personnalisés pour affiner votre recherche d'implants
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Section Favoris */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Favoris</Label>
            </div>
            {isLoadingFilters ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : savedFilters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun favori enregistré</p>
            ) : (
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {savedFilters.map((filter) => (
                    <div 
                      key={filter.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate"
                      data-testid={`favorite-filter-${filter.id}`}
                    >
                      <span 
                        className="text-sm truncate flex-1 cursor-pointer"
                        onClick={() => handleLoadFilter(filter)}
                      >
                        {filter.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleLoadFilter(filter, "AND")}
                              data-testid={`button-combine-and-${filter.id}`}
                            >
                              +ET
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Combiner avec les filtres actuels (ET)</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleLoadFilter(filter, "OR")}
                              data-testid={`button-combine-or-${filter.id}`}
                            >
                              +OU
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Combiner avec les filtres actuels (OU)</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleDeleteFilter(e, filter.id)}
                          data-testid={`button-delete-favorite-${filter.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="border-t" />

          {/* Section création de filtres */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Combiner les filtres avec :</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGroupOperator}
              data-testid="button-toggle-operator"
            >
              {localFilters.operator === "AND" ? "ET (tous)" : "OU (un parmi)"}
            </Button>
          </div>

          <div className="space-y-3">
            {localFilters.rules.map((rule, index) => {
              const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
              const needsValue = rule.operator !== "is_null" && rule.operator !== "is_not_null";
              const needsSecondValue = rule.operator === "between";

              return (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Champ</Label>
                          <Select 
                            value={rule.field} 
                            onValueChange={(v) => {
                              const newFieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === v);
                              updateRule(rule.id, { 
                                field: v as SurgeryImplantFilterField,
                                operator: newFieldConfig?.operators[0] || "equals",
                                value: "",
                                value2: undefined,
                              });
                            }}
                          >
                            <SelectTrigger data-testid={`select-field-${index}`}>
                              <SelectValue placeholder="Champ" />
                            </SelectTrigger>
                            <SelectContent>
                              {SURGERY_IMPLANT_FILTER_CONFIGS.map(config => (
                                <SelectItem key={config.field} value={config.field}>
                                  {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Opérateur</Label>
                          <Select 
                            value={rule.operator} 
                            onValueChange={(v) => updateRule(rule.id, { operator: v as SurgeryImplantFilterOperator })}
                          >
                            <SelectTrigger data-testid={`select-operator-${index}`}>
                              <SelectValue placeholder="Opérateur" />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldConfig?.operators.map(op => (
                                <SelectItem key={op} value={op}>
                                  {OPERATOR_LABELS[op]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {needsValue && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Valeur</Label>
                          {fieldConfig?.type === "enum" ? (
                            <Select 
                              value={String(rule.value || "")} 
                              onValueChange={(v) => updateRule(rule.id, { value: v })}
                            >
                              <SelectTrigger data-testid={`select-value-${index}`}>
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldConfig.enumValues?.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : fieldConfig?.type === "date" ? (
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={String(rule.value || "")}
                                onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                data-testid={`input-filter-value-${index}`}
                              />
                              {needsSecondValue && (
                                <>
                                  <span className="flex items-center text-muted-foreground">et</span>
                                  <Input
                                    type="date"
                                    value={String(rule.value2 || "")}
                                    onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                    data-testid={`input-filter-value2-${index}`}
                                  />
                                </>
                              )}
                            </div>
                          ) : fieldConfig?.type === "number" ? (
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="Valeur"
                                value={rule.value === null ? "" : String(rule.value)}
                                onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                data-testid={`input-filter-value-${index}`}
                              />
                              {needsSecondValue && (
                                <>
                                  <span className="flex items-center text-muted-foreground">et</span>
                                  <Input
                                    type="number"
                                    placeholder="Valeur max"
                                    value={rule.value2 === null || rule.value2 === undefined ? "" : String(rule.value2)}
                                    onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                    data-testid={`input-filter-value2-${index}`}
                                  />
                                </>
                              )}
                            </div>
                          ) : (
                            <Input
                              type="text"
                              placeholder="Valeur..."
                              value={String(rule.value || "")}
                              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                              data-testid={`input-filter-value-${index}`}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {localFilters.rules.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-6"
                        onClick={() => removeRule(rule.id)}
                        data-testid={`button-remove-rule-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Button variant="outline" className="w-full" onClick={addRule} data-testid="button-add-rule">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un filtre
          </Button>
        </div>

        <SheetFooter className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setSaveDialogOpen(true)}
                data-testid="button-save-filter-favorite"
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sauvegarder ce filtre en favoris</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={handleClear} data-testid="button-clear-filters">
            <X className="h-4 w-4 mr-2" />
            Effacer tout
          </Button>
          <Button onClick={handleApply} data-testid="button-apply-filters">
            Appliquer
          </Button>
        </SheetFooter>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter aux favoris</DialogTitle>
              <DialogDescription>
                Donnez un nom à ce filtre pour le retrouver facilement.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Nom du favori"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                data-testid="input-favorite-name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveFilter} disabled={!filterName.trim() || saveMutation.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

export function SurgeryImplantFilterChips({ 
  filters, 
  onRemoveFilter, 
  onClearAll 
}: { 
  filters: SurgeryImplantFilterGroup | null; 
  onRemoveFilter: (ruleId: string) => void;
  onClearAll: () => void;
}) {
  if (!filters || filters.rules.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Filtres actifs:</span>
      {filters.rules.map((rule, index) => {
        const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
        
        let displayValue = String(rule.value || "");
        if (fieldConfig?.type === "enum" && fieldConfig.enumValues) {
          const option = fieldConfig.enumValues.find(o => o.value === rule.value);
          displayValue = option?.label || displayValue;
        }
        if (rule.operator === "is_null") {
          displayValue = "";
        }
        if (rule.operator === "is_not_null") {
          displayValue = "";
        }

        const chipLabel = `${fieldConfig?.label || rule.field} ${OPERATOR_LABELS[rule.operator]}${displayValue ? ` ${displayValue}` : ""}`;

        return (
          <Badge 
            key={rule.id} 
            variant="secondary" 
            className="cursor-pointer"
            onClick={() => onRemoveFilter(rule.id)}
            data-testid={`filter-chip-${index}`}
          >
            {chipLabel}
            <X className="h-3 w-3 ml-1" />
          </Badge>
        );
      })}
      {filters.rules.length > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearAll}
          data-testid="button-clear-all-chips"
        >
          Tout effacer
        </Button>
      )}
    </div>
  );
}
