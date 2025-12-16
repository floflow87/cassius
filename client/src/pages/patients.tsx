import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  LayoutGrid,
  User,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PatientForm } from "@/components/patient-form";
import type { Patient } from "@shared/schema";

interface PatientsPageProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function PatientsPage({ searchQuery, setSearchQuery }: PatientsPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>(["Patients actifs"]);
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

  const togglePatientSelection = (id: string) => {
    setSelectedPatients(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedPatients.length === paginatedPatients.length && paginatedPatients.length > 0) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(paginatedPatients.map(p => p.id));
    }
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  const getPatientStatus = (patient: Patient): string => {
    return "Actif";
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case "Actif":
        return "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      case "En suivi":
        return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      case "Planifié":
        return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800";
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un patient (nom, prénom, date de naissance...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-background"
            data-testid="input-search-patients"
          />
        </div>
        
        <Button variant="outline" className="gap-2" data-testid="button-filter">
          <Filter className="h-4 w-4" />
          Filtrer
        </Button>
        
        <Button variant="outline" className="gap-2" data-testid="button-export">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-patient">
              <Plus className="h-4 w-4" />
              Nouveau patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouveau patient</DialogTitle>
            </DialogHeader>
            <PatientForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Filtres actifs:</span>
          {activeFilters.map((filter) => (
            <Badge 
              key={filter} 
              variant="secondary" 
              className="gap-1 cursor-pointer bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
              onClick={() => removeFilter(filter)}
            >
              {filter}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Checkbox 
            checked={selectedPatients.length === paginatedPatients.length && paginatedPatients.length > 0}
            onCheckedChange={toggleAllSelection}
            data-testid="checkbox-select-all"
          />
          <span className="text-sm text-muted-foreground">
            {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" data-testid="button-grid-view">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {totalPatients > 0 ? `${startIndex + 1} – ${endIndex} de ${totalPatients}` : '0 de 0'}
          </span>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === 1} 
              onClick={goToFirstPage}
              data-testid="button-first-page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === 1} 
              onClick={goToPrevPage}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={goToNextPage}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={goToLastPage}
              data-testid="button-last-page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-background rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="w-12 px-4 py-3"></th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Patient</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date de naissance</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contact</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-28">Implants</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-32">Dernière visite</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-24">Statut</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPatients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun patient</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery
                        ? "Aucun patient ne correspond à votre recherche"
                        : "Commencez par ajouter votre premier patient"}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-patient">
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
                    className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                    data-testid={`row-patient-${patient.id}`}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedPatients.includes(patient.id)}
                        onCheckedChange={() => togglePatientSelection(patient.id)}
                        data-testid={`checkbox-patient-${patient.id}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <div className="cursor-pointer">
                          <div className="font-medium text-foreground">
                            {patient.prenom} {patient.nom}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {displayId}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <span className="text-sm text-muted-foreground cursor-pointer">
                          {formatDateWithAge(patient.dateNaissance)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <div className="cursor-pointer">
                          <div className="text-sm text-foreground">{formatPhoneNumber(patient.telephone)}</div>
                          <div className="text-sm text-muted-foreground">{patient.email || '-'}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <span className="text-sm text-muted-foreground cursor-pointer">
                          <span className="font-medium text-foreground">-</span> implants
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <span className="text-sm text-muted-foreground cursor-pointer">-</span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/patients/${patient.id}`}>
                        <Badge 
                          variant="outline"
                          className={`${getStatusBadgeClasses(status)} cursor-pointer`}
                        >
                          {status}
                        </Badge>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPatients > 0 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-sm text-muted-foreground">
            {startIndex + 1} – {endIndex} de {totalPatients}
          </span>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === 1}
              onClick={goToFirstPage}
              data-testid="button-first-page-bottom"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === 1}
              onClick={goToPrevPage}
              data-testid="button-prev-page-bottom"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === totalPages}
              onClick={goToNextPage}
              data-testid="button-next-page-bottom"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={currentPage === totalPages}
              onClick={goToLastPage}
              data-testid="button-last-page-bottom"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
