import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, FileImage, MoreVertical, Pencil, Download, Trash2, ZoomIn, ZoomOut } from "lucide-react";
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
import type { Radio } from "@shared/schema";

interface RadioCardProps {
  radio: Radio;
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getImageUrl = () => {
    if (radio.url.startsWith("/objects/")) {
      return radio.url;
    }
    return radio.url;
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

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = getImageUrl();
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
          onClick={() => setViewerOpen(true)}
        >
          {radio.url && !imageError ? (
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
            {radio.url && !imageError ? (
              <img
                src={getImageUrl()}
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
