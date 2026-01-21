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

  const { data: savedFilters = [] } = useQuery<SavedFilter[]>({
    queryKey: ["/api/saved-filters/surgery-implants"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; pageType: string; filterData: string }) => {
      return apiRequest("POST", "/api/saved-filters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/surgery-implants"] });
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

  const updateGroupOperator = useCallback((operator: "AND" | "OR") => {
    setLocalFilters(prev => ({ ...prev, operator }));
  }, []);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-surgery-implant-advanced-filters">
            <Filter className="h-3.5 w-3.5" />
            Filtres
            {activeFilterCount > 0 && (
              <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[450px] sm:w-[540px] flex flex-col">
          <SheetHeader>
            <SheetTitle>Filtres avancés - Implants posés</SheetTitle>
            <SheetDescription>
              Configurez des filtres pour affiner la liste des implants posés.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {savedFilters.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Favoris</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => handleLoadFilter(filter)}
                              data-testid={`button-load-filter-${filter.id}`}
                            >
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {filter.name}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleLoadFilter(filter)}>
                              Remplacer
                            </Button>
                            {filters && filters.rules.length > 0 && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleLoadFilter(filter, "AND")}>
                                  + ET
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleLoadFilter(filter, "OR")}>
                                  + OU
                                </Button>
                              </>
                            )}
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleDeleteFilter(e, filter.id)}
                          data-testid={`button-delete-filter-${filter.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Label className="text-xs">Combiner avec</Label>
                <Select value={localFilters.operator} onValueChange={(v) => updateGroupOperator(v as "AND" | "OR")}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">ET</SelectItem>
                    <SelectItem value="OR">OU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {localFilters.rules.map((rule, index) => {
                  const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
                  const needsValue = rule.operator !== "is_null" && rule.operator !== "is_not_null";
                  const needsSecondValue = rule.operator === "between";

                  return (
                    <Card key={rule.id} className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
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
                              <SelectTrigger className="flex-1 h-8 text-xs">
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

                            <Select 
                              value={rule.operator} 
                              onValueChange={(v) => updateRule(rule.id, { operator: v as SurgeryImplantFilterOperator })}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs">
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

                          {needsValue && (
                            <div className="flex gap-2">
                              {fieldConfig?.type === "enum" ? (
                                <Select 
                                  value={String(rule.value || "")} 
                                  onValueChange={(v) => updateRule(rule.id, { value: v })}
                                >
                                  <SelectTrigger className="flex-1 h-8 text-xs">
                                    <SelectValue placeholder="Valeur" />
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
                                <>
                                  <Input
                                    type="date"
                                    className="flex-1 h-8 text-xs"
                                    value={String(rule.value || "")}
                                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                    data-testid={`input-filter-value-${index}`}
                                  />
                                  {needsSecondValue && (
                                    <>
                                      <span className="flex items-center text-xs text-muted-foreground">et</span>
                                      <Input
                                        type="date"
                                        className="flex-1 h-8 text-xs"
                                        value={String(rule.value2 || "")}
                                        onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                        data-testid={`input-filter-value2-${index}`}
                                      />
                                    </>
                                  )}
                                </>
                              ) : fieldConfig?.type === "number" ? (
                                <>
                                  <Input
                                    type="number"
                                    className="flex-1 h-8 text-xs"
                                    placeholder="Valeur"
                                    value={rule.value === null ? "" : String(rule.value)}
                                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                    data-testid={`input-filter-value-${index}`}
                                  />
                                  {needsSecondValue && (
                                    <>
                                      <span className="flex items-center text-xs text-muted-foreground">et</span>
                                      <Input
                                        type="number"
                                        className="flex-1 h-8 text-xs"
                                        placeholder="Valeur"
                                        value={rule.value2 === null || rule.value2 === undefined ? "" : String(rule.value2)}
                                        onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                        data-testid={`input-filter-value2-${index}`}
                                      />
                                    </>
                                  )}
                                </>
                              ) : (
                                <Input
                                  type="text"
                                  className="flex-1 h-8 text-xs"
                                  placeholder="Valeur"
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
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeRule(rule.id)}
                            data-testid={`button-remove-rule-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" className="gap-2" onClick={addRule} data-testid="button-add-rule">
                <Plus className="h-3.5 w-3.5" />
                Ajouter une condition
              </Button>
            </div>
          </ScrollArea>

          <SheetFooter className="flex-row gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear-filters">
              Effacer
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5" 
              onClick={() => setSaveDialogOpen(true)}
              disabled={localFilters.rules.length === 0}
              data-testid="button-save-filter"
            >
              <Save className="h-3.5 w-3.5" />
              Enregistrer
            </Button>
            <Button size="sm" onClick={handleApply} data-testid="button-apply-filters">
              Appliquer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Enregistrer le filtre</DialogTitle>
            <DialogDescription>
              Donnez un nom à ce filtre pour le retrouver facilement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filter-name">Nom du filtre</Label>
            <Input
              id="filter-name"
              placeholder="Ex: Implants en succès"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="mt-2"
              data-testid="input-filter-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
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

  const getChipLabel = (rule: SurgeryImplantFilterRule): string => {
    const fieldConfig = SURGERY_IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
    const fieldLabel = fieldConfig?.label || rule.field;
    const operatorLabel = OPERATOR_LABELS[rule.operator];

    if (rule.operator === "is_null" || rule.operator === "is_not_null") {
      return `${fieldLabel} ${operatorLabel}`;
    }

    let valueLabel = String(rule.value);
    if (fieldConfig?.type === "enum" && fieldConfig.enumValues) {
      const enumOption = fieldConfig.enumValues.find(v => v.value === rule.value);
      valueLabel = enumOption?.label || valueLabel;
    }

    if (rule.operator === "between") {
      return `${fieldLabel} ${operatorLabel} ${valueLabel} et ${rule.value2}`;
    }

    return `${fieldLabel} ${operatorLabel} ${valueLabel}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.rules.map((rule, index) => (
        <Badge 
          key={rule.id} 
          variant="secondary" 
          className="gap-1.5 text-xs py-1"
        >
          {index > 0 && (
            <span className="text-muted-foreground font-normal">
              {filters.operator === "AND" ? "ET" : "OU"}
            </span>
          )}
          {getChipLabel(rule)}
          <button
            className="ml-1 hover:text-destructive transition-colors"
            onClick={() => onRemoveFilter(rule.id)}
            data-testid={`button-remove-chip-${index}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {filters.rules.length > 1 && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearAll}
          data-testid="button-clear-all-chips"
        >
          Tout effacer
        </Button>
      )}
    </div>
  );
}
