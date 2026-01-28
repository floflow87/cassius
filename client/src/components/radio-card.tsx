import { useState, useEffect } from "react";
import { Calendar, FileImage, Loader2, MoreHorizontal, Pencil, Trash2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { RadioDrawer } from "@/components/radio-drawer";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
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
  const { user } = useCurrentUser();
  const canDelete = user?.role !== "ASSISTANT";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [urlLoadFailed, setUrlLoadFailed] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (radio.filePath && !radio.signedUrl && !radio.url && !freshSignedUrl && !thumbnailLoading && !urlLoadFailed) {
      setThumbnailLoading(true);
      fetch(`/api/radios/${radio.id}/signed-url`, { credentials: "include" })
        .then(res => {
          if (!res.ok) {
            setUrlLoadFailed(true);
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data?.signedUrl) {
            setFreshSignedUrl(data.signedUrl);
          }
        })
        .catch(err => {
          console.error("Failed to load thumbnail URL:", err);
          setUrlLoadFailed(true);
        })
        .finally(() => setThumbnailLoading(false));
    }
  }, [radio.id, radio.filePath, radio.signedUrl, radio.url, freshSignedUrl, thumbnailLoading, urlLoadFailed]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/radios/${radio.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/radios"] });
      toast({
        title: "Radio supprimee",
        variant: "success",
      });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la radio",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getImageUrl = () => {
    if (freshSignedUrl) return freshSignedUrl;
    if (radio.signedUrl) return radio.signedUrl;
    if (radio.url) return radio.url.startsWith("/objects/") ? radio.url : `/objects/${radio.url}`;
    return "";
  };

  const handleDownload = async () => {
    const url = getImageUrl();
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = radio.title || `radio-${radio.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de telecharger le fichier",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = () => {
    setPreviewOpen(true);
  };

  return (
    <>
      <Card
        className="group relative overflow-hidden cursor-pointer hover-elevate"
        data-testid={`card-radio-${radio.id}`}
      >
        <div className="aspect-square bg-muted" onClick={handleCardClick}>
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
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
            {typeLabels[radio.type] || radio.type}
          </Badge>
        </div>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0" onClick={handleCardClick}>
              {radio.lastNote ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="font-medium text-xs truncate cursor-default" data-testid={`text-radio-title-${radio.id}`}>
                      {radio.title || "Sans titre"}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-[99999] bg-white dark:bg-zinc-900 border shadow-lg max-w-xs">
                    <p className="text-[10px]">{radio.lastNote}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <p className="font-medium text-xs truncate" data-testid={`text-radio-title-${radio.id}`}>
                  {radio.title || "Sans titre"}
                </p>
              )}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(radio.date)}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-radio-menu-${radio.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDrawerOpen(true)} data-testid={`menu-edit-radio-${radio.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} data-testid={`menu-download-radio-${radio.id}`}>
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem 
                    onClick={() => setDeleteDialogOpen(true)} 
                    className="text-destructive"
                    data-testid={`menu-delete-radio-${radio.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0">
          <VisuallyHidden>
            <DialogTitle>{radio.title || `Radio ${typeLabels[radio.type]}`}</DialogTitle>
            <DialogDescription>Aperçu de la radiographie</DialogDescription>
          </VisuallyHidden>
          <div className="relative">
            {getImageUrl() && !imageError ? (
              <img
                src={getImageUrl()}
                alt={radio.title || `Radio ${typeLabels[radio.type]}`}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center bg-muted">
                <FileImage className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette radio ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La radiographie sera definitivement supprimee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RadioDrawer
        radio={radio}
        patientId={patientId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
