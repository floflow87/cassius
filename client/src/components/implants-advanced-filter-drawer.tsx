import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Filter, Plus, Trash2, X } from "lucide-react";

export type ImplantFilterField = 
  | "marque"
  | "referenceFabricant"
  | "diametre"
  | "longueur"
  | "lot"
  | "poseCount"
  | "successRate";

export type ImplantFilterOperator = 
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between";

export interface ImplantFilterRule {
  id: string;
  field: ImplantFilterField;
  operator: ImplantFilterOperator;
  value: string | number | null;
  value2?: string | number | null;
}

export interface ImplantFilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: ImplantFilterRule[];
}

interface ImplantFilterFieldConfig {
  field: ImplantFilterField;
  label: string;
  type: "text" | "number";
  operators: ImplantFilterOperator[];
}

const IMPLANT_FILTER_CONFIGS: ImplantFilterFieldConfig[] = [
  { field: "marque", label: "Marque", type: "text", operators: ["contains", "equals", "not_contains", "not_equals"] },
  { field: "referenceFabricant", label: "Référence fabricant", type: "text", operators: ["contains", "equals", "not_contains"] },
  { field: "diametre", label: "Diamètre (mm)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "longueur", label: "Longueur (mm)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "lot", label: "Numéro de lot", type: "text", operators: ["contains", "equals"] },
  { field: "poseCount", label: "Nombre de poses", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
  { field: "successRate", label: "Taux de réussite (%)", type: "number", operators: ["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "between"] },
];

const OPERATOR_LABELS: Record<ImplantFilterOperator, string> = {
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

interface ImplantsAdvancedFilterDrawerProps {
  filters: ImplantFilterGroup | null;
  onFiltersChange: (filters: ImplantFilterGroup | null) => void;
  activeFilterCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRule(): ImplantFilterRule {
  return {
    id: generateId(),
    field: "marque",
    operator: "contains",
    value: "",
  };
}

function createEmptyGroup(): ImplantFilterGroup {
  return {
    id: generateId(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function ImplantsAdvancedFilterDrawer({ filters, onFiltersChange, activeFilterCount }: ImplantsAdvancedFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ImplantFilterGroup>(() => 
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
      if (rule.value === "" || rule.value === null) return false;
      
      const fieldConfig = IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
      if (fieldConfig?.type === "number") {
        const numValue = Number(rule.value);
        if (isNaN(numValue)) return false;
        if (rule.operator === "between" && (rule.value2 === "" || rule.value2 === null || isNaN(Number(rule.value2)))) {
          return false;
        }
      }
      return true;
    }).map(rule => {
      const fieldConfig = IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
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

  const updateRule = useCallback((ruleId: string, updates: Partial<ImplantFilterRule>) => {
    setLocalFilters(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.id !== ruleId) return r;
        const updated = { ...r, ...updates };
        if (updates.field && updates.field !== r.field) {
          const newConfig = IMPLANT_FILTER_CONFIGS.find(c => c.field === updates.field);
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
        <Button variant="outline" size="default" data-testid="button-implants-advanced-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filtres avancés
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtres avancés - Catalogue implants</SheetTitle>
          <SheetDescription>
            Créez des filtres personnalisés pour affiner votre recherche d'implants
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Combiner les filtres avec :</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGroupOperator}
              data-testid="button-toggle-implant-operator"
            >
              {localFilters.operator === "AND" ? "ET (tous)" : "OU (un parmi)"}
            </Button>
          </div>

          <div className="space-y-3">
            {localFilters.rules.map((rule, index) => {
              const fieldConfig = IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);

              return (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Champ</Label>
                          <Select
                            value={rule.field}
                            onValueChange={(value) => updateRule(rule.id, { field: value as ImplantFilterField })}
                          >
                            <SelectTrigger data-testid={`select-implant-field-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {IMPLANT_FILTER_CONFIGS.map(config => (
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
                            onValueChange={(value) => updateRule(rule.id, { operator: value as ImplantFilterOperator })}
                          >
                            <SelectTrigger data-testid={`select-implant-operator-${index}`}>
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

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Valeur</Label>
                        <ImplantFilterValueInput
                          fieldConfig={fieldConfig}
                          rule={rule}
                          onUpdate={(updates) => updateRule(rule.id, updates)}
                          index={index}
                        />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(rule.id)}
                      disabled={localFilters.rules.length === 1}
                      data-testid={`button-remove-implant-rule-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button variant="outline" onClick={addRule} className="w-full" data-testid="button-add-implant-rule">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un filtre
          </Button>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClear} data-testid="button-clear-implant-filters">
            <X className="h-4 w-4 mr-2" />
            Effacer tout
          </Button>
          <Button onClick={handleApply} data-testid="button-apply-implant-filters">
            Appliquer les filtres
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface ImplantFilterValueInputProps {
  fieldConfig: ImplantFilterFieldConfig | undefined;
  rule: ImplantFilterRule;
  onUpdate: (updates: Partial<ImplantFilterRule>) => void;
  index: number;
}

function ImplantFilterValueInput({ fieldConfig, rule, onUpdate, index }: ImplantFilterValueInputProps) {
  if (!fieldConfig) return null;

  const isRangeOperator = rule.operator === "between";

  if (fieldConfig.type === "number") {
    return (
      <div className="flex gap-2">
        <Input
          type="number"
          step={fieldConfig.field === "diametre" || fieldConfig.field === "longueur" ? "0.1" : "1"}
          value={String(rule.value || "")}
          onChange={(e) => onUpdate({ value: e.target.value ? Number(e.target.value) : "" })}
          placeholder="Valeur"
          data-testid={`input-implant-number-${index}`}
        />
        {isRangeOperator && (
          <>
            <span className="self-center text-muted-foreground">et</span>
            <Input
              type="number"
              step={fieldConfig.field === "diametre" || fieldConfig.field === "longueur" ? "0.1" : "1"}
              value={String(rule.value2 || "")}
              onChange={(e) => onUpdate({ value2: e.target.value ? Number(e.target.value) : "" })}
              placeholder="Valeur max"
              data-testid={`input-implant-number2-${index}`}
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
      data-testid={`input-implant-text-${index}`}
    />
  );
}

export function ImplantFilterChips({ 
  filters, 
  onRemoveFilter, 
  onClearAll 
}: { 
  filters: ImplantFilterGroup | null; 
  onRemoveFilter: (ruleId: string) => void;
  onClearAll: () => void;
}) {
  if (!filters || filters.rules.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Filtres actifs:</span>
      {filters.rules.map((rule, index) => {
        const fieldConfig = IMPLANT_FILTER_CONFIGS.find(c => c.field === rule.field);
        
        let displayValue = String(rule.value || "");
        if (rule.operator === "between" && rule.value2) {
          displayValue = `${rule.value} - ${rule.value2}`;
        }

        const chipLabel = `${fieldConfig?.label || rule.field} ${OPERATOR_LABELS[rule.operator]} ${displayValue}`;

        return (
          <Badge 
            key={rule.id} 
            variant="secondary" 
            className="cursor-pointer"
            onClick={() => onRemoveFilter(rule.id)}
            data-testid={`implant-filter-chip-${index}`}
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
          data-testid="button-clear-all-implant-chips"
        >
          Tout effacer
        </Button>
      )}
    </div>
  );
}
