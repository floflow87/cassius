import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lightbulb, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StatusSuggestion {
  status: "SUCCES" | "COMPLICATION" | "ECHEC";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rule: string;
  reasonCode?: string;
}

interface SuggestionsResponse {
  implantId: string;
  currentStatus: string;
  latestIsq: number | null;
  isqHistory: {
    pose: number | null;
    m2: number | null;
    m3: number | null;
    m6: number | null;
  };
  suggestions: StatusSuggestion[];
}

interface StatusReason {
  id: string;
  organisationId: string | null;
  status: string;
  code: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
}

interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reasonId: string | null;
  reasonFreeText: string | null;
  evidence: string | null;
  changedAt: Date;
  reasonLabel: string | null;
  reasonCode: string | null;
  changedByNom: string | null;
  changedByPrenom: string | null;
}

interface ImplantStatusSuggestionsProps {
  implantId: string;
  currentStatus: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "echec" | "complication" | "ensuivi"; icon: typeof CheckCircle2 }> = {
  EN_SUIVI: { label: "En suivi", variant: "ensuivi", icon: History },
  SUCCES: { label: "Succes", variant: "default", icon: CheckCircle2 },
  COMPLICATION: { label: "Complication", variant: "complication", icon: AlertTriangle },
  ECHEC: { label: "Echec", variant: "echec", icon: XCircle },
};

const confidenceConfig: Record<string, { label: string; className: string }> = {
  HIGH: { label: "Confiance elevee", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  MEDIUM: { label: "Confiance moyenne", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  LOW: { label: "Confiance faible", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function ImplantStatusSuggestions({ implantId, currentStatus }: ImplantStatusSuggestionsProps) {
  const { toast } = useToast();
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<StatusSuggestion | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string>("");
  const [freeTextReason, setFreeTextReason] = useState("");
  const [evidence, setEvidence] = useState("");

  const suggestionsQuery = useQuery<SuggestionsResponse>({
    queryKey: ["/api/surgery-implants", implantId, "status-suggestions"],
    queryFn: async () => {
      const res = await fetch(`/api/surgery-implants/${implantId}/status-suggestions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      return res.json();
    },
  });

  const reasonsQuery = useQuery<StatusReason[]>({
    queryKey: ["/api/status-reasons", selectedSuggestion?.status],
    queryFn: async () => {
      const url = selectedSuggestion?.status 
        ? `/api/status-reasons?status=${selectedSuggestion.status}`
        : "/api/status-reasons";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reasons");
      return res.json();
    },
    enabled: !!selectedSuggestion,
  });

  const historyQuery = useQuery<StatusHistoryEntry[]>({
    queryKey: ["/api/surgery-implants", implantId, "status-history"],
    queryFn: async () => {
      const res = await fetch(`/api/surgery-implants/${implantId}/status-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: historySheetOpen,
  });

  const applyStatusMutation = useMutation({
    mutationFn: async (data: { toStatus: string; fromStatus: string; reasonId?: string; reasonFreeText?: string; evidence?: string }) => {
      const res = await apiRequest("POST", `/api/surgery-implants/${implantId}/status`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId, "status-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants", implantId, "status-history"] });
      toast({ title: "Statut mis a jour", variant: "success" });
      setApplyDialogOpen(false);
      setSelectedSuggestion(null);
      setSelectedReasonId("");
      setFreeTextReason("");
      setEvidence("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le statut.", variant: "destructive" });
    },
  });

  const handleApplySuggestion = (suggestion: StatusSuggestion) => {
    setSelectedSuggestion(suggestion);
    setSelectedReasonId("");
    setFreeTextReason("");
    setEvidence(suggestion.rule);
    setApplyDialogOpen(true);
  };

  const handleConfirmApply = () => {
    if (!selectedSuggestion) return;
    applyStatusMutation.mutate({
      toStatus: selectedSuggestion.status,
      fromStatus: currentStatus,
      reasonId: selectedReasonId || undefined,
      reasonFreeText: freeTextReason || undefined,
      evidence: evidence || undefined,
    });
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const suggestions = suggestionsQuery.data?.suggestions || [];
  const hasSuggestions = suggestions.length > 0;

  return (
    <>
      {/* Inline section - no Card wrapper for embedding in ISQ section */}
      <div className="mt-4 pt-4 border-t space-y-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="status-suggestions-section">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Suggestions de statut</span>
          {suggestionsQuery.data?.latestIsq && (
            <span className="text-xs text-muted-foreground">
              (ISQ: {suggestionsQuery.data.latestIsq})
            </span>
          )}
        </div>
        
        {suggestionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSuggestions ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Aucune suggestion pour le moment
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {suggestions.map((suggestion, index) => {
              const config = statusConfig[suggestion.status] || statusConfig.EN_SUIVI;
              const confidenceConf = confidenceConfig[suggestion.confidence] || confidenceConfig.LOW;

              return (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-3 rounded-lg border bg-card shadow-sm"
                  data-testid={`suggestion-${suggestion.status}-${index}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${confidenceConf.className}`}>
                      {confidenceConf.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">{suggestion.rule}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleApplySuggestion(suggestion)}
                    data-testid={`button-apply-suggestion-${index}`}
                  >
                    Appliquer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Changer le statut de l'implant</SheetTitle>
            <SheetDescription>
              {selectedSuggestion && (
                <span className="flex items-center gap-2 mt-1">
                  <Badge variant={statusConfig[currentStatus]?.variant || "secondary"}>
                    {statusConfig[currentStatus]?.label || currentStatus}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant={statusConfig[selectedSuggestion.status]?.variant || "secondary"}>
                    {statusConfig[selectedSuggestion.status]?.label || selectedSuggestion.status}
                  </Badge>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            {selectedSuggestion?.rule && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Raison suggérée:</p>
                <p className="text-sm font-medium mt-1">{selectedSuggestion.rule}</p>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label>Motif</Label>
              {reasonsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des motifs...
                </div>
              ) : reasonsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Aucun motif prédéfini disponible
                </p>
              ) : (
                <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                  <SelectTrigger data-testid="select-status-reason">
                    <SelectValue placeholder="Sélectionner un motif (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonsQuery.data?.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.label}
                        {reason.isSystem && <Badge variant="outline" className="ml-2 text-[10px]">Système</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Motif personnalisé (optionnel)</Label>
              <Textarea
                value={freeTextReason}
                onChange={(e) => setFreeTextReason(e.target.value)}
                placeholder="Ajouter un commentaire libre..."
                className="min-h-[80px]"
                data-testid="textarea-free-text-reason"
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence / justification</Label>
              <Textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Evidence clinique justifiant ce changement..."
                className="min-h-[80px]"
                data-testid="textarea-evidence"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setApplyDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmApply}
              disabled={applyStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {applyStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Historique des statuts</SheetTitle>
            <SheetDescription>
              Tous les changements de statut pour cet implant
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-150px)] mt-4">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !historyQuery.data?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun changement de statut enregistre
              </p>
            ) : (
              <div className="space-y-4">
                {historyQuery.data.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {entry.fromStatus && (
                          <>
                            <Badge variant={statusConfig[entry.fromStatus]?.variant || "secondary"}>
                              {statusConfig[entry.fromStatus]?.label || entry.fromStatus}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </>
                        )}
                        <Badge variant={statusConfig[entry.toStatus]?.variant || "secondary"}>
                          {statusConfig[entry.toStatus]?.label || entry.toStatus}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.changedAt)}
                      </span>
                    </div>
                    {(entry.reasonLabel || entry.reasonFreeText) && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Motif: </span>
                        {entry.reasonLabel || entry.reasonFreeText}
                      </div>
                    )}
                    {entry.evidence && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Evidence: </span>
                        {entry.evidence}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Par {entry.changedByPrenom} {entry.changedByNom}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
