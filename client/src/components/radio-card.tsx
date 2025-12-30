import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, FileImage, MoreVertical, Pencil, Download, Trash2, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Radio } from "@shared/types";

interface RadioCardProps {
  radio: Radio & { signedUrl?: string | null };
  patientId: string;
}

const typeLabels: Record<string, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Retro-alveolaire",
};

export function RadioCard({ radio, patientId }: RadioCardProps) {
  const { toast } = useToast();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(radio.title || "");
  const [renameError, setRenameError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  // Fetch fresh signed URL when opening viewer (handles expiration)
  // Returns the fresh URL directly for immediate use
  const refreshSignedUrl = async (): Promise<string | null> => {
    if (!radio.filePath) return null; // Legacy URLs don't need refresh
    
    setIsLoadingUrl(true);
    setUrlError(false);
    try {
      const res = await fetch(`/api/radios/${radio.id}/signed-url`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFreshSignedUrl(data.signedUrl);
        return data.signedUrl;
      }
      setUrlError(true);
    } catch (err) {
      console.error("Failed to refresh signed URL:", err);
      setUrlError(true);
    } finally {
      setIsLoadingUrl(false);
    }
    return null;
  };

  // Auto-fetch signed URL for thumbnail when signedUrl is null but filePath exists
  useEffect(() => {
    if (radio.filePath && !radio.signedUrl && !radio.url && !freshSignedUrl && !thumbnailLoading) {
      setThumbnailLoading(true);
      fetch(`/api/radios/${radio.id}/signed-url`, { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.signedUrl) {
            setFreshSignedUrl(data.signedUrl);
          }
        })
        .catch(err => console.error("Failed to load thumbnail URL:", err))
        .finally(() => setThumbnailLoading(false));
    }
  }, [radio.id, radio.filePath, radio.signedUrl, radio.url, freshSignedUrl, thumbnailLoading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getImageUrl = (useFresh = false) => {
    // Use fresh signed URL if available (for viewer/download or when loaded for thumbnail)
    if (freshSignedUrl) {
      return freshSignedUrl;
    }
    // Use signed URL from Supabase Storage (for new uploads)
    if (radio.signedUrl) {
      return radio.signedUrl;
    }
    // Fallback to legacy Replit Object Storage URL
    if (radio.url) {
      return radio.url.startsWith("/objects/") ? radio.url : `/objects/${radio.url}`;
    }
    return "";
  };

  const handleOpenViewer = async () => {
    // Reset error state for fresh attempt in viewer
    setImageError(false);
    setViewerOpen(true);
    // Refresh signed URL for new uploads (handles expiration)
    if (radio.filePath) {
      await refreshSignedUrl();
    }
  };

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("PATCH", `/api/radios/${radio.id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({ title: "Document renommé", description: "Le nom a été mis à jour.", variant: "success" });
      setRenameOpen(false);
      setRenameError("");
    },
    onError: () => {
      setRenameError("Impossible de renommer le document. Veuillez reessayer.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/radios/${radio.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({ title: "Document supprimé", description: "La radiographie a été supprimée.", variant: "success" });
      setDeleteOpen(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le document.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    // Get fresh URL for download
    let url: string | null = null;
    
    if (radio.filePath) {
      url = await refreshSignedUrl();
      if (!url) {
        toast({ 
          title: "Erreur", 
          description: "Impossible de telecharger le document. Veuillez reessayer.", 
          variant: "destructive" 
        });
        return;
      }
    } else if (radio.url) {
      url = radio.url.startsWith("/objects/") ? radio.url : `/objects/${radio.url}`;
    }
    
    if (!url) {
      toast({ title: "Erreur", description: "Aucun fichier disponible.", variant: "destructive" });
      return;
    }
    
    const link = document.createElement("a");
    link.href = url;
    link.download = radio.title || `radio-${radio.id}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));

  const handleRenameSubmit = () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setRenameError("Le titre ne peut pas etre vide.");
      return;
    }
    setRenameError("");
    renameMutation.mutate(trimmedTitle);
  };

  const handleRenameOpenChange = (open: boolean) => {
    if (!open) {
      setRenameError("");
    }
    setRenameOpen(open);
  };

  return (
    <>
      <Card
        className="group relative overflow-hidden"
        data-testid={`card-radio-${radio.id}`}
      >
        <div 
          className="aspect-square bg-muted cursor-pointer"
          onClick={handleOpenViewer}
        >
          {thumbnailLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
          ) : getImageUrl() && !imageError ? (
            <img
              src={getImageUrl()}
              alt={radio.title || `Radio ${typeLabels[radio.type]}`}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileImage className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <Badge variant="secondary" className="absolute top-2 left-2">
            {typeLabels[radio.type] || radio.type}
          </Badge>
        </div>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" data-testid={`text-radio-title-${radio.id}`}>
                {radio.title || "Sans titre"}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(radio.date)}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  data-testid={`button-radio-menu-${radio.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900">
                <DropdownMenuItem 
                  onClick={() => {
                    setNewTitle(radio.title || "");
                    setRenameError("");
                    setRenameOpen(true);
                  }}
                  data-testid={`button-rename-radio-${radio.id}`}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Renommer
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDownload}
                  data-testid={`button-download-radio-${radio.id}`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive"
                  data-testid={`button-delete-radio-${radio.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <span>{radio.title || "Sans titre"}</span>
                  <Badge variant="secondary">{typeLabels[radio.type]}</Badge>
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {formatDate(radio.date)}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 mr-10">
                <Button variant="outline" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleDownload} data-testid="button-viewer-download">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-black/90 flex items-center justify-center min-h-[60vh]">
            {isLoadingUrl ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              </div>
            ) : urlError && !radio.url ? (
              <div className="flex flex-col items-center justify-center gap-2 text-white">
                <FileImage className="h-16 w-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Impossible de charger l'image</p>
                <Button variant="outline" size="sm" onClick={() => refreshSignedUrl()}>
                  Reessayer
                </Button>
              </div>
            ) : (freshSignedUrl || radio.url || radio.signedUrl) && !imageError ? (
              <img
                src={getImageUrl(true)}
                alt={radio.title || `Radio ${typeLabels[radio.type]}`}
                className="transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : (
              <div className="flex items-center justify-center">
                <FileImage className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={handleRenameOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le document</DialogTitle>
            <DialogDescription>
              Entrez un nouveau nom pour ce document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">Nom du document</Label>
              <Input
                id="rename-input"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (renameError) setRenameError("");
                }}
                placeholder="Nom du document"
                data-testid="input-rename-radio"
              />
              {renameError && (
                <p className="text-sm text-destructive">{renameError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renameMutation.isPending}>
                Annuler
              </Button>
              <Button 
                onClick={handleRenameSubmit}
                disabled={!newTitle.trim() || renameMutation.isPending}
                data-testid="button-confirm-rename"
              >
                {renameMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le document sera definitivement supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete-radio">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="bg-primary text-primary-foreground"
              data-testid="button-confirm-delete-radio"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
