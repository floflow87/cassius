import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Phone,
  Mail,
  User,
  Activity,
  FileImage,
  FileText,
  ClipboardList,
  Pencil,
  AlertTriangle,
  Pill,
  Heart,
  CheckCircle,
  CheckCircle2,
  Check,
  Image as ImageIcon,
  Stethoscope,
  MapPin,
  MoreVertical,
  Trash2,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  LayoutGrid,
  LayoutList,
  Share2,
  Copy,
  ExternalLink,
  Link2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientDetailsSkeleton } from "@/components/page-skeletons";
import { FlagList, CompactFlagList, TopFlagSummary, FlagsTooltipBadge } from "@/components/flag-badge";
import { AuditHistory } from "@/components/audit-history";
import type { Flag } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OperationForm } from "@/components/operation-form";
import { ImplantCard } from "@/components/implant-card";
import { RadioCard } from "@/components/radio-card";
import { RadioUploadForm } from "@/components/radio-upload-form";
import { DocumentCard } from "@/components/document-card";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { AppointmentCard } from "@/components/appointment-card";
import { AppointmentForm } from "@/components/appointment-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Patient, Operation, Implant, Radio, Visite, Note, RendezVous, Document, SurgeryImplantWithDetails, OperationWithImplants, Appointment } from "@shared/schema";

interface SurgeryImplantWithVisites extends SurgeryImplantWithDetails {
  visites?: Visite[];
  latestIsq?: { value: number; label: string };
  topFlag?: { type: string; level: "CRITICAL" | "WARNING" | "INFO"; label: string };
  activeFlagCount?: number;
}

interface PatientWithDetails extends Patient {
  operations: OperationWithImplants[];
  surgeryImplants: SurgeryImplantWithVisites[];
  radios: Radio[];
  topFlag?: { type: string; level: "CRITICAL" | "WARNING" | "INFO"; label: string };
  activeFlagCount?: number;
}

type ImplantSortDirection = "asc" | "desc" | null;
type ImplantColumnId = "marque" | "dimensions" | "position" | "site" | "typeOs" | "greffe" | "chirurgie" | "miseEnCharge" | "isq" | "flag" | "situation" | "operation" | "datePose";

interface ImplantColumnConfig {
  id: ImplantColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const defaultImplantColumns: ImplantColumnConfig[] = [
  { id: "marque", label: "Marque / Réf.", width: "min-w-40", sortable: true },
  { id: "dimensions", label: "Dimensions", width: "min-w-24", sortable: true },
  { id: "position", label: "Position", width: "min-w-28", sortable: true },
  { id: "site", label: "Site(s)", width: "min-w-20", sortable: true },
  { id: "typeOs", label: "Type d'os", width: "min-w-24", sortable: true },
  { id: "greffe", label: "Greffe", width: "min-w-16", sortable: true },
  { id: "chirurgie", label: "Chirurgie", width: "min-w-20", sortable: true },
  { id: "miseEnCharge", label: "Mise en charge", width: "min-w-28", sortable: true },
  { id: "isq", label: "ISQ", width: "min-w-24", sortable: true },
  { id: "flag", label: "Alertes", width: "min-w-20", sortable: false },
  { id: "situation", label: "Situation", width: "min-w-28", sortable: true },
  { id: "operation", label: "Opération", width: "min-w-32", sortable: true },
];

const IMPLANT_VIEW_MODE_KEY = "cassius_patient_implants_view_mode";
const IMPLANT_COLUMNS_KEY = "cassius_patient_implants_columns";
const IMPLANT_SORT_KEY = "cassius_patient_implants_sort";

// Operation table columns
type OperationSortDirection = "asc" | "desc" | null;
type OperationColumnId = "date" | "typeIntervention" | "implants" | "chirurgie" | "greffe" | "miseEnCharge" | "reussite";

interface OperationColumnConfig {
  id: OperationColumnId;
  label: string;
  width?: string;
  sortable: boolean;
}

const defaultOperationColumns: OperationColumnConfig[] = [
  { id: "date", label: "Date", width: "min-w-28", sortable: true },
  { id: "typeIntervention", label: "Type d'intervention", width: "min-w-40", sortable: true },
  { id: "implants", label: "Implants", width: "min-w-20", sortable: true },
  { id: "chirurgie", label: "Chirurgie", width: "min-w-32", sortable: true },
  { id: "greffe", label: "Greffe", width: "min-w-24", sortable: true },
  { id: "miseEnCharge", label: "Mise en charge", width: "min-w-28", sortable: true },
  { id: "reussite", label: "Réussite", width: "min-w-24", sortable: true },
];

const OPERATION_COLUMNS_KEY = "cassius_patient_operations_columns";
const OPERATION_SORT_KEY = "cassius_patient_operations_sort";

export default function PatientDetailsPage() {
  const [, params] = useRoute("/patients/:id");
  const [, setLocation] = useLocation();
  const patientId = params?.id;
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [radioDialogOpen, setRadioDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const { canDelete, canEdit } = useCurrentUser();
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

  const { data: patient, isLoading, error: patientError } = useQuery<PatientWithDetails>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
    retry: false,
  });

  // Query for all patient flags (including implant-level flags)
  const { data: allPatientFlagsData } = useQuery<{ patientFlags: Flag[]; implantFlagsById: Record<string, Flag[]> }>({
    queryKey: ["/api/patients", patientId, "flags"],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/flags`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch flags");
      return res.json();
    },
    enabled: !!patientId,
  });
  const patientFlags = allPatientFlagsData?.patientFlags ?? [];
  const implantFlagsById = allPatientFlagsData?.implantFlagsById ?? {};

  // Mutation pour mettre à jour le statut patient
  const updateStatusMutation = useMutation({
    mutationFn: async (statut: string) => {
      const res = await apiRequest("PATCH", `/api/patients/${patientId}`, { statut });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({ title: "Statut mis a jour", description: "Le statut du patient a ete modifie." });
      setStatusPopoverOpen(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut.", variant: "destructive" });
    },
  });

  // Mutation pour supprimer le patient
  const deletePatientMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Patient ID manquant");
      await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      setDeletePatientDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({ title: "Patient supprimé", description: "Le patient a été supprimé avec succès." });
      setLocation("/patients");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le patient.", variant: "destructive" });
    },
  });

  // Documents query
  const documentsQuery = useQuery<(Document & { signedUrl?: string | null })[]>({
    queryKey: ["/api/patients", patientId, "documents"],
    enabled: !!patientId,
  });
  const documents = documentsQuery.data;

  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    dateNaissance: "",
    sexe: "HOMME" as "HOMME" | "FEMME",
    telephone: "",
    email: "",
    ssn: "",
    adresse: "",
    codePostal: "",
    ville: "",
    pays: "",
  });

  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    contexteMedical: "",
    allergies: "",
    traitement: "",
    conditions: "",
  });

  // Notes state
  type NoteTag = "CONSULTATION" | "CHIRURGIE" | "SUIVI" | "COMPLICATION" | "ADMINISTRATIVE";
  interface NoteWithUser extends Note {
    user: { nom: string | null; prenom: string | null };
  }
  const [noteContent, setNoteContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<NoteTag | null>(null);
  const [editingNote, setEditingNote] = useState<NoteWithUser | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const { data: patientNotes = [], isLoading: notesLoading } = useQuery<NoteWithUser[]>({
    queryKey: ["/api/patients", patientId, "notes"],
    enabled: !!patientId,
  });

  // Implants table view state
  const [implantViewMode, setImplantViewMode] = useState<"table" | "cards">(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_VIEW_MODE_KEY);
      if (saved === "table" || saved === "cards") return saved;
    } catch {}
    return "table";
  });

  const [implantColumns, setImplantColumns] = useState<ImplantColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_COLUMNS_KEY);
      if (saved) {
        const savedOrder = JSON.parse(saved) as ImplantColumnId[];
        const orderedColumns = savedOrder.map(id => defaultImplantColumns.find(c => c.id === id)!).filter(Boolean);
        const missingColumns = defaultImplantColumns.filter(c => !savedOrder.includes(c.id));
        return [...orderedColumns, ...missingColumns];
      }
    } catch {}
    return defaultImplantColumns;
  });

  const [implantSortColumn, setImplantSortColumn] = useState<ImplantColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_SORT_KEY);
      if (saved) {
        const { column } = JSON.parse(saved);
        return column;
      }
    } catch {}
    return null;
  });

  const [implantSortDirection, setImplantSortDirection] = useState<ImplantSortDirection>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_SORT_KEY);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return null;
  });

  const [draggedImplantColumn, setDraggedImplantColumn] = useState<ImplantColumnId | null>(null);
  const [dragOverImplantColumn, setDragOverImplantColumn] = useState<ImplantColumnId | null>(null);

  // Implant type filter state
  type ImplantTypeFilter = "all" | "IMPLANT" | "MINI_IMPLANT";
  const IMPLANT_TYPE_FILTER_KEY = "cassius_implant_type_filter";
  const [implantTypeFilter, setImplantTypeFilter] = useState<ImplantTypeFilter>(() => {
    try {
      const saved = localStorage.getItem(IMPLANT_TYPE_FILTER_KEY);
      if (saved === "all" || saved === "IMPLANT" || saved === "MINI_IMPLANT") return saved;
    } catch {}
    return "all";
  });

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareExpiryDays, setShareExpiryDays] = useState<number | null>(null);
  const [newShareLink, setNewShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Share links query
  interface ShareLinkData {
    id: string;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    accessCount: number;
    sharedByUserName?: string;
  }
  const { data: shareLinks = [], isLoading: shareLinksLoading } = useQuery<ShareLinkData[]>({
    queryKey: ["/api/patients", patientId, "share-links"],
    enabled: !!patientId && shareDialogOpen,
  });

  // Create share link mutation
  const createShareLinkMutation = useMutation({
    mutationFn: async (expiresInDays: number | null) => {
      const res = await apiRequest("POST", `/api/patients/${patientId}/share-links`, { 
        expiresInDays 
      });
      return res.json();
    },
    onSuccess: (data: { token: string }) => {
      const link = `${window.location.origin}/share/${data.token}`;
      setNewShareLink(link);
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "share-links"] });
      toast({ title: "Lien créé", description: "Le lien de partage a été généré avec succès." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le lien de partage.", variant: "destructive" });
    },
  });

  // Revoke share link mutation
  const revokeShareLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/patients/${patientId}/share-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "share-links"] });
      toast({ title: "Lien révoqué", description: "Le lien de partage a été désactivé." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de révoquer le lien.", variant: "destructive" });
    },
  });

  const handleCopyLink = () => {
    if (newShareLink) {
      navigator.clipboard.writeText(newShareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: "Copié", description: "Le lien a été copié dans le presse-papiers." });
    }
  };

  // Persist implant view preferences
  useEffect(() => {
    try {
      localStorage.setItem(IMPLANT_VIEW_MODE_KEY, implantViewMode);
    } catch {}
  }, [implantViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(IMPLANT_COLUMNS_KEY, JSON.stringify(implantColumns.map(c => c.id)));
    } catch {}
  }, [implantColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(IMPLANT_SORT_KEY, JSON.stringify({ column: implantSortColumn, direction: implantSortDirection }));
    } catch {}
  }, [implantSortColumn, implantSortDirection]);

  useEffect(() => {
    try {
      localStorage.setItem(IMPLANT_TYPE_FILTER_KEY, implantTypeFilter);
    } catch {}
  }, [implantTypeFilter]);

  // Filter implants by type
  const filteredSurgeryImplants = (patient?.surgeryImplants || []).filter((si) => {
    if (implantTypeFilter === "all") return true;
    return si.implant?.typeImplant === implantTypeFilter;
  });

  // Implant table handlers
  const handleImplantSort = useCallback((columnId: ImplantColumnId) => {
    if (implantSortColumn === columnId) {
      if (implantSortDirection === "asc") {
        setImplantSortDirection("desc");
      } else if (implantSortDirection === "desc") {
        setImplantSortColumn(null);
        setImplantSortDirection(null);
      }
    } else {
      setImplantSortColumn(columnId);
      setImplantSortDirection("asc");
    }
  }, [implantSortColumn, implantSortDirection]);

  const handleImplantDragStart = useCallback((e: React.DragEvent, columnId: ImplantColumnId) => {
    setDraggedImplantColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleImplantDragOver = useCallback((e: React.DragEvent, columnId: ImplantColumnId) => {
    e.preventDefault();
    if (draggedImplantColumn && draggedImplantColumn !== columnId) {
      setDragOverImplantColumn(columnId);
    }
  }, [draggedImplantColumn]);

  const handleImplantDrop = useCallback((e: React.DragEvent, targetColumnId: ImplantColumnId) => {
    e.preventDefault();
    if (draggedImplantColumn && draggedImplantColumn !== targetColumnId) {
      const newColumns = [...implantColumns];
      const draggedIndex = newColumns.findIndex(c => c.id === draggedImplantColumn);
      const dropIndex = newColumns.findIndex(c => c.id === targetColumnId);
      
      if (draggedIndex !== -1 && dropIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(dropIndex, 0, removed);
        setImplantColumns(newColumns);
      }
    }
    setDraggedImplantColumn(null);
    setDragOverImplantColumn(null);
  }, [draggedImplantColumn, implantColumns]);

  const handleImplantDragEnd = useCallback(() => {
    setDraggedImplantColumn(null);
    setDragOverImplantColumn(null);
  }, []);

  const renderImplantSortIcon = useCallback((columnId: ImplantColumnId) => {
    if (implantSortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (implantSortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  }, [implantSortColumn, implantSortDirection]);

  // Operation table state
  const [operationColumns, setOperationColumns] = useState<OperationColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(OPERATION_COLUMNS_KEY);
      if (saved) {
        const savedOrder = JSON.parse(saved) as OperationColumnId[];
        const orderedColumns = savedOrder.map(id => defaultOperationColumns.find(c => c.id === id)!).filter(Boolean);
        const missingColumns = defaultOperationColumns.filter(c => !savedOrder.includes(c.id));
        return [...orderedColumns, ...missingColumns];
      }
    } catch {}
    return defaultOperationColumns;
  });

  const [operationSortColumn, setOperationSortColumn] = useState<OperationColumnId | null>(() => {
    try {
      const saved = localStorage.getItem(OPERATION_SORT_KEY);
      if (saved) {
        const { column } = JSON.parse(saved);
        return column;
      }
    } catch {}
    return null;
  });

  const [operationSortDirection, setOperationSortDirection] = useState<OperationSortDirection>(() => {
    try {
      const saved = localStorage.getItem(OPERATION_SORT_KEY);
      if (saved) {
        const { direction } = JSON.parse(saved);
        return direction;
      }
    } catch {}
    return null;
  });

  const [draggedOperationColumn, setDraggedOperationColumn] = useState<OperationColumnId | null>(null);
  const [dragOverOperationColumn, setDragOverOperationColumn] = useState<OperationColumnId | null>(null);

  // Persist operation preferences
  useEffect(() => {
    try {
      localStorage.setItem(OPERATION_COLUMNS_KEY, JSON.stringify(operationColumns.map(c => c.id)));
    } catch {}
  }, [operationColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(OPERATION_SORT_KEY, JSON.stringify({ column: operationSortColumn, direction: operationSortDirection }));
    } catch {}
  }, [operationSortColumn, operationSortDirection]);

  // Operation table handlers
  const handleOperationSort = useCallback((columnId: OperationColumnId) => {
    if (operationSortColumn === columnId) {
      if (operationSortDirection === "asc") {
        setOperationSortDirection("desc");
      } else if (operationSortDirection === "desc") {
        setOperationSortColumn(null);
        setOperationSortDirection(null);
      }
    } else {
      setOperationSortColumn(columnId);
      setOperationSortDirection("asc");
    }
  }, [operationSortColumn, operationSortDirection]);

  const handleOperationDragStart = useCallback((e: React.DragEvent, columnId: OperationColumnId) => {
    setDraggedOperationColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleOperationDragOver = useCallback((e: React.DragEvent, columnId: OperationColumnId) => {
    e.preventDefault();
    if (draggedOperationColumn && draggedOperationColumn !== columnId) {
      setDragOverOperationColumn(columnId);
    }
  }, [draggedOperationColumn]);

  const handleOperationDrop = useCallback((e: React.DragEvent, targetColumnId: OperationColumnId) => {
    e.preventDefault();
    if (draggedOperationColumn && draggedOperationColumn !== targetColumnId) {
      const newColumns = [...operationColumns];
      const draggedIndex = newColumns.findIndex(c => c.id === draggedOperationColumn);
      const dropIndex = newColumns.findIndex(c => c.id === targetColumnId);
      
      if (draggedIndex !== -1 && dropIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(dropIndex, 0, removed);
        setOperationColumns(newColumns);
      }
    }
    setDraggedOperationColumn(null);
    setDragOverOperationColumn(null);
  }, [draggedOperationColumn, operationColumns]);

  const handleOperationDragEnd = useCallback(() => {
    setDraggedOperationColumn(null);
    setDragOverOperationColumn(null);
  }, []);

  const renderOperationSortIcon = useCallback((columnId: OperationColumnId) => {
    if (operationSortColumn !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (operationSortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  }, [operationSortColumn, operationSortDirection]);

  // Calculate success rate for an operation
  const getOperationSuccessRate = useCallback((operation: OperationWithImplants) => {
    const implants = operation.surgeryImplants || [];
    if (implants.length === 0) return null;
    
    const successfulImplants = implants.filter(si => 
      si.statut === "SUCCES" || si.statut === "EN_SUIVI"
    ).length;
    
    return Math.round((successfulImplants / implants.length) * 100);
  }, []);

  // Get success rate badge styling
  const getSuccessRateBadge = useCallback((rate: number | null) => {
    if (rate === null) return { className: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400", label: "-" };
    
    if (rate >= 80) {
      return { className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", label: `${rate}%` };
    } else if (rate >= 60) {
      return { className: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400", label: `${rate}%` };
    } else {
      return { className: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400", label: `${rate}%` };
    }
  }, []);

  // Sort operations for table
  const getSortedOperations = useCallback((operations: OperationWithImplants[]) => {
    if (!operationSortColumn || !operationSortDirection) return operations;

    return [...operations].sort((a, b) => {
      let comparison = 0;
      
      switch (operationSortColumn) {
        case "date":
          comparison = new Date(a.dateOperation || 0).getTime() - new Date(b.dateOperation || 0).getTime();
          break;
        case "typeIntervention":
          comparison = (a.typeIntervention || "").localeCompare(b.typeIntervention || "");
          break;
        case "implants":
          comparison = (a.surgeryImplants?.length || 0) - (b.surgeryImplants?.length || 0);
          break;
        case "chirurgie":
          comparison = (a.typeChirurgieTemps || "").localeCompare(b.typeChirurgieTemps || "");
          break;
        case "greffe":
          comparison = (a.greffeOsseuse ? 1 : 0) - (b.greffeOsseuse ? 1 : 0);
          break;
        case "miseEnCharge":
          comparison = (a.typeMiseEnCharge || "").localeCompare(b.typeMiseEnCharge || "");
          break;
        case "reussite":
          const rateA = getOperationSuccessRate(a) ?? -1;
          const rateB = getOperationSuccessRate(b) ?? -1;
          comparison = rateA - rateB;
          break;
      }
      
      return operationSortDirection === "asc" ? comparison : -comparison;
    });
  }, [operationSortColumn, operationSortDirection, getOperationSuccessRate]);

  // Format date as dd/mm/yyyy
  const formatDateCompact = (date: string) => {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Render operation cell content
  const renderOperationCellContent = useCallback((columnId: OperationColumnId, operation: OperationWithImplants) => {
    switch (columnId) {
      case "date":
        return formatDateCompact(operation.dateOperation);
      case "typeIntervention":
        return getInterventionLabel(operation.typeIntervention);
      case "implants":
        const sites = operation.surgeryImplants?.map(si => si.siteFdi).join(", ") || "";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge variant="default" className="rounded-full cursor-help">
                  {operation.surgeryImplants?.length || 0}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>{sites || "Aucun implant"}</TooltipContent>
          </Tooltip>
        );
      case "chirurgie":
        if (!operation.typeChirurgieTemps) return "-";
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">
            {operation.typeChirurgieTemps === "UN_TEMPS" ? "1 temps" : "2 temps"}
          </Badge>
        );
      case "greffe":
        return operation.greffeOsseuse ? (operation.typeGreffe || "Oui") : "-";
      case "miseEnCharge":
        if (!operation.typeMiseEnCharge) return "-";
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-0">
            {operation.typeMiseEnCharge.charAt(0) + operation.typeMiseEnCharge.slice(1).toLowerCase()}
          </Badge>
        );
      case "reussite":
        const rate = getOperationSuccessRate(operation);
        const badge = getSuccessRateBadge(rate);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        );
      default:
        return "-";
    }
  }, [getOperationSuccessRate, getSuccessRateBadge]);

  // Rendez-vous state
  type RdvTag = "CONSULTATION" | "SUIVI" | "CHIRURGIE";
  const [rdvDialogOpen, setRdvDialogOpen] = useState(false);
  const [timelineRadioViewerId, setTimelineRadioViewerId] = useState<string | null>(null);
  const [rdvForm, setRdvForm] = useState({
    titre: "",
    description: "",
    date: "",
    heureDebut: "09:00",
    heureFin: "09:30",
    tag: "CONSULTATION" as RdvTag,
  });
  const [editingRdv, setEditingRdv] = useState<RendezVous | null>(null);
  const [deleteRdvId, setDeleteRdvId] = useState<string | null>(null);

  const { data: patientRdvs = [], isLoading: rdvsLoading } = useQuery<RendezVous[]>({
    queryKey: ["/api/patients", patientId, "rendez-vous"],
    enabled: !!patientId,
  });

  // Unified Appointments (new system)
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/patients", patientId, "appointments"],
    enabled: !!patientId,
  });
  // Filter appointments by actual date (not status) - future dates are upcoming, past dates are completed
  const now = new Date();
  const upcomingAppointments = appointments.filter((a) => new Date(a.dateStart) > now).sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());
  const completedAppointments = appointments.filter((a) => new Date(a.dateStart) <= now).sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

  const createRdvMutation = useMutation({
    mutationFn: async (data: typeof rdvForm) => {
      return apiRequest("POST", `/api/patients/${patientId}/rendez-vous`, {
        patientId,
        titre: data.titre,
        description: data.description || null,
        date: data.date,
        heureDebut: data.heureDebut,
        heureFin: data.heureFin,
        tag: data.tag,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "rendez-vous"] });
      setRdvDialogOpen(false);
      setRdvForm({ titre: "", description: "", date: "", heureDebut: "09:00", heureFin: "09:30", tag: "CONSULTATION" });
      toast({ title: "Rendez-vous créé", description: "Le rendez-vous a été ajouté.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le rendez-vous.", variant: "destructive" });
    },
  });

  const updateRdvMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof rdvForm) => {
      return apiRequest("PATCH", `/api/rendez-vous/${data.id}`, {
        titre: data.titre,
        description: data.description || null,
        date: data.date,
        heureDebut: data.heureDebut,
        heureFin: data.heureFin,
        tag: data.tag,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "rendez-vous"] });
      setEditingRdv(null);
      toast({ title: "Rendez-vous modifié", description: "Le rendez-vous a été mis à jour.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le rendez-vous.", variant: "destructive" });
    },
  });

  const deleteRdvMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rendez-vous/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "rendez-vous"] });
      setDeleteRdvId(null);
      toast({ title: "Rendez-vous supprimé", description: "Le rendez-vous a été supprimé.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le rendez-vous.", variant: "destructive" });
    },
  });

  const getRdvTagConfig = (tag: RdvTag) => {
    const configs: Record<RdvTag, { label: string; className: string; borderColor: string }> = {
      CONSULTATION: { label: "Consultation", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", borderColor: "border-l-orange-500" },
      SUIVI: { label: "Suivi", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", borderColor: "border-l-green-500" },
      CHIRURGIE: { label: "Chirurgie", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", borderColor: "border-l-red-500" },
    };
    return configs[tag];
  };

  const formatRdvDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingRdvs = patientRdvs.filter((r) => new Date(r.date) >= today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastRdvs = patientRdvs.filter((r) => new Date(r.date) < today).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const createNoteMutation = useMutation({
    mutationFn: async (data: { contenu: string; tag: NoteTag | null }) => {
      return apiRequest("POST", `/api/patients/${patientId}/notes`, {
        patientId,
        contenu: data.contenu,
        tag: data.tag,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "notes"] });
      setNoteContent("");
      setSelectedTag(null);
      toast({ title: "Note ajoutée", description: "La note a été créée avec succès.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la note.", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (data: { id: string; contenu: string; tag: NoteTag | null }) => {
      return apiRequest("PATCH", `/api/notes/${data.id}`, {
        contenu: data.contenu,
        tag: data.tag,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "notes"] });
      setEditingNote(null);
      toast({ title: "Note modifiée", description: "La note a été mise à jour.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier la note.", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "notes"] });
      setDeleteNoteId(null);
      toast({ title: "Note supprimée", description: "La note a été supprimée.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la note.", variant: "destructive" });
    },
  });

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    createNoteMutation.mutate({ contenu: noteContent, tag: selectedTag });
  };

  const handleUpdateNote = () => {
    if (!editingNote || !editingNote.contenu.trim()) return;
    updateNoteMutation.mutate({
      id: editingNote.id,
      contenu: editingNote.contenu,
      tag: editingNote.tag as NoteTag | null,
    });
  };

  const getTagConfig = (tag: NoteTag | null) => {
    const configs: Record<NoteTag, { label: string; className: string }> = {
      CONSULTATION: { label: "Consultation", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      CHIRURGIE: { label: "Chirurgie", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      SUIVI: { label: "Suivi", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      COMPLICATION: { label: "Complication", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
      ADMINISTRATIVE: { label: "Administrative", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
    };
    return tag ? configs[tag] : null;
  };

  const formatNoteDatetime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) + " à " + d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const updatePatientMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      return apiRequest("PATCH", `/api/patients/${patientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setEditDialogOpen(false);
      toast({
        title: "Patient mis à jour",
        description: "Les informations du patient ont été enregistrées.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le patient.",
        variant: "destructive",
      });
    },
  });

  const updateMedicalMutation = useMutation({
    mutationFn: async (data: typeof medicalForm) => {
      return apiRequest("PATCH", `/api/patients/${patientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setMedicalDialogOpen(false);
      toast({
        title: "Contexte médical mis à jour",
        description: "Les informations médicales ont été enregistrées.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le contexte médical.",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = () => {
    if (patient) {
      setEditForm({
        nom: patient.nom,
        prenom: patient.prenom,
        dateNaissance: patient.dateNaissance,
        sexe: patient.sexe,
        telephone: patient.telephone || "",
        email: patient.email || "",
        ssn: patient.ssn || "",
        adresse: patient.adresse || "",
        codePostal: patient.codePostal || "",
        ville: patient.ville || "",
        pays: patient.pays || "",
      });
      setEditDialogOpen(true);
    }
  };

  const openMedicalDialog = () => {
    if (patient) {
      setMedicalForm({
        contexteMedical: patient.contexteMedical || "",
        allergies: patient.allergies || "",
        traitement: patient.traitement || "",
        conditions: patient.conditions || "",
      });
      setMedicalDialogOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePatientMutation.mutate(editForm);
  };

  const handleMedicalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMedicalMutation.mutate(medicalForm);
  };

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

  const formatDate = (dateInput: string | Date) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateShort = (dateInput: string | Date) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getInterventionLabel = (type: string) => {
    const labels: Record<string, string> = {
      POSE_IMPLANT: "Pose d'implant",
      GREFFE_OSSEUSE: "Greffe osseuse",
      SINUS_LIFT: "Sinus lift",
      EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
      REPRISE_IMPLANT: "Reprise d'implant",
      CHIRURGIE_GUIDEE: "Chirurgie guidée",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (statut: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "echec" | "complication" | "ensuivi" | "success" }> = {
      SUCCES: { label: "Succès", variant: "success" },
      EN_SUIVI: { label: "En suivi", variant: "ensuivi" },
      COMPLICATION: { label: "Complication", variant: "complication" },
      ECHEC: { label: "Échec", variant: "echec" },
    };
    const config = statusConfig[statut] || statusConfig.EN_SUIVI;
    return <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>;
  };

  const getRadioLabel = (type: string) => {
    const labels: Record<string, string> = {
      PANORAMIQUE: "Radiographie panoramique",
      CBCT: "CBCT",
      RETROALVEOLAIRE: "Rétro-alvéolaire",
    };
    return labels[type] || type;
  };

  const getSituationFromSiteFdi = (siteFdi: string | null) => {
    if (!siteFdi) return "-";
    const firstDigit = siteFdi.charAt(0);
    if (firstDigit === "1" || firstDigit === "2") return "Maxillaire";
    if (firstDigit === "3" || firstDigit === "4") return "Mandibulaire";
    return "-";
  };

  const getPositionLabel = (position: string | null) => {
    const labels: Record<string, string> = {
      CRESTAL: "Crestal",
      SOUS_CRESTAL: "Sous-crestal",
      SUPRA_CRESTAL: "Supra-crestal",
    };
    return position ? labels[position] || position : "-";
  };

  const getMiseEnChargeLabel = (miseEnCharge: string | null) => {
    const labels: Record<string, string> = {
      IMMEDIATE: "Immédiate",
      PRECOCE: "Précoce",
      DIFFEREE: "Différée",
    };
    return miseEnCharge ? labels[miseEnCharge] || miseEnCharge : "-";
  };

  const getChirurgieTempsLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      UN_TEMPS: "1T",
      DEUX_TEMPS: "2T",
    };
    return type ? labels[type] || type : "-";
  };

  // Sort implants for table view
  const sortImplants = useCallback((implantsToSort: SurgeryImplantWithVisites[]) => {
    if (!implantSortColumn || !implantSortDirection) return implantsToSort;

    return [...implantsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (implantSortColumn) {
        case "site":
          comparison = (a.siteFdi || "").localeCompare(b.siteFdi || "");
          break;
        case "marque":
          comparison = (a.implant?.marque || "").localeCompare(b.implant?.marque || "");
          break;
        case "dimensions":
          const dimA = (a.implant?.diametre || 0) * 100 + (a.implant?.longueur || 0);
          const dimB = (b.implant?.diametre || 0) * 100 + (b.implant?.longueur || 0);
          comparison = dimA - dimB;
          break;
        case "datePose":
          comparison = new Date(a.datePose || 0).getTime() - new Date(b.datePose || 0).getTime();
          break;
        case "isq":
          const isqValA = a.latestIsq?.value || 0;
          const isqValB = b.latestIsq?.value || 0;
          comparison = isqValA - isqValB;
          break;
        case "position":
          comparison = (a.positionImplant || "").localeCompare(b.positionImplant || "");
          break;
        case "typeOs":
          comparison = (a.typeOs || "").localeCompare(b.typeOs || "");
          break;
        case "greffe":
          comparison = (a.greffeOsseuse ? 1 : 0) - (b.greffeOsseuse ? 1 : 0);
          break;
        case "chirurgie":
          comparison = (a.typeChirurgieTemps || "").localeCompare(b.typeChirurgieTemps || "");
          break;
        case "miseEnCharge":
          comparison = (a.miseEnCharge || "").localeCompare(b.miseEnCharge || "");
          break;
        case "situation":
          comparison = getSituationFromSiteFdi(a.siteFdi).localeCompare(getSituationFromSiteFdi(b.siteFdi));
          break;
        case "operation":
          comparison = new Date(a.datePose || 0).getTime() - new Date(b.datePose || 0).getTime();
          break;
        default:
          comparison = 0;
      }
      
      return implantSortDirection === "desc" ? -comparison : comparison;
    });
  }, [implantSortColumn, implantSortDirection]);

  // Render implant table cell content
  const renderImplantCellContent = useCallback((columnId: ImplantColumnId, surgeryImplant: SurgeryImplantWithVisites) => {
    switch (columnId) {
      case "site":
        return (
          <span className="font-mono font-medium text-xs">{surgeryImplant.siteFdi || "-"}</span>
        );
      case "marque":
        return (
          <div>
            <div className="text-xs font-medium">{surgeryImplant.implant?.marque || "-"}</div>
            <div className="text-[10px] text-muted-foreground">{surgeryImplant.implant?.referenceFabricant || "-"}</div>
          </div>
        );
      case "dimensions":
        return (
          <span className="text-xs">
            {surgeryImplant.implant?.diametre} x {surgeryImplant.implant?.longueur}mm
          </span>
        );
      case "datePose":
        return (
          <span className="text-xs text-muted-foreground">
            {surgeryImplant.datePose ? formatDateShort(surgeryImplant.datePose) : "-"}
          </span>
        );
      case "isq":
        const latestIsq = surgeryImplant.latestIsq;
        if (!latestIsq) return <span className="text-muted-foreground">-</span>;
        const isqClassName = latestIsq.value >= 70 
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0" 
          : latestIsq.value >= 60 
            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0" 
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0";
        return (
          <div className="flex items-center gap-1">
            <Badge className={`font-mono ${isqClassName}`}>
              {latestIsq.value}
            </Badge>
            <span className="text-xs text-muted-foreground">{latestIsq.label}</span>
          </div>
        );
      case "flag":
        const implantFlags = implantFlagsById[surgeryImplant.id] || [];
        if (implantFlags.length > 0) {
          return <FlagsTooltipBadge flags={implantFlags} />;
        }
        return (
          <TopFlagSummary 
            topFlag={surgeryImplant.topFlag} 
            activeFlagCount={surgeryImplant.activeFlagCount} 
          />
        );
      case "position":
        return <span className="text-xs">{getPositionLabel(surgeryImplant.positionImplant)}</span>;
      case "typeOs":
        return <span className="text-xs font-mono">{surgeryImplant.typeOs || "-"}</span>;
      case "greffe":
        return surgeryImplant.greffeOsseuse ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      case "chirurgie":
        return <span className="text-xs">{getChirurgieTempsLabel(surgeryImplant.typeChirurgieTemps)}</span>;
      case "miseEnCharge":
        return <span className="text-xs">{getMiseEnChargeLabel(surgeryImplant.miseEnCharge)}</span>;
      case "situation":
        return <span className="text-xs">{getSituationFromSiteFdi(surgeryImplant.siteFdi)}</span>;
      case "operation":
        return (
          <div className="text-xs">
            <div>{formatDateShort(surgeryImplant.datePose)}</div>
          </div>
        );
      default:
        return null;
    }
  }, [implantFlagsById]);

  if (isLoading) {
    return <PatientDetailsSkeleton />;
  }

  if (!patient || patientError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {patientError ? "Erreur de chargement" : "Patient non trouvé"}
            </h3>
            {patientError && (
              <p className="text-sm text-destructive mb-4 max-w-md text-center">
                {(patientError as any)?.message || String(patientError)}
              </p>
            )}
            <Link href="/patients">
              <Button variant="outline">Retour à la liste</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const implantCount = patient.surgeryImplants?.length || 0;
  const operationCount = patient.operations?.length || 0;
  const radioCount = patient.radios?.length || 0;
  const visiteCount = completedAppointments.length;

  const sortedOperations = [...(patient.operations || [])].sort(
    (a, b) => new Date(b.dateOperation).getTime() - new Date(a.dateOperation).getTime()
  );

  interface TimelineEvent {
    id: string;
    date: Date;
    type: "operation" | "radio" | "visite" | "rdv" | "document";
    title: string;
    description?: string;
    badges?: string[];
    badgeClassName?: string;
    radioId?: string;
    documentId?: string;
  }

  const timelineEvents: TimelineEvent[] = [];

  sortedOperations.forEach((op) => {
    timelineEvents.push({
      id: `op-${op.id}`,
      date: new Date(op.dateOperation),
      type: "operation",
      title: getInterventionLabel(op.typeIntervention),
      description: op.notesPerop || `${op.surgeryImplants?.length || 0} implant(s)`,
      badges: op.surgeryImplants?.slice(0, 3).map(imp => `Site ${imp.siteFdi}`),
    });
  });

  patient.radios?.forEach((radio) => {
    timelineEvents.push({
      id: `radio-${radio.id}`,
      date: new Date(radio.date),
      type: "radio",
      title: radio.title || getRadioLabel(radio.type),
      description: "Voir l'image",
      radioId: radio.id,
    });
  });

  patient.surgeryImplants?.forEach((imp) => {
    imp.visites?.forEach((visite) => {
      timelineEvents.push({
        id: `visite-${visite.id}`,
        date: new Date(visite.date),
        type: "visite",
        title: "Visite de contrôle",
        description: visite.notes || `ISQ: ${visite.isq || "-"}`,
        badges: visite.isq ? [`ISQ: ${visite.isq}`] : undefined,
      });
    });
  });

  // Ajouter les documents à la timeline
  const TAG_LABELS_DOC: Record<string, string> = {
    DEVIS: "Devis",
    CONSENTEMENT: "Consentement",
    COMPTE_RENDU: "Compte-rendu",
    ASSURANCE: "Assurance",
    AUTRE: "Autre",
  };
  
  documents?.forEach((doc) => {
    const primaryTag = doc.tags?.[0];
    timelineEvents.push({
      id: `doc-${doc.id}`,
      date: new Date(doc.createdAt),
      type: "document",
      title: doc.title || "Document",
      description: "Voir le document",
      badges: primaryTag ? [TAG_LABELS_DOC[primaryTag] || primaryTag] : undefined,
      documentId: doc.id,
    });
  });

  // Ajouter les rendez-vous passés à la timeline (depuis appointments)
  completedAppointments.forEach((apt) => {
    const aptDate = new Date(apt.dateStart);
    // Seulement les rendez-vous avec une date passée
    if (aptDate <= today) {
      const typeLabel = apt.type === "CONSULTATION" ? "Consultation" : 
                        apt.type === "SUIVI" ? "Suivi" : 
                        apt.type === "CHIRURGIE" ? "Chirurgie" :
                        apt.type === "CONTROLE" ? "Contrôle" :
                        apt.type === "URGENCE" ? "Urgence" : "Autre";
      const typeClassName = apt.type === "CONSULTATION" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : 
                            apt.type === "SUIVI" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : 
                            apt.type === "CHIRURGIE" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                            "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      timelineEvents.push({
        id: `apt-${apt.id}`,
        date: aptDate,
        type: "rdv",
        title: apt.title,
        description: apt.description || typeLabel,
        badges: [typeLabel],
        badgeClassName: typeClassName,
      });
    }
  });

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const oldestOperationYear = sortedOperations.length > 0
    ? new Date(sortedOperations[sortedOperations.length - 1].dateOperation).getFullYear()
    : null;

  // Calculate success rate based on implants with definitive outcomes (SUCCES or ECHEC)
  const definitiveImplants = patient.surgeryImplants?.filter(i => i.statut === "SUCCES" || i.statut === "ECHEC") || [];
  const successfulImplants = definitiveImplants.filter(i => i.statut === "SUCCES").length;
  const successRate = definitiveImplants.length > 0 
    ? Math.round((successfulImplants / definitiveImplants.length) * 100)
    : 100; // Default to 100% if no definitive outcomes yet

  return (
    <div className="p-6 space-y-4 bg-muted/30 min-h-full">
      <div className="flex items-center gap-4 pb-2 border-b border-border">
        <Link href="/patients">
          <Button variant="ghost" size="icon" data-testid="button-back-to-patients">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" data-testid="text-patient-name">
              {patient.prenom} {patient.nom}
            </h1>
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Badge 
                  variant="default" 
                  className={`cursor-pointer ${
                    patient.statut === "ARCHIVE" 
                      ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" 
                      : patient.statut === "INACTIF"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  }`}
                  data-testid="badge-patient-status"
                >
                  {patient.statut === "ARCHIVE" ? "Archive" : patient.statut === "INACTIF" ? "Inactif" : "Actif"}
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2" align="start">
                <div className="space-y-1">
                  <Button
                    variant={patient.statut === "ACTIF" || !patient.statut ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => updateStatusMutation.mutate("ACTIF")}
                    disabled={updateStatusMutation.isPending}
                    data-testid="status-option-actif"
                  >
                    <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                    Actif
                  </Button>
                  <Button
                    variant={patient.statut === "INACTIF" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => updateStatusMutation.mutate("INACTIF")}
                    disabled={updateStatusMutation.isPending}
                    data-testid="status-option-inactif"
                  >
                    <span className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
                    Inactif
                  </Button>
                  <Button
                    variant={patient.statut === "ARCHIVE" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => updateStatusMutation.mutate("ARCHIVE")}
                    disabled={updateStatusMutation.isPending}
                    data-testid="status-option-archive"
                  >
                    <span className="h-2 w-2 rounded-full bg-gray-500 mr-2" />
                    Archive
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {patientFlags.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 cursor-help gap-1"
                    data-testid="badge-patient-alerts"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{patientFlags.length} alerte{patientFlags.length > 1 ? 's' : ''}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <div className="space-y-2">
                    {patientFlags.map((flag) => {
                      const levelConfig: Record<string, { label: string; className: string }> = {
                        CRITICAL: { label: "Critique", className: "text-red-500" },
                        WARNING: { label: "Attention", className: "text-orange-500" },
                        INFO: { label: "Info", className: "text-blue-500" },
                      };
                      const config = levelConfig[flag.level] || levelConfig.INFO;
                      return (
                        <div key={flag.id} className="flex items-start gap-2">
                          <AlertTriangle className={`w-3 h-3 mt-0.5 ${config.className}`} />
                          <div>
                            <p className="font-medium text-sm">{flag.label}</p>
                            {flag.description && (
                              <p className="text-xs text-muted-foreground">{flag.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Follow-up status badge */}
            {!appointmentsLoading && (() => {
              // Determine follow-up status: upcoming takes priority, then most recent completed/cancelled
              if (upcomingAppointments.length > 0) {
                return (
                  <Badge className="bg-[#EFF6FF] text-blue-700 text-[10px] gap-1" data-testid="badge-followup-status">
                    <Calendar className="w-3 h-3" />
                    À venir
                  </Badge>
                );
              }
              if (completedAppointments.length > 0) {
                const lastAppointment = completedAppointments[0];
                if (lastAppointment.status === "COMPLETED") {
                  return (
                    <Badge className="bg-[#DCFCE7] text-green-700 text-[10px] gap-1" data-testid="badge-followup-status">
                      <CheckCircle2 className="w-3 h-3" />
                      Terminé
                    </Badge>
                  );
                }
                if (lastAppointment.status === "CANCELLED") {
                  return (
                    <Badge className="bg-[#FEF2F2] text-red-700 text-[10px] gap-1" data-testid="badge-followup-status">
                      <XCircle className="w-3 h-3" />
                      Annulé
                    </Badge>
                  );
                }
              }
              return null;
            })()}
          </div>
          <p className="text-xs text-muted-foreground">
            {calculateAge(patient.dateNaissance)} ans - Depuis {new Date(patient.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-full w-fit">
          {[
            { value: "overview", label: "Vue d'ensemble" },
            { value: "implants", label: `Implants (${implantCount})` },
            { value: "operations", label: "Actes chirurgicaux" },
            { value: "radios", label: "Radiographies" },
            { value: "documents", label: "Documents" },
            { value: "visits", label: "Suivi & Visites" },
            { value: "notes", label: "Notes" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 ${
                activeTab === tab.value ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.value}`}
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="patient-tab-indicator"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Informations patient</CardTitle>
                    <Button variant="ghost" size="icon" onClick={openEditDialog} data-testid="button-edit-patient">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Nom complet</span>
                    <p className="font-medium">{patient.prenom} {patient.nom}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Date de naissance</span>
                    <p>{formatDate(patient.dateNaissance)} ({calculateAge(patient.dateNaissance)} ans)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Sexe</span>
                    <p>{patient.sexe === "HOMME" ? "Homme" : "Femme"}</p>
                  </div>
                  {patient.telephone && (
                    <div>
                      <span className="text-muted-foreground text-[10px]">Téléphone</span>
                      <p>{patient.telephone}</p>
                    </div>
                  )}
                  {patient.email && (
                    <div>
                      <span className="text-muted-foreground text-[10px]">Email</span>
                      <p>{patient.email}</p>
                    </div>
                  )}
                  {patient.ssn && (
                    <div>
                      <span className="text-muted-foreground text-[10px]">Numéro de sécurité sociale</span>
                      <p>{patient.ssn}</p>
                    </div>
                  )}
                  {(patient.adresse || patient.codePostal || patient.ville || patient.pays) && (
                    <div>
                      <span className="text-muted-foreground text-[10px]">Adresse</span>
                      <p>
                        {patient.adresse && <span>{patient.adresse}<br /></span>}
                        {(patient.codePostal || patient.ville) && (
                          <span>{patient.codePostal} {patient.ville}<br /></span>
                        )}
                        {patient.pays && <span>{patient.pays}</span>}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-[10px]">Patient depuis le</span>
                    <p>{formatDate(patient.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Modifier le patient</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prenom">Prénom</Label>
                        <Input
                          id="prenom"
                          value={editForm.prenom}
                          onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                          required
                          data-testid="input-edit-prenom"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nom">Nom</Label>
                        <Input
                          id="nom"
                          value={editForm.nom}
                          onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                          required
                          data-testid="input-edit-nom"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateNaissance">Date de naissance</Label>
                        <Input
                          id="dateNaissance"
                          type="date"
                          value={editForm.dateNaissance}
                          onChange={(e) => setEditForm({ ...editForm, dateNaissance: e.target.value })}
                          required
                          data-testid="input-edit-date-naissance"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sexe">Sexe</Label>
                        <Select
                          value={editForm.sexe}
                          onValueChange={(value: "HOMME" | "FEMME") => setEditForm({ ...editForm, sexe: value })}
                        >
                          <SelectTrigger data-testid="select-edit-sexe">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOMME">Homme</SelectItem>
                            <SelectItem value="FEMME">Femme</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telephone">Téléphone</Label>
                        <Input
                          id="telephone"
                          value={editForm.telephone}
                          onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                          data-testid="input-edit-telephone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          data-testid="input-edit-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ssn">Numéro de sécurité sociale</Label>
                      <Input
                        id="ssn"
                        value={editForm.ssn}
                        onChange={(e) => setEditForm({ ...editForm, ssn: e.target.value })}
                        placeholder="1 23 45 67 890 123 45"
                        data-testid="input-edit-ssn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adresse">Adresse</Label>
                      <Input
                        id="adresse"
                        value={editForm.adresse}
                        onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })}
                        placeholder="Numéro et rue"
                        data-testid="input-edit-adresse"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="codePostal">Code postal</Label>
                        <Input
                          id="codePostal"
                          value={editForm.codePostal}
                          onChange={(e) => setEditForm({ ...editForm, codePostal: e.target.value })}
                          data-testid="input-edit-code-postal"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="ville">Ville</Label>
                        <Input
                          id="ville"
                          value={editForm.ville}
                          onChange={(e) => setEditForm({ ...editForm, ville: e.target.value })}
                          data-testid="input-edit-ville"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pays">Pays</Label>
                      <Input
                        id="pays"
                        value={editForm.pays}
                        onChange={(e) => setEditForm({ ...editForm, pays: e.target.value })}
                        placeholder="France"
                        data-testid="input-edit-pays"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={updatePatientMutation.isPending} data-testid="button-save-patient">
                        {updatePatientMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Contexte médical</CardTitle>
                    <Button variant="ghost" size="icon" onClick={openMedicalDialog} data-testid="button-edit-medical">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border-l-4 border-blue-400">
                    <ClipboardList className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Contexte médical</p>
                      <p className="text-[10px] text-muted-foreground">
                        {patient.contexteMedical || "Aucun contexte renseigné"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border-l-4 border-red-400">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Allergies</p>
                      <p className="text-[10px] text-muted-foreground">
                        {patient.allergies || "Aucune connue"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border-l-4 border-amber-400">
                    <Pill className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Traitement</p>
                      <p className="text-[10px] text-muted-foreground">
                        {patient.traitement || "Aucun traitement en cours"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-950/50 border-l-4 border-pink-400">
                    <Heart className="h-4 w-4 text-pink-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Conditions</p>
                      <p className="text-[10px] text-muted-foreground">
                        {patient.conditions || "Aucune condition signalée"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Sheet open={medicalDialogOpen} onOpenChange={setMedicalDialogOpen}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Contexte médical</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={handleMedicalSubmit} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contexteMedical">Contexte médical</Label>
                      <Textarea
                        id="contexteMedical"
                        value={medicalForm.contexteMedical}
                        onChange={(e) => setMedicalForm({ ...medicalForm, contexteMedical: e.target.value })}
                        placeholder="Antécédents médicaux généraux..."
                        rows={3}
                        data-testid="input-edit-contexte-medical"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Allergies</Label>
                      <Textarea
                        id="allergies"
                        value={medicalForm.allergies}
                        onChange={(e) => setMedicalForm({ ...medicalForm, allergies: e.target.value })}
                        placeholder="Ex: Pénicilline, latex..."
                        rows={2}
                        data-testid="input-edit-allergies"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="traitement">Traitement</Label>
                      <Textarea
                        id="traitement"
                        value={medicalForm.traitement}
                        onChange={(e) => setMedicalForm({ ...medicalForm, traitement: e.target.value })}
                        placeholder="Médicaments en cours..."
                        rows={2}
                        data-testid="input-edit-traitement"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conditions">Conditions</Label>
                      <Textarea
                        id="conditions"
                        value={medicalForm.conditions}
                        onChange={(e) => setMedicalForm({ ...medicalForm, conditions: e.target.value })}
                        placeholder="Diabète, hypertension..."
                        rows={2}
                        data-testid="input-edit-conditions"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setMedicalDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={updateMedicalMutation.isPending} data-testid="button-save-medical">
                        {updateMedicalMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Sheet open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-add-implant">
                        <Activity className="h-4 w-4 text-primary" />
                        Nouvel acte
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Nouvelle opération</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <OperationForm
                          patientId={patient.id}
                          onSuccess={() => setOperationDialogOpen(false)}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Sheet open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
                    <SheetTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-3"
                        data-testid="button-plan-visit"
                      >
                        <Calendar className="h-4 w-4 text-primary" />
                        Planifier une visite
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Nouveau rendez-vous</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <AppointmentForm
                          patientId={patient.id}
                          onSuccess={() => setAppointmentDialogOpen(false)}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Sheet open={radioDialogOpen} onOpenChange={setRadioDialogOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-add-radio">
                        <FileImage className="h-4 w-4 text-primary" />
                        Ajouter une radio
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Ajouter une radiographie</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <RadioUploadForm
                          patientId={patient.id}
                          operations={patient.operations || []}
                          surgeryImplants={patient.surgeryImplants || []}
                          onSuccess={() => setRadioDialogOpen(false)}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Sheet open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-add-document-quick">
                        <FileText className="h-4 w-4 text-primary" />
                        Ajouter un document
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Ajouter un document</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <DocumentUploadForm
                          patientId={patient.id}
                          onSuccess={() => setDocDialogOpen(false)}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  
                  {canDelete && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 text-destructive"
                      onClick={() => setDeletePatientDialogOpen(true)}
                      disabled={!patientId}
                      data-testid="button-delete-patient"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer le patient
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-zinc-900">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Implants</span>
                    </div>
                    <p className="text-2xl font-semibold">{implantCount}</p>
                    <p className="text-xs text-primary">{successRate}% réussite</p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Actes</span>
                    </div>
                    <p className="text-2xl font-semibold">{operationCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {oldestOperationYear ? `Depuis ${oldestOperationYear}` : "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Visites</span>
                    </div>
                    <p className="text-2xl font-semibold">{visiteCount}</p>
                    <p className="text-xs text-muted-foreground">Suivi régulier</p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Radios</span>
                    </div>
                    <p className="text-2xl font-semibold">{radioCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.radios?.filter(r => r.type === "PANORAMIQUE").length || 0} panoramiques
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">Timeline clinique</CardTitle>
                    <Button 
                      variant="ghost" 
                      className="text-primary text-xs p-0 h-auto"
                      onClick={() => setActiveTab("operations")}
                    >
                      Voir tout
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {timelineEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Aucun événement enregistré
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {timelineEvents.slice(0, 4).map((event, index) => {
                        const getEventIcon = () => {
                          switch (event.type) {
                            case "operation":
                              return <Activity className="h-4 w-4 text-orange-500" />;
                            case "radio":
                              return <ImageIcon className="h-4 w-4 text-blue-500" />;
                            case "visite":
                              return <Stethoscope className="h-4 w-4 text-green-500" />;
                            case "rdv":
                              return <Calendar className="h-4 w-4 text-primary" />;
                            case "document":
                              return <FileText className="h-4 w-4 text-purple-500" />;
                          }
                        };
                        const getEventBgColor = () => {
                          switch (event.type) {
                            case "operation":
                              return "bg-orange-100 dark:bg-orange-900/30";
                            case "radio":
                              return "bg-blue-100 dark:bg-blue-900/30";
                            case "visite":
                              return "bg-green-100 dark:bg-green-900/30";
                            case "rdv":
                              return "bg-primary/10";
                            case "document":
                              return "bg-purple-100 dark:bg-purple-900/30";
                          }
                        };
                        return (
                          <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`p-2 rounded-full ${getEventBgColor()}`}>
                                {getEventIcon()}
                              </div>
                              {index < Math.min(timelineEvents.length - 1, 3) && (
                                <div className="flex-1 w-px bg-border mt-2" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-xs">{event.title}</p>
                                  {event.description && event.radioId ? (
                                    <button 
                                      className="text-[10px] text-primary hover:underline mt-0.5 text-left"
                                      onClick={() => setTimelineRadioViewerId(event.radioId!)}
                                      data-testid={`button-view-radio-${event.radioId}`}
                                    >
                                      {event.description}
                                    </button>
                                  ) : event.description && event.documentId ? (
                                    <button 
                                      className="text-[10px] text-primary hover:underline mt-0.5 text-left"
                                      onClick={() => {
                                        setActiveTab("documents");
                                      }}
                                      data-testid={`button-view-document-${event.documentId}`}
                                    >
                                      {event.description}
                                    </button>
                                  ) : event.description ? (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {event.description}
                                    </p>
                                  ) : null}
                                  {event.badges && event.badges.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      {event.badges.map((badge, i) => (
                                        <Badge 
                                          key={i} 
                                          variant="outline" 
                                          className={`text-[10px] ${event.badgeClassName || ""}`}
                                        >
                                          {badge}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDateShort(event.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs font-medium">Implants posés</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        className="text-primary text-[12px] p-0 h-auto"
                        onClick={() => setActiveTab("implants")}
                      >
                        Voir détails
                      </Button>
                      <Dialog open={shareDialogOpen} onOpenChange={(open) => {
                        setShareDialogOpen(open);
                        if (!open) {
                          setNewShareLink(null);
                          setShareExpiryDays(null);
                        }
                      }}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white dark:bg-zinc-900"
                          onClick={() => setShareDialogOpen(true)}
                          data-testid="button-share-patient"
                        >
                          <Share2 className="h-4 w-4 mr-1" />
                          Partager
                        </Button>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Partager les données implants</DialogTitle>
                            <DialogDescription>
                              Créez un lien sécurisé pour partager les informations d'implants de ce patient.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {newShareLink ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={newShareLink} 
                                    readOnly 
                                    className="font-mono text-sm bg-muted"
                                    data-testid="input-share-link"
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="outline" 
                                    onClick={handleCopyLink}
                                    data-testid="button-copy-link"
                                  >
                                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                  </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Ce lien permet à quiconque d'accéder aux données d'implants du patient sans connexion.
                                </p>
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => setNewShareLink(null)}
                                >
                                  Créer un autre lien
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <Label>Expiration du lien</Label>
                                  <Select 
                                    value={shareExpiryDays?.toString() || "never"} 
                                    onValueChange={(v) => setShareExpiryDays(v === "never" ? null : parseInt(v))}
                                  >
                                    <SelectTrigger className="w-full mt-1" data-testid="select-expiry">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="never">Sans expiration</SelectItem>
                                      <SelectItem value="1">1 jour</SelectItem>
                                      <SelectItem value="7">7 jours</SelectItem>
                                      <SelectItem value="30">30 jours</SelectItem>
                                      <SelectItem value="90">90 jours</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button 
                                  className="w-full" 
                                  onClick={() => createShareLinkMutation.mutate(shareExpiryDays)}
                                  disabled={createShareLinkMutation.isPending}
                                  data-testid="button-create-share-link"
                                >
                                  {createShareLinkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Générer un lien de partage
                                </Button>
                              </div>
                            )}

                            {shareLinks.length > 0 && (
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Liens actifs</h4>
                                <div className="space-y-2">
                                  {shareLinks
                                    .filter(l => !l.revokedAt)
                                    .map((link) => (
                                      <div 
                                        key={link.id} 
                                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                                      >
                                        <div className="text-sm">
                                          <p className="text-muted-foreground">
                                            Créé le {new Date(link.createdAt).toLocaleDateString("fr-FR")}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {link.accessCount} accès
                                            {link.expiresAt && ` · Expire le ${new Date(link.expiresAt).toLocaleDateString("fr-FR")}`}
                                          </p>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="text-destructive"
                                          onClick={() => revokeShareLinkMutation.mutate(link.id)}
                                          disabled={revokeShareLinkMutation.isPending}
                                          data-testid={`button-revoke-link-${link.id}`}
                                        >
                                          Révoquer
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Sheet open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
                        <SheetTrigger asChild>
                          <Button size="sm" data-testid="button-new-act">
                            <Plus className="h-4 w-4 mr-1" />
                            Nouvel acte
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Nouvelle opération</SheetTitle>
                          </SheetHeader>
                          <div className="mt-6">
                            <OperationForm
                              patientId={patient.id}
                              onSuccess={() => setOperationDialogOpen(false)}
                            />
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {implantCount === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Aucun implant posé
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patient.surgeryImplants?.slice(0, 4).map((surgeryImplant) => (
                        <div key={surgeryImplant.id} className="border rounded-md p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-xs">Site {surgeryImplant.siteFdi}</span>
                            {getStatusBadge(surgeryImplant.statut)}
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-xs">
                            <div>
                              <span className="text-muted-foreground text-[10px]">Marque:</span>
                              <p>{surgeryImplant.implant.marque}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">Dimensions:</span>
                              <p>{surgeryImplant.implant.diametre} x {surgeryImplant.implant.longueur}mm</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">Date pose:</span>
                              <p>{formatDateShort(surgeryImplant.datePose)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">ISQ actuel:</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-primary font-medium cursor-help underline decoration-dotted">
                                    {surgeryImplant.isq6m || surgeryImplant.isq3m || surgeryImplant.isq2m || surgeryImplant.isqPose || "-"}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px]">
                                  <div className="space-y-1">
                                    <p><span className="text-muted-foreground">Pose:</span> {surgeryImplant.isqPose ?? "-"}</p>
                                    {surgeryImplant.isq2m != null && <p><span className="text-muted-foreground">2 mois:</span> {surgeryImplant.isq2m}</p>}
                                    {surgeryImplant.isq3m != null && <p><span className="text-muted-foreground">3 mois:</span> {surgeryImplant.isq3m}</p>}
                                    {surgeryImplant.isq6m != null && <p><span className="text-muted-foreground">6 mois:</span> {surgeryImplant.isq6m}</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <AuditHistory
                entityType="PATIENT"
                entityId={patient.id}
                title="Historique du patient"
                maxItems={5}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="implants" className="mt-4 space-y-4">
          {implantCount === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun implant</h3>
                <p className="text-xs text-muted-foreground">
                  Les implants seront ajoutés lors de la création d'une opération
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-full">
                    {[
                      { value: "all" as const, label: "Tous" },
                      { value: "IMPLANT" as const, label: "Implants" },
                      { value: "MINI_IMPLANT" as const, label: "Mini-implants" },
                    ].map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setImplantTypeFilter(filter.value)}
                        className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 ${
                          implantTypeFilter === filter.value ? "text-white" : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`button-filter-${filter.value.toLowerCase()}`}
                      >
                        {implantTypeFilter === filter.value && (
                          <motion.div
                            layoutId="implant-type-filter-indicator"
                            className="absolute inset-0 bg-primary rounded-full"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                          />
                        )}
                        <span className="relative z-10">{filter.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {filteredSurgeryImplants.length} implant{filteredSurgeryImplants.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-full">
                  {[
                    { value: "table" as const, icon: LayoutList },
                    { value: "cards" as const, icon: LayoutGrid },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setImplantViewMode(mode.value)}
                      className={`relative p-2 rounded-full transition-colors duration-200 ${
                        implantViewMode === mode.value ? "text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`button-view-${mode.value}`}
                    >
                      {implantViewMode === mode.value && (
                        <motion.div
                          layoutId="implant-view-mode-indicator"
                          className="absolute inset-0 bg-primary rounded-full"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <mode.icon className="h-4 w-4 relative z-10" />
                    </button>
                  ))}
                </div>
              </div>

              {implantViewMode === "table" ? (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-gray bg-border-gray">
                          {implantColumns.map((column) => (
                            <th
                              key={column.id}
                              draggable
                              onDragStart={(e) => handleImplantDragStart(e, column.id)}
                              onDragOver={(e) => handleImplantDragOver(e, column.id)}
                              onDrop={(e) => handleImplantDrop(e, column.id)}
                              onDragEnd={handleImplantDragEnd}
                              className={`px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-move select-none ${column.width || ""} ${dragOverImplantColumn === column.id ? "bg-primary/10" : ""}`}
                            >
                              <div className="flex items-center gap-1">
                                <GripVertical className="h-3 w-3 opacity-40" />
                                {column.sortable ? (
                                  <button
                                    onClick={() => handleImplantSort(column.id)}
                                    className="flex items-center hover:text-foreground transition-colors"
                                    data-testid={`button-sort-${column.id}`}
                                  >
                                    {column.label}
                                    {renderImplantSortIcon(column.id)}
                                  </button>
                                ) : (
                                  <span>{column.label}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortImplants(filteredSurgeryImplants).map((surgeryImplant) => (
                          <tr
                            key={surgeryImplant.id}
                            className="border-b last:border-b-0 hover-elevate cursor-pointer"
                            onClick={() => window.location.href = `/patients/${patient.id}/implants/${surgeryImplant.id}`}
                            data-testid={`row-implant-${surgeryImplant.id}`}
                          >
                            {implantColumns.map((column) => (
                              <td key={column.id} className={`px-4 py-3 ${column.width || ""}`}>
                                {renderImplantCellContent(column.id, surgeryImplant)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSurgeryImplants.map((surgeryImplant) => (
                    <ImplantCard key={surgeryImplant.id} surgeryImplant={surgeryImplant} patientId={patient.id} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="operations" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-operation">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel acte
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Nouvelle opération</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <OperationForm
                    patientId={patient.id}
                    onSuccess={() => setOperationDialogOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {operationCount === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune opération</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ajoutez la première opération pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-lg border border-border-gray overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-gray bg-border-gray">
                      {operationColumns.map((column) => (
                        <th
                          key={column.id}
                          className={`text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${column.width || ""} ${dragOverOperationColumn === column.id ? "bg-primary/10" : ""}`}
                          draggable
                          onDragStart={(e) => handleOperationDragStart(e, column.id)}
                          onDragOver={(e) => handleOperationDragOver(e, column.id)}
                          onDragEnd={handleOperationDragEnd}
                          onDrop={(e) => handleOperationDrop(e, column.id)}
                        >
                          <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-3 w-3 opacity-40" />
                            <button
                              onClick={() => column.sortable && handleOperationSort(column.id)}
                              className="flex items-center hover:text-foreground transition-colors"
                              data-testid={`sort-operation-${column.id}`}
                            >
                              {column.label}
                              {column.sortable && renderOperationSortIcon(column.id)}
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedOperations(patient.operations || []).map((operation) => (
                      <tr
                        key={operation.id}
                        className="border-b border-border-gray/50 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        data-testid={`row-operation-${operation.id}`}
                        onClick={() => {
                          window.location.href = `/patients/${patient.id}/operations/${operation.id}`;
                        }}
                      >
                        {operationColumns.map((column) => (
                          <td key={column.id} className="px-4 py-3">
                            {renderOperationCellContent(column.id, operation)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="radios" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={radioDialogOpen} onOpenChange={setRadioDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-radio">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une radio
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Ajouter une radiographie</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <RadioUploadForm
                    patientId={patient.id}
                    operations={patient.operations || []}
                    surgeryImplants={patient.surgeryImplants || []}
                    onSuccess={() => setRadioDialogOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {radioCount === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune radio</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ajoutez des radiographies pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {patient.radios?.map((radio) => (
                <RadioCard key={radio.id} radio={radio} patientId={patient.id} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={docDialogOpen} onOpenChange={setDocDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-document">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un document
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Ajouter un document</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <DocumentUploadForm
                    patientId={patient.id}
                    onSuccess={() => setDocDialogOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {documentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun document</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ajoutez des documents PDF pour ce patient (devis, consentements, etc.)
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} patientId={patient.id} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits" className="mt-4 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Rendez-vous</h2>
            <Sheet open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-appointment">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau rendez-vous
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-900">
                <SheetHeader>
                  <SheetTitle>Nouveau rendez-vous</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <AppointmentForm
                    patientId={patient.id}
                    onSuccess={() => setAppointmentDialogOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {appointmentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun rendez-vous</h3>
                <p className="text-sm text-muted-foreground">
                  Ajoutez un rendez-vous pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {upcomingAppointments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-muted-foreground">Rendez-vous a venir</h3>
                  <div className="space-y-3">
                    {upcomingAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        patientId={patient.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {completedAppointments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-muted-foreground">Historique</h3>
                  <div className="space-y-3">
                    {completedAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        patientId={patient.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Ajouter une note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["CONSULTATION", "CHIRURGIE", "SUIVI", "COMPLICATION", "ADMINISTRATIVE"] as const).map((tag) => {
                  const config = getTagConfig(tag);
                  return (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`${selectedTag === tag ? config?.className : ""} ${selectedTag === tag ? "ring-2 ring-primary" : ""}`}
                      data-testid={`button-tag-${tag.toLowerCase()}`}
                    >
                      {config?.label}
                    </Button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-content">Note</Label>
                <Textarea
                  id="note-content"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Saisissez votre note ici..."
                  rows={4}
                  className="text-xs placeholder:text-[10px]"
                  data-testid="input-note-content"
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddNote} 
                  disabled={!noteContent.trim() || createNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la note
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Historique</h3>
            {notesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (() => {
              const allImplantFlagsFlat = Object.values(implantFlagsById).flat();
              const allFlags = [...patientFlags, ...allImplantFlagsFlat];
              
              type TimelineItem = 
                | { type: "note"; data: NoteWithUser; date: Date }
                | { type: "flag"; data: Flag; date: Date };
              
              const timelineItems: TimelineItem[] = [
                ...patientNotes.map(note => ({
                  type: "note" as const,
                  data: note,
                  date: new Date(note.createdAt),
                })),
                ...allFlags.map(flag => ({
                  type: "flag" as const,
                  data: flag,
                  date: new Date(flag.createdAt),
                })),
              ].sort((a, b) => b.date.getTime() - a.date.getTime());
              
              if (timelineItems.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-xs text-muted-foreground">
                        Aucune note ou alerte pour ce patient
                      </p>
                    </CardContent>
                  </Card>
                );
              }
              
              const levelConfig: Record<string, { label: string; className: string; bgClassName: string }> = {
                CRITICAL: { label: "Critique", className: "text-red-500", bgClassName: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" },
                WARNING: { label: "Attention", className: "text-orange-500", bgClassName: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800" },
                INFO: { label: "Info", className: "text-blue-500", bgClassName: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" },
              };
              
              return (
                <div className="space-y-4">
                  {timelineItems.map((item, idx) => {
                    if (item.type === "note") {
                      const note = item.data;
                      const tagConfig = getTagConfig(note.tag as any);
                      const authorName = note.user.prenom && note.user.nom 
                        ? `${note.user.prenom.charAt(0)}. ${note.user.nom}`
                        : note.user.nom || "Utilisateur";
                      
                      return (
                        <Card key={`note-${note.id}`} data-testid={`card-note-${note.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-[10px]">{authorName}</span>
                                  {tagConfig && (
                                    <Badge variant="secondary" className={`text-[9px] ${tagConfig.className}`}>
                                      {tagConfig.label}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[9px] text-muted-foreground mb-2">
                                  {formatNoteDatetime(note.createdAt)}
                                </p>
                                <p className="text-[10px] text-foreground whitespace-pre-wrap">
                                  {note.contenu}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-note-menu-${note.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900">
                                  <DropdownMenuItem onClick={() => setEditingNote(note)} data-testid={`button-edit-note-${note.id}`}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <DropdownMenuItem 
                                      onClick={() => setDeleteNoteId(note.id)} 
                                      className="text-destructive"
                                      data-testid={`button-delete-note-${note.id}`}
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
                      );
                    } else {
                      const flag = item.data;
                      const config = levelConfig[flag.level] || levelConfig.INFO;
                      
                      return (
                        <Card key={`flag-${flag.id}`} className={`border ${config.bgClassName}`} data-testid={`card-flag-${flag.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={`h-4 w-4 mt-0.5 ${config.className}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                    Alerte
                                  </Badge>
                                  <Badge variant="secondary" className={`text-xs ${
                                    flag.level === "CRITICAL" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" :
                                    flag.level === "WARNING" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200" :
                                    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                                  }`}>
                                    {config.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {formatNoteDatetime(flag.createdAt)}
                                </p>
                                <p className="font-medium text-xs">{flag.label}</p>
                                {flag.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }
                  })}
                </div>
              );
            })()}
          </div>

          <Sheet open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-900">
              <SheetHeader>
                <SheetTitle>Modifier la note</SheetTitle>
              </SheetHeader>
              {editingNote && (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(["CONSULTATION", "CHIRURGIE", "SUIVI", "COMPLICATION", "ADMINISTRATIVE"] as const).map((tag) => {
                      const config = getTagConfig(tag);
                      return (
                        <Button
                          key={tag}
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNote({ ...editingNote, tag: editingNote.tag === tag ? null : tag })}
                          className={`${editingNote.tag === tag ? config?.className : ""} ${editingNote.tag === tag ? "ring-2 ring-primary" : ""}`}
                        >
                          {config?.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-note-content">Note</Label>
                    <Textarea
                      id="edit-note-content"
                      value={editingNote.contenu}
                      onChange={(e) => setEditingNote({ ...editingNote, contenu: e.target.value })}
                      rows={6}
                      data-testid="input-edit-note-content"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setEditingNote(null)}>
                      Annuler
                    </Button>
                    <Button onClick={handleUpdateNote} disabled={updateNoteMutation.isPending} data-testid="button-save-note">
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer la note</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)}
                  className="bg-primary text-primary-foreground"
                  data-testid="button-confirm-delete-note"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>

      {/* Dialog aperçu radio depuis timeline */}
      <Dialog open={!!timelineRadioViewerId} onOpenChange={(open) => !open && setTimelineRadioViewerId(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          {(() => {
            const radio = patient.radios?.find(r => r.id === timelineRadioViewerId);
            if (!radio) return null;
            return (
              <>
                <DialogHeader className="p-4 border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <DialogTitle className="flex items-center gap-2">
                        <span>{radio.title || getRadioLabel(radio.type)}</span>
                        <Badge variant="secondary">{getRadioLabel(radio.type)}</Badge>
                      </DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        {formatDateShort(new Date(radio.date))}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-auto bg-black/90 flex items-center justify-center min-h-[60vh]">
                  {(radio as any).signedUrl || radio.url ? (
                    <img
                      src={(radio as any).signedUrl || radio.url}
                      alt={radio.title || getRadioLabel(radio.type)}
                      className="max-w-full max-h-[80vh] object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center">
                      <FileImage className="h-24 w-24 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation suppression patient */}
      <AlertDialog open={deletePatientDialogOpen} onOpenChange={setDeletePatientDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce patient ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées au patient seront définitivement supprimées : actes chirurgicaux, implants, rendez-vous, radiographies, documents et notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-patient">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePatientMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
              disabled={deletePatientMutation.isPending || !patientId}
              data-testid="button-confirm-delete-patient"
            >
              {deletePatientMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
