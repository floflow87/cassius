import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lightbulb, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  EN_SUIVI: { label: "En suivi", variant: "secondary", icon: History },
  SUCCES: { label: "Succes", variant: "default", icon: CheckCircle2 },
  COMPLICATION: { label: "Complication", variant: "outline", icon: AlertTriangle },
  ECHEC: { label: "Echec", variant: "destructive", icon: XCircle },
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Suggestions de statut
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistorySheetOpen(true)}
            data-testid="button-view-status-history"
          >
            <History className="h-4 w-4 mr-1" />
            Historique
          </Button>
        </CardHeader>
        <CardContent>
          {suggestionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSuggestions ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                Aucune suggestion de changement de statut pour le moment.
              </p>
              {suggestionsQuery.data?.latestIsq && (
                <p className="text-xs text-muted-foreground mt-2">
                  Dernier ISQ: {suggestionsQuery.data.latestIsq}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => {
                const config = statusConfig[suggestion.status] || statusConfig.EN_SUIVI;
                const confidenceConf = confidenceConfig[suggestion.confidence] || confidenceConfig.LOW;
                const Icon = config.icon;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    data-testid={`suggestion-${suggestion.status}-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        suggestion.status === "SUCCES" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                        suggestion.status === "COMPLICATION" ? "bg-amber-100 dark:bg-amber-900/30" :
                        "bg-red-100 dark:bg-red-900/30"
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          suggestion.status === "SUCCES" ? "text-emerald-600 dark:text-emerald-400" :
                          suggestion.status === "COMPLICATION" ? "text-amber-600 dark:text-amber-400" :
                          "text-red-600 dark:text-red-400"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          <Badge variant="outline" className={confidenceConf.className}>
                            {confidenceConf.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.rule}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplySuggestion(suggestion)}
                      data-testid={`button-apply-suggestion-${index}`}
                    >
                      Appliquer
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                );
              })}
              {suggestionsQuery.data?.latestIsq !== null && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Base sur ISQ actuel: {suggestionsQuery.data?.latestIsq}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut de l'implant</DialogTitle>
            <DialogDescription>
              {selectedSuggestion && (
                <>
                  Passer de{" "}
                  <Badge variant={statusConfig[currentStatus]?.variant || "secondary"}>
                    {statusConfig[currentStatus]?.label || currentStatus}
                  </Badge>{" "}
                  a{" "}
                  <Badge variant={statusConfig[selectedSuggestion.status]?.variant || "secondary"}>
                    {statusConfig[selectedSuggestion.status]?.label || selectedSuggestion.status}
                  </Badge>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motif</Label>
              <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                <SelectTrigger data-testid="select-status-reason">
                  <SelectValue placeholder="Selectionner un motif (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {reasonsQuery.data?.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                      {reason.isSystem && <span className="text-muted-foreground ml-1">(systeme)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Motif personnalise (optionnel)</Label>
              <Textarea
                value={freeTextReason}
                onChange={(e) => setFreeTextReason(e.target.value)}
                placeholder="Ajouter un commentaire libre..."
                className="min-h-[60px]"
                data-testid="textarea-free-text-reason"
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence / justification</Label>
              <Textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Evidence clinique justifiant ce changement..."
                className="min-h-[60px]"
                data-testid="textarea-evidence"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmApply}
              disabled={applyStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {applyStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
