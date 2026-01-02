import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, ArrowRight, Download, Loader2, Settings2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface ImportStats {
  total: number;
  ok: number;
  warning: number;
  error: number;
  collision: number;
  toCreate: number;
  toUpdate: number;
}

interface ValidationSample {
  row: number;
  data?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

interface ValidationResponse {
  jobId: string;
  status: string;
  stats: ImportStats;
  samples: {
    ok: ValidationSample[];
    errors: ValidationSample[];
    warnings: ValidationSample[];
  };
}

interface UploadResponse {
  jobId: string;
  fileName: string;
  fileHash: string;
  status: string;
}

interface RunResponse {
  jobId: string;
  status: string;
  stats: ImportStats;
  message: string;
}

interface ProgressResponse {
  status: string;
  totalRows: number;
  processedRows: number;
  stats: ImportStats;
}

interface LastImportResponse {
  lastImport: {
    id: string;
    status: string;
    fileName: string;
    totalRows: number;
    processedRows: number;
    stats: ImportStats | null;
    completedAt: string;
    createdAt: string;
  } | null;
}

interface PatientField {
  key: string | null;
  label: string;
  required: boolean;
}

interface HeadersResponse {
  headers: string[];
  delimiter: string;
  rowCount: number;
  suggestedMapping: Array<{ csvHeader: string; suggestedField: string | null }>;
  patientFields: PatientField[];
}

type WizardStep = "upload" | "mapping" | "validate" | "review" | "import" | "complete";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Fichier" },
  { key: "mapping", label: "Colonnes" },
  { key: "validate", label: "Validation" },
  { key: "review", label: "Apercu" },
  { key: "import", label: "Import" },
  { key: "complete", label: "Terminé" },
];

export default function ImportPatientsPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<WizardStep>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [importResult, setImportResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [headersData, setHeadersData] = useState<HeadersResponse | null>(null);
  const [importStarted, setImportStarted] = useState(false);
  const [importProgress, setImportProgress] = useState<ProgressResponse | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastServerProgress = useRef(0);

  // Query for last import
  const { data: lastImportData } = useQuery<LastImportResponse>({
    queryKey: ["/api/import/patients/last"],
    staleTime: 30000,
  });

  const getCurrentStepIndex = () => STEPS.findIndex(s => s.key === step);

  const uploadMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/import/patients/upload", {
        content,
        fileName,
      });
      return res.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      detectHeadersMutation.mutate(data.jobId);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const detectHeadersMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/import/patients/detect-headers", { jobId: id });
      return res.json() as Promise<HeadersResponse>;
    },
    onSuccess: (data) => {
      setHeadersData(data);
      const initialMapping: Record<string, string | null> = {};
      data.suggestedMapping.forEach(m => {
        initialMapping[m.csvHeader] = m.suggestedField;
      });
      setColumnMapping(initialMapping);
      setStep("mapping");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("upload");
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ id, mapping }: { id: string; mapping: Record<string, string | null> }) => {
      const res = await apiRequest("POST", "/api/import/patients/validate", { jobId: id, mapping });
      return res.json() as Promise<ValidationResponse>;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep("review");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("mapping");
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[IMPORT] Calling POST /api/import/patients/run with jobId:", id);
      const res = await apiRequest("POST", "/api/import/patients/run", { jobId: id });
      console.log("[IMPORT] Response status:", res.status);
      return res.json() as Promise<RunResponse>;
    },
    onSuccess: (data) => {
      console.log("[IMPORT] Import completed successfully:", data);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setImportResult(data);
      setStep("complete");
    },
    onError: (err: Error) => {
      console.error("[IMPORT] Import failed:", err.message);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setError(`Erreur lors de l'import: ${err.message}`);
      setImportStarted(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/import/${id}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      setCancelRequested(true);
    },
    onError: (err: Error) => {
      console.error("[IMPORT] Cancel failed:", err.message);
    },
  });

  // Smooth progress animation
  useEffect(() => {
    if (!importProgress) return;
    
    const totalRows = importProgress.totalRows || 1;
    const targetPercent = Math.round((importProgress.processedRows / totalRows) * 100);
    
    // Animate from current animated progress to target
    const startPercent = animatedProgress;
    const duration = 800; // Animation duration in ms
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newPercent = startPercent + (targetPercent - startPercent) * easeOut;
      
      setAnimatedProgress(Math.round(newPercent));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [importProgress?.processedRows, importProgress?.totalRows]);

  // Poll for progress when import is running
  const pollProgress = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/import/${jobId}/progress`, {
        credentials: "include",
      });
      if (res.ok) {
        const progress = await res.json() as ProgressResponse;
        console.log("[IMPORT] Progress:", progress.processedRows, "/", progress.totalRows, "status:", progress.status);
        setImportProgress(progress);
        
        // Stop polling if import is complete, failed, or cancelled
        if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Handle cancelled status
          if (progress.status === "cancelled") {
            setImportResult({
              jobId: jobId,
              status: "cancelled",
              stats: progress.stats,
              message: `Import interrompu: ${progress.stats.toCreate} créés, ${progress.stats.toUpdate} mis à jour, ${progress.stats.error} erreurs`
            });
            setStep("complete");
          }
        }
      } else if (res.status === 404 || res.status >= 500) {
        // Stop polling on terminal errors
        console.error("[IMPORT] Error polling progress:", res.status);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err) {
      console.error("[IMPORT] Error polling progress:", err);
    }
  }, [jobId]);

  useEffect(() => {
    if (step === "import" && jobId && !importStarted && !runMutation.isPending) {
      console.log("[IMPORT] Step is 'import', starting import for jobId:", jobId);
      setImportStarted(true);
      setError(null);
      setImportProgress(null);
      runMutation.mutate(jobId);
      
      // Start polling for progress
      pollingRef.current = setInterval(pollProgress, 1000);
    }
  }, [step, jobId, importStarted, runMutation.isPending, pollProgress]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError("Veuillez sélectionner un fichier CSV");
      return;
    }

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      uploadMutation.mutate(content);
    };
    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier");
    };
    reader.readAsText(file, "UTF-8");
  }, [uploadMutation]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleStartValidation = () => {
    if (jobId) {
      setStep("validate");
      validateMutation.mutate({ id: jobId, mapping: columnMapping });
    }
  };

  const handleStartImport = () => {
    if (jobId) {
      console.log("[IMPORT] handleStartImport called with jobId:", jobId);
      setImportStarted(false);
      setError(null);
      setStep("import");
    } else {
      console.error("[IMPORT] handleStartImport called but jobId is null");
      setError("Erreur: Identifiant de job manquant. Veuillez recommencer l'import.");
    }
  };

  const handleDownloadTemplate = (variant: "empty" | "example") => {
    window.open(`/api/import/patients/template?variant=${variant}`, "_blank");
  };

  const handleDownloadErrors = () => {
    if (jobId) {
      window.open(`/api/import/${jobId}/errors`, "_blank");
    }
  };

  const handleReset = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setStep("upload");
    setJobId(null);
    setFileName("");
    setValidationResult(null);
    setImportResult(null);
    setError(null);
    setColumnMapping({});
    setHeadersData(null);
    setImportStarted(false);
    setImportProgress(null);
    setCancelRequested(false);
    setAnimatedProgress(0);
  };

  const handleCancelImport = () => {
    if (jobId && !cancelRequested) {
      cancelMutation.mutate(jobId);
    }
  };

  const handleMappingChange = (csvHeader: string, patientField: string | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvHeader]: patientField === "_ignore_" ? null : patientField
    }));
  };

  const renderProgressSteps = () => {
    const currentIndex = getCurrentStepIndex();
    return (
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, index) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index < currentIndex ? "bg-primary text-primary-foreground" : ""}
                  ${index === currentIndex ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : ""}
                  ${index > currentIndex ? "bg-muted text-muted-foreground" : ""}`}
              >
                {index < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`text-xs mt-1 ${index <= currentIndex ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${index < currentIndex ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importer des patients
        </CardTitle>
        <CardDescription>
          Sélectionnez un fichier CSV contenant les données de vos patients.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDownloadTemplate("empty")}
              data-testid="button-download-template-empty"
            >
              <Download className="h-4 w-4 mr-2" />
              Modèle vide
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDownloadTemplate("example")}
              data-testid="button-download-template-example"
            >
              <Download className="h-4 w-4 mr-2" />
              Modèle avec exemples
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover-elevate"}`}
            onClick={() => document.getElementById("file-input")?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="dropzone-csv"
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file-csv"
            />
            <FileText className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className={`text-sm mb-2 ${isDragging ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {isDragging ? "Déposez le fichier ici" : "Glissez-déposez ou cliquez pour sélectionner un fichier CSV"}
            </p>
            <p className="text-xs text-muted-foreground">
              Formats supportés: CSV avec séparateur ; ou ,
            </p>
          </div>

          {(uploadMutation.isPending || detectHeadersMutation.isPending) && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse du fichier...
            </div>
          )}

          <Alert>
            <AlertTitle>Colonnes supportées</AlertTitle>
            <AlertDescription className="text-xs">
              Nom, Prénom, Date de naissance, Téléphone, E-mail, Numéro de dossier, Numéro SS, Adresse, Code postal, Ville, Pays
            </AlertDescription>
          </Alert>

          {lastImportData?.lastImport && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Dernier import
              </h4>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {lastImportData.lastImport.fileName || "Fichier CSV"}
                  </span>
                  <Badge variant={lastImportData.lastImport.status === "completed" ? "default" : "destructive"}>
                    {lastImportData.lastImport.status === "completed" ? "Terminé" : "Échoué"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {new Date(lastImportData.lastImport.completedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {lastImportData.lastImport.stats && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-background rounded p-2">
                      <div className="text-sm font-bold">{lastImportData.lastImport.stats.total?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="bg-background rounded p-2">
                      <div className="text-sm font-bold text-green-600">{lastImportData.lastImport.stats.toCreate?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Créés</div>
                    </div>
                    <div className="bg-background rounded p-2">
                      <div className="text-sm font-bold text-blue-600">{lastImportData.lastImport.stats.toUpdate?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Mis à jour</div>
                    </div>
                    <div className="bg-background rounded p-2">
                      <div className="text-sm font-bold text-red-600">{lastImportData.lastImport.stats.error?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Erreurs</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderMappingStep = () => {
    if (!headersData) return null;

    const requiredFields = headersData.patientFields.filter(f => f.required);
    const mappedFields = Object.values(columnMapping).filter(Boolean);
    const missingRequired = requiredFields.filter(f => f.key && !mappedFields.includes(f.key));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Correspondance des colonnes
            </CardTitle>
            <CardDescription>
              {fileName} - {headersData.rowCount} lignes détectées (séparateur: {headersData.delimiter})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                <div>Colonnes de votre fichier</div>
                <div>Champs patient dans Cassius</div>
              </div>
              
              {headersData.headers.map((header, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-sm font-medium truncate" title={header}>
                    {header}
                  </div>
                  <Select
                    value={columnMapping[header] || "_ignore_"}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger data-testid={`select-mapping-${index}`}>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ignore_">
                        <span className="text-muted-foreground">Ignorer</span>
                      </SelectItem>
                      {headersData.patientFields.filter(f => f.key).map((field) => (
                        <SelectItem key={field.key!} value={field.key!}>
                          <span className="flex items-center gap-2">
                            {field.label}
                            {field.required && (
                              <Badge variant="destructive" className="text-xs px-1">requis</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Champs requis manquants</AlertTitle>
                <AlertDescription>
                  {missingRequired.map(f => f.label).join(", ")}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={handleReset} data-testid="button-back-to-upload">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Changer de fichier
          </Button>
          <Button 
            onClick={handleStartValidation} 
            disabled={missingRequired.length > 0}
            data-testid="button-validate"
          >
            Valider
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderValidatingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Validation en cours
        </CardTitle>
        <CardDescription>
          Analyse du fichier {fileName}...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={50} className="mb-4" />
        <p className="text-sm text-muted-foreground text-center">
          Vérification des données...
        </p>
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => {
    if (!validationResult) return null;
    const { stats, samples } = validationResult;

    // Importable = ok + warning (rows without blocking errors)
    const importableCount = stats.ok + stats.warning;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Résumé de la validation
            </CardTitle>
            <CardDescription>{fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total lignes</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importableCount}</div>
                <div className="text-sm text-muted-foreground">Importables</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
                <div className="text-sm text-muted-foreground">Avec avertissements</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-sm text-muted-foreground">Non importables</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {samples.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Erreurs bloquantes ({stats.error})
              </CardTitle>
              <CardDescription>Ces lignes ne seront pas importées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {samples.errors.map((item, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                    <div className="font-medium">Ligne {item.row}</div>
                    <div className="text-red-600">
                      {item.errors?.map(e => `${e.field}: ${e.message}`).join(", ")}
                    </div>
                  </div>
                ))}
                {stats.error > samples.errors.length && (
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger toutes les erreurs
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {samples.warnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                Avertissements ({stats.warning})
              </CardTitle>
              <CardDescription>Ces patients seront importés. Certaines informations (date de naissance, sexe) pourront être complétées ultérieurement.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {samples.warnings.map((item, i) => (
                  <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                    <div className="font-medium">Ligne {item.row}: {(item.data as any)?.prenom} {(item.data as any)?.nom}</div>
                    <div className="text-yellow-700 dark:text-yellow-400">
                      {item.warnings?.map(w => w.message).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-to-mapping">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Modifier le mapping
          </Button>
          <Button
            onClick={handleStartImport}
            disabled={importableCount === 0}
            data-testid="button-start-import"
          >
            Importer {importableCount} patients
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderImportingStep = () => {
    if (!jobId) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Erreur
            </CardTitle>
            <CardDescription>
              Identifiant de job manquant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Job introuvable</AlertTitle>
              <AlertDescription>
                L'identifiant du job d'import est manquant. Veuillez recommencer le processus d'import.
              </AlertDescription>
            </Alert>
            <Button onClick={handleReset} data-testid="button-restart-import">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Recommencer l'import
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Erreur lors de l'import
            </CardTitle>
            <CardDescription>
              Une erreur s'est produite pendant l'import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleReset} data-testid="button-restart-import">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Recommencer
              </Button>
              <Button 
                onClick={() => {
                  setImportStarted(false);
                  setError(null);
                }} 
                data-testid="button-retry-import"
              >
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const totalRows = importProgress?.totalRows || validationResult?.stats?.total || 0;
    const processedRows = importProgress?.processedRows || 0;
    const progressPercent = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
    const created = importProgress?.stats?.toCreate || 0;
    const updated = importProgress?.stats?.toUpdate || 0;
    const errors = importProgress?.stats?.error || 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {cancelRequested ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Interruption en cours...
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Import en cours
              </>
            )}
          </CardTitle>
          <CardDescription>
            {cancelRequested 
              ? "L'import sera interrompu après le batch en cours..." 
              : "Création et mise à jour des patients..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={animatedProgress} className="mb-4" />
          
          <div className="text-center mb-4">
            <div className="text-2xl font-bold">
              {processedRows.toLocaleString()} / {totalRows.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              patients traités ({progressPercent}%)
            </p>
          </div>

          {importProgress && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-lg font-bold text-green-600">{created.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Créés</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{updated.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Mis à jour</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-lg font-bold text-red-600">{errors.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Erreurs</div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Ne fermez pas cette page pendant l'import.
            </p>
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={cancelRequested || cancelMutation.isPending}
              data-testid="button-cancel-import"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              {cancelRequested ? "Interruption demandée..." : "Interrompre l'import"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCompleteStep = () => {
    if (!importResult) return null;
    const { stats, status } = importResult;
    const isCancelled = status === "cancelled";

    return (
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isCancelled ? "text-orange-600" : "text-green-600"}`}>
            {isCancelled ? (
              <>
                <StopCircle className="h-5 w-5" />
                Import interrompu
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Import terminé
              </>
            )}
          </CardTitle>
          <CardDescription>{importResult.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.toCreate}</div>
              <div className="text-sm text-muted-foreground">Créés</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.toUpdate}</div>
              <div className="text-sm text-muted-foreground">Mis à jour</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.error}</div>
              <div className="text-sm text-muted-foreground">Erreurs</div>
            </div>
          </div>

          <div className="flex justify-between gap-4">
            <Button variant="outline" onClick={handleReset} data-testid="button-new-import">
              Nouvel import
            </Button>
            <Button onClick={() => navigate("/patients")} data-testid="button-view-patients">
              Voir les patients
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCurrentStep = () => {
    if (step === "upload") return renderUploadStep();
    if (step === "mapping") return renderMappingStep();
    if (step === "validate") return renderValidatingStep();
    if (step === "review") return renderReviewStep();
    if (step === "import") return renderImportingStep();
    if (step === "complete") return renderCompleteStep();
    return null;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/patients")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux patients
          </Button>
        </div>

        {renderProgressSteps()}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderCurrentStep()}
      </div>
    </div>
  );
}
