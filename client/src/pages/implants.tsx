import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Activity, Search, Filter, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Implant, Patient } from "@shared/schema";

interface ImplantWithPatient extends Implant {
  patient?: Patient;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary" },
  SUCCES: { label: "Succès", variant: "default" },
  COMPLICATION: { label: "Complication", variant: "outline" },
  ECHEC: { label: "Échec", variant: "destructive" },
};

const boneTypes = ["D1", "D2", "D3", "D4"];
const statuses = ["EN_SUIVI", "SUCCES", "COMPLICATION", "ECHEC"];

export default function ImplantsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedBoneType, setSelectedBoneType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedSite, setSelectedSite] = useState<string>("");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (selectedBrand) params.set("marque", selectedBrand);
    if (selectedBoneType) params.set("typeOs", selectedBoneType);
    if (selectedStatus) params.set("statut", selectedStatus);
    if (selectedSite) params.set("siteFdi", selectedSite);
    return params.toString();
  };

  const { data: implants, isLoading } = useQuery<ImplantWithPatient[]>({
    queryKey: ["/api/implants", selectedBrand, selectedBoneType, selectedStatus, selectedSite],
    queryFn: async () => {
      const qs = buildQueryString();
      const response = await fetch(`/api/implants${qs ? `?${qs}` : ""}`);
      if (!response.ok) throw new Error("Failed to fetch implants");
      return response.json();
    },
  });

  const { data: brands } = useQuery<string[]>({
    queryKey: ["/api/implants/brands"],
  });

  const filteredImplants = implants?.filter((implant) => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      implant.marque.toLowerCase().includes(query) ||
      implant.siteFdi.toLowerCase().includes(query) ||
      implant.patient?.nom.toLowerCase().includes(query) ||
      implant.patient?.prenom.toLowerCase().includes(query) ||
      implant.referenceFabricant?.toLowerCase().includes(query)
    );
  });

  const hasActiveFilters = selectedBrand || selectedBoneType || selectedStatus || selectedSite;

  const clearFilters = () => {
    setSelectedBrand("");
    setSelectedBoneType("");
    setSelectedStatus("");
    setSelectedSite("");
    setSearchTerm("");
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
        </div>
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Implants</h1>
        <p className="text-sm text-muted-foreground">
          {filteredImplants?.length || 0} implant{(filteredImplants?.length || 0) !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-implants"
            />
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-40" data-testid="select-brand">
              <SelectValue placeholder="Marque" />
            </SelectTrigger>
            <SelectContent>
              {brands?.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedBoneType} onValueChange={setSelectedBoneType}>
            <SelectTrigger className="w-32" data-testid="select-bone-type">
              <SelectValue placeholder="Type d'os" />
            </SelectTrigger>
            <SelectContent>
              {boneTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-36" data-testid="select-status">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusConfig[status]?.label || status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Site FDI"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-28"
            data-testid="input-site-fdi"
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
        </div>
      </div>

      {filteredImplants?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun implant</h3>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters || searchTerm
                ? "Aucun implant ne correspond à vos critères"
                : "Aucun implant enregistré"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredImplants?.map((implant) => {
            const status = statusConfig[implant.statut] || statusConfig.EN_SUIVI;
            return (
              <Link key={implant.id} href={`/patient/${implant.patientId}/implant/${implant.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-implant-${implant.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground font-mono font-medium text-lg shrink-0">
                          {implant.siteFdi}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">
                              {implant.marque}
                            </h3>
                            <Badge variant="secondary" className="text-xs font-mono">
                              {implant.diametre}x{implant.longueur}mm
                            </Badge>
                            <Badge variant={status.variant} className="text-xs">
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            {implant.patient && (
                              <span>
                                {implant.patient.prenom} {implant.patient.nom}
                              </span>
                            )}
                            <span>{formatDate(implant.datePose)}</span>
                            {implant.typeOs && (
                              <span className="font-mono">{implant.typeOs}</span>
                            )}
                            {implant.isqPose && (
                              <span className="font-mono">ISQ: {implant.isqPose}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
