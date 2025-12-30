import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bookmark, ChevronDown, Trash2, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedFilter, SavedFilterPageType } from "@shared/schema";

interface SavedFiltersManagerProps<T> {
  pageType: SavedFilterPageType;
  currentFilters: T | null;
  onLoadFilter: (filters: T) => void;
  hasActiveFilters: boolean;
}

export function SavedFiltersManager<T>({
  pageType,
  currentFilters,
  onLoadFilter,
  hasActiveFilters,
}: SavedFiltersManagerProps<T>) {
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const { data: savedFilters = [], isLoading } = useQuery<SavedFilter[]>({
    queryKey: ["/api/saved-filters", pageType],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; pageType: SavedFilterPageType; filterData: string }) => {
      return apiRequest("POST", "/api/saved-filters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters", pageType] });
      toast({ title: "Filtre sauvegardé", description: "Le filtre a été enregistré avec succès." });
      setSaveDialogOpen(false);
      setFilterName("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder le filtre.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/saved-filters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-filters", pageType] });
      toast({ title: "Filtre supprimé", description: "Le filtre a été supprimé." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le filtre.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!filterName.trim() || !currentFilters) return;
    saveMutation.mutate({
      name: filterName.trim(),
      pageType,
      filterData: JSON.stringify(currentFilters),
    });
  };

  const handleLoad = (filter: SavedFilter) => {
    try {
      const parsedFilters = JSON.parse(filter.filterData) as T;
      onLoadFilter(parsedFilters);
      toast({ title: "Filtre chargé", description: `"${filter.name}" a été appliqué.` });
    } catch {
      toast({ title: "Erreur", description: "Format de filtre invalide.", variant: "destructive" });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-saved-filters">
            <Bookmark className="h-4 w-4 mr-2" />
            Filtres sauvegardés
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {hasActiveFilters && (
            <>
              <DropdownMenuItem
                onClick={() => setSaveDialogOpen(true)}
                data-testid="button-save-current-filter"
              >
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder le filtre actuel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {isLoading ? (
            <DropdownMenuItem disabled>Chargement...</DropdownMenuItem>
          ) : savedFilters.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              Aucun filtre sauvegardé
            </DropdownMenuItem>
          ) : (
            savedFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                onClick={() => handleLoad(filter)}
                className="flex items-center justify-between gap-2"
                data-testid={`saved-filter-${filter.id}`}
              >
                <span className="truncate">{filter.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => handleDelete(e, filter.id)}
                  data-testid={`button-delete-filter-${filter.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder le filtre</DialogTitle>
            <DialogDescription>
              Donnez un nom à ce filtre pour le retrouver facilement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nom du filtre"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              data-testid="input-filter-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!filterName.trim() || saveMutation.isPending}
              data-testid="button-confirm-save-filter"
            >
              {saveMutation.isPending ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
