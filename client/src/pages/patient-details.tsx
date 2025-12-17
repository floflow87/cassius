import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Phone,
  Mail,
  User,
  Activity,
  FileImage,
  ClipboardList,
  Pencil,
  AlertTriangle,
  Pill,
  Heart,
  CheckCircle,
  Image as ImageIcon,
  Stethoscope,
  MapPin,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { OperationForm } from "@/components/operation-form";
import { ImplantCard } from "@/components/implant-card";
import { RadioCard } from "@/components/radio-card";
import { RadioUploadForm } from "@/components/radio-upload-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Patient, Operation, Implant, Radio, Visite, Note, RendezVous } from "@shared/schema";

interface PatientWithDetails extends Patient {
  operations: (Operation & { implants: Implant[] })[];
  implants: (Implant & { visites: Visite[] })[];
  radios: Radio[];
}

export default function PatientDetailsPage() {
  const [, params] = useRoute("/patients/:id");
  const patientId = params?.id;
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [radioDialogOpen, setRadioDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: patient, isLoading } = useQuery<PatientWithDetails>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    dateNaissance: "",
    sexe: "HOMME" as "HOMME" | "FEMME",
    telephone: "",
    email: "",
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
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      SUCCES: { label: "Succès", variant: "default" },
      EN_SUIVI: { label: "En suivi", variant: "secondary" },
      COMPLICATION: { label: "Complication", variant: "outline" },
      ECHEC: { label: "Echec", variant: "destructive" },
    };
    const config = statusConfig[statut] || statusConfig.EN_SUIVI;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRadioLabel = (type: string) => {
    const labels: Record<string, string> = {
      PANORAMIQUE: "Radiographie panoramique",
      CBCT: "CBCT",
      RETROALVEOLAIRE: "Rétro-alvéolaire",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Patient non trouvé</h3>
            <Link href="/patients">
              <Button variant="outline">Retour à la liste</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const implantCount = patient.implants?.length || 0;
  const operationCount = patient.operations?.length || 0;
  const radioCount = patient.radios?.length || 0;
  const visiteCount = patient.implants?.reduce((acc, imp) => acc + (imp.visites?.length || 0), 0) || 0;

  const sortedOperations = [...(patient.operations || [])].sort(
    (a, b) => new Date(b.dateOperation).getTime() - new Date(a.dateOperation).getTime()
  );

  interface TimelineEvent {
    id: string;
    date: Date;
    type: "operation" | "radio" | "visite" | "rdv";
    title: string;
    description?: string;
    badges?: string[];
    badgeClassName?: string;
    radioId?: string;
  }

  const timelineEvents: TimelineEvent[] = [];

  sortedOperations.forEach((op) => {
    timelineEvents.push({
      id: `op-${op.id}`,
      date: new Date(op.dateOperation),
      type: "operation",
      title: getInterventionLabel(op.typeIntervention),
      description: op.notesPerop || `${op.implants?.length || 0} implant(s)`,
      badges: op.implants?.slice(0, 3).map(imp => `Site ${imp.siteFdi}`),
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

  patient.implants?.forEach((imp) => {
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

  // Ajouter les rendez-vous passés à la timeline
  patientRdvs.forEach((rdv) => {
    const rdvDate = new Date(rdv.date);
    // Seulement les rendez-vous passés
    if (rdvDate < today) {
      const tagConfig = getRdvTagConfig(rdv.tag as RdvTag);
      timelineEvents.push({
        id: `rdv-${rdv.id}`,
        date: rdvDate,
        type: "rdv",
        title: rdv.titre,
        description: rdv.description || tagConfig.label,
        badges: [tagConfig.label],
        badgeClassName: tagConfig.className,
      });
    }
  });

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const oldestOperationYear = sortedOperations.length > 0
    ? new Date(sortedOperations[sortedOperations.length - 1].dateOperation).getFullYear()
    : null;

  const successRate = implantCount > 0 
    ? Math.round((patient.implants?.filter(i => i.statut === "SUCCES").length || 0) / implantCount * 100)
    : 0;

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
            <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-patient-status">
              Actif
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {calculateAge(patient.dateNaissance)} ans - Depuis {new Date(patient.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent p-0 h-auto gap-6 border-b-0">
          <TabsTrigger 
            value="overview" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-overview"
          >
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger 
            value="implants" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-implants"
          >
            Implants ({implantCount})
          </TabsTrigger>
          <TabsTrigger 
            value="operations" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-operations"
          >
            Actes chirurgicaux
          </TabsTrigger>
          <TabsTrigger 
            value="radios" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-radios"
          >
            Radiographies
          </TabsTrigger>
          <TabsTrigger 
            value="visits" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-visits"
          >
            Suivi & Visites
          </TabsTrigger>
          <TabsTrigger 
            value="notes" 
            className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2" 
            data-testid="tab-notes"
          >
            Notes
          </TabsTrigger>
        </TabsList>

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
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Nom complet</span>
                    <p className="font-medium">{patient.prenom} {patient.nom}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Date de naissance</span>
                    <p>{formatDate(patient.dateNaissance)} ({calculateAge(patient.dateNaissance)} ans)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Sexe</span>
                    <p>{patient.sexe === "HOMME" ? "Homme" : "Femme"}</p>
                  </div>
                  {patient.telephone && (
                    <div>
                      <span className="text-muted-foreground text-xs">Téléphone</span>
                      <p>{patient.telephone}</p>
                    </div>
                  )}
                  {patient.email && (
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p>{patient.email}</p>
                    </div>
                  )}
                  {(patient.adresse || patient.codePostal || patient.ville || patient.pays) && (
                    <div>
                      <span className="text-muted-foreground text-xs">Adresse</span>
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
                    <span className="text-muted-foreground text-xs">Patient depuis le</span>
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
                      <p className="text-sm font-medium">Contexte médical</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.contexteMedical || "Aucun contexte renseigné"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border-l-4 border-red-400">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Allergies</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.allergies || "Aucune connue"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border-l-4 border-amber-400">
                    <Pill className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Traitement</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.traitement || "Aucun traitement en cours"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-950/50 border-l-4 border-pink-400">
                    <Heart className="h-4 w-4 text-pink-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Conditions</p>
                      <p className="text-xs text-muted-foreground">
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
                        Ajouter un implant
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
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Enregistrer un acte
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    Planifier une visite
                  </Button>
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
                          implants={patient.implants || []}
                          onSuccess={() => setRadioDialogOpen(false)}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
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
                      className="text-primary text-sm p-0 h-auto"
                      onClick={() => setActiveTab("operations")}
                    >
                      Voir tout
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {timelineEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
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
                                  <p className="font-medium text-sm">{event.title}</p>
                                  {event.description && event.radioId ? (
                                    <button 
                                      className="text-xs text-primary hover:underline mt-0.5 text-left"
                                      onClick={() => setTimelineRadioViewerId(event.radioId!)}
                                      data-testid={`button-view-radio-${event.radioId}`}
                                    >
                                      {event.description}
                                    </button>
                                  ) : event.description ? (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {event.description}
                                    </p>
                                  ) : null}
                                  {event.badges && event.badges.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      {event.badges.map((badge, i) => (
                                        <Badge 
                                          key={i} 
                                          variant="outline" 
                                          className={`text-xs ${event.badgeClassName || ""}`}
                                        >
                                          {badge}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
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
                    <CardTitle className="text-base font-medium">Implants posés</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        className="text-primary text-sm p-0 h-auto"
                        onClick={() => setActiveTab("implants")}
                      >
                        Voir détails
                      </Button>
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
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Aucun implant posé
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patient.implants?.slice(0, 4).map((implant) => (
                        <div key={implant.id} className="border rounded-md p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium">Site {implant.siteFdi}</span>
                            {getStatusBadge(implant.statut)}
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Marque:</span>
                              <p>{implant.marque}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Dimensions:</span>
                              <p>{implant.diametre} x {implant.longueur}mm</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Date pose:</span>
                              <p>{formatDateShort(implant.datePose)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">ISQ actuel:</span>
                              <p className="text-primary font-medium">
                                {implant.isq6m || implant.isq3m || implant.isq2m || implant.isqPose || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="implants" className="mt-4 space-y-4">
          {implantCount === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun implant</h3>
                <p className="text-sm text-muted-foreground">
                  Les implants seront ajoutés lors de la création d'une opération
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patient.implants?.map((implant) => (
                <ImplantCard key={implant.id} implant={implant} patientId={patient.id} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="operations" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-operation">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle opération
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
                <p className="text-sm text-muted-foreground mb-4">
                  Ajoutez la première opération pour ce patient
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {patient.operations?.map((operation) => (
                <Card key={operation.id} data-testid={`card-operation-${operation.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {getInterventionLabel(operation.typeIntervention)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(operation.dateOperation)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {operation.implants?.length || 0} implant{(operation.implants?.length || 0) !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {operation.typeChirurgieTemps && (
                        <div>
                          <span className="text-muted-foreground">Temps: </span>
                          {operation.typeChirurgieTemps === "UN_TEMPS" ? "1 temps" : "2 temps"}
                        </div>
                      )}
                      {operation.typeChirurgieApproche && (
                        <div>
                          <span className="text-muted-foreground">Approche: </span>
                          {operation.typeChirurgieApproche === "LAMBEAU" ? "Lambeau" : "Flapless"}
                        </div>
                      )}
                      {operation.typeMiseEnCharge && (
                        <div>
                          <span className="text-muted-foreground">Mise en charge: </span>
                          {operation.typeMiseEnCharge.charAt(0) + operation.typeMiseEnCharge.slice(1).toLowerCase()}
                        </div>
                      )}
                      {operation.greffeOsseuse && (
                        <div>
                          <span className="text-muted-foreground">Greffe: </span>
                          {operation.typeGreffe || "Oui"}
                        </div>
                      )}
                    </div>
                    {operation.notesPerop && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Notes per-op</p>
                        <p className="text-sm">{operation.notesPerop}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
                    implants={patient.implants || []}
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
                <p className="text-sm text-muted-foreground mb-4">
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

        <TabsContent value="visits" className="mt-4 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Suivi & Visites</h2>
            <Sheet open={rdvDialogOpen} onOpenChange={setRdvDialogOpen}>
              <SheetTrigger asChild>
                <Button data-testid="button-new-rdv">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau rendez-vous
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-900">
                <SheetHeader>
                  <SheetTitle>Nouveau rendez-vous</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rdv-titre">Titre</Label>
                    <Input
                      id="rdv-titre"
                      value={rdvForm.titre}
                      onChange={(e) => setRdvForm({ ...rdvForm, titre: e.target.value })}
                      placeholder="Ex: Consultation pré-opératoire"
                      data-testid="input-rdv-titre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rdv-date">Date</Label>
                    <Input
                      id="rdv-date"
                      type="date"
                      value={rdvForm.date}
                      onChange={(e) => setRdvForm({ ...rdvForm, date: e.target.value })}
                      data-testid="input-rdv-date"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rdv-heure-debut">Heure début</Label>
                      <Input
                        id="rdv-heure-debut"
                        type="time"
                        value={rdvForm.heureDebut}
                        onChange={(e) => setRdvForm({ ...rdvForm, heureDebut: e.target.value })}
                        data-testid="input-rdv-heure-debut"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rdv-heure-fin">Heure fin</Label>
                      <Input
                        id="rdv-heure-fin"
                        type="time"
                        value={rdvForm.heureFin}
                        onChange={(e) => setRdvForm({ ...rdvForm, heureFin: e.target.value })}
                        data-testid="input-rdv-heure-fin"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["CONSULTATION", "SUIVI", "CHIRURGIE"] as const).map((tag) => {
                        const config = getRdvTagConfig(tag);
                        return (
                          <Button
                            key={tag}
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setRdvForm({ ...rdvForm, tag })}
                            className={rdvForm.tag === tag ? `${config.className} ring-2 ring-primary` : ""}
                            data-testid={`button-rdv-tag-${tag.toLowerCase()}`}
                          >
                            {config.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rdv-description">Description (optionnelle)</Label>
                    <Textarea
                      id="rdv-description"
                      value={rdvForm.description}
                      onChange={(e) => setRdvForm({ ...rdvForm, description: e.target.value })}
                      placeholder="Informations complémentaires..."
                      rows={3}
                      data-testid="input-rdv-description"
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => createRdvMutation.mutate(rdvForm)}
                      disabled={!rdvForm.titre.trim() || !rdvForm.date || createRdvMutation.isPending}
                      data-testid="button-submit-rdv"
                    >
                      Créer le rendez-vous
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {rdvsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : patientRdvs.length === 0 ? (
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
              {upcomingRdvs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-muted-foreground">Rendez-vous à venir</h3>
                  {upcomingRdvs.map((rdv) => {
                    const tagConfig = getRdvTagConfig(rdv.tag as RdvTag);
                    return (
                      <div
                        key={rdv.id}
                        className={`bg-card rounded-md p-4 border-l-4 ${tagConfig.borderColor} border border-border`}
                        data-testid={`card-rdv-upcoming-${rdv.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm">{rdv.titre}</span>
                              <Badge variant="secondary" className={`text-xs ${tagConfig.className}`}>
                                {tagConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {formatRdvDate(rdv.date)} - {rdv.heureDebut} à {rdv.heureFin}
                            </p>
                            {rdv.description && (
                              <p className="text-sm text-muted-foreground mt-2">{rdv.description}</p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-rdv-menu-${rdv.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900">
                              <DropdownMenuItem onClick={() => setEditingRdv(rdv)} data-testid={`button-edit-rdv-${rdv.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteRdvId(rdv.id)} className="text-destructive" data-testid={`button-delete-rdv-${rdv.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {pastRdvs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-muted-foreground">Historique</h3>
                  {pastRdvs.map((rdv) => {
                    const tagConfig = getRdvTagConfig(rdv.tag as RdvTag);
                    return (
                      <div
                        key={rdv.id}
                        className="bg-muted/50 rounded-md p-4 border border-border"
                        data-testid={`card-rdv-past-${rdv.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm text-muted-foreground">{rdv.titre}</span>
                              <Badge variant="secondary" className={`text-xs ${tagConfig.className}`}>
                                {tagConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {formatRdvDate(rdv.date)} - {rdv.heureDebut} à {rdv.heureFin}
                            </p>
                            {rdv.description && (
                              <p className="text-sm text-muted-foreground mt-2">{rdv.description}</p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-rdv-menu-${rdv.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900">
                              <DropdownMenuItem onClick={() => setEditingRdv(rdv)} data-testid={`button-edit-rdv-${rdv.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteRdvId(rdv.id)} className="text-destructive" data-testid={`button-delete-rdv-${rdv.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <Sheet open={!!editingRdv} onOpenChange={(open) => !open && setEditingRdv(null)}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-900">
              <SheetHeader>
                <SheetTitle>Modifier le rendez-vous</SheetTitle>
              </SheetHeader>
              {editingRdv && (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-rdv-titre">Titre</Label>
                    <Input
                      id="edit-rdv-titre"
                      value={editingRdv.titre}
                      onChange={(e) => setEditingRdv({ ...editingRdv, titre: e.target.value })}
                      data-testid="input-edit-rdv-titre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-rdv-date">Date</Label>
                    <Input
                      id="edit-rdv-date"
                      type="date"
                      value={editingRdv.date}
                      onChange={(e) => setEditingRdv({ ...editingRdv, date: e.target.value })}
                      data-testid="input-edit-rdv-date"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-rdv-heure-debut">Heure début</Label>
                      <Input
                        id="edit-rdv-heure-debut"
                        type="time"
                        value={editingRdv.heureDebut}
                        onChange={(e) => setEditingRdv({ ...editingRdv, heureDebut: e.target.value })}
                        data-testid="input-edit-rdv-heure-debut"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-rdv-heure-fin">Heure fin</Label>
                      <Input
                        id="edit-rdv-heure-fin"
                        type="time"
                        value={editingRdv.heureFin}
                        onChange={(e) => setEditingRdv({ ...editingRdv, heureFin: e.target.value })}
                        data-testid="input-edit-rdv-heure-fin"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["CONSULTATION", "SUIVI", "CHIRURGIE"] as const).map((tag) => {
                        const config = getRdvTagConfig(tag);
                        return (
                          <Button
                            key={tag}
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setEditingRdv({ ...editingRdv, tag })}
                            className={editingRdv.tag === tag ? `${config.className} ring-2 ring-primary` : ""}
                            data-testid={`button-edit-rdv-tag-${tag.toLowerCase()}`}
                          >
                            {config.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-rdv-description">Description (optionnelle)</Label>
                    <Textarea
                      id="edit-rdv-description"
                      value={editingRdv.description || ""}
                      onChange={(e) => setEditingRdv({ ...editingRdv, description: e.target.value })}
                      rows={3}
                      data-testid="input-edit-rdv-description"
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => updateRdvMutation.mutate({
                        id: editingRdv.id,
                        titre: editingRdv.titre,
                        description: editingRdv.description || "",
                        date: editingRdv.date,
                        heureDebut: editingRdv.heureDebut,
                        heureFin: editingRdv.heureFin,
                        tag: editingRdv.tag as RdvTag,
                      })}
                      disabled={!editingRdv.titre.trim() || !editingRdv.date || updateRdvMutation.isPending}
                      data-testid="button-update-rdv"
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <AlertDialog open={!!deleteRdvId} onOpenChange={(open) => !open && setDeleteRdvId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le rendez-vous ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Le rendez-vous sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete-rdv">Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteRdvId && deleteRdvMutation.mutate(deleteRdvId)}
                  className="bg-primary text-primary-foreground"
                  data-testid="button-confirm-delete-rdv"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
            <h3 className="text-base font-semibold">Historique des notes</h3>
            {notesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : patientNotes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Aucune note pour ce patient
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {patientNotes.map((note) => {
                  const tagConfig = getTagConfig(note.tag as any);
                  const authorName = note.user.prenom && note.user.nom 
                    ? `${note.user.prenom.charAt(0)}. ${note.user.nom}`
                    : note.user.nom || "Utilisateur";
                  
                  return (
                    <Card key={note.id} data-testid={`card-note-${note.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{authorName}</span>
                              {tagConfig && (
                                <Badge variant="secondary" className={`text-xs ${tagConfig.className}`}>
                                  {tagConfig.label}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {formatNoteDatetime(note.createdAt)}
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
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
                              <DropdownMenuItem 
                                onClick={() => setDeleteNoteId(note.id)} 
                                className="text-destructive"
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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
    </div>
  );
}
