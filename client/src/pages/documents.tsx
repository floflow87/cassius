import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Folder,
  FolderOpen,
  FileText,
  File,
  Image,
  ChevronRight,
  ChevronDown,
  Search,
  Upload,
  MoreHorizontal,
  Download,
  Trash2,
  Edit2,
  Eye,
  User,
  Calendar,
  Filter,
  SortAsc,
  SortDesc,
  FolderClosed,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { DocumentWithDetails } from "@shared/schema";
import type { DocumentTree, DocumentTreeNode, DocumentFilters, UnifiedFile, TypeRadio } from "@shared/types";

type FolderPath = {
  type: 'root' | 'patients' | 'operations' | 'unclassified' | 'patient' | 'operation';
  id?: string;
  name: string;
};

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

const RADIO_TYPE_LABELS: Record<TypeRadio, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Rétroalvéolaire",
};

const RADIO_TYPE_COLORS: Record<TypeRadio, string> = {
  PANORAMIQUE: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  CBCT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  RETROALVEOLAIRE: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function Breadcrumb({ path, onNavigate }: { path: FolderPath[]; onNavigate: (index: number) => void }) {
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {path.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <button
            onClick={() => onNavigate(index)}
            className={`px-2 py-1 rounded-md hover-elevate ${
              index === path.length - 1 
                ? "font-medium text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`breadcrumb-${item.type}-${item.id || 'root'}`}
          >
            {item.name}
          </button>
        </div>
      ))}
    </nav>
  );
}

function FolderTreeItem({ 
  node, 
  isOpen, 
  isSelected, 
  onToggle, 
  onSelect,
  hasChildren = false,
}: { 
  node: { name: string; count: number; type: string; id?: string };
  isOpen?: boolean;
  isSelected?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  hasChildren?: boolean;
}) {
  return (
    <button
      onClick={() => {
        if (hasChildren && onToggle) onToggle();
        onSelect();
      }}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover-elevate ${
        isSelected ? "bg-accent" : ""
      }`}
      data-testid={`folder-${node.type}-${node.id || 'root'}`}
    >
      {hasChildren ? (
        isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
      ) : (
        <span className="w-4" />
      )}
      {isOpen ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
      ) : (
        <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />
      )}
      <span className="truncate flex-1 text-left">{node.name}</span>
      {node.count > 0 && (
        <Badge variant="secondary" className="text-xs">
          {node.count}
        </Badge>
      )}
    </button>
  );
}

function FileRow({ 
  file, 
  onView, 
  onDownload, 
  onEdit, 
  onDelete 
}: { 
  file: UnifiedFile;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isRadio = file.sourceType === 'radio';
  
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b hover-elevate cursor-pointer"
      onClick={onView}
      data-testid={`file-row-${file.sourceType}-${file.id}`}
    >
      <div className="shrink-0">
        {getFileIcon(file.mimeType)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{file.title}</span>
          {isRadio && file.radioType && (
            <Badge variant="secondary" className={`text-xs ${RADIO_TYPE_COLORS[file.radioType] || ''}`}>
              {RADIO_TYPE_LABELS[file.radioType] || file.radioType}
            </Badge>
          )}
          {!isRadio && file.tags?.map(tag => (
            <Badge key={tag} variant="secondary" className={`text-xs ${TAG_COLORS[tag] || ''}`}>
              {TAG_LABELS[tag] || tag}
            </Badge>
          ))}
          {isRadio && (
            <Badge variant="outline" className="text-xs">
              Radio
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
          {file.patient && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {file.patient.prenom} {file.patient.nom}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(file.createdAt), "d MMM yyyy", { locale: fr })}
          </span>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground shrink-0">
        {formatFileSize(file.sizeBytes)}
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" data-testid={`file-actions-${file.sourceType}-${file.id}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
            <Eye className="h-4 w-4 mr-2" />
            Ouvrir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </DropdownMenuItem>
          {!isRadio && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPath, setCurrentPath] = useState<FolderPath[]>([
    { type: 'root', name: 'Documents' }
  ]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['patients', 'operations']));
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewingFile, setViewingFile] = useState<{ file: UnifiedFile; url: string } | null>(null);
  const [editingDoc, setEditingDoc] = useState<UnifiedFile | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingFile, setDeletingFile] = useState<UnifiedFile | null>(null);

  const currentFolder = currentPath[currentPath.length - 1];

  const filters: DocumentFilters = useMemo(() => {
    const f: DocumentFilters = {
      sort: sortBy,
      sortDir,
      q: searchQuery || undefined,
      pageSize: 100,
    };
    
    if (currentFolder.type === 'patients') {
      f.scope = 'patients';
    } else if (currentFolder.type === 'operations') {
      f.scope = 'operations';
    } else if (currentFolder.type === 'unclassified') {
      f.scope = 'unclassified';
    } else if (currentFolder.type === 'patient' && currentFolder.id) {
      f.patientId = currentFolder.id;
    } else if (currentFolder.type === 'operation' && currentFolder.id) {
      f.operationId = currentFolder.id;
    }
    
    return f;
  }, [currentFolder, sortBy, sortDir, searchQuery]);

  const { data: tree, isLoading: treeLoading } = useQuery<DocumentTree>({
    queryKey: ["/api/documents/tree"],
  });

  const { data: filesData, isLoading: filesLoading } = useQuery<{ files: UnifiedFile[]; totalCount: number }>({
    queryKey: ["/api/files", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      const response = await fetch(`/api/files?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, sourceType }: { id: string; sourceType: 'document' | 'radio' }) => {
      const endpoint = sourceType === 'radio' ? `/api/radios/${id}` : `/api/documents/${id}`;
      await apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/tree"] });
      setDeletingFile(null);
      toast({ title: "Fichier supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la suppression", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await apiRequest("PATCH", `/api/documents/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setEditingDoc(null);
      toast({ title: "Document renommé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec du renommage", variant: "destructive" });
    },
  });

  const handleNavigate = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const handleFolderSelect = (type: FolderPath['type'], id?: string, name?: string) => {
    if (type === 'root') {
      setCurrentPath([{ type: 'root', name: 'Documents' }]);
    } else if (type === 'patients') {
      setCurrentPath([
        { type: 'root', name: 'Documents' },
        { type: 'patients', name: 'Patients' }
      ]);
    } else if (type === 'operations') {
      setCurrentPath([
        { type: 'root', name: 'Documents' },
        { type: 'operations', name: 'Actes' }
      ]);
    } else if (type === 'unclassified') {
      setCurrentPath([
        { type: 'root', name: 'Documents' },
        { type: 'unclassified', name: 'Non classés' }
      ]);
    } else if (type === 'patient' && id && name) {
      setCurrentPath([
        { type: 'root', name: 'Documents' },
        { type: 'patients', name: 'Patients' },
        { type: 'patient', id, name }
      ]);
    } else if (type === 'operation' && id && name) {
      setCurrentPath([
        { type: 'root', name: 'Documents' },
        { type: 'operations', name: 'Actes' },
        { type: 'operation', id, name }
      ]);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleView = async (file: UnifiedFile) => {
    try {
      const endpoint = file.sourceType === 'radio' 
        ? `/api/radios/${file.id}/signed-url` 
        : `/api/documents/${file.id}/signed-url`;
      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to get URL');
      const { signedUrl } = await response.json();
      
      const isViewable = file.mimeType?.startsWith('image/') || file.mimeType === 'application/pdf';
      if (isViewable) {
        setViewingFile({ file, url: signedUrl });
      } else {
        window.open(signedUrl, '_blank');
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'ouvrir le fichier", variant: "destructive" });
    }
  };

  const handleDownload = async (file: UnifiedFile) => {
    try {
      const endpoint = file.sourceType === 'radio' 
        ? `/api/radios/${file.id}/signed-url` 
        : `/api/documents/${file.id}/signed-url`;
      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to get URL');
      const { signedUrl } = await response.json();
      
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.fileName || file.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de télécharger le fichier", variant: "destructive" });
    }
  };

  const handleStartEdit = (file: UnifiedFile) => {
    if (file.sourceType === 'document') {
      setEditingDoc(file);
      setEditTitle(file.title);
    }
  };

  const handleSaveEdit = () => {
    if (editingDoc && editTitle.trim()) {
      updateMutation.mutate({ id: editingDoc.id, title: editTitle.trim() });
    }
  };

  const files = filesData?.files || [];
  const totalCount = filesData?.totalCount || 0;

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r bg-card shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Dossiers
          </h2>
        </div>
        <ScrollArea className="h-[calc(100%-57px)]">
          <div className="p-2">
            {treeLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <FolderTreeItem
                  node={{ name: 'Tous les documents', count: tree?.totalCount || 0, type: 'root' }}
                  isSelected={currentFolder.type === 'root'}
                  onSelect={() => handleFolderSelect('root')}
                />
                
                <FolderTreeItem
                  node={{ name: 'Patients', count: tree?.patients.reduce((acc, p) => acc + p.count, 0) || 0, type: 'patients' }}
                  isOpen={expandedFolders.has('patients')}
                  isSelected={currentFolder.type === 'patients'}
                  hasChildren={(tree?.patients.length || 0) > 0}
                  onToggle={() => toggleFolder('patients')}
                  onSelect={() => handleFolderSelect('patients')}
                />
                {expandedFolders.has('patients') && tree?.patients.map(p => (
                  <div key={p.id} style={{ paddingLeft: '24px' }}>
                    <FolderTreeItem
                      node={{ name: p.name, count: p.count, type: 'patient', id: p.patientId }}
                      isSelected={currentFolder.type === 'patient' && currentFolder.id === p.patientId}
                      onSelect={() => handleFolderSelect('patient', p.patientId, p.name)}
                    />
                  </div>
                ))}
                
                <FolderTreeItem
                  node={{ name: 'Actes', count: tree?.operations.reduce((acc, o) => acc + o.count, 0) || 0, type: 'operations' }}
                  isOpen={expandedFolders.has('operations')}
                  isSelected={currentFolder.type === 'operations'}
                  hasChildren={(tree?.operations.length || 0) > 0}
                  onToggle={() => toggleFolder('operations')}
                  onSelect={() => handleFolderSelect('operations')}
                />
                {expandedFolders.has('operations') && tree?.operations.map(o => (
                  <div key={o.id} style={{ paddingLeft: '24px' }}>
                    <FolderTreeItem
                      node={{ name: o.name, count: o.count, type: 'operation', id: o.operationId }}
                      isSelected={currentFolder.type === 'operation' && currentFolder.id === o.operationId}
                      onSelect={() => handleFolderSelect('operation', o.operationId, o.name)}
                    />
                  </div>
                ))}
                
                {(tree?.unclassifiedCount || 0) > 0 && (
                  <FolderTreeItem
                    node={{ name: 'Non classés', count: tree?.unclassifiedCount || 0, type: 'unclassified' }}
                    isSelected={currentFolder.type === 'unclassified'}
                    onSelect={() => handleFolderSelect('unclassified')}
                  />
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-card">
          <Breadcrumb path={currentPath} onNavigate={handleNavigate} />
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-documents"
              />
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-32" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Nom</SelectItem>
                <SelectItem value="size">Taille</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              data-testid="button-toggle-sort-dir"
            >
              {sortDir === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {filesLoading ? (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Folder className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun fichier</p>
              <p className="text-sm">Ce dossier est vide</p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-2 text-xs text-muted-foreground border-b bg-muted/50">
                {totalCount} fichier{totalCount > 1 ? 's' : ''}
              </div>
              {files.map(file => (
                <FileRow
                  key={`${file.sourceType}-${file.id}`}
                  file={file}
                  onView={() => handleView(file)}
                  onDownload={() => handleDownload(file)}
                  onEdit={() => handleStartEdit(file)}
                  onDelete={() => setDeletingFile(file)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 pr-8">
              {viewingFile && getFileIcon(viewingFile.file.mimeType)}
              <span className="truncate">{viewingFile?.file.title}</span>
              {viewingFile?.file.sourceType === 'radio' && (
                <Badge variant="outline" className="text-xs ml-2">Radio</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {viewingFile && viewingFile.file.mimeType?.startsWith('image/') && (
              <div className="flex items-center justify-center p-4">
                <img 
                  src={viewingFile.url} 
                  alt={viewingFile.file.title}
                  className="max-w-full max-h-[60vh] object-contain rounded-md"
                  data-testid="file-viewer-image"
                />
              </div>
            )}
            {viewingFile && viewingFile.file.mimeType === 'application/pdf' && (
              <iframe
                src={viewingFile.url}
                className="w-full h-[60vh] rounded-md border"
                title={viewingFile.file.title}
                data-testid="file-viewer-pdf"
              />
            )}
          </div>
          <DialogFooter className="shrink-0">
            <Button 
              variant="outline" 
              onClick={() => viewingFile && window.open(viewingFile.url, '_blank')}
              data-testid="button-open-new-tab"
            >
              <Eye className="h-4 w-4 mr-2" />
              Ouvrir dans un nouvel onglet
            </Button>
            <Button 
              onClick={() => viewingFile && handleDownload(viewingFile.file)}
              data-testid="button-download-viewer"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editingDoc} onOpenChange={() => setEditingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Nouveau nom</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="input-edit-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={!editTitle.trim() || updateMutation.isPending}
              data-testid="button-save-edit"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!deletingFile} onOpenChange={() => setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Supprimer {deletingFile?.sourceType === 'radio' ? 'la radio' : 'le document'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer "{deletingFile?.title}" ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingFile && deleteMutation.mutate({ id: deletingFile.id, sourceType: deletingFile.sourceType })}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
