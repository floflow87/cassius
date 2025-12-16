import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  User,
  ChevronRight,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PatientForm } from "@/components/patient-form";
import { CassiusBadge, CassiusChip, CassiusPagination, CassiusSearchInput } from "@/components/cassius-ui";
import type { Patient } from "@shared/schema";

interface PatientsPageProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function PatientsPage({ searchQuery, setSearchQuery }: PatientsPageProps) {
  const [, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const itemsPerPage = 20;

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  const totalPatients = filteredPatients.length;
  const totalPages = Math.ceil(totalPatients / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalPatients);
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

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

  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
  };

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
          placeholder="Rechercher un patient (nom, prénom, date de naissance...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="max-w-2xl"
          data-testid="input-search-patients"
        />
        
        <Button variant="outline" className="gap-2 shrink-0" data-testid="button-filter">
          <Filter className="h-4 w-4" />
          Filtrer
        </Button>
        
        <Button variant="outline" className="gap-2 shrink-0" data-testid="button-export">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
        
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
            <PatientForm onSuccess={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
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

      <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-gray bg-border-gray">
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Patient</th>
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date de naissance</th>
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">Implants</th>
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Dernière visite</th>
                <th className="text-left px-4 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Statut</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16">
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
                paginatedPatients.map((patient) => {
                  const status = getPatientStatus(patient);
                  const displayId = `PAT-${new Date(patient.createdAt || Date.now()).getFullYear()}-${patient.id.slice(0, 4).toUpperCase()}`;
                  
                  return (
                    <tr 
                      key={patient.id} 
                      onClick={() => navigateToPatient(patient.id)}
                      className="border-b border-border-gray/50 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                      data-testid={`row-patient-${patient.id}`}
                    >
                      <td className="px-4 py-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {patient.prenom} {patient.nom}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {displayId}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDateWithAge(patient.dateNaissance)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="text-sm text-foreground">{formatPhoneNumber(patient.telephone)}</div>
                          <div className="text-xs text-muted-foreground">{patient.email || '-'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">-</span> implants
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-muted-foreground">-</span>
                      </td>
                      <td className="px-4 py-4">
                        <CassiusBadge status={status}>
                          {getStatusLabel(status)}
                        </CassiusBadge>
                      </td>
                      <td className="px-4 py-4">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}
