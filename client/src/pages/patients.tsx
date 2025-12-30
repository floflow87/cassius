import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  User,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  LayoutGrid,
  LayoutList,
  Phone,
  Mail,
  Calendar,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientsListSkeleton } from "@/components/page-skeletons";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { PatientForm } from "@/components/patient-form";
import { CassiusBadge, CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import { AdvancedFilterDrawer, FilterChips, type FilterGroup } from "@/components/advanced-filter-drawer";
import { CompactFlagList, TopFlagSummary } from "@/components/flag-badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Patient, FlagWithEntity } from "@shared/schema";
import type { FilterRule, PatientSearchResult, TopFlag } from "@shared/types";
import { AlertTriangle } from "lucide-react";

interface PatientsPageProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

type SortDirection = "asc" | "desc" | null;
type ColumnId = "patient" | "dateNaissance" | "contact" | "implants" | "derniereVisite" | "flags" | "statut";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const defaultColumns: ColumnConfig[] = [
  { id: "patient", label: "Patient", width: "w-56", sortable: true },
  { id: "dateNaissance", label: "Date de naissance", width: "w-40", sortable: true },
  { id: "contact", label: "Contact", width: "w-44", sortable: true },
  { id: "implants", label: "Implants", width: "w-28", sortable: true },
  { id: "derniereVisite", label: "Dernière visite", width: "w-40", sortable: true },
  { id: "flags", label: "Alertes", width: "w-32", sortable: true },
  { id: "statut", label: "Statut", width: "w-28", sortable: true },
];

const STORAGE_KEY_COLUMNS = "cassius_patients_columns_order";
const STORAGE_KEY_SORT = "cassius_patients_sort";
const STORAGE_KEY_VIEW_MODE = "cassius_patients_view_mode";

export default function PatientsPage({ searchQuery, setSearchQuery }: PatientsPageProps) {
  const [, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [advancedFilters, setAdvancedFilters] = useState<FilterGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
      if (saved === "table" || saved === "cards") {
        return saved;
      }
    } catch {}
    return "table";
  });
  const itemsPerPage = 20;

  const handleViewModeChange = (mode: "table" | "cards") => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch {}
  };

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ColumnId[];
        // Map saved order to columns, filtering out any that no longer exist
        const orderedColumns = savedOrder
          .map(id => defaultColumns.find(c => c.id === id))
          .filter(Boolean) as ColumnConfig[];
        // Add any new columns that weren't in the saved order (at the end, before 'statut')
        const savedIds = new Set(savedOrder);
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        if (newColumns.length > 0) {
          // Insert new columns before 'statut' column if it exists at the end
          const statutIndex = orderedColumns.findIndex(c => c.id === "statut");
          if (statutIndex === orderedColumns.length - 1) {
            orderedColumns.splice(statutIndex, 0, ...newColumns);
          } else {
            orderedColumns.push(...newColumns);
          }
        }
        return orderedColumns;
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

  const activeFilterCount = useMemo(() => {
    if (!advancedFilters) return 0;
    return advancedFilters.rules.filter(rule => "field" in rule).length;
  }, [advancedFilters]);

  const hasActiveFilters = Boolean(advancedFilters && advancedFilters.rules.length > 0);

  // Use search endpoint when filters are active, otherwise use summary endpoint
  const { data: searchData, isLoading: isSearchLoading } = useQuery<PatientSearchResult>({
    queryKey: ["/api/patients/search", advancedFilters, currentPage, sortColumn, sortDirection],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/patients/search", {
        filters: advancedFilters,
        pagination: { page: currentPage, pageSize: itemsPerPage },
        sort: sortColumn && sortDirection ? {
          field: sortColumn === "patient" ? "nom" : sortColumn,
          direction: sortDirection
        } : undefined,
      });
      return response.json();
    },
    enabled: hasActiveFilters,
  });

  // OPTIMIZATION: Combined summary endpoint - reduces 3 API calls to 1 (when no filters)
  // Now includes flag summaries per patient
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<{
    patients: Patient[];
    implantCounts: Record<string, number>;
    lastVisits: Record<string, { date: string; titre: string | null }>;
    flagsByPatient: Record<string, { topFlag?: TopFlag; activeFlagCount: number }>;
  }>({
    queryKey: ["/api/patients/summary"],
    enabled: !hasActiveFilters,
  });

  // Fetch all flags with patient info (fallback for when filters are active)
  const { data: allFlags = [] } = useQuery<FlagWithEntity[]>({
    queryKey: ["/api/flags", "withEntity"],
    queryFn: async () => {
      const res = await fetch("/api/flags?withEntity=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flags");
      return res.json();
    },
    enabled: hasActiveFilters,
  });

  // Use flagsByPatient from summary endpoint, or build from allFlags when filters are active
  const flagsByPatient = useMemo(() => {
    if (summaryData?.flagsByPatient) {
      return summaryData.flagsByPatient;
    }
    // Fallback: group flags by patientId when filters are active
    const grouped: Record<string, { topFlag?: TopFlag; activeFlagCount: number }> = {};
    allFlags.forEach((flag) => {
      if (!flag.resolvedAt && flag.patientId) {
        if (!grouped[flag.patientId]) {
          grouped[flag.patientId] = { activeFlagCount: 0 };
        }
        grouped[flag.patientId].activeFlagCount += 1;
        // Set topFlag as the most critical one
        if (!grouped[flag.patientId].topFlag || 
            (flag.level === "CRITICAL" && grouped[flag.patientId].topFlag?.level !== "CRITICAL") ||
            (flag.level === "WARNING" && grouped[flag.patientId].topFlag?.level === "INFO")) {
          grouped[flag.patientId].topFlag = {
            type: flag.type,
            level: flag.level as "CRITICAL" | "WARNING" | "INFO",
            label: flag.label,
            createdAt: flag.createdAt?.toISOString?.() || String(flag.createdAt),
          };
        }
      }
    });
    return grouped;
  }, [summaryData?.flagsByPatient, allFlags]);
  
  const isLoading = hasActiveFilters ? isSearchLoading : isSummaryLoading;
  const patients = hasActiveFilters ? searchData?.patients : summaryData?.patients;
  const implantCounts = hasActiveFilters ? searchData?.implantCounts : summaryData?.implantCounts;
  const lastVisits = hasActiveFilters ? searchData?.lastVisits : summaryData?.lastVisits;
  const serverTotal = hasActiveFilters ? searchData?.total : undefined;
  const serverTotalPages = hasActiveFilters ? searchData?.totalPages : undefined;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, advancedFilters]);

  useEffect(() => {
    if (patients && currentPage > 1) {
      const maxPage = Math.max(1, Math.ceil(patients.length / itemsPerPage));
      if (currentPage > maxPage) {
        setCurrentPage(maxPage);
      }
    }
  }, [patients, currentPage, itemsPerPage]);

  const filteredPatients = patients?.filter((patient) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      patient.nom.toLowerCase().includes(query) ||
      patient.prenom.toLowerCase().includes(query) ||
      patient.email?.toLowerCase().includes(query) ||
      patient.telephone?.includes(query) ||
      patient.dateNaissance?.includes(query)
    );
  }) || [];

  const sortPatients = useCallback((patientsToSort: Patient[]) => {
    if (!sortColumn || !sortDirection) return patientsToSort;

    return [...patientsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "patient":
          comparison = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
          break;
        case "dateNaissance":
          comparison = new Date(a.dateNaissance).getTime() - new Date(b.dateNaissance).getTime();
          break;
        case "contact":
          comparison = (a.telephone || "").localeCompare(b.telephone || "");
          break;
        case "implants":
          comparison = (implantCounts?.[a.id] || 0) - (implantCounts?.[b.id] || 0);
          break;
        case "derniereVisite":
          const dateA = lastVisits?.[a.id]?.date;
          const dateB = lastVisits?.[b.id]?.date;
          if (!dateA && !dateB) comparison = 0;
          else if (!dateA) comparison = 1;
          else if (!dateB) comparison = -1;
          else comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
          break;
        case "flags":
          const flagsA = flagsByPatient[a.id]?.activeFlagCount || 0;
          const flagsB = flagsByPatient[b.id]?.activeFlagCount || 0;
          comparison = flagsA - flagsB;
          break;
        case "statut":
          comparison = 0;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [sortColumn, sortDirection, implantCounts, lastVisits, flagsByPatient]);

  // When filters are active, server handles sorting and pagination
  // When no filters, we handle it client-side
  const sortedPatients = hasActiveFilters ? (patients || []) : sortPatients(filteredPatients);
  const totalPatients = hasActiveFilters ? (serverTotal || 0) : sortedPatients.length;
  const totalPages = hasActiveFilters ? (serverTotalPages || 1) : Math.ceil(totalPatients / itemsPerPage);
  const startIndex = hasActiveFilters ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = hasActiveFilters ? sortedPatients.length : Math.min(startIndex + itemsPerPage, totalPatients);
  const paginatedPatients = hasActiveFilters ? sortedPatients : sortedPatients.slice(startIndex, endIndex);

  const currentPageIds = paginatedPatients.map(p => p.id);
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiRequest("DELETE", `/api/patients/${id}`);
      }
      return ids.length;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/search"] });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: "Patients supprimés",
        description: `${deletedCount} patient(s) supprimé(s) avec succès.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

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

  const calculateAge = (dateNaissance: string) => {
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateWithAge = (dateString: string) => {
    const age = calculateAge(dateString);
    return `${formatDate(dateString)} (${age} ans)`;
  };

  const handleRemoveFilter = useCallback((ruleId: string) => {
    if (!advancedFilters) return;
    const newRules = advancedFilters.rules.filter(rule => {
      if ("id" in rule) return rule.id !== ruleId;
      return true;
    });
    if (newRules.length === 0) {
      setAdvancedFilters(null);
    } else {
      setAdvancedFilters({ ...advancedFilters, rules: newRules });
    }
  }, [advancedFilters]);

  const handleClearAllFilters = useCallback(() => {
    setAdvancedFilters(null);
  }, []);

  const getPatientStatus = (_patient: Patient): "actif" | "en-suivi" | "planifie" | "inactif" => {
    return "actif";
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "actif": return "Actif";
      case "en-suivi": return "En suivi";
      case "planifie": return "Planifié";
      case "inactif": return "Inactif";
      default: return "Actif";
    }
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phone;
  };

  const navigateToPatient = (patientId: string) => {
    setLocation(`/patients/${patientId}`);
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

  const renderCellContent = (columnId: ColumnId, patient: Patient) => {
    const status = getPatientStatus(patient);
    const displayId = `PAT-${new Date(patient.createdAt || Date.now()).getFullYear()}-${patient.id.slice(0, 4).toUpperCase()}`;

    switch (columnId) {
      case "patient":
        return (
          <div>
            <div className="text-sm font-medium text-foreground">
              {patient.prenom} {patient.nom}
            </div>
            <div className="text-xs text-muted-foreground">
              ID: {displayId}
            </div>
          </div>
        );
      case "dateNaissance":
        return (
          <span className="text-sm text-muted-foreground">
            {formatDateWithAge(patient.dateNaissance)}
          </span>
        );
      case "contact":
        return (
          <div>
            <div className="text-sm text-foreground">{formatPhoneNumber(patient.telephone)}</div>
            <div className="text-xs text-muted-foreground">{patient.email || '-'}</div>
          </div>
        );
      case "implants":
        const implantCount = implantCounts?.[patient.id] || 0;
        return (
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{implantCount}</span> implant{implantCount !== 1 ? 's' : ''}
          </span>
        );
      case "derniereVisite":
        const lastVisit = lastVisits?.[patient.id];
        if (lastVisit) {
          return (
            <span className="text-sm text-muted-foreground">
              {new Date(lastVisit.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          );
        }
        return <span className="text-sm text-muted-foreground">—</span>;
      case "flags":
        const patientFlagData = flagsByPatient[patient.id];
        if (!patientFlagData || patientFlagData.activeFlagCount === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return <TopFlagSummary topFlag={patientFlagData.topFlag} activeFlagCount={patientFlagData.activeFlagCount} />;
      case "statut":
        return (
          <CassiusBadge status={status}>
            {getStatusLabel(status)}
          </CassiusBadge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PatientsListSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-5">
        <CassiusSearchInput
          placeholder="Rechercher un patient (nom, prénom, date de naissance...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="max-w-2xl"
          data-testid="input-search-patients"
        />
        
        <AdvancedFilterDrawer
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          activeFilterCount={activeFilterCount}
        />

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("table")}
            data-testid="button-view-table"
            className="rounded-r-none"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("cards")}
            data-testid="button-view-cards"
            className="rounded-l-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        
        {selectedIds.size > 0 && (
          <>
            <span className="text-sm font-medium">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              data-testid="button-bulk-delete-patients"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-clear-selection-patients"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 shrink-0" data-testid="button-new-patient">
              <Plus className="h-4 w-4" />
              Nouveau patient
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto bg-white dark:bg-gray-950">
            <SheetHeader className="mb-6">
              <SheetTitle>Nouveau patient</SheetTitle>
            </SheetHeader>
            <PatientForm onSuccess={(patientId) => {
              setSheetOpen(false);
              setLocation(`/patients/${patientId}`);
            }} />
          </SheetContent>
        </Sheet>
      </div>

      {advancedFilters && advancedFilters.rules.length > 0 && (
        <div className="mb-5">
          <FilterChips
            filters={advancedFilters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        </div>
      )}

      {viewMode === "table" ? (
        <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-gray bg-border-gray">
                  <th className="w-10 px-4 py-2">
                    <Checkbox
                      checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      data-testid="checkbox-select-all-patients"
                    />
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
                {paginatedPatients.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-16">
                      <div className="flex flex-col items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-base font-medium mb-2 text-foreground">Aucun patient</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery
                            ? "Aucun patient ne correspond à votre recherche"
                            : "Commencez par ajouter votre premier patient"}
                        </p>
                        {!searchQuery && (
                          <Button onClick={() => setSheetOpen(true)} data-testid="button-add-first-patient">
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter un patient
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      onClick={() => navigateToPatient(patient.id)}
                      className={`border-b border-border-gray/50 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer group ${selectedIds.has(patient.id) ? "bg-primary/5" : ""}`}
                      data-testid={`row-patient-${patient.id}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(patient.id)}
                          onCheckedChange={(checked) => handleSelectRow(patient.id, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-patient-${patient.id}`}
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.id} className="px-4 py-3">
                          {renderCellContent(column.id, patient)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedPatients.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-base font-medium mb-2 text-foreground">Aucun patient</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Aucun patient ne correspond à votre recherche"
                  : "Commencez par ajouter votre premier patient"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setSheetOpen(true)} data-testid="button-add-first-patient-cards">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un patient
                </Button>
              )}
            </div>
          ) : (
            paginatedPatients.map((patient) => {
              const status = getPatientStatus(patient);
              const displayId = `PAT-${new Date(patient.createdAt || Date.now()).getFullYear()}-${patient.id.slice(0, 4).toUpperCase()}`;
              
              return (
                <Card 
                  key={patient.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigateToPatient(patient.id)}
                  data-testid={`card-patient-${patient.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-foreground">
                          {patient.prenom} {patient.nom}
                        </h3>
                        <p className="text-xs text-muted-foreground">{displayId}</p>
                      </div>
                      <CassiusBadge status={status}>
                        {getStatusLabel(status)}
                      </CassiusBadge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDateWithAge(patient.dateNaissance)}</span>
                      </div>
                      
                      {patient.telephone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{formatPhoneNumber(patient.telephone)}</span>
                        </div>
                      )}
                      
                      {patient.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                      )}
                    </div>
                    
                    {flagsByPatient[patient.id]?.activeFlagCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <TopFlagSummary 
                          topFlag={flagsByPatient[patient.id]?.topFlag} 
                          activeFlagCount={flagsByPatient[patient.id]?.activeFlagCount} 
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {totalPatients > 0 && (
        <div className="flex items-center justify-end mt-4">
          <CassiusPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalPatients}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.size} patient{selectedIds.size > 1 ? "s" : ""} ? 
              Cette action est irréversible et supprimera également toutes les données associées 
              (opérations, implants, radiographies, visites, documents et notes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-patients">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-patients"
            >
              {bulkDeleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
