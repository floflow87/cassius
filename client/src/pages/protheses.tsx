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
import { ProtheseForm } from "@/components/prothese-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ImplantWithStats } from "@shared/schema";

type SortDirection = "asc" | "desc" | null;
type ColumnId = "marque" | "typeProthese" | "mobilite" | "typePilier";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const columnWidths: Record<ColumnId, string> = {
  marque: "w-[30%]",
  typeProthese: "w-[25%]",
  mobilite: "w-[22%]",
  typePilier: "w-[23%]",
};

const defaultColumns: ColumnConfig[] = [
  { id: "marque", label: "Marque", sortable: true },
  { id: "typeProthese", label: "Type de prothèse", sortable: true },
  { id: "mobilite", label: "Mobilité", sortable: true },
  { id: "typePilier", label: "Type de pilier", sortable: true },
];

const STORAGE_KEY_COLUMNS = "cassius_protheses_columns_order";
const STORAGE_KEY_SORT = "cassius_protheses_sort";

const typeProtheseLabels: Record<string, string> = {
  VISSEE: "Vissée",
  SCELLEE: "Scellée",
};

const mobiliteLabels: Record<string, string> = {
  AMOVIBLE: "Amovible",
  FIXE: "Fixe",
};

const typePilierLabels: Record<string, string> = {
  DROIT: "Droit",
  ANGULE: "Angulé",
  MULTI_UNIT: "Multi-unit",
};

export default function ProthesesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canDelete } = useCurrentUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 20;
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

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

  const { data: allImplants, isLoading } = useQuery<ImplantWithStats[]>({
    queryKey: ["/api/implants"],
  });

  const protheses = allImplants?.filter(imp => imp.typeImplant === "PROTHESE") || [];

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
          title: "Prothèses supprimées",
          description: `${successCount} prothèse(s) supprimée(s) avec succès.`,
          variant: "success",
        });
      } else if (successCount === 0) {
        toast({
          title: "Erreur",
          description: "Aucune prothèse n'a pu être supprimée. Ces prothèses sont peut-être utilisées dans des interventions.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Suppression partielle",
          description: `${successCount} prothèse(s) supprimée(s), ${failedCount} échec(s).`,
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

  const filteredProtheses = protheses.filter((prothese) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      prothese.marque.toLowerCase().includes(query) ||
      prothese.referenceFabricant?.toLowerCase().includes(query)
    );
  });

  const sortProtheses = useCallback((prothesesToSort: ImplantWithStats[]) => {
    if (!sortColumn || !sortDirection) return prothesesToSort;

    return [...prothesesToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "marque":
          comparison = a.marque.localeCompare(b.marque);
          break;
        case "typeProthese":
          comparison = (a.typeProthese || "").localeCompare(b.typeProthese || "");
          break;
        case "mobilite":
          comparison = (a.mobilite || "").localeCompare(b.mobilite || "");
          break;
        case "typePilier":
          comparison = (a.typePilier || "").localeCompare(b.typePilier || "");
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [sortColumn, sortDirection]);

  const sortedProtheses = sortProtheses(filteredProtheses);
  const totalProtheses = sortedProtheses.length;
  const totalPages = Math.ceil(totalProtheses / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProtheses = sortedProtheses.slice(startIndex, startIndex + itemsPerPage);

  const currentPageIds = paginatedProtheses.map(i => i.id);
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

  const renderCellContent = (columnId: ColumnId, prothese: ImplantWithStats) => {
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
      case "mobilite":
        return prothese.mobilite ? (
          <Badge variant="secondary" className="text-xs">
            {mobiliteLabels[prothese.mobilite] || prothese.mobilite}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      case "typePilier":
        return prothese.typePilier ? (
          <Badge variant="secondary" className="text-xs">
            {typePilierLabels[prothese.typePilier] || prothese.typePilier}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <CatalogImplantsListSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <CassiusSearchInput
          placeholder="Rechercher une prothèse..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="max-w-sm"
          data-testid="input-search-protheses"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && canDelete && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground"
                data-testid="button-clear-selection"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {selectedIds.size} sélectionné(s)
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete-protheses"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Supprimer
              </Button>
            </>
          )}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" data-testid="button-add-prothese">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nouvelle prothèse
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Ajouter une prothèse</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <ProtheseForm onSuccess={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {paginatedProtheses.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              Aucune prothèse
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {searchQuery 
                ? "Aucun résultat pour cette recherche"
                : "Commencez par ajouter une prothèse à votre catalogue"
              }
            </p>
            {!searchQuery && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" data-testid="button-add-prothese-empty">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter une prothèse
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Ajouter une prothèse</SheetTitle>
                  </SheetHeader>
                  <div className="py-4">
                    <ProtheseForm onSuccess={() => setSheetOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Sélectionner tout"
                      className={someCurrentPageSelected && !allCurrentPageSelected ? "data-[state=checked]:bg-primary/50" : ""}
                      data-testid="checkbox-select-all-protheses"
                    />
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className={`${columnWidths[column.id]} px-3 py-2 text-left cursor-pointer select-none ${
                        dragOverColumn === column.id ? "bg-primary/10" : ""
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, column.id)}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => column.sortable && handleSort(column.id)}
                      data-testid={`th-${column.id}`}
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {column.label}
                        </span>
                        {column.sortable && renderSortIcon(column.id)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProtheses.map((prothese) => (
                  <tr
                    key={prothese.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/protheses/${prothese.id}`)}
                    data-testid={`row-prothese-${prothese.id}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(prothese.id)}
                        onCheckedChange={(checked) => handleSelectRow(prothese.id, !!checked)}
                        aria-label={`Sélectionner ${prothese.marque}`}
                        data-testid={`checkbox-prothese-${prothese.id}`}
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className={`${columnWidths[column.id]} px-3 py-2`}>
                        {renderCellContent(column.id, prothese)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <CassiusPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalProtheses}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les prothèses sélectionnées ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer {selectedIds.size} prothèse(s).
              Cette action est irréversible. Les prothèses déjà utilisées dans des interventions ne pourront pas être supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
