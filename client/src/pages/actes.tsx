import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import type { Operation } from "@shared/schema";

type OperationWithDetails = Operation & { 
  patientNom: string; 
  patientPrenom: string; 
  implantCount: number;
};

type SortDirection = "asc" | "desc" | null;
type ColumnId = "dateOperation" | "patient" | "typeIntervention" | "implantCount" | "greffe";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const columnWidths: Record<ColumnId, string> = {
  dateOperation: "w-[18%]",
  patient: "w-[22%]",
  typeIntervention: "w-[25%]",
  implantCount: "w-[18%]",
  greffe: "w-[17%]",
};

const defaultColumns: ColumnConfig[] = [
  { id: "dateOperation", label: "Date", sortable: true },
  { id: "patient", label: "Patient", sortable: true },
  { id: "typeIntervention", label: "Type d'intervention", sortable: true },
  { id: "implantCount", label: "Implants posés", sortable: true },
  { id: "greffe", label: "Greffe", sortable: true },
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
    queryKey: ["/api/operations"],
    queryFn: async () => {
      const res = await fetch("/api/operations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch operations");
      return res.json();
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
        case "implantCount":
          comparison = a.implantCount - b.implantCount;
          break;
        case "greffe":
          comparison = (a.greffeOsseuse ? 1 : 0) - (b.greffeOsseuse ? 1 : 0);
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

  const renderSortIcon = (columnId: ColumnId) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const renderCellContent = (columnId: ColumnId, op: OperationWithDetails) => {
    switch (columnId) {
      case "dateOperation":
        return <span className="font-medium">{formatDate(op.dateOperation)}</span>;
      case "patient":
        return (
          <span className="font-medium">
            {op.patientPrenom} {op.patientNom}
          </span>
        );
      case "typeIntervention":
        return (
          <Badge variant="secondary" className="text-xs">
            {TYPE_INTERVENTION_LABELS[op.typeIntervention] || op.typeIntervention}
          </Badge>
        );
      case "implantCount":
        return op.implantCount > 0 ? (
          <span className="text-muted-foreground">{op.implantCount} implant{op.implantCount > 1 ? "s" : ""}</span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        );
      case "greffe":
        return op.greffeOsseuse ? (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
            Oui
          </Badge>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-actes-title">Actes chirurgicaux</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Liste de toutes les interventions chirurgicales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CassiusSearchInput 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            data-testid="input-search-actes"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">{totalOperations} acte{totalOperations > 1 ? "s" : ""}</span>
      </div>

      <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-gray bg-border-gray">
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
              {paginatedOperations.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16">
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
                    className="border-b border-border-gray hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/patients/${op.patientId}`)}
                    data-testid={`row-operation-${op.id}`}
                  >
                    {columns.map((column) => (
                      <td key={column.id} className={`px-4 py-3 ${columnWidths[column.id]}`}>
                        {renderCellContent(column.id, op)}
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
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalOperations}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
