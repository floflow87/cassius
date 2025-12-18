import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, FileText, MoreVertical, Pencil, Download, Trash2, ExternalLink, X, Loader2 } from "lucide-react";
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
  DialogClose,
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
import type { Document } from "@shared/schema";

interface DocumentCardProps {
  document: Document & { signedUrl?: string | null };
  patientId: string;
}

const TAG_LABELS: Record<string, string> = {
  DEVIS: "Devis",
  CONSENTEMENT: "Consentement",
  COMPTE_RENDU: "Compte-rendu",
  ASSURANCE: "Assurance",
  AUTRE: "Autre",
};

const TAG_COLORS: Record<string, string> = {
  DEVIS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CONSENTEMENT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  COMPTE_RENDU: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ASSURANCE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  AUTRE: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export function DocumentCard({ document, patientId }: DocumentCardProps) {
  const { toast } = useToast();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(document.title || "");
  const [renameError, setRenameError] = useState("");
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const refreshSignedUrl = async (): Promise<string | null> => {
    if (!document.filePath) return null;
    
    setIsLoadingUrl(true);
    setUrlError(false);
    try {
      const res = await fetch(`/api/documents/${document.id}/signed-url`, { credentials: "include" });
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

  const loadPdfAsBlob = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch PDF");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
      return objectUrl;
    } catch (err) {
      console.error("Failed to load PDF as blob:", err);
      return null;
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDocumentUrl = (useFresh = false) => {
    if (useFresh && freshSignedUrl) {
      return freshSignedUrl;
    }
    if (document.signedUrl) {
      return document.signedUrl;
    }
    return "";
  };

  const handleOpenViewer = async () => {
    setViewerOpen(true);
    setBlobUrl(null);
    setUrlError(false);
    
    if (document.filePath) {
      setIsLoadingUrl(true);
      const signedUrl = await refreshSignedUrl();
      if (signedUrl) {
        const blob = await loadPdfAsBlob(signedUrl);
        if (!blob) {
          setUrlError(true);
        }
      }
      setIsLoadingUrl(false);
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  };

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("PATCH", `/api/documents/${document.id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast({ title: "Document renomme", description: "Le nom a ete mis a jour.", variant: "success" });
      setRenameOpen(false);
      setRenameError("");
    },
    onError: () => {
      setRenameError("Impossible de renommer le document. Veuillez reessayer.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/documents/${document.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast({ title: "Document supprime", description: "Le document a ete supprime.", variant: "success" });
      setDeleteOpen(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le document.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    let url: string | null = null;
    
    if (document.filePath) {
      url = await refreshSignedUrl();
      if (!url) {
        toast({ 
          title: "Erreur", 
          description: "Impossible de telecharger le document. Veuillez reessayer.", 
          variant: "destructive" 
        });
        return;
      }
    }
    
    if (!url) {
      toast({ title: "Erreur", description: "Aucun fichier disponible.", variant: "destructive" });
      return;
    }
    
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.title || `document-${document.id}.pdf`;
    link.target = "_blank";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

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

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <>
      <Card
        className="group relative overflow-visible"
        data-testid={`card-document-${document.id}`}
      >
        <div 
          className="aspect-square bg-muted cursor-pointer flex items-center justify-center"
          onClick={handleOpenViewer}
        >
          <FileText className="h-16 w-16 text-primary" />
          {document.tags && document.tags.length > 0 && (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {document.tags.slice(0, 2).map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary" 
                  className={`text-xs ${TAG_COLORS[tag] || TAG_COLORS.AUTRE}`}
                >
                  {TAG_LABELS[tag] || tag}
                </Badge>
              ))}
              {document.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">+{document.tags.length - 2}</Badge>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" title={document.title}>
                {document.title}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(document.createdAt)}</span>
                {document.sizeBytes && (
                  <span className="ml-2">{formatFileSize(document.sizeBytes)}</span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  data-testid={`button-document-menu-${document.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenameOpen(true)} data-testid="menu-rename">
                  <Pencil className="mr-2 h-4 w-4" />
                  Renommer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} data-testid="menu-download">
                  <Download className="mr-2 h-4 w-4" />
                  Telecharger
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteOpen(true)} 
                  className="text-destructive"
                  data-testid="menu-delete"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewerOpen} onOpenChange={handleCloseViewer}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 flex flex-col [&>button]:hidden">
          <DialogHeader className="flex-shrink-0 p-4 border-b relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="truncate">{document.title}</span>
                  {document.tags && document.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className={TAG_COLORS[tag] || TAG_COLORS.AUTRE}>
                      {TAG_LABELS[tag] || tag}
                    </Badge>
                  ))}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {formatDate(document.createdAt)}
                  {document.sizeBytes && ` - ${formatFileSize(document.sizeBytes)}`}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  data-testid="button-download-document"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const url = freshSignedUrl || document.signedUrl;
                    if (url) window.open(url, "_blank");
                  }}
                  data-testid="button-open-new-tab"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseViewer}
                  data-testid="button-close-viewer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted min-h-[60vh]">
            {isLoadingUrl ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground ml-2">Chargement du document...</p>
              </div>
            ) : urlError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <FileText className="h-24 w-24 text-muted-foreground" />
                <p className="text-muted-foreground">Impossible de charger le document</p>
                <Button onClick={handleOpenViewer} variant="outline">Reessayer</Button>
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                className="w-full h-[70vh] border-0"
                title={document.title}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <FileText className="h-24 w-24 text-muted-foreground" />
                <p className="text-muted-foreground">Aucun fichier disponible</p>
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
              <Label htmlFor="title">Nom</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nouveau nom"
                data-testid="input-rename-document"
              />
              {renameError && (
                <p className="text-sm text-destructive">{renameError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleRenameSubmit} 
                disabled={renameMutation.isPending}
                data-testid="button-confirm-rename"
              >
                {renameMutation.isPending ? "..." : "Renommer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le document</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer "{document.title}" ? Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
