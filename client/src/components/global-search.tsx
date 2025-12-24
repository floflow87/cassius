import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, User, Stethoscope, Activity, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search results
  const { data: results, isLoading } = useQuery<GlobalSearchResults>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
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
    setIsFocused(false);
    setQuery("");
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
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (hasResults) {
          setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (hasResults) {
          setSelectedIndex(i => Math.max(i - 1, 0));
        }
        break;
      case "Enter":
        e.preventDefault();
        if (hasResults) {
          const item = flatResults[selectedIndex];
          if (item) {
            navigateTo(item.type, item.data);
          }
        }
        break;
      case "Escape":
        setIsFocused(false);
        inputRef.current?.blur();
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

  const showDropdown = isFocused && query.length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher..."
          className="pl-9 pr-16 w-64"
          data-testid="input-global-search"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-md shadow-lg overflow-hidden">
          <div ref={resultsRef} className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="p-3 text-center text-muted-foreground text-sm">
                Recherche en cours...
              </div>
            )}

            {!isLoading && !hasResults && (
              <div className="p-3 text-center text-muted-foreground text-sm">
                Aucun résultat pour "{debouncedQuery}"
              </div>
            )}

            {!isLoading && hasResults && results && (
              <div className="py-1">
                {results.patients.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      Patients
                    </div>
                    {results.patients.map((patient) => {
                      const idx = indexMaps.patientIndices[patient.id];
                      return (
                        <div
                          key={patient.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                          onClick={() => navigateTo("patient", patient)}
                          data-testid={`search-result-patient-${patient.id}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("patient")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
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
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      Actes
                    </div>
                    {results.actes.map((acte) => {
                      const idx = indexMaps.acteIndices[acte.id];
                      return (
                        <div
                          key={acte.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                          onClick={() => navigateTo("acte", acte)}
                          data-testid={`search-result-acte-${acte.id}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("acte")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
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
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      Implants
                    </div>
                    {results.implants.map((implant) => {
                      const idx = indexMaps.implantIndices[implant.id];
                      return (
                        <div
                          key={implant.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                          onClick={() => navigateTo("implant", implant)}
                          data-testid={`search-result-implant-${implant.id}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("implant")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
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
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      Documents
                    </div>
                    {results.documents.map((doc) => {
                      const idx = indexMaps.documentIndices[doc.id];
                      return (
                        <div
                          key={doc.id}
                          data-index={idx}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                            idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                          onClick={() => navigateTo("document", doc)}
                          data-testid={`search-result-document-${doc.id}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
                            {renderCategoryIcon("document")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {doc.nom}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {doc.type} – {doc.patientPrenom} {doc.patientNom}
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
        </div>
      )}
    </div>
  );
}
