import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Filter, Plus, Trash2, X } from "lucide-react";

export type ActeFilterField = 
  | "dateOperation"
  | "typeIntervention"
  | "typeChirurgieTemps"
  | "typeChirurgieApproche"
  | "greffeOsseuse"
  | "implantCount"
  | "successRate";

export type ActeFilterOperator = 
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "is_true"
  | "is_false";

export interface ActeFilterRule {
  id: string;
  field: ActeFilterField;
  operator: ActeFilterOperator;
  value: string | number | boolean | null;
  value2?: string | number | null;
}

export interface ActeFilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: ActeFilterRule[];
}

interface ActeFilterFieldConfig {
  field: ActeFilterField;
  label: string;
  type: "text" | "number" | "date" | "enum" | "boolean";
  operators: ActeFilterOperator[];
  enumValues?: { value: string; label: string }[];
}

const TYPE_INTERVENTION_OPTIONS = [
  { value: "POSE_IMPLANT", label: "Pose d'implant" },
  { value: "GREFFE_OSSEUSE", label: "Greffe osseuse" },
  { value: "SINUS_LIFT", label: "Sinus lift" },
  { value: "EXTRACTION_IMPLANT_IMMEDIATE", label: "Extraction + Implant immédiat" },
  { value: "REPRISE_IMPLANT", label: "Reprise d'implant" },
  { value: "CHIRURGIE_GUIDEE", label: "Chirurgie guidée" },
];

const TYPE_CHIRURGIE_TEMPS_OPTIONS = [
  { value: "UN_TEMPS", label: "1 temps" },
  { value: "DEUX_TEMPS", label: "2 temps" },
];

const TYPE_CHIRURGIE_APPROCHE_OPTIONS = [
  { value: "LAMBEAU", label: "Lambeau" },
  { value: "FLAPLESS", label: "Flapless" },
];

const ACTE_FILTER_CONFIGS: ActeFilterFieldConfig[] = [
  { field: "dateOperation", label: "Date d'opération", type: "date", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "typeIntervention", label: "Type d'intervention", type: "enum", operators: ["equals", "not_equals"], enumValues: TYPE_INTERVENTION_OPTIONS },
  { field: "typeChirurgieTemps", label: "Temps chirurgical", type: "enum", operators: ["equals", "not_equals"], enumValues: TYPE_CHIRURGIE_TEMPS_OPTIONS },
  { field: "typeChirurgieApproche", label: "Approche chirurgicale", type: "enum", operators: ["equals", "not_equals"], enumValues: TYPE_CHIRURGIE_APPROCHE_OPTIONS },
  { field: "greffeOsseuse", label: "Greffe osseuse", type: "boolean", operators: ["is_true", "is_false"] },
  { field: "implantCount", label: "Nombre d'implants", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "successRate", label: "Taux de réussite (%)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
];

const OPERATOR_LABELS: Record<ActeFilterOperator, string> = {
  equals: "est égal à",
  not_equals: "n'est pas égal à",
  greater_than: "après" ,
  greater_than_or_equal: "à partir de",
  less_than: "avant",
  less_than_or_equal: "jusqu'à",
  between: "entre",
  is_true: "oui",
  is_false: "non",
};

interface ActesAdvancedFilterDrawerProps {
  filters: ActeFilterGroup | null;
  onFiltersChange: (filters: ActeFilterGroup | null) => void;
  activeFilterCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRule(): ActeFilterRule {
  return {
    id: generateId(),
    field: "typeIntervention",
    operator: "equals",
    value: "",
  };
}

function createEmptyGroup(): ActeFilterGroup {
  return {
    id: generateId(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function ActesAdvancedFilterDrawer({ filters, onFiltersChange, activeFilterCount }: ActesAdvancedFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ActeFilterGroup>(() => 
    filters || createEmptyGroup()
  );

  const handleOpen = useCallback((open: boolean) => {
    if (open) {
      setLocalFilters(filters || createEmptyGroup());
    }
    setIsOpen(open);
  }, [filters]);

  const handleApply = useCallback(() => {
    const validRules = localFilters.rules.filter(rule => {
      const fieldConfig = ACTE_FILTER_CONFIGS.find(c => c.field === rule.field);
      
      if (fieldConfig?.type === "boolean") {
        return rule.operator === "is_true" || rule.operator === "is_false";
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
      const fieldConfig = ACTE_FILTER_CONFIGS.find(c => c.field === rule.field);
      if (fieldConfig?.type === "number") {
        return {
          ...rule,
          value: Number(rule.value),
          value2: rule.value2 !== undefined && rule.value2 !== null && rule.value2 !== "" ? Number(rule.value2) : undefined,
        };
      }
      if (fieldConfig?.type === "boolean") {
        return {
          ...rule,
          value: rule.operator === "is_true",
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

  const updateRule = useCallback((ruleId: string, updates: Partial<ActeFilterRule>) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.id !== ruleId) return r;
        const updated = { ...r, ...updates };
        if (updates.field && updates.field !== r.field) {
          const newConfig = ACTE_FILTER_CONFIGS.find(c => c.field === updates.field);
          updated.operator = newConfig?.operators[0] || "equals";
          updated.value = "";
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
        <Button variant="outline" size="default" data-testid="button-actes-advanced-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filtres avancés
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtres avancés - Actes chirurgicaux</SheetTitle>
          <SheetDescription>
            Créez des filtres personnalisés pour affiner votre recherche d'actes
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Combiner les filtres avec :</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGroupOperator}
              data-testid="button-toggle-acte-operator"
            >
              {localFilters.operator === "AND" ? "ET (tous)" : "OU (un parmi)"}
            </Button>
          </div>

          <div className="space-y-3">
            {localFilters.rules.map((rule, index) => {
              const fieldConfig = ACTE_FILTER_CONFIGS.find(c => c.field === rule.field);

              return (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Champ</Label>
                          <Select
                            value={rule.field}
                            onValueChange={(value) => updateRule(rule.id, { field: value as ActeFilterField })}
                          >
                            <SelectTrigger data-testid={`select-acte-field-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTE_FILTER_CONFIGS.map(config => (
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
                            onValueChange={(value) => updateRule(rule.id, { operator: value as ActeFilterOperator })}
                          >
                            <SelectTrigger data-testid={`select-acte-operator-${index}`}>
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
                        <div className={rule.operator === "between" ? "grid grid-cols-2 gap-2" : ""}>
                          {fieldConfig?.type === "enum" ? (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Valeur</Label>
                              <Select
                                value={String(rule.value || "")}
                                onValueChange={(value) => updateRule(rule.id, { value })}
                              >
                                <SelectTrigger data-testid={`select-acte-value-${index}`}>
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
                            </div>
                          ) : fieldConfig?.type === "date" ? (
                            <>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  {rule.operator === "between" ? "Date début" : "Date"}
                                </Label>
                                <Input
                                  type="date"
                                  value={String(rule.value || "")}
                                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                  data-testid={`input-acte-value-${index}`}
                                />
                              </div>
                              {rule.operator === "between" && (
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Date fin</Label>
                                  <Input
                                    type="date"
                                    value={String(rule.value2 || "")}
                                    onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                    data-testid={`input-acte-value2-${index}`}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  {rule.operator === "between" ? "Valeur min" : "Valeur"}
                                </Label>
                                <Input
                                  type={fieldConfig?.type === "number" ? "number" : "text"}
                                  value={String(rule.value || "")}
                                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                  placeholder={fieldConfig?.type === "number" ? "0" : "Valeur..."}
                                  data-testid={`input-acte-value-${index}`}
                                />
                              </div>
                              {rule.operator === "between" && (
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Valeur max</Label>
                                  <Input
                                    type={fieldConfig?.type === "number" ? "number" : "text"}
                                    value={String(rule.value2 || "")}
                                    onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                    placeholder={fieldConfig?.type === "number" ? "0" : "Valeur..."}
                                    data-testid={`input-acte-value2-${index}`}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(rule.id)}
                      disabled={localFilters.rules.length === 1}
                      data-testid={`button-remove-acte-rule-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={addRule}
            className="w-full"
            data-testid="button-add-acte-rule"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un filtre
          </Button>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClear} data-testid="button-acte-reset-filters">
            Réinitialiser
          </Button>
          <Button onClick={handleApply} data-testid="button-acte-apply-filters">
            Appliquer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ActeFilterChips({ 
  filters, 
  onRemoveFilter, 
  onClearAll 
}: { 
  filters: ActeFilterGroup | null; 
  onRemoveFilter: (ruleId: string) => void;
  onClearAll: () => void;
}) {
  if (!filters || filters.rules.length === 0) return null;

  const getFilterLabel = (rule: ActeFilterRule): string => {
    const fieldConfig = ACTE_FILTER_CONFIGS.find(c => c.field === rule.field);
    const fieldLabel = fieldConfig?.label || rule.field;
    const operatorLabel = OPERATOR_LABELS[rule.operator];
    
    if (fieldConfig?.type === "boolean") {
      return `${fieldLabel}: ${rule.operator === "is_true" ? "Oui" : "Non"}`;
    }
    
    if (fieldConfig?.type === "enum" && fieldConfig.enumValues) {
      const enumLabel = fieldConfig.enumValues.find(e => e.value === rule.value)?.label || rule.value;
      return `${fieldLabel} ${operatorLabel} "${enumLabel}"`;
    }
    
    if (rule.operator === "between") {
      return `${fieldLabel} ${operatorLabel} ${rule.value} et ${rule.value2}`;
    }
    
    return `${fieldLabel} ${operatorLabel} ${rule.value}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtres actifs ({filters.operator}):</span>
      {filters.rules.map(rule => (
        <Badge 
          key={rule.id} 
          variant="secondary" 
          className="flex items-center gap-1"
        >
          {getFilterLabel(rule)}
          <button
            onClick={() => onRemoveFilter(rule.id)}
            className="ml-1 hover:text-destructive"
            data-testid={`button-remove-acte-chip-${rule.id}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onClearAll}
        data-testid="button-clear-all-acte-filters"
      >
        Tout effacer
      </Button>
    </div>
  );
}
