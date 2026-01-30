import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Trash2,
  X,
} from "lucide-react";
import { ImplantsAdvancedFilterDrawer, ImplantFilterChips, type ImplantFilterGroup } from "@/components/implants-advanced-filter-drawer";
import { ProthesesAdvancedFilterDrawer, ProtheseFilterChips, applyProtheseFilters, type ProtheseFilterGroup } from "@/components/protheses-advanced-filter-drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CatalogImplantsListSkeleton } from "@/components/page-skeletons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import { ImplantForm } from "@/components/implant-form";
import { ProtheseForm } from "@/components/prothese-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ImplantWithStats } from "@shared/schema";

type SortDirection = "asc" | "desc" | null;
type ColumnId = "marqueRef" | "dimensions" | "poseCount" | "successRate";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const columnWidths: Record<ColumnId, string> = {
  marqueRef: "w-[30%]",
  dimensions: "w-[25%]",
  poseCount: "w-[22%]",
  successRate: "w-[23%]",
};

const defaultColumns: ColumnConfig[] = [
  { id: "marqueRef", label: "Marque & Référence", sortable: true },
  { id: "dimensions", label: "Diamètre × Longueur", sortable: true },
  { id: "poseCount", label: "Nb de poses", sortable: true },
  { id: "successRate", label: "Réussite moyenne", sortable: true },
];

const STORAGE_KEY_COLUMNS = "cassius_implants_columns_order";
const STORAGE_KEY_SORT = "cassius_implants_sort";
const STORAGE_KEY_PROTHESES_COLUMNS = "cassius_protheses_columns_order";
const STORAGE_KEY_PROTHESES_SORT = "cassius_protheses_sort";

type ProtheseColumnId = "marque" | "typeProthese" | "nbPoses";

interface ProtheseColumnConfig {
  id: ProtheseColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const protheseColumnWidths: Record<ProtheseColumnId, string> = {
  marque: "w-[40%]",
  typeProthese: "w-[35%]",
  nbPoses: "w-[25%]",
};

const defaultProtheseColumns: ProtheseColumnConfig[] = [
  { id: "marque", label: "Marque", sortable: true },
  { id: "typeProthese", label: "Type de prothèse", sortable: true },
  { id: "nbPoses", label: "Nombre de poses", sortable: true },
];

const typeProtheseLabels: Record<string, string> = {
  VISSEE: "Vissée",
  SCELLEE: "Scellée",
};

interface CataloguePageProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export default function CataloguePage({ searchQuery: externalSearchQuery, setSearchQuery: externalSetSearchQuery }: CataloguePageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canDelete } = useCurrentUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [catalogType, setCatalogType] = useState<"implants" | "mini" | "protheses">("implants");
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery ?? setInternalSearchQuery;
  const itemsPerPage = 20;
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<ImplantFilterGroup | null>(null);
  const [protheseAdvancedFilters, setProtheseAdvancedFilters] = useState<ProtheseFilterGroup | null>(null);

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
    return null;
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return null;
  });

  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columns.map(c => c.id)));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify({ column: sortColumn, direction: sortDirection }));
  }, [sortColumn, sortDirection]);

  // Protheses columns state
  const [protheseColumns, setProtheseColumns] = useState<ProtheseColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROTHESES_COLUMNS);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ProtheseColumnId[];
        const validIds = new Set(defaultProtheseColumns.map(c => c.id));
        const validSavedOrder = savedOrder.filter(id => validIds.has(id));
        if (validSavedOrder.length === defaultProtheseColumns.length) {
          return validSavedOrder.map(id => defaultProtheseColumns.find(c => c.id === id)!);
        }
      }
    } catch {}
    return defaultProtheseColumns;
  });

  const [protheseSortColumn, setProtheseSortColumn] = useState<ProtheseColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROTHESES_SORT);
      if (saved) {
        const { column } = JSON.parse(saved);
        return column;
      }
    } catch {}
    return null;
  });

  const [protheseSortDirection, setProtheseSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROTHESES_SORT);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return null;
  });

  const [draggedProtheseColumn, setDraggedProtheseColumn] = useState<ProtheseColumnId | null>(null);
  const [dragOverProtheseColumn, setDragOverProtheseColumn] = useState<ProtheseColumnId | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROTHESES_COLUMNS, JSON.stringify(protheseColumns.map(c => c.id)));
  }, [protheseColumns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROTHESES_SORT, JSON.stringify({ column: protheseSortColumn, direction: protheseSortDirection }));
  }, [protheseSortColumn, protheseSortDirection]);

  const { data: implants, isLoading } = useQuery<ImplantWithStats[]>({
    queryKey: ["/api/implants", catalogType, advancedFilters ? JSON.stringify(advancedFilters) : null],
    queryFn: async () => {
      if (advancedFilters && advancedFilters.rules.length > 0 && catalogType !== "protheses") {
        const typeImplantValue = catalogType === "implants" ? "IMPLANT" : "MINI_IMPLANT";
        const res = await fetch("/api/catalog-implants/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ filters: advancedFilters, typeImplant: typeImplantValue }),
        });
        if (!res.ok) throw new Error("Failed to search implants");
        return res.json();
      }
      const res = await fetch("/api/implants", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch implants");
      return res.json();
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results: { id: string; success: boolean }[] = [];
      for (const id of ids) {
        try {
          await apiRequest("DELETE", `/api/catalog-implants/${id}`);
          results.push({ id, success: true });
        } catch {
          results.push({ id, success: false });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
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
          title: "Implants supprimés",
          description: `${successCount} implant(s) supprimé(s) avec succès.`,
          variant: "success",
        });
      } else if (successCount === 0) {
        toast({
          title: "Erreur",
          description: "Aucun implant n'a pu être supprimé. Ces implants sont peut-être utilisés dans des interventions.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Suppression partielle",
          description: `${successCount} implant(s) supprimé(s), ${failedCount} échec(s).`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
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

  // Filter based on catalog type
  const filteredImplants = implants?.filter((implant) => {
    const typeImplant = implant.typeImplant || "IMPLANT";
    
    if (catalogType === "protheses") {
      if (typeImplant !== "PROTHESE") return false;
    } else if (catalogType === "mini") {
      if (typeImplant !== "MINI_IMPLANT") return false;
    } else {
      // Default "implants" tab - only show regular implants (not mini, not prothese)
      if (typeImplant !== "IMPLANT") return false;
    }
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      implant.marque.toLowerCase().includes(query) ||
      implant.referenceFabricant?.toLowerCase().includes(query)
    );
  }) || [];

  // Sort protheses
  const sortProtheses = useCallback((prothesesToSort: ImplantWithStats[]) => {
    if (!protheseSortColumn || !protheseSortDirection) return prothesesToSort;

    return [...prothesesToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (protheseSortColumn) {
        case "marque":
          comparison = a.marque.localeCompare(b.marque);
          break;
        case "typeProthese":
          comparison = (a.typeProthese || "").localeCompare(b.typeProthese || "");
          break;
        case "nbPoses":
          comparison = (a.poseCount || 0) - (b.poseCount || 0);
          break;
        default:
          comparison = 0;
      }
      
      return protheseSortDirection === "desc" ? -comparison : comparison;
    });
  }, [protheseSortColumn, protheseSortDirection]);

  // Prothese drag handlers
  const handleProtheseDragStart = (e: React.DragEvent, columnId: ProtheseColumnId) => {
    setDraggedProtheseColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleProtheseDragOver = (e: React.DragEvent, columnId: ProtheseColumnId) => {
    e.preventDefault();
    if (draggedProtheseColumn && draggedProtheseColumn !== columnId) {
      setDragOverProtheseColumn(columnId);
    }
  };

  const handleProtheseDragEnd = () => {
    if (draggedProtheseColumn && dragOverProtheseColumn) {
      const newColumns = [...protheseColumns];
      const draggedIndex = newColumns.findIndex(c => c.id === draggedProtheseColumn);
      const dropIndex = newColumns.findIndex(c => c.id === dragOverProtheseColumn);
      
      if (draggedIndex !== -1 && dropIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(dropIndex, 0, removed);
        setProtheseColumns(newColumns);
      }
    }
    setDraggedProtheseColumn(null);
    setDragOverProtheseColumn(null);
  };

  const handleProtheseSort = (columnId: ProtheseColumnId) => {
    if (protheseSortColumn === columnId) {
      if (protheseSortDirection === "asc") {
        setProtheseSortDirection("desc");
      } else if (protheseSortDirection === "desc") {
        setProtheseSortColumn(null);
        setProtheseSortDirection(null);
      }
    } else {
      setProtheseSortColumn(columnId);
      setProtheseSortDirection("asc");
    }
  };

  const renderProtheseSortIcon = (columnId: ProtheseColumnId) => {
    if (protheseSortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (protheseSortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const renderProtheseCellContent = (columnId: ProtheseColumnId, prothese: ImplantWithStats) => {
    switch (columnId) {
      case "marque":
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {prothese.marque}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Réf: {prothese.referenceFabricant || "-"}
              </span>
            </div>
          </div>
        );
      case "typeProthese":
        return prothese.typeProthese ? (
          <Badge variant="outline" className="text-xs">
            {typeProtheseLabels[prothese.typeProthese] || prothese.typeProthese}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      case "nbPoses":
        return (
          <span className="text-xs font-medium">
            {prothese.poseCount || 0}
          </span>
        );
      default:
        return null;
    }
  };

  // Get totals for counter display
  const prothesesTotalCount = implants?.filter(i => i.typeImplant === "PROTHESE").length || 0;

  const sortImplants = useCallback((implantsToSort: ImplantWithStats[]) => {
    if (!sortColumn || !sortDirection) return implantsToSort;

    return [...implantsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "marqueRef":
          comparison = a.marque.localeCompare(b.marque);
          break;
        case "dimensions":
          comparison = (a.diametre * 100 + a.longueur) - (b.diametre * 100 + b.longueur);
          break;
        case "poseCount":
          comparison = a.poseCount - b.poseCount;
          break;
        case "successRate":
          comparison = (a.successRate ?? 0) - (b.successRate ?? 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [sortColumn, sortDirection]);

  const sortedImplants = sortImplants(filteredImplants);
  const totalImplants = sortedImplants.length;
  const totalPages = Math.ceil(totalImplants / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedImplants = sortedImplants.slice(startIndex, startIndex + itemsPerPage);

  const currentPageIds = paginatedImplants.map(i => i.id);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const someCurrentPageSelected = currentPageIds.some(id => selectedIds.has(id));

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        currentPageIds.forEach(id => next.add(id));
      } else {
        currentPageIds.forEach(id => next.delete(id));
      }
      return next;
    });
  };

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
      const dropIndex = newColumns.findIndex(c => c.id === dragOverColumn);
      
      if (draggedIndex !== -1 && dropIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(dropIndex, 0, removed);
        setColumns(newColumns);
      }
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const renderSortIcon = (columnId: ColumnId) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const renderCellContent = (columnId: ColumnId, implant: ImplantWithStats) => {
    switch (columnId) {
      case "marqueRef":
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {implant.marque}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Réf: {implant.referenceFabricant || "-"}
              </span>
            </div>
          </div>
        );
      case "dimensions":
        return (
          <span className="text-xs text-muted-foreground">
            {implant.diametre} × {implant.longueur} mm
          </span>
        );
      case "poseCount":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="default" className="cursor-pointer">
                {implant.poseCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {implant.lastPoseDate 
                ? `Dernière pose: ${new Date(implant.lastPoseDate).toLocaleDateString('fr-FR')}`
                : "Aucune pose enregistrée"
              }
            </TooltipContent>
          </Tooltip>
        );
      case "successRate":
        if (implant.successRate === null) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        const rate = implant.successRate;
        const colorClass = rate >= 90 ? "text-green-600" : rate >= 70 ? "text-yellow-600" : "text-red-600";
        return (
          <Badge variant="outline" className={colorClass}>
            {rate.toFixed(1)}%
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <CatalogImplantsListSkeleton />;
  }

  // Sorted and paginated protheses for display
  const advancedFilteredProtheses = catalogType === "protheses" 
    ? applyProtheseFilters(filteredImplants, protheseAdvancedFilters)
    : [];
  const sortedProtheses = catalogType === "protheses" ? sortProtheses(advancedFilteredProtheses) : [];
  const paginatedProtheses = sortedProtheses.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col h-full overflow-auto px-6 pb-6">
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-full w-fit mb-4" data-testid="tabs-catalogue-page">
        {[
          { value: "implants" as const, label: "Implants" },
          { value: "mini" as const, label: "Mini-implants" },
          { value: "protheses" as const, label: "Prothèses" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setCatalogType(tab.value);
              setCurrentPage(1);
              setSelectedIds(new Set());
            }}
            className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 ${
              catalogType === tab.value ? "text-white" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${tab.value}`}
          >
            {catalogType === tab.value && (
              <motion.div
                layoutId="catalog-type-indicator"
                className="absolute inset-0 bg-primary rounded-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-5">
        <CassiusSearchInput
          placeholder={catalogType === "protheses" ? "Rechercher une prothèse..." : "Rechercher par marque ou reference..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="max-w-sm"
          data-testid="input-search-catalogue"
        />
        <span className="text-xs italic text-muted-foreground">
          {catalogType === "protheses" ? sortedProtheses.length : totalImplants} {catalogType === "protheses" ? "prothèse" : "implant"}{(catalogType === "protheses" ? sortedProtheses.length : totalImplants) > 1 ? "s" : ""}
        </span>
        
        {catalogType === "protheses" ? (
          <ProthesesAdvancedFilterDrawer
            filters={protheseAdvancedFilters}
            onFiltersChange={setProtheseAdvancedFilters}
            activeFilterCount={protheseAdvancedFilters?.rules.length || 0}
          />
        ) : (
          <ImplantsAdvancedFilterDrawer
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            activeFilterCount={advancedFilters?.rules.length || 0}
          />
        )}

        {selectedIds.size > 0 && (
          <>
            <span className="text-sm font-medium">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={bulkDeleteMutation.isPending}
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
        
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 shrink-0" data-testid="button-new-item">
              <Plus className="h-4 w-4" />
              {catalogType === "protheses" ? "Nouvelle prothèse" : "Nouvel implant"}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto bg-white dark:bg-gray-950">
            <SheetHeader className="mb-6">
              <SheetTitle>{catalogType === "protheses" ? "Nouvelle prothèse" : "Nouvel implant"}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {catalogType === "protheses" ? "Ajoutez une prothèse au catalogue" : "Ajoutez un implant au catalogue produit"}
              </p>
            </SheetHeader>
            {catalogType === "protheses" ? (
              <ProtheseForm 
                onSuccess={() => {
                  setSheetOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
                }} 
              />
            ) : (
              <ImplantForm 
                onSuccess={() => {
                  setSheetOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
                }} 
              />
            )}
          </SheetContent>
        </Sheet>
      </div>

      {catalogType === "protheses" ? (
        <div className="flex items-center justify-end mb-4">
          <ProtheseFilterChips
            filters={protheseAdvancedFilters}
            onFiltersChange={setProtheseAdvancedFilters}
          />
        </div>
      ) : (
        <div className="flex items-center justify-end mb-4">
          <ImplantFilterChips
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
      )}

      {catalogType === "protheses" ? (
        /* Protheses Table */
        <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-gray bg-border-gray">
                  <th className="w-12 px-4 py-2">
                    <Checkbox
                      checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      data-testid="checkbox-select-all-header"
                    />
                  </th>
                  {protheseColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${protheseColumnWidths[column.id]} ${dragOverProtheseColumn === column.id ? "bg-primary/10" : ""}`}
                      draggable
                      onDragStart={(e) => handleProtheseDragStart(e, column.id)}
                      onDragOver={(e) => handleProtheseDragOver(e, column.id)}
                      onDragEnd={handleProtheseDragEnd}
                      onDrop={handleProtheseDragEnd}
                    >
                      <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3 w-3 opacity-40" />
                        <button
                          onClick={() => column.sortable && handleProtheseSort(column.id)}
                          className="flex items-center hover:text-foreground transition-colors"
                          data-testid={`sort-${column.id}`}
                        >
                          {column.label}
                          {column.sortable && renderProtheseSortIcon(column.id)}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedProtheses.length === 0 ? (
                  <tr>
                    <td colSpan={protheseColumns.length + 1} className="px-4 py-16">
                      <div className="flex flex-col items-center justify-center">
                        <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-base font-medium mb-2 text-foreground">Aucune prothèse</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery
                            ? "Aucune prothèse ne correspond à votre recherche"
                            : "Commencez par ajouter votre première prothèse au catalogue"}
                        </p>
                        {!searchQuery && (
                          <Button onClick={() => setSheetOpen(true)} data-testid="button-add-first-prothese">
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter une prothèse
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedProtheses.map((prothese) => (
                    <tr 
                      key={prothese.id} 
                      className={`border-b border-border-gray hover-elevate cursor-pointer ${selectedIds.has(prothese.id) ? "bg-muted/50" : ""}`}
                      onClick={() => setLocation(`/catalogue/${prothese.id}`)}
                      data-testid={`row-prothese-${prothese.id}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(prothese.id)}
                          onCheckedChange={(checked) => handleSelectRow(prothese.id, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-prothese-${prothese.id}`}
                        />
                      </td>
                      {protheseColumns.map((column) => (
                        <td key={column.id} className={`px-4 py-3 ${protheseColumnWidths[column.id]}`}>
                          {renderProtheseCellContent(column.id, prothese)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Implants Table */
        <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-gray bg-border-gray">
                  <th className="w-12 px-4 py-2">
                    <Checkbox
                      checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      data-testid="checkbox-select-all-header"
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
                </tr>
              </thead>
              <tbody>
                {paginatedImplants.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-16">
                      <div className="flex flex-col items-center justify-center">
                        <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-base font-medium mb-2 text-foreground">Aucun implant</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery
                            ? "Aucun implant ne correspond a votre recherche"
                            : "Commencez par ajouter votre premier implant au catalogue"}
                        </p>
                        {!searchQuery && (
                          <Button onClick={() => setSheetOpen(true)} data-testid="button-add-first-implant">
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter un implant
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedImplants.map((implant) => (
                    <tr 
                      key={implant.id} 
                      className={`border-b border-border-gray hover-elevate cursor-pointer ${selectedIds.has(implant.id) ? "bg-muted/50" : ""}`}
                      onClick={() => setLocation(`/catalogue/${implant.id}`)}
                      data-testid={`row-implant-${implant.id}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(implant.id)}
                          onCheckedChange={(checked) => handleSelectRow(implant.id, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-implant-${implant.id}`}
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.id} className={`px-4 py-3 ${columnWidths[column.id]}`}>
                          {renderCellContent(column.id, implant)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mt-4">
        <CassiusPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalImplants}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer {selectedIds.size} {catalogType === "protheses" ? "prothèse(s)" : "implant(s)"} du catalogue ?
              Cette action est irréversible. Les éléments utilisés dans des interventions ne pourront pas être supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending} data-testid="button-cancel-delete">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {bulkDeleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
