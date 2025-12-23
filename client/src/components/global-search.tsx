import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, User, Stethoscope, Activity, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { GlobalSearchResults, TypeIntervention } from "@shared/types";

const TYPE_INTERVENTION_LABELS: Record<TypeIntervention, string> = {
  POSE_IMPLANT: "Pose d'implant",
  GREFFE_OSSEUSE: "Greffe osseuse",
  SINUS_LIFT: "Sinus lift",
  EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + implant immédiat",
  REPRISE_IMPLANT: "Reprise d'implant",
  CHIRURGIE_GUIDEE: "Chirurgie guidée",
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getBirthYear(dateStr: string): string {
  try {
    return new Date(dateStr).getFullYear().toString();
  } catch {
    return "";
  }
}

interface GlobalSearchProps {
  className?: string;
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Fetch search results
  const { data: results, isLoading } = useQuery<GlobalSearchResults>({
    queryKey: ["/api/search", { q: debouncedQuery }],
    enabled: debouncedQuery.length >= 2,
  });

  // Build flat list of all results for keyboard navigation with precomputed indices
  const flatResults = useMemo(() => {
    if (!results) return [];
    const items: { type: "patient" | "acte" | "implant" | "document"; data: any; idx: number }[] = [];
    let idx = 0;
    
    results.patients.forEach(p => items.push({ type: "patient", data: p, idx: idx++ }));
    results.actes.forEach(a => items.push({ type: "acte", data: a, idx: idx++ }));
    results.implants.forEach(i => items.push({ type: "implant", data: i, idx: idx++ }));
    results.documents.forEach(d => items.push({ type: "document", data: d, idx: idx++ }));
    
    return items;
  }, [results]);

  const hasResults = flatResults.length > 0;
  
  // Build index maps for rendering
  const indexMaps = useMemo(() => {
    const patientIndices: Record<string, number> = {};
    const acteIndices: Record<string, number> = {};
    const implantIndices: Record<string, number> = {};
    const documentIndices: Record<string, number> = {};
    
    for (const item of flatResults) {
      if (item.type === "patient") patientIndices[item.data.id] = item.idx;
      else if (item.type === "acte") acteIndices[item.data.id] = item.idx;
      else if (item.type === "implant") implantIndices[item.data.id] = item.idx;
      else if (item.type === "document") documentIndices[item.data.id] = item.idx;
    }
    
    return { patientIndices, acteIndices, implantIndices, documentIndices };
  }, [flatResults]);

  // Navigate to result
  const navigateTo = useCallback((type: string, data: any) => {
    setIsOpen(false);
    switch (type) {
      case "patient":
        setLocation(`/patients/${data.id}`);
        break;
      case "acte":
        setLocation(`/actes/${data.id}`);
        break;
      case "implant":
        setLocation(`/patients/${data.patientId}/implants/${data.id}`);
        break;
      case "document":
        setLocation(`/patients/${data.patientId}?tab=documents`);
        break;
    }
  }, [setLocation]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasResults) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const item = flatResults[selectedIndex];
        if (item) {
          navigateTo(item.type, item.data);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && hasResults) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, hasResults]);

  const renderCategoryIcon = (type: string) => {
    switch (type) {
      case "patient": return <User className="h-4 w-4" />;
      case "acte": return <Stethoscope className="h-4 w-4" />;
      case "implant": return <Activity className="h-4 w-4" />;
      case "document": return <FileText className="h-4 w-4" />;
    }
  };

  const renderCategoryBadge = (type: string) => {
    const labels: Record<string, string> = {
      patient: "Patient",
      acte: "Acte",
      implant: "Implant",
      document: "Document",
    };
    const colors: Record<string, string> = {
      patient: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      acte: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      implant: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      document: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    };
    return (
      <Badge variant="secondary" className={`text-xs ${colors[type]}`}>
        {labels[type]}
      </Badge>
    );
  };

  return (
    <>
      <Button 
        variant="outline" 
        className={`relative justify-start text-muted-foreground ${className}`}
        onClick={() => setIsOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Rechercher...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un patient, acte, implant, document..."
              className="border-0 focus-visible:ring-0 text-base"
              data-testid="input-global-search"
            />
            {query && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
            {isLoading && debouncedQuery.length >= 2 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Recherche en cours...
              </div>
            )}

            {!isLoading && debouncedQuery.length >= 2 && !hasResults && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Aucun résultat pour "{debouncedQuery}"
              </div>
            )}

            {debouncedQuery.length < 2 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Tapez au moins 2 caractères pour rechercher
              </div>
            )}

            {!isLoading && hasResults && results && (
              <div className="py-2">
                {results.patients.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Patients
                    </div>
                    {results.patients.map((patient) => {
                      const idx = indexMaps.patientIndices[patient.id];
                      return (
                        <div
                          key={patient.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover-elevate"
                          }`}
                          onClick={() => navigateTo("patient", patient)}
                          data-testid={`search-result-patient-${patient.id}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("patient")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {patient.prenom} {patient.nom}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Né(e) en {getBirthYear(patient.dateNaissance)}
                            </div>
                          </div>
                          {renderCategoryBadge("patient")}
                        </div>
                      );
                    })}
                  </div>
                )}

                {results.actes.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actes
                    </div>
                    {results.actes.map((acte) => {
                      const idx = indexMaps.acteIndices[acte.id];
                      return (
                        <div
                          key={acte.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover-elevate"
                          }`}
                          onClick={() => navigateTo("acte", acte)}
                          data-testid={`search-result-acte-${acte.id}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("acte")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {TYPE_INTERVENTION_LABELS[acte.typeIntervention] || acte.typeIntervention}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(acte.dateOperation)} – {acte.patientPrenom} {acte.patientNom}
                            </div>
                          </div>
                          {renderCategoryBadge("acte")}
                        </div>
                      );
                    })}
                  </div>
                )}

                {results.implants.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Implants
                    </div>
                    {results.implants.map((implant) => {
                      const idx = indexMaps.implantIndices[implant.id];
                      return (
                        <div
                          key={implant.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover-elevate"
                          }`}
                          onClick={() => navigateTo("implant", implant)}
                          data-testid={`search-result-implant-${implant.id}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("implant")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {implant.marque} {implant.referenceFabricant && `– ${implant.referenceFabricant}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Position {implant.siteFdi} – {implant.patientPrenom} {implant.patientNom}
                            </div>
                          </div>
                          {renderCategoryBadge("implant")}
                        </div>
                      );
                    })}
                  </div>
                )}

                {results.documents.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Documents
                    </div>
                    {results.documents.map((doc) => {
                      const idx = indexMaps.documentIndices[doc.id];
                      return (
                        <div
                          key={doc.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover-elevate"
                          }`}
                          onClick={() => navigateTo("document", doc)}
                          data-testid={`search-result-document-${doc.id}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("document")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {doc.nom}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {doc.type} – {doc.patientPrenom} {doc.patientNom} – {formatDate(doc.date)}
                            </div>
                          </div>
                          {renderCategoryBadge("document")}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {hasResults && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground bg-muted/50">
              <div className="flex items-center gap-2">
                <kbd className="rounded border bg-background px-1.5 py-0.5">↑</kbd>
                <kbd className="rounded border bg-background px-1.5 py-0.5">↓</kbd>
                <span>naviguer</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded border bg-background px-1.5 py-0.5">↵</kbd>
                <span>sélectionner</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded border bg-background px-1.5 py-0.5">esc</kbd>
                <span>fermer</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
