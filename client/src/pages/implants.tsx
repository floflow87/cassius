import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Filter, 
  Activity,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  LayoutGrid,
  LayoutList,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CassiusChip, CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import { ImplantForm } from "@/components/implant-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Implant, Patient } from "@shared/schema";

interface ImplantWithPatient extends Implant {
  patient?: Patient;
}

type SortDirection = "asc" | "desc" | null;
type ColumnId = "marque" | "dimensions" | "nbPoses" | "reussite";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const defaultColumns: ColumnConfig[] = [
  { id: "marque", label: "Marque & Reference", width: "w-72", sortable: true },
  { id: "dimensions", label: "Diametre x Longueur", width: "w-40", sortable: true },
  { id: "nbPoses", label: "Nb de poses", width: "w-36", sortable: true },
  { id: "reussite", label: "Reussite moyenne", width: "w-40", sortable: true },
];

const STORAGE_KEY_COLUMNS = "cassius_implants_columns_order";
const STORAGE_KEY_SORT = "cassius_implants_sort";

interface ImplantsPageProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export default function ImplantsPage({ searchQuery: externalSearchQuery, setSearchQuery: externalSetSearchQuery }: ImplantsPageProps) {
  const [, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [implantType, setImplantType] = useState<"implants" | "mini">("implants");
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery ?? setInternalSearchQuery;
  const itemsPerPage = 20;

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ColumnId[];
        return savedOrder.map(id => defaultColumns.find(c => c.id === id)!).filter(Boolean);
      }
    } catch {}
    return defaultColumns;
  });

  const [sortColumn, setSortColumn] = useState<ColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT);
      if (saved) {
        const { column } = JSON.parse(saved);
        return column;
      }
    } catch {}
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

  const { data: implants, isLoading } = useQuery<ImplantWithPatient[]>({
    queryKey: ["/api/implants"],
    queryFn: async () => {
      const res = await fetch("/api/implants", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch implants");
      return res.json();
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredImplants = implants?.filter((implant) => {
    // Filter by implant type
    const expectedType = implantType === "mini" ? "MINI_IMPLANT" : "IMPLANT";
    if ((implant as any).typeImplant && (implant as any).typeImplant !== expectedType) {
      return false;
    }
    // If no typeImplant field (legacy data), treat as regular implant
    if (!(implant as any).typeImplant && implantType === "mini") {
      return false;
    }
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      implant.marque.toLowerCase().includes(query) ||
      implant.siteFdi.toLowerCase().includes(query) ||
      implant.patient?.nom.toLowerCase().includes(query) ||
      implant.patient?.prenom.toLowerCase().includes(query) ||
      implant.referenceFabricant?.toLowerCase().includes(query)
    );
  }) || [];

  const sortImplants = useCallback((implantsToSort: ImplantWithPatient[]) => {
    if (!sortColumn || !sortDirection) return implantsToSort;

    return [...implantsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "marque":
          comparison = a.marque.localeCompare(b.marque);
          break;
        case "dimensions":
          comparison = (a.diametre * 100 + a.longueur) - (b.diametre * 100 + b.longueur);
          break;
        case "nbPoses":
          comparison = new Date(a.datePose).getTime() - new Date(b.datePose).getTime();
          break;
        case "reussite":
          const aIsq = a.isqPose || 0;
          const bIsq = b.isqPose || 0;
          comparison = aIsq - bIsq;
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
  const endIndex = Math.min(startIndex + itemsPerPage, totalImplants);
  const paginatedImplants = sortedImplants.slice(startIndex, endIndex);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
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

  const getSuccessRate = (implant: ImplantWithPatient): number => {
    if (implant.statut === "SUCCES") return 100;
    if (implant.statut === "ECHEC") return 0;
    const isq = implant.isq6m || implant.isq3m || implant.isq2m || implant.isqPose || 0;
    return Math.min(100, Math.round(isq * 1.2));
  };

  const renderCellContent = (columnId: ColumnId, implant: ImplantWithPatient) => {
    switch (columnId) {
      case "marque":
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                {implant.marque}
              </div>
              <div className="text-xs text-muted-foreground">
                Ref: {implant.referenceFabricant || "-"}
              </div>
            </div>
          </div>
        );
      case "dimensions":
        return (
          <span className="text-sm text-muted-foreground">
            {implant.diametre} x {implant.longueur} mm
          </span>
        );
      case "nbPoses":
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(implant.datePose)}
          </span>
        );
      case "reussite":
        const rate = getSuccessRate(implant);
        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${rate >= 90 ? "text-emerald-600 dark:text-emerald-400" : rate >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {rate.toFixed(1)}%
            </span>
            {rate >= 90 && (
              <Check className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-11 w-full max-w-2xl" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-5">
        <CassiusSearchInput
          placeholder="Rechercher par marque, reference, patient, site FDI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="max-w-2xl"
          data-testid="input-search-implants"
        />
        
        <Button variant="outline" className="gap-2 shrink-0" data-testid="button-filter">
          <Filter className="h-4 w-4" />
          Filtrer
        </Button>
        
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 shrink-0" data-testid="button-new-implant">
              <Plus className="h-4 w-4" />
              Nouvel implant
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto bg-white dark:bg-gray-950">
            <SheetHeader className="mb-6">
              <SheetTitle>Nouvel implant</SheetTitle>
            </SheetHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="patient-select">Patient</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger id="patient-select" data-testid="select-patient-for-implant">
                    <SelectValue placeholder="Selectionnez un patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.prenom} {patient.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPatientId && (
                <ImplantForm 
                  patientId={selectedPatientId} 
                  onSuccess={() => {
                    setSheetOpen(false);
                    setSelectedPatientId("");
                    queryClient.invalidateQueries({ queryKey: ["/api/implants"] });
                  }} 
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Tabs value={implantType} onValueChange={(v) => setImplantType(v as "implants" | "mini")}>
          <TabsList>
            <TabsTrigger value="implants" data-testid="tab-implants">Implants</TabsTrigger>
            <TabsTrigger value="mini" data-testid="tab-mini-implants">Mini-implants</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtres actifs:</span>
            {activeFilters.map((filter) => (
              <CassiusChip 
                key={filter} 
                onRemove={() => removeFilter(filter)}
              >
                {filter}
              </CassiusChip>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" data-testid="checkbox-select-all" />
          <span className="text-sm text-muted-foreground">{totalImplants} implants</span>
        </div>
        <CassiusPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalImplants}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-gray bg-border-gray">
                <th className="w-12 px-4 py-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={`text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${column.width || ""} ${dragOverColumn === column.id ? "bg-primary/10" : ""}`}
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
                          : "Commencez par ajouter votre premier implant"}
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
                    onClick={() => setLocation(`/patients/${implant.patientId}/implants/${implant.id}`)}
                    className="border-b border-border-gray/50 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                    data-testid={`row-implant-${implant.id}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className="px-4 py-3">
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

      {totalImplants > 0 && (
        <div className="flex items-center justify-end mt-4">
          <CassiusPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalImplants}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
