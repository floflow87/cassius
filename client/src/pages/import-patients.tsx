import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type WizardStep = "upload" | "validate" | "review" | "import" | "complete";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Fichier" },
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
      setStep("validate");
      validateMutation.mutate(data.jobId);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/import/patients/validate", { jobId: id });
      return res.json() as Promise<ValidationResponse>;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep("review");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("upload");
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/import/patients/run", { jobId: id });
      return res.json() as Promise<RunResponse>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("complete");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

  const handleStartImport = () => {
    if (jobId) {
      setStep("import");
      runMutation.mutate(jobId);
    }
  };

  const handleDownloadErrors = () => {
    if (jobId) {
      window.open(`/api/import/${jobId}/errors`, "_blank");
    }
  };

  const handleReset = () => {
    setStep("upload");
    setJobId(null);
    setFileName("");
    setValidationResult(null);
    setImportResult(null);
    setError(null);
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
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file-csv"
            />
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Cliquez pour sélectionner un fichier CSV
            </p>
            <p className="text-xs text-muted-foreground">
              Format attendu: nom, prénom, date de naissance, sexe, etc.
            </p>
          </div>

          {uploadMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du fichier...
            </div>
          )}

          <Alert>
            <AlertTitle>Colonnes supportées</AlertTitle>
            <AlertDescription className="text-xs">
              Nom, Prénom, Date de naissance, Sexe, Téléphone, Email, Numéro de dossier, NIR/SSN, Adresse, Code postal, Ville, Pays
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );

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
          Vérification des données et recherche de doublons...
        </p>
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => {
    if (!validationResult) return null;
    const { stats, samples } = validationResult;

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
                <div className="text-2xl font-bold text-green-600">{stats.ok}</div>
                <div className="text-sm text-muted-foreground">Valides</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
                <div className="text-sm text-muted-foreground">Avertissements</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-sm text-muted-foreground">Erreurs</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Nouveaux</Badge>
                  <span className="font-bold">{stats.toCreate}</span>
                </div>
                <p className="text-xs text-muted-foreground">Patients à créer</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Existants</Badge>
                  <span className="font-bold">{stats.toUpdate}</span>
                </div>
                <p className="text-xs text-muted-foreground">Patients à mettre à jour</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {samples.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Erreurs ({stats.error})
              </CardTitle>
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
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {samples.warnings.map((item, i) => (
                  <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                    <div className="font-medium">Ligne {item.row}</div>
                    <div className="text-yellow-600">
                      {item.warnings?.map(w => `${w.field}: ${w.message}`).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset} data-testid="button-reset">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Recommencer
          </Button>
          <Button
            onClick={handleStartImport}
            disabled={stats.ok + stats.warning === 0}
            data-testid="button-start-import"
          >
            Importer {stats.ok + stats.warning} patients
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderImportingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Import en cours
        </CardTitle>
        <CardDescription>
          Création et mise à jour des patients...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={75} className="mb-4" />
        <p className="text-sm text-muted-foreground text-center">
          Ne fermez pas cette page pendant l'import.
        </p>
      </CardContent>
    </Card>
  );

  const renderCompleteStep = () => {
    if (!importResult) return null;
    const { stats } = importResult;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Import terminé
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

          <div className="flex justify-between">
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
