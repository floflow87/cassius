import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, User, Calendar, Phone, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
}

export default function PatientsPage({ searchQuery }: PatientsPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const filteredPatients = patients?.filter((patient) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      patient.nom.toLowerCase().includes(query) ||
      patient.prenom.toLowerCase().includes(query) ||
      patient.email?.toLowerCase().includes(query) ||
      patient.telephone?.includes(query)
    );
  });

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
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-sm text-muted-foreground">
            {filteredPatients?.length || 0} patient{(filteredPatients?.length || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-patient">
              <Plus className="h-4 w-4 mr-2" />
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

      {filteredPatients?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPatients?.map((patient) => (
            <Link key={patient.id} href={`/patient/${patient.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-patient-${patient.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground font-medium text-lg shrink-0">
                        {patient.prenom[0]}{patient.nom[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">
                            {patient.prenom} {patient.nom}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {patient.sexe === "HOMME" ? "H" : "F"} - {calculateAge(patient.dateNaissance)} ans
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(patient.dateNaissance)}
                          </span>
                          {patient.telephone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {patient.telephone}
                            </span>
                          )}
                          {patient.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {patient.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
