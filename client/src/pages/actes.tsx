import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion } from "framer-motion";
import { 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Stethoscope,
  Plus,
  ChevronsUpDown,
  Check,
  MoreHorizontal,
  Eye,
  Trash2,
  X,
  Search,
  Activity,
} from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { OperationForm } from "@/components/operation-form";
import { queryClient } from "@/lib/queryClient";
import { ActesAdvancedFilterDrawer, ActeFilterChips, type ActeFilterGroup } from "@/components/actes-advanced-filter-drawer";
import { SurgeryImplantsFilterDrawer, SurgeryImplantFilterChips, type SurgeryImplantFilterGroup } from "@/components/surgery-implants-filter-drawer";
import { Card, CardContent } from "@/components/ui/card";
import type { Operation, Patient, SurgeryImplant, Implant } from "@shared/schema";

type OperationWithDetails = Operation & { 
  patientNom: string; 
  patientPrenom: string; 
  implantCount: number;
  successRate: number | null;
};

type SurgeryImplantWithDetails = SurgeryImplant & {
  implant?: Implant | null;
  patient?: { id: string; nom: string; prenom: string } | null;
  datePose?: string | null;
  latestIsq?: { value: number; label: string } | null;
  topFlag?: { type: string; severity: string } | null;
  activeFlagCount?: number;
};

// Implant table columns
type ImplantColumnId = "patient" | "marque" | "dimensions" | "site" | "datePose" | "isq" | "statut";

interface ImplantColumnConfig {
  id: ImplantColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const implantColumnWidths: Record<ImplantColumnId, string> = {
  patient: "w-[18%]",
  marque: "w-[18%]",
  dimensions: "w-[12%]",
  site: "w-[10%]",
  datePose: "w-[14%]",
  isq: "w-[14%]",
  statut: "w-[14%]",
};

const defaultImplantColumns: ImplantColumnConfig[] = [
  { id: "patient", label: "Patient", sortable: true },
  { id: "marque", label: "Marque / Réf.", sortable: true },
  { id: "dimensions", label: "Dimensions", sortable: true },
  { id: "site", label: "Site", sortable: true },
  { id: "datePose", label: "Date de pose", sortable: true },
  { id: "isq", label: "ISQ", sortable: true },
  { id: "statut", label: "Statut", sortable: true },
];

const IMPLANT_STORAGE_KEY_COLUMNS = "cassius_actes_implants_columns_order";
const IMPLANT_STORAGE_KEY_SORT = "cassius_actes_implants_sort";

const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  EN_SUIVI: { label: "En suivi", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  SUCCES: { label: "Succès", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  COMPLICATION: { label: "Complication", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ECHEC: { label: "Échec", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

type SortDirection = "asc" | "desc" | null;
type ColumnId = "dateOperation" | "patient" | "typeIntervention" | "chirurgie" | "implantCount" | "greffe" | "reussite";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const columnWidths: Record<ColumnId, string> = {
  dateOperation: "w-[12%]",
  patient: "w-[18%]",
  typeIntervention: "w-[20%]",
  chirurgie: "w-[15%]",
  implantCount: "w-[12%]",
  greffe: "w-[11%]",
  reussite: "w-[12%]",
};

const defaultColumns: ColumnConfig[] = [
  { id: "dateOperation", label: "Date", sortable: true },
  { id: "patient", label: "Patient", sortable: true },
  { id: "typeIntervention", label: "Type d'intervention", sortable: true },
  { id: "chirurgie", label: "Chirurgie", sortable: true },
  { id: "implantCount", label: "Implants posés", sortable: true },
  { id: "greffe", label: "Greffe", sortable: true },
  { id: "reussite", label: "Réussite", sortable: true },
];

const STORAGE_KEY_COLUMNS = "cassius_actes_columns_order";
const STORAGE_KEY_SORT = "cassius_actes_sort";

const TYPE_INTERVENTION_LABELS: Record<string, string> = {
  POSE_IMPLANT: "Pose d'implant",
  GREFFE_OSSEUSE: "Greffe osseuse",
  SINUS_LIFT: "Sinus lift",
  EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
  REPRISE_IMPLANT: "Reprise d'implant",
  CHIRURGIE_GUIDEE: "Chirurgie guidée",
};

const CHIRURGIE_TEMPS_LABELS: Record<string, string> = {
  UN_TEMPS: "1 temps",
  DEUX_TEMPS: "2 temps",
};

const CHIRURGIE_APPROCHE_LABELS: Record<string, string> = {
  LAMBEAU: "Lambeau",
  FLAPLESS: "Flapless",
};

interface ActesPageProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export default function ActesPage({ searchQuery: externalSearchQuery, setSearchQuery: externalSetSearchQuery }: ActesPageProps) {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery ?? setInternalSearchQuery;
  const itemsPerPage = 20;
  
  const [activeTab, setActiveTab] = useState<"actes" | "implants">("actes");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [operationToDelete, setOperationToDelete] = useState<OperationWithDetails | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<ActeFilterGroup | null>(null);
  const [surgeryImplantFilters, setSurgeryImplantFilters] = useState<SurgeryImplantFilterGroup | null>(null);
  const [implantCurrentPage, setImplantCurrentPage] = useState(1);
  const { toast } = useToast();
  const { canDelete } = useCurrentUser();

  // Implant table state
  const [implantColumns, setImplantColumns] = useState<ImplantColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_STORAGE_KEY_COLUMNS);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ImplantColumnId[];
        const validIds = new Set(defaultImplantColumns.map(c => c.id));
        const validSavedOrder = savedOrder.filter(id => validIds.has(id));
        if (validSavedOrder.length === defaultImplantColumns.length) {
          return validSavedOrder.map(id => defaultImplantColumns.find(c => c.id === id)!);
        }
      }
    } catch {}
    return defaultImplantColumns;
  });

  const [implantSortColumn, setImplantSortColumn] = useState<ImplantColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_STORAGE_KEY_SORT);
      if (saved) {
        const { column } = JSON.parse(saved);
        return column;
      }
    } catch {}
    return "datePose";
  });

  const [implantSortDirection, setImplantSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_STORAGE_KEY_SORT);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return "desc";
  });

  const [draggedImplantColumn, setDraggedImplantColumn] = useState<ImplantColumnId | null>(null);
  const [dragOverImplantColumn, setDragOverImplantColumn] = useState<ImplantColumnId | null>(null);

  useEffect(() => {
    localStorage.setItem(IMPLANT_STORAGE_KEY_COLUMNS, JSON.stringify(implantColumns.map(c => c.id)));
  }, [implantColumns]);

  useEffect(() => {
    localStorage.setItem(IMPLANT_STORAGE_KEY_SORT, JSON.stringify({ column: implantSortColumn, direction: implantSortDirection }));
  }, [implantSortColumn, implantSortDirection]);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ColumnId[];
        const validIds = new Set(defaultColumns.map(c => c.id));
        const validSavedOrder = savedOrder.filter(id => validIds.has(id));
        if (validSavedOrder.length === defaultColumns.length) {
          return validSavedOrder.map(id => defaultColumns.find(c => c.id === id)!);
        }
      }
    } catch {}
    localStorage.removeItem(STORAGE_KEY_COLUMNS);
    return defaultColumns;
  });

  const [sortColumn, setSortColumn] = useState<ColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT);
      if (saved) {
        const { column } = JSON.parse(saved);
        const validIds = new Set(defaultColumns.map(c => c.id));
        if (validIds.has(column)) {
          return column;
        }
      }
    } catch {}
    localStorage.removeItem(STORAGE_KEY_SORT);
    return "dateOperation";
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return "desc";
  });

  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columns.map(c => c.id)));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify({ column: sortColumn, direction: sortDirection }));
  }, [sortColumn, sortDirection]);

  const { data: operations, isLoading } = useQuery<OperationWithDetails[]>({
    queryKey: ["/api/operations", advancedFilters ? JSON.stringify(advancedFilters) : null],
    queryFn: async () => {
      if (advancedFilters && advancedFilters.rules.length > 0) {
        const res = await fetch("/api/operations/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ filters: advancedFilters }),
        });
        if (!res.ok) throw new Error("Failed to search operations");
        return res.json();
      }
      const res = await fetch("/api/operations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch operations");
      return res.json();
    },
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Query for surgery implants
  const { data: surgeryImplants, isLoading: isLoadingImplants } = useQuery<SurgeryImplantWithDetails[]>({
    queryKey: ["/api/surgery-implants"],
    enabled: activeTab === "implants",
  });

  const deleteMutation = useMutation({
    mutationFn: async (operationId: string) => {
      await apiRequest("DELETE", `/api/operations/${operationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      toast({
        title: "Acte supprimé",
        description: "L'acte a été supprimé avec succès.",
        variant: "success",
      });
      setOperationToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results: { id: string; success: boolean }[] = [];
      for (const id of ids) {
        try {
          await apiRequest("DELETE", `/api/operations/${id}`);
          results.push({ id, success: true });
        } catch {
          results.push({ id, success: false });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      const successIds = new Set(results.filter(r => r.success).map(r => r.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        successIds.forEach(id => next.delete(id));
        return next;
      });
      setShowBulkDeleteDialog(false);
      if (failedCount === 0) {
        toast({
          title: "Actes supprimés",
          description: `${successCount} acte(s) supprimé(s) avec succès.`,
          variant: "success",
        });
      } else if (successCount === 0) {
        toast({
          title: "Erreur",
          description: "Aucun acte n'a pu être supprimé.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Suppression partielle",
          description: `${successCount} acte(s) supprimé(s), ${failedCount} échec(s).`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredOperations = operations?.filter((op) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      op.patientNom.toLowerCase().includes(query) ||
      op.patientPrenom.toLowerCase().includes(query) ||
      TYPE_INTERVENTION_LABELS[op.typeIntervention]?.toLowerCase().includes(query)
    );
  }) || [];

  const sortOperations = useCallback((opsToSort: OperationWithDetails[]) => {
    if (!sortColumn || !sortDirection) return opsToSort;

    return [...opsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "dateOperation":
          comparison = new Date(a.dateOperation).getTime() - new Date(b.dateOperation).getTime();
          break;
        case "patient":
          comparison = `${a.patientNom} ${a.patientPrenom}`.localeCompare(`${b.patientNom} ${b.patientPrenom}`);
          break;
        case "typeIntervention":
          comparison = a.typeIntervention.localeCompare(b.typeIntervention);
          break;
        case "chirurgie":
          comparison = (a.typeChirurgieTemps || "").localeCompare(b.typeChirurgieTemps || "");
          break;
        case "implantCount":
          comparison = a.implantCount - b.implantCount;
          break;
        case "greffe":
          comparison = (a.greffeOsseuse ? 1 : 0) - (b.greffeOsseuse ? 1 : 0);
          break;
        case "reussite":
          comparison = (a.successRate ?? -1) - (b.successRate ?? -1);
          break;
        default:
          return 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [sortColumn, sortDirection]);

  const sortedOperations = sortOperations(filteredOperations);
  const totalOperations = sortedOperations.length;
  const totalPages = Math.ceil(totalOperations / itemsPerPage);
  const paginatedOperations = sortedOperations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (columnId: ColumnId) => {
    if (sortColumn === columnId) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  const handleDragStart = (e: React.DragEvent, columnId: ColumnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragEnd = () => {
    if (draggedColumn && dragOverColumn) {
      const newColumns = [...columns];
      const draggedIndex = newColumns.findIndex(c => c.id === draggedColumn);
      const overIndex = newColumns.findIndex(c => c.id === dragOverColumn);
      
      if (draggedIndex !== -1 && overIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(overIndex, 0, removed);
        setColumns(newColumns);
      }
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const currentPageIds = useMemo(() => paginatedOperations.map(op => op.id), [paginatedOperations]);

  const allCurrentPageSelected = useMemo(() => {
    if (currentPageIds.length === 0) return false;
    return currentPageIds.every(id => selectedIds.has(id));
  }, [currentPageIds, selectedIds]);

  const someCurrentPageSelected = useMemo(() => {
    return currentPageIds.some(id => selectedIds.has(id)) && !allCurrentPageSelected;
  }, [currentPageIds, selectedIds, allCurrentPageSelected]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set([...Array.from(selectedIds), ...currentPageIds]));
    } else {
      const newSet = new Set(selectedIds);
      currentPageIds.forEach(id => newSet.delete(id));
      setSelectedIds(newSet);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const renderSortIcon = (columnId: ColumnId) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Implant table helpers
  const handleImplantSort = (columnId: ImplantColumnId) => {
    if (implantSortColumn === columnId) {
      if (implantSortDirection === "desc") {
        setImplantSortDirection("asc");
      } else if (implantSortDirection === "asc") {
        setImplantSortColumn(null);
        setImplantSortDirection(null);
      }
    } else {
      setImplantSortColumn(columnId);
      setImplantSortDirection("desc");
    }
  };

  const handleImplantDragStart = (e: React.DragEvent, columnId: ImplantColumnId) => {
    setDraggedImplantColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleImplantDragOver = (e: React.DragEvent, columnId: ImplantColumnId) => {
    e.preventDefault();
    if (draggedImplantColumn && draggedImplantColumn !== columnId) {
      setDragOverImplantColumn(columnId);
    }
  };

  const handleImplantDragEnd = () => {
    if (draggedImplantColumn && dragOverImplantColumn) {
      const newColumns = [...implantColumns];
      const draggedIndex = newColumns.findIndex(c => c.id === draggedImplantColumn);
      const overIndex = newColumns.findIndex(c => c.id === dragOverImplantColumn);
      
      if (draggedIndex !== -1 && overIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(overIndex, 0, removed);
        setImplantColumns(newColumns);
      }
    }
    setDraggedImplantColumn(null);
    setDragOverImplantColumn(null);
  };

  const renderImplantSortIcon = (columnId: ImplantColumnId) => {
    if (implantSortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    if (implantSortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Filter and sort implants
  const filteredImplants = useMemo(() => {
    if (!surgeryImplants) return [];
    let filtered = [...surgeryImplants];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((si) => {
        const patientName = `${si.patient?.prenom || ""} ${si.patient?.nom || ""}`.toLowerCase();
        const marque = (si.implant?.marque || "").toLowerCase();
        const ref = (si.implant?.referenceFabricant || "").toLowerCase();
        return patientName.includes(query) || marque.includes(query) || ref.includes(query);
      });
    }
    
    // Apply advanced filters
    if (surgeryImplantFilters && surgeryImplantFilters.rules.length > 0) {
      filtered = filtered.filter((si) => {
        const results = surgeryImplantFilters.rules.map((rule) => {
          let fieldValue: string | number | null = null;
          
          switch (rule.field) {
            case "datePose":
              fieldValue = si.datePose || null;
              break;
            case "statut":
              fieldValue = si.statut || "EN_SUIVI";
              break;
            case "marque":
              fieldValue = si.implant?.marque || null;
              break;
            case "siteFdi":
              fieldValue = si.siteFdi || null;
              break;
            case "isqPose":
              fieldValue = si.isqPose ?? null;
              break;
            case "isq2m":
              fieldValue = si.isq2m ?? null;
              break;
            case "isq3m":
              fieldValue = si.isq3m ?? null;
              break;
            case "isq6m":
              fieldValue = si.isq6m ?? null;
              break;
            case "diametre":
              fieldValue = si.implant?.diametre ?? null;
              break;
            case "longueur":
              fieldValue = si.implant?.longueur ?? null;
              break;
          }
          
          switch (rule.operator) {
            case "equals":
              return fieldValue === rule.value;
            case "not_equals":
              return fieldValue !== rule.value;
            case "contains":
              return typeof fieldValue === "string" && typeof rule.value === "string" && fieldValue.toLowerCase().includes(rule.value.toLowerCase());
            case "greater_than":
              if (rule.field === "datePose") {
                return fieldValue && rule.value && new Date(fieldValue) > new Date(String(rule.value));
              }
              return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue > rule.value;
            case "greater_than_or_equal":
              if (rule.field === "datePose") {
                return fieldValue && rule.value && new Date(fieldValue) >= new Date(String(rule.value));
              }
              return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue >= rule.value;
            case "less_than":
              if (rule.field === "datePose") {
                return fieldValue && rule.value && new Date(fieldValue) < new Date(String(rule.value));
              }
              return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue < rule.value;
            case "less_than_or_equal":
              if (rule.field === "datePose") {
                return fieldValue && rule.value && new Date(fieldValue) <= new Date(String(rule.value));
              }
              return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue <= rule.value;
            case "between":
              if (rule.field === "datePose") {
                return fieldValue && rule.value && rule.value2 && 
                  new Date(fieldValue) >= new Date(String(rule.value)) && 
                  new Date(fieldValue) <= new Date(String(rule.value2));
              }
              return typeof fieldValue === "number" && typeof rule.value === "number" && typeof rule.value2 === "number" && 
                fieldValue >= rule.value && fieldValue <= rule.value2;
            case "is_null":
              return fieldValue === null || fieldValue === undefined;
            case "is_not_null":
              return fieldValue !== null && fieldValue !== undefined;
            default:
              return true;
          }
        });
        
        return surgeryImplantFilters.operator === "AND" 
          ? results.every(Boolean) 
          : results.some(Boolean);
      });
    }
    
    return filtered;
  }, [surgeryImplants, searchQuery, surgeryImplantFilters]);

  const sortedImplants = useMemo(() => {
    if (!implantSortColumn || !implantSortDirection) return filteredImplants;
    
    return [...filteredImplants].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      
      switch (implantSortColumn) {
        case "patient":
          aVal = `${a.patient?.nom || ""} ${a.patient?.prenom || ""}`;
          bVal = `${b.patient?.nom || ""} ${b.patient?.prenom || ""}`;
          break;
        case "marque":
          aVal = a.implant?.marque || "";
          bVal = b.implant?.marque || "";
          break;
        case "dimensions":
          aVal = (a.implant?.diametre || 0) * (a.implant?.longueur || 0);
          bVal = (b.implant?.diametre || 0) * (b.implant?.longueur || 0);
          break;
        case "site":
          aVal = a.siteFdi || "";
          bVal = b.siteFdi || "";
          break;
        case "datePose":
          aVal = a.datePose || "";
          bVal = b.datePose || "";
          break;
        case "isq":
          aVal = a.latestIsq?.value || 0;
          bVal = b.latestIsq?.value || 0;
          break;
        case "statut":
          aVal = a.statut || "";
          bVal = b.statut || "";
          break;
      }
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return implantSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return implantSortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredImplants, implantSortColumn, implantSortDirection]);

  const implantTotalPages = Math.ceil(sortedImplants.length / itemsPerPage);
  const paginatedImplants = sortedImplants.slice(
    (implantCurrentPage - 1) * itemsPerPage,
    implantCurrentPage * itemsPerPage
  );

  const renderImplantCellContent = (columnId: ImplantColumnId, si: SurgeryImplantWithDetails) => {
    switch (columnId) {
      case "patient":
        return (
          <span className="font-medium text-xs">
            {si.patient?.prenom || ""} {si.patient?.nom || ""}
          </span>
        );
      case "marque":
        return (
          <div>
            <div className="text-xs font-medium">{si.implant?.marque || "-"}</div>
            <div className="text-[10px] text-muted-foreground">{si.implant?.referenceFabricant || "-"}</div>
          </div>
        );
      case "dimensions":
        return (
          <span className="text-xs">
            {si.implant?.diametre} x {si.implant?.longueur}mm
          </span>
        );
      case "site":
        return <span className="font-mono font-medium text-xs">{si.siteFdi || "-"}</span>;
      case "datePose":
        return (
          <span className="text-xs text-muted-foreground">
            {si.datePose ? formatDate(si.datePose) : "-"}
          </span>
        );
      case "isq":
        if (!si.latestIsq) return <span className="text-muted-foreground">-</span>;
        const isqClassName = si.latestIsq.value >= 70 
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0" 
          : si.latestIsq.value >= 60 
            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0" 
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0";
        return (
          <div className="flex items-center gap-1">
            <Badge className={`font-mono ${isqClassName}`}>
              {si.latestIsq.value}
            </Badge>
            <span className="text-xs text-muted-foreground">{si.latestIsq.label}</span>
          </div>
        );
      case "statut":
        const statutInfo = STATUT_LABELS[si.statut || "EN_SUIVI"] || STATUT_LABELS.EN_SUIVI;
        return (
          <Badge className={`text-[10px] border-0 ${statutInfo.className}`}>
            {statutInfo.label}
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getSuccessRateBadge = (rate: number | null) => {
    if (rate === null) return { className: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400", label: "-" };
    
    if (rate >= 80) {
      return { className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", label: `${rate}%` };
    } else if (rate >= 60) {
      return { className: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400", label: `${rate}%` };
    } else {
      return { className: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400", label: `${rate}%` };
    }
  };

  const renderCellContent = (columnId: ColumnId, op: OperationWithDetails) => {
    switch (columnId) {
      case "dateOperation":
        return <span className="text-muted-foreground text-xs">{formatDate(op.dateOperation)}</span>;
      case "patient":
        return (
          <span className="font-medium text-xs">
            {op.patientPrenom} {op.patientNom}
          </span>
        );
      case "typeIntervention":
        return (
          <Badge className="text-[10px] rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0">
            {TYPE_INTERVENTION_LABELS[op.typeIntervention] || op.typeIntervention}
          </Badge>
        );
      case "chirurgie": {
        const temps = op.typeChirurgieTemps ? CHIRURGIE_TEMPS_LABELS[op.typeChirurgieTemps] : null;
        const approche = op.typeChirurgieApproche ? CHIRURGIE_APPROCHE_LABELS[op.typeChirurgieApproche] : null;
        if (!temps && !approche) {
          return <span className="text-muted-foreground/50 text-xs">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {temps && (
              <Badge variant="outline" className="text-[10px]">
                {temps}
              </Badge>
            )}
            {approche && (
              <Badge variant="outline" className="text-[10px]">
                {approche}
              </Badge>
            )}
          </div>
        );
      }
      case "implantCount":
        return op.implantCount > 0 ? (
          <span className="text-muted-foreground text-xs">{op.implantCount} implant{op.implantCount > 1 ? "s" : ""}</span>
        ) : (
          <span className="text-muted-foreground/50 text-xs">-</span>
        );
      case "greffe":
        return op.greffeOsseuse ? (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
            Oui
          </Badge>
        ) : (
          <span className="text-muted-foreground/50 text-xs">-</span>
        );
      case "reussite": {
        const badge = getSuccessRateBadge(op.successRate);
        return (
          <Badge variant="outline" className={`text-[10px] border-0 ${badge.className}`}>
            {badge.label}
          </Badge>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto px-6 pb-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "actes" | "implants")} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-full w-fit" data-testid="tabs-actes-page">
            {[
              { value: "actes" as const, label: "Actes", icon: Stethoscope },
              { value: "implants" as const, label: "Implants posés", icon: Activity },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 flex items-center gap-2 ${
                  activeTab === tab.value ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.value}`}
              >
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="actes-tab-indicator"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <tab.icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
            <CassiusSearchInput 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              icon={<Search className="h-4 w-4" />}
              className="max-w-lg"
              data-testid="input-search-actes"
            />
            
            {activeTab === "actes" && (
              <ActesAdvancedFilterDrawer
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
                activeFilterCount={advancedFilters?.rules.length || 0}
              />
            )}

            {activeTab === "implants" && (
              <SurgeryImplantsFilterDrawer
                filters={surgeryImplantFilters}
                onFiltersChange={setSurgeryImplantFilters}
                activeFilterCount={surgeryImplantFilters?.rules.length || 0}
              />
            )}
            
            {activeTab === "actes" && selectedIds.size > 0 && (
          <>
            <span className="text-sm font-medium">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-clear-selection"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </>
        )}
        
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setSelectedPatientId(null);
          }
        }}>
          <SheetTrigger asChild>
            <Button data-testid="button-new-acte">
              <Plus className="h-4 w-4 mr-2" />
              Nouvel acte
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Nouvel acte chirurgical</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Patient</label>
                <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientPopoverOpen}
                      className="w-full justify-between"
                      data-testid="select-patient-trigger"
                    >
                      {selectedPatientId
                        ? patients?.find((p) => p.id === selectedPatientId)
                          ? `${patients.find((p) => p.id === selectedPatientId)?.prenom} ${patients.find((p) => p.id === selectedPatientId)?.nom}`
                          : "Sélectionner un patient..."
                        : "Sélectionner un patient..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un patient..." data-testid="input-search-patient" />
                      <CommandList>
                        <CommandEmpty>Aucun patient trouvé.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[200px]">
                            {patients?.map((patient) => (
                              <CommandItem
                                key={patient.id}
                                value={`${patient.prenom} ${patient.nom}`}
                                onSelect={() => {
                                  setSelectedPatientId(patient.id);
                                  setPatientPopoverOpen(false);
                                }}
                                data-testid={`select-patient-${patient.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPatientId === patient.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {patient.prenom} {patient.nom}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {selectedPatientId && (
                <OperationForm 
                  patientId={selectedPatientId}
                  onSuccess={() => {
                    setSheetOpen(false);
                    setSelectedPatientId(null);
                    queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
          </div>
        </div>

        <TabsContent value="actes" className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs italic text-muted-foreground">{totalOperations} acte{totalOperations > 1 ? "s" : ""}</span>
                <ActeFilterChips
                  filters={advancedFilters}
                  onRemoveFilter={(ruleId) => {
                    if (!advancedFilters) return;
                    const updatedRules = advancedFilters.rules.filter(r => r.id !== ruleId);
                    if (updatedRules.length === 0) {
                      setAdvancedFilters(null);
                    } else {
                      setAdvancedFilters({ ...advancedFilters, rules: updatedRules });
                    }
                  }}
                  onClearAll={() => setAdvancedFilters(null)}
                />
              </div>

              <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-gray bg-border-gray">
                        <th className="w-[40px] px-3 py-2">
                          <Checkbox
                            checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                            onCheckedChange={handleSelectAll}
                            aria-label="Sélectionner tout"
                            data-testid="checkbox-select-all"
                          />
                        </th>
                        {columns.map((column) => (
                          <th
                            key={column.id}
                            className={`text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${columnWidths[column.id]} ${dragOverColumn === column.id ? "bg-primary/10" : ""}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.id)}
                            onDragOver={(e) => handleDragOver(e, column.id)}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDragEnd}
                          >
                            <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-3 w-3 opacity-40" />
                              <button
                                onClick={() => column.sortable && handleSort(column.id)}
                                className="flex items-center hover:text-foreground transition-colors"
                                data-testid={`sort-${column.id}`}
                              >
                                {column.label}
                                {column.sortable && renderSortIcon(column.id)}
                              </button>
                            </div>
                          </th>
                        ))}
                        <th className="w-[50px] px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOperations.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 2} className="px-4 py-16">
                            <div className="flex flex-col items-center justify-center">
                              <Stethoscope className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <h3 className="text-base font-medium mb-2 text-foreground">Aucun acte</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {searchQuery
                                  ? "Aucun acte ne correspond à votre recherche"
                                  : "Aucune intervention chirurgicale enregistrée"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedOperations.map((op) => (
                          <tr 
                            key={op.id} 
                            className={cn(
                              "border-b border-border-gray hover-elevate cursor-pointer",
                              selectedIds.has(op.id) && "bg-primary/5"
                            )}
                            onClick={() => setLocation(`/actes/${op.id}`)}
                            data-testid={`row-operation-${op.id}`}
                          >
                            <td className="w-[40px] px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(op.id)}
                                onCheckedChange={(checked) => handleSelectRow(op.id, !!checked)}
                                aria-label={`Sélectionner ${op.patientPrenom} ${op.patientNom}`}
                                data-testid={`checkbox-row-${op.id}`}
                              />
                            </td>
                            {columns.map((column) => (
                              <td key={column.id} className={`px-4 py-2 text-xs ${columnWidths[column.id]}`}>
                                {renderCellContent(column.id, op)}
                              </td>
                            ))}
                            <td className="w-[50px] px-2 py-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" data-testid={`button-actions-${op.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/actes/${op.id}`); }}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Voir
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <DropdownMenuItem 
                                      onClick={(e) => { e.stopPropagation(); setOperationToDelete(op); }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end mt-4">
                <CassiusPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalOperations}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="implants" className="mt-0">
          {isLoadingImplants ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs italic text-muted-foreground">{sortedImplants.length} implant{sortedImplants.length !== 1 ? "s" : ""}</span>
                <SurgeryImplantFilterChips
                  filters={surgeryImplantFilters}
                  onRemoveFilter={(ruleId) => {
                    if (!surgeryImplantFilters) return;
                    const updatedRules = surgeryImplantFilters.rules.filter(r => r.id !== ruleId);
                    if (updatedRules.length === 0) {
                      setSurgeryImplantFilters(null);
                    } else {
                      setSurgeryImplantFilters({ ...surgeryImplantFilters, rules: updatedRules });
                    }
                  }}
                  onClearAll={() => setSurgeryImplantFilters(null)}
                />
              </div>

              <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-gray bg-border-gray">
                        {implantColumns.map((column) => (
                          <th
                            key={column.id}
                            className={`text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${implantColumnWidths[column.id]} ${dragOverImplantColumn === column.id ? "bg-primary/10" : ""}`}
                            draggable
                            onDragStart={(e) => handleImplantDragStart(e, column.id)}
                            onDragOver={(e) => handleImplantDragOver(e, column.id)}
                            onDragEnd={handleImplantDragEnd}
                            onDrop={handleImplantDragEnd}
                          >
                            <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-3 w-3 opacity-40" />
                              <button
                                onClick={() => column.sortable && handleImplantSort(column.id)}
                                className="flex items-center hover:text-foreground transition-colors"
                                data-testid={`sort-implant-${column.id}`}
                              >
                                {column.label}
                                {column.sortable && renderImplantSortIcon(column.id)}
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedImplants.length === 0 ? (
                        <tr>
                          <td colSpan={implantColumns.length} className="px-4 py-16">
                            <div className="flex flex-col items-center justify-center">
                              <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <h3 className="text-base font-medium mb-2 text-foreground">Aucun implant</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {searchQuery
                                  ? "Aucun implant ne correspond à votre recherche"
                                  : "Aucun implant posé enregistré"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedImplants.map((si) => (
                          <tr 
                            key={si.id} 
                            className="border-b border-border-gray hover-elevate cursor-pointer"
                            onClick={() => si.patient?.id && setLocation(`/patients/${si.patient.id}`)}
                            data-testid={`row-implant-${si.id}`}
                          >
                            {implantColumns.map((column) => (
                              <td key={column.id} className={`px-4 py-2 text-xs ${implantColumnWidths[column.id]}`}>
                                {renderImplantCellContent(column.id, si)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end mt-4">
                <CassiusPagination
                  currentPage={implantCurrentPage}
                  totalPages={implantTotalPages}
                  totalItems={sortedImplants.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setImplantCurrentPage}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!operationToDelete} onOpenChange={(open) => !open && setOperationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet acte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'acte du {operationToDelete && new Date(operationToDelete.dateOperation).toLocaleDateString("fr-FR")} pour {operationToDelete?.patientPrenom} {operationToDelete?.patientNom} sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => operationToDelete && deleteMutation.mutate(operationToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} acte{selectedIds.size > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les {selectedIds.size} acte{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""} seront définitivement supprimé{selectedIds.size > 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
