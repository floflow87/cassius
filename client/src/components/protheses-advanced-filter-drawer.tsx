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
import { Filter, Plus, Trash2, Save, Star } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedFilter } from "@shared/schema";

export type ProtheseFilterField = 
  | "marque"
  | "referenceFabricant"
  | "typeProthese"
  | "poseCount";

export type ProtheseFilterOperator = 
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between";

export interface ProtheseFilterRule {
  id: string;
  field: ProtheseFilterField;
  operator: ProtheseFilterOperator;
  value: string | number | null;
  value2?: string | number | null;
}

export interface ProtheseFilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: ProtheseFilterRule[];
}

interface ProtheseFilterFieldConfig {
  field: ProtheseFilterField;
  label: string;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  operators: ProtheseFilterOperator[];
}

const PROTHESE_FILTER_CONFIGS: ProtheseFilterFieldConfig[] = [
  { field: "marque", label: "Marque", type: "text", operators: ["contains", "equals", "not_contains", "not_equals"] },
  { field: "referenceFabricant", label: "Référence fabricant", type: "text", operators: ["contains", "equals", "not_contains"] },
  { 
    field: "typeProthese", 
    label: "Type de prothèse", 
    type: "select", 
    options: [
      { value: "VISSEE", label: "Vissée" },
      { value: "SCELLEE", label: "Scellée" },
    ],
    operators: ["equals", "not_equals"] 
  },
  { field: "poseCount", label: "Nombre de poses", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
];

const OPERATOR_LABELS: Record<ProtheseFilterOperator, string> = {
  equals: "est égal à",
  not_equals: "n'est pas égal à",
  contains: "contient",
  not_contains: "ne contient pas",
  greater_than: "supérieur à",
  greater_than_or_equal: "supérieur ou égal à",
  less_than: "inférieur à",
  less_than_or_equal: "inférieur ou égal à",
  between: "entre",
};

interface ProthesesAdvancedFilterDrawerProps {
  filters: ProtheseFilterGroup | null;
  onFiltersChange: (filters: ProtheseFilterGroup | null) => void;
  activeFilterCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRule(): ProtheseFilterRule {
  return {
    id: generateId(),
    field: "marque",
    operator: "contains",
    value: "",
  };
}

function createEmptyGroup(): ProtheseFilterGroup {
  return {
    id: generateId(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function ProthesesAdvancedFilterDrawer({ filters, onFiltersChange, activeFilterCount }: ProthesesAdvancedFilterDrawerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ProtheseFilterGroup>(() => 
    filters || createEmptyGroup()
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const { data: savedFilters = [], isLoading: isLoadingFilters } = useQuery<SavedFilter[]>({
    queryKey: ["/api/saved-filters/protheses"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; pageType: string; filterData: string }) => {
      return apiRequest("POST", "/api/saved-filters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/protheses"] });
      toast({ title: "Favori enregistré", description: "Le filtre a été ajouté à vos favoris." });
      setSaveDialogOpen(false);
      setFilterName("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder le filtre.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/saved-filters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/protheses"] });
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
      pageType: "protheses",
      filterData: JSON.stringify(localFilters),
    });
  };

  const handleLoadFilter = (filter: SavedFilter, combineMode?: "AND" | "OR" | null) => {
    try {
      const parsedFilters = JSON.parse(filter.filterData) as ProtheseFilterGroup;
      
      if (combineMode && filters && filters.rules.length > 0 && parsedFilters.rules.length > 0) {
        const combinedFilters: ProtheseFilterGroup = {
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
      if (rule.value === "" || rule.value === null) return false;
      
      const fieldConfig = PROTHESE_FILTER_CONFIGS.find(c => c.field === rule.field);
      if (fieldConfig?.type === "number") {
        const numValue = Number(rule.value);
        if (isNaN(numValue)) return false;
        if (rule.operator === "between" && (rule.value2 === "" || rule.value2 === null || isNaN(Number(rule.value2)))) {
          return false;
        }
      }
      return true;
    }).map(rule => {
      const fieldConfig = PROTHESE_FILTER_CONFIGS.find(c => c.field === rule.field);
      if (fieldConfig?.type === "number") {
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
      onFiltersChange({ ...localFilters, rules: validRules });
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

  const updateRule = useCallback((ruleId: string, updates: Partial<ProtheseFilterRule>) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r),
    }));
  }, []);

  const toggleOperator = useCallback(() => {
    setLocalFilters(prev => ({
      ...prev,
      operator: prev.operator === "AND" ? "OR" : "AND",
    }));
  }, []);

  const hasValidFilters = localFilters.rules.some(rule => rule.value !== "" && rule.value !== null);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="default" 
            className="bg-white dark:bg-zinc-900"
            data-testid="btn-prothese-advanced-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtres avancés
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Filtres avancés - Catalogue prothèses</SheetTitle>
            <SheetDescription>
              Créez des filtres personnalisés pour affiner votre recherche de prothèses
            </SheetDescription>
          </SheetHeader>

          <div className="py-6 space-y-6">
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
                    {savedFilters.map((sf) => (
                      <div 
                        key={sf.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate"
                        data-testid={`saved-prothese-filter-${sf.id}`}
                      >
                        <span 
                          className="text-sm truncate flex-1 cursor-pointer"
                          onClick={() => handleLoadFilter(sf)}
                        >
                          {sf.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleLoadFilter(sf, "AND")}
                                data-testid={`button-combine-and-${sf.id}`}
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
                                onClick={() => handleLoadFilter(sf, "OR")}
                                data-testid={`button-combine-or-${sf.id}`}
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
                            onClick={(e) => handleDeleteFilter(e, sf.id)}
                            data-testid={`delete-prothese-filter-${sf.id}`}
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

            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Combiner les filtres avec :</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleOperator}
                data-testid="toggle-prothese-operator"
              >
                {localFilters.operator === "AND" ? "ET (tous)" : "OU (un parmi)"}
              </Button>
            </div>

            <div className="space-y-4">
              {localFilters.rules.map((rule, index) => {
                const fieldConfig = PROTHESE_FILTER_CONFIGS.find(c => c.field === rule.field);
                
                return (
                  <Card key={rule.id} className="p-3 space-y-3">
                    {index > 0 && (
                      <div className="text-center text-xs text-muted-foreground font-mono">
                        {localFilters.operator}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16">Champ</Label>
                        <Select
                          value={rule.field}
                          onValueChange={(value: ProtheseFilterField) => {
                            const newConfig = PROTHESE_FILTER_CONFIGS.find(c => c.field === value);
                            updateRule(rule.id, { 
                              field: value, 
                              operator: newConfig?.operators[0] || "contains",
                              value: "",
                              value2: undefined,
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1" data-testid={`prothese-filter-field-${rule.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROTHESE_FILTER_CONFIGS.map((config) => (
                              <SelectItem key={config.field} value={config.field}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {localFilters.rules.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRule(rule.id)}
                            data-testid={`remove-prothese-rule-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16">Opérateur</Label>
                        <Select
                          value={rule.operator}
                          onValueChange={(value: ProtheseFilterOperator) => updateRule(rule.id, { operator: value })}
                        >
                          <SelectTrigger className="flex-1" data-testid={`prothese-filter-operator-${rule.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldConfig?.operators.map((op) => (
                              <SelectItem key={op} value={op}>
                                {OPERATOR_LABELS[op]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16">Valeur</Label>
                        {fieldConfig?.type === "select" ? (
                          <Select
                            value={String(rule.value || "")}
                            onValueChange={(value) => updateRule(rule.id, { value })}
                          >
                            <SelectTrigger className="flex-1" data-testid={`prothese-filter-value-${rule.id}`}>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldConfig.options?.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex-1 flex gap-2">
                            <Input
                              type={fieldConfig?.type === "number" ? "number" : "text"}
                              value={rule.value ?? ""}
                              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                              placeholder="Valeur..."
                              className="flex-1"
                              data-testid={`prothese-filter-value-${rule.id}`}
                            />
                            {rule.operator === "between" && (
                              <Input
                                type="number"
                                value={rule.value2 ?? ""}
                                onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                placeholder="et..."
                                className="flex-1"
                                data-testid={`prothese-filter-value2-${rule.id}`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2" 
                onClick={addRule}
                data-testid="add-prothese-rule"
              >
                <Plus className="h-4 w-4" />
                Ajouter un filtre
              </Button>
            </div>
          </div>

          <SheetFooter className="gap-2">
            <div className="flex items-center gap-2 w-full">
              {hasValidFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setSaveDialogOpen(true)}
                      data-testid="save-prothese-filter"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enregistrer en favori</TooltipContent>
                </Tooltip>
              )}
              <Button 
                variant="ghost" 
                onClick={handleClear} 
                className="flex-1"
                data-testid="clear-prothese-filters"
              >
                Effacer tout
              </Button>
              <Button 
                onClick={handleApply} 
                className="flex-1"
                data-testid="apply-prothese-filters"
              >
                Appliquer les filtres
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer le filtre</DialogTitle>
            <DialogDescription>
              Donnez un nom à ce filtre pour le retrouver facilement
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Nom du filtre..."
              data-testid="prothese-filter-name-input"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProtheseFilterChips({ 
  filters, 
  onFiltersChange 
}: { 
  filters: ProtheseFilterGroup | null; 
  onFiltersChange: (filters: ProtheseFilterGroup | null) => void;
}) {
  if (!filters || filters.rules.length === 0) return null;

  const removeRule = (ruleId: string) => {
    const newRules = filters.rules.filter(r => r.id !== ruleId);
    if (newRules.length === 0) {
      onFiltersChange(null);
    } else {
      onFiltersChange({ ...filters, rules: newRules });
    }
  };

  const getFieldLabel = (field: ProtheseFilterField) => {
    return PROTHESE_FILTER_CONFIGS.find(c => c.field === field)?.label || field;
  };

  const getValueLabel = (rule: ProtheseFilterRule) => {
    const fieldConfig = PROTHESE_FILTER_CONFIGS.find(c => c.field === rule.field);
    if (fieldConfig?.type === "select" && fieldConfig.options) {
      const option = fieldConfig.options.find(o => o.value === rule.value);
      return option?.label || String(rule.value);
    }
    return String(rule.value);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filters.rules.map((rule, index) => (
        <Badge 
          key={rule.id} 
          variant="secondary" 
          className="gap-1 pr-1 text-xs"
        >
          {index > 0 && (
            <span className="font-mono mr-1 opacity-60">{filters.operator}</span>
          )}
          <span className="font-medium">{getFieldLabel(rule.field)}</span>
          <span className="opacity-60 mx-1">{OPERATOR_LABELS[rule.operator]}</span>
          <span>
            {getValueLabel(rule)}
            {rule.operator === "between" && rule.value2 !== undefined && ` - ${rule.value2}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 ml-1 hover:bg-destructive/20"
            onClick={() => removeRule(rule.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-6 text-xs text-muted-foreground"
        onClick={() => onFiltersChange(null)}
      >
        Tout effacer
      </Button>
    </div>
  );
}

export function applyProtheseFilters<T extends { 
  marque?: string | null; 
  referenceFabricant?: string | null;
  typeProthese?: string | null;
  poseCount?: number;
}>(
  items: T[], 
  filters: ProtheseFilterGroup | null
): T[] {
  if (!filters || filters.rules.length === 0) return items;

  return items.filter(item => {
    const results = filters.rules.map(rule => {
      let fieldValue: string | number | null | undefined;
      
      switch (rule.field) {
        case "marque":
          fieldValue = item.marque;
          break;
        case "referenceFabricant":
          fieldValue = item.referenceFabricant;
          break;
        case "typeProthese":
          fieldValue = item.typeProthese;
          break;
        case "poseCount":
          fieldValue = item.poseCount;
          break;
        default:
          return true;
      }

      if (fieldValue === null || fieldValue === undefined) {
        return rule.operator === "not_equals" || rule.operator === "not_contains";
      }

      const ruleValue = rule.value;
      const ruleValue2 = rule.value2;

      switch (rule.operator) {
        case "equals":
          return String(fieldValue).toLowerCase() === String(ruleValue).toLowerCase();
        case "not_equals":
          return String(fieldValue).toLowerCase() !== String(ruleValue).toLowerCase();
        case "contains":
          return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
        case "not_contains":
          return !String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
        case "greater_than":
          return Number(fieldValue) > Number(ruleValue);
        case "greater_than_or_equal":
          return Number(fieldValue) >= Number(ruleValue);
        case "less_than":
          return Number(fieldValue) < Number(ruleValue);
        case "less_than_or_equal":
          return Number(fieldValue) <= Number(ruleValue);
        case "between":
          return Number(fieldValue) >= Number(ruleValue) && Number(fieldValue) <= Number(ruleValue2);
        default:
          return true;
      }
    });

    return filters.operator === "AND" 
      ? results.every(r => r)
      : results.some(r => r);
  });
}
