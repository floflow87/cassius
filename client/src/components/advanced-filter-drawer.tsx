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
import type { FilterGroup, FilterRule, FilterField, FilterOperator, FilterFieldConfig } from "@shared/types";

export type { FilterGroup, FilterRule } from "@shared/types";

const FILTER_FIELD_CONFIGS: FilterFieldConfig[] = [
  { field: "patient_nom", label: "Nom du patient", category: "patient", type: "text", operators: ["contains", "equals", "not_contains"] },
  { field: "patient_prenom", label: "Prénom du patient", category: "patient", type: "text", operators: ["contains", "equals", "not_contains"] },
  { field: "patient_dateNaissance", label: "Date de naissance", category: "patient", type: "date", operators: ["before", "after", "between"] },
  { field: "patient_statut", label: "Statut patient", category: "patient", type: "select", operators: ["equals", "not_equals"], options: [
    { value: "ACTIF", label: "Actif" },
    { value: "INACTIF", label: "Inactif" },
    { value: "ARCHIVE", label: "Archivé" },
  ]},
  { field: "patient_derniereVisite", label: "Dernière visite", category: "patient", type: "date", operators: ["after", "before", "last_n_days", "last_n_months", "last_n_years"] },
  { field: "patient_implantCount", label: "Nombre d'implants", category: "patient", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "surgery_hasSurgery", label: "A une chirurgie", category: "surgery", type: "boolean", operators: ["is_true", "is_false"] },
  { field: "surgery_dateOperation", label: "Date d'opération", category: "surgery", type: "date", operators: ["after", "before", "last_n_days", "last_n_months", "last_n_years", "between"] },
  { field: "surgery_typeIntervention", label: "Type d'intervention", category: "surgery", type: "select", operators: ["equals", "not_equals"], options: [
    { value: "POSE_IMPLANT", label: "Pose d'implant" },
    { value: "GREFFE_OSSEUSE", label: "Greffe osseuse" },
    { value: "SINUS_LIFT", label: "Sinus lift" },
    { value: "EXTRACTION_IMPLANT_IMMEDIATE", label: "Extraction + implant immédiat" },
    { value: "REPRISE_IMPLANT", label: "Reprise d'implant" },
    { value: "CHIRURGIE_GUIDEE", label: "Chirurgie guidée" },
  ]},
  { field: "implant_marque", label: "Marque d'implant", category: "implant", type: "text", operators: ["contains", "equals", "not_contains"] },
  { field: "implant_reference", label: "Référence implant", category: "implant", type: "text", operators: ["contains", "equals"] },
  { field: "implant_siteFdi", label: "Site FDI", category: "implant", type: "text", operators: ["equals", "contains"] },
  { field: "implant_statut", label: "Statut implant", category: "implant", type: "select", operators: ["equals", "not_equals"], options: [
    { value: "EN_SUIVI", label: "En suivi" },
    { value: "SUCCES", label: "Succès" },
    { value: "COMPLICATION", label: "Complication" },
    { value: "ECHEC", label: "Échec" },
  ]},
  { field: "implant_datePose", label: "Date de pose", category: "implant", type: "date", operators: ["after", "before", "last_n_days", "last_n_months", "last_n_years", "between"] },
  { field: "implant_successRate", label: "Taux de réussite (%)", category: "implant", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
];

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "est égal à",
  not_equals: "n'est pas égal à",
  contains: "contient",
  not_contains: "ne contient pas",
  greater_than: "supérieur à",
  greater_than_or_equal: "supérieur ou égal à",
  less_than: "inférieur à",
  less_than_or_equal: "inférieur ou égal à",
  between: "entre",
  is_true: "oui",
  is_false: "non",
  after: "après",
  before: "avant",
  last_n_days: "derniers jours",
  last_n_months: "derniers mois",
  last_n_years: "dernières années",
};

interface AdvancedFilterDrawerProps {
  filters: FilterGroup | null;
  onFiltersChange: (filters: FilterGroup | null) => void;
  activeFilterCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRule(): FilterRule {
  return {
    id: generateId(),
    field: "patient_nom",
    operator: "contains",
    value: "",
  };
}

function createEmptyGroup(): FilterGroup {
  return {
    id: generateId(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function AdvancedFilterDrawer({ filters, onFiltersChange, activeFilterCount }: AdvancedFilterDrawerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterGroup>(() => 
    filters || createEmptyGroup()
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const { data: savedFilters = [], isLoading: isLoadingFilters } = useQuery<SavedFilter[]>({
    queryKey: ["/api/saved-filters/patients"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; pageType: string; filterData: string }) => {
      const res = await apiRequest("POST", "/api/saved-filters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/patients"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters/patients"] });
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
      pageType: "patients",
      filterData: JSON.stringify(localFilters),
    });
  };

  const handleLoadFilter = (filter: SavedFilter, combineMode?: "AND" | "OR" | null) => {
    try {
      const parsedFilters = JSON.parse(filter.filterData) as FilterGroup;
      
      if (combineMode && filters && filters.rules.length > 0 && parsedFilters.rules.length > 0) {
        const combinedFilters: FilterGroup = {
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
      if ("field" in rule) {
        const fieldConfig = FILTER_FIELD_CONFIGS.find(c => c.field === rule.field);
        if (fieldConfig?.type === "boolean") return true;
        return rule.value !== "" && rule.value !== null;
      }
      return true;
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

  const updateRule = useCallback((ruleId: string, updates: Partial<FilterRule>) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.id !== ruleId || !("field" in r)) return r;
        const updated = { ...r, ...updates };
        if (updates.field && updates.field !== r.field) {
          const newConfig = FILTER_FIELD_CONFIGS.find(c => c.field === updates.field);
          updated.operator = newConfig?.operators[0] || "equals";
          updated.value = newConfig?.type === "boolean" ? null : "";
          updated.value2 = undefined;
        }
        return updated;
      }),
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
        <Button variant="outline" size="default" data-testid="button-advanced-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filtres avancés
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtres avancés</SheetTitle>
          <SheetDescription>
            Créez des filtres personnalisés pour affiner votre recherche de patients
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
              if (!("field" in rule)) return null;
              const filterRule = rule as FilterRule;
              const fieldConfig = FILTER_FIELD_CONFIGS.find(c => c.field === filterRule.field);

              return (
                <Card key={filterRule.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Champ</Label>
                          <Select
                            value={filterRule.field}
                            onValueChange={(value) => updateRule(filterRule.id, { field: value as FilterField })}
                          >
                            <SelectTrigger data-testid={`select-field-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="_header_patient" disabled className="font-semibold text-muted-foreground">
                                Patient
                              </SelectItem>
                              {FILTER_FIELD_CONFIGS.filter(c => c.category === "patient").map(config => (
                                <SelectItem key={config.field} value={config.field}>
                                  {config.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="_header_surgery" disabled className="font-semibold text-muted-foreground">
                                Chirurgie
                              </SelectItem>
                              {FILTER_FIELD_CONFIGS.filter(c => c.category === "surgery").map(config => (
                                <SelectItem key={config.field} value={config.field}>
                                  {config.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="_header_implant" disabled className="font-semibold text-muted-foreground">
                                Implant
                              </SelectItem>
                              {FILTER_FIELD_CONFIGS.filter(c => c.category === "implant").map(config => (
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
                            value={filterRule.operator}
                            onValueChange={(value) => updateRule(filterRule.id, { operator: value as FilterOperator })}
                          >
                            <SelectTrigger data-testid={`select-operator-${index}`}>
                              <SelectValue />
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

                      {fieldConfig?.type !== "boolean" && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Valeur</Label>
                          <FilterValueInput
                            fieldConfig={fieldConfig}
                            rule={filterRule}
                            onUpdate={(updates) => updateRule(filterRule.id, updates)}
                            index={index}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(filterRule.id)}
                      disabled={localFilters.rules.length === 1}
                      data-testid={`button-remove-rule-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button variant="outline" onClick={addRule} className="w-full" data-testid="button-add-rule">
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
            Appliquer les filtres
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
              <Button
                onClick={handleSaveFilter}
                disabled={!filterName.trim() || saveMutation.isPending}
                data-testid="button-confirm-save-favorite"
              >
                {saveMutation.isPending ? "Enregistrement..." : "Sauvegarder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

interface FilterValueInputProps {
  fieldConfig: FilterFieldConfig | undefined;
  rule: FilterRule;
  onUpdate: (updates: Partial<FilterRule>) => void;
  index: number;
}

function FilterValueInput({ fieldConfig, rule, onUpdate, index }: FilterValueInputProps) {
  if (!fieldConfig) return null;

  const isRangeOperator = rule.operator === "between";
  const isRelativeDate = ["last_n_days", "last_n_months", "last_n_years"].includes(rule.operator);

  if (fieldConfig.type === "select" && fieldConfig.options) {
    return (
      <Select
        value={String(rule.value || "")}
        onValueChange={(value) => onUpdate({ value })}
      >
        <SelectTrigger data-testid={`select-value-${index}`}>
          <SelectValue placeholder="Sélectionner..." />
        </SelectTrigger>
        <SelectContent>
          {fieldConfig.options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldConfig.type === "date" && !isRelativeDate) {
    return (
      <div className="flex gap-2">
        <Input
          type="date"
          value={String(rule.value || "")}
          onChange={(e) => onUpdate({ value: e.target.value })}
          data-testid={`input-date-${index}`}
        />
        {isRangeOperator && (
          <>
            <span className="self-center text-muted-foreground">et</span>
            <Input
              type="date"
              value={String(rule.value2 || "")}
              onChange={(e) => onUpdate({ value2: e.target.value })}
              data-testid={`input-date2-${index}`}
            />
          </>
        )}
      </div>
    );
  }

  if (fieldConfig.type === "number" || isRelativeDate) {
    return (
      <div className="flex gap-2">
        <Input
          type="number"
          value={String(rule.value || "")}
          onChange={(e) => onUpdate({ value: e.target.value ? Number(e.target.value) : "" })}
          placeholder={isRelativeDate ? "Nombre" : "Valeur"}
          data-testid={`input-number-${index}`}
        />
        {isRangeOperator && (
          <>
            <span className="self-center text-muted-foreground">et</span>
            <Input
              type="number"
              value={String(rule.value2 || "")}
              onChange={(e) => onUpdate({ value2: e.target.value ? Number(e.target.value) : "" })}
              placeholder="Valeur max"
              data-testid={`input-number2-${index}`}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <Input
      type="text"
      value={String(rule.value || "")}
      onChange={(e) => onUpdate({ value: e.target.value })}
      placeholder="Valeur..."
      data-testid={`input-text-${index}`}
    />
  );
}

export function FilterChips({ 
  filters, 
  onRemoveFilter, 
  onClearAll 
}: { 
  filters: FilterGroup | null; 
  onRemoveFilter: (ruleId: string) => void;
  onClearAll: () => void;
}) {
  if (!filters || filters.rules.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Filtres actifs:</span>
      {filters.rules.map((rule, index) => {
        if (!("field" in rule)) return null;
        const filterRule = rule as FilterRule;
        const fieldConfig = FILTER_FIELD_CONFIGS.find(c => c.field === filterRule.field);
        
        let displayValue = String(filterRule.value || "");
        if (fieldConfig?.type === "select" && fieldConfig.options) {
          const option = fieldConfig.options.find(o => o.value === filterRule.value);
          displayValue = option?.label || displayValue;
        }
        if (fieldConfig?.type === "boolean") {
          displayValue = filterRule.operator === "is_true" ? "Oui" : "Non";
        }

        const chipLabel = `${fieldConfig?.label || filterRule.field} ${OPERATOR_LABELS[filterRule.operator]} ${displayValue}`;

        return (
          <Badge 
            key={filterRule.id} 
            variant="secondary" 
            className="cursor-pointer"
            onClick={() => onRemoveFilter(filterRule.id)}
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
