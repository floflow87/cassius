import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Pencil, Trash2, Download, Calendar, FileImage, Send, Loader2, ZoomIn, ZoomOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

interface RadioNoteWithAuthor {
  id: string;
  organisationId: string;
  radioId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  authorNom: string | null;
  authorPrenom: string | null;
}

interface RadioDrawerProps {
  radio: Radio & { signedUrl?: string | null };
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<string, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Retro-alveolaire",
};

export function RadioDrawer({ radio, patientId, open, onOpenChange }: RadioDrawerProps) {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState(radio.title || "");
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  const notesQuery = useQuery<RadioNoteWithAuthor[]>({
    queryKey: ["/api/radios", radio.id, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/radios/${radio.id}/notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: open,
  });

  const refreshSignedUrl = async (): Promise<string | null> => {
    if (!radio.filePath) return null;
    setIsLoadingUrl(true);
    try {
      const res = await fetch(`/api/radios/${radio.id}/signed-url`, { credentials: "include" });
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

  const getImageUrl = () => {
    if (freshSignedUrl) return freshSignedUrl;
    if (radio.signedUrl) return radio.signedUrl;
    if (radio.url) return radio.url.startsWith("/objects/") ? radio.url : `/objects/${radio.url}`;
    return "";
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("PATCH", `/api/radios/${radio.id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({ title: "Document renomme", description: "Le nom a ete mis a jour.", variant: "success" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de renommer le document.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/radios/${radio.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({ title: "Document supprime", description: "La radiographie a ete supprimee.", variant: "success" });
      setDeleteOpen(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le document.", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/radios/${radio.id}/notes`, { body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/radios", radio.id, "notes"] });
      setNewNote("");
      toast({ title: "Note ajoutee", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'ajouter la note.", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }) => {
      const res = await apiRequest("PATCH", `/api/radios/${radio.id}/notes/${noteId}`, { body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/radios", radio.id, "notes"] });
      setEditingNoteId(null);
      setEditingNoteBody("");
      toast({ title: "Note modifiee", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier la note.", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/radios/${radio.id}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/radios", radio.id, "notes"] });
      toast({ title: "Note supprimee", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la note.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    let url: string | null = null;
    if (radio.filePath) {
      url = await refreshSignedUrl();
      if (!url) {
        toast({ title: "Erreur", description: "Impossible de telecharger le document.", variant: "destructive" });
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

  const handleSaveTitle = () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;
    renameMutation.mutate(trimmedTitle);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote.trim());
  };

  const handleSaveNote = () => {
    if (!editingNoteId || !editingNoteBody.trim()) return;
    updateNoteMutation.mutate({ noteId: editingNoteId, body: editingNoteBody.trim() });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="max-w-[200px]"
                      data-testid="input-edit-radio-title"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveTitle}
                      disabled={renameMutation.isPending}
                      data-testid="button-save-radio-title"
                    >
                      {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-left">{radio.title || "Sans titre"}</SheetTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setNewTitle(radio.title || "");
                        setIsEditing(true);
                      }}
                      data-testid="button-edit-radio-title"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{typeLabels[radio.type] || radio.type}</Badge>
                  <span className="flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3" />
                    {formatDate(radio.date)}
                  </span>
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-radio">
                <Download className="h-4 w-4 mr-1" />
                Telecharger
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                data-testid="button-delete-radio"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <div className="flex items-center justify-center gap-2 p-2 border-b">
                  <Button variant="ghost" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="aspect-video flex items-center justify-center overflow-hidden bg-black/5 dark:bg-black/20">
                  {isLoadingUrl ? (
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  ) : getImageUrl() && !imageError ? (
                    <img
                      src={getImageUrl()}
                      alt={radio.title || "Radiographie"}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{ transform: `scale(${zoom})` }}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <FileImage className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Remarques</Label>
                  <Badge variant="outline">{notesQuery.data?.length || 0}</Badge>
                </div>

                <div className="space-y-3">
                  {notesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notesQuery.data && notesQuery.data.length > 0 ? (
                    notesQuery.data.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-lg bg-muted/50 border space-y-2"
                        data-testid={`note-${note.id}`}
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingNoteBody}
                              onChange={(e) => setEditingNoteBody(e.target.value)}
                              className="min-h-[60px]"
                              data-testid={`textarea-edit-note-${note.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveNote}
                                disabled={updateNoteMutation.isPending}
                                data-testid={`button-save-note-${note.id}`}
                              >
                                {updateNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteBody("");
                                }}
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>
                                  {note.authorPrenom} {note.authorNom}
                                </span>
                                <span className="mx-1">-</span>
                                <span>{formatDateTime(note.createdAt)}</span>
                                {note.updatedAt && (
                                  <span className="text-muted-foreground/60">(modifie)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteBody(note.body);
                                  }}
                                  data-testid={`button-edit-note-${note.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => deleteNoteMutation.mutate(note.id)}
                                  disabled={deleteNoteMutation.isPending}
                                  data-testid={`button-delete-note-${note.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune remarque pour le moment
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Ajouter une remarque..."
                    className="min-h-[60px]"
                    data-testid="textarea-new-note"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  {createNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Ajouter une remarque
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le document sera definitivement supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="bg-primary text-primary-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
