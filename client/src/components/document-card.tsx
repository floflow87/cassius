import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, FileText, MoreVertical, Pencil, Download, Trash2 } from "lucide-react";
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(document.title || "");
  const [renameError, setRenameError] = useState("");
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Auto-fetch signed URL when signedUrl is null but filePath exists
  useEffect(() => {
    if (document.filePath && !document.signedUrl && !freshSignedUrl && !isLoadingUrl) {
      fetch(`/api/documents/${document.id}/signed-url`, { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.signedUrl) {
            setFreshSignedUrl(data.signedUrl);
          }
        })
        .catch(err => console.error("Failed to load document URL:", err));
    }
  }, [document.id, document.filePath, document.signedUrl, freshSignedUrl, isLoadingUrl]);

  const refreshSignedUrl = async (): Promise<string | null> => {
    if (!document.filePath) return null;
    
    setIsLoadingUrl(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/signed-url`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFreshSignedUrl(data.signedUrl);
        return data.signedUrl;
      }
    } catch (err) {
      console.error("Failed to refresh signed URL:", err);
    } finally {
      setIsLoadingUrl(false);
    }
    return null;
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleOpenDocument = async () => {
    // Open document directly in new tab - most reliable method as Chrome blocks iframe PDF viewing
    if (document.filePath) {
      setIsLoadingUrl(true);
      const url = await refreshSignedUrl();
      setIsLoadingUrl(false);
      
      if (url) {
        window.open(url, "_blank");
      } else {
        toast({ 
          title: "Erreur", 
          description: "Impossible d'ouvrir le document. Veuillez reessayer.", 
          variant: "destructive" 
        });
      }
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
          onClick={handleOpenDocument}
        >
          <FileText className="h-16 w-16 text-primary" />
          {document.tags && document.tags.length > 0 && (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {document.tags.slice(0, 2).map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary" 
                  className={`text-[10px] ${TAG_COLORS[tag] || TAG_COLORS.AUTRE}`}
                >
                  {TAG_LABELS[tag] || tag}
                </Badge>
              ))}
              {document.tags.length > 2 && (
                <Badge variant="secondary" className="text-[10px]">+{document.tags.length - 2}</Badge>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs truncate" title={document.title}>
                {document.title}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
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
