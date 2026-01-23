import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronLeft, ChevronRight, Building2, Users, Database, Stethoscope, Calendar, Bell, FileText, Sparkles, SkipForward, Mail, ExternalLink } from "lucide-react";
import type { OnboardingData } from "@shared/schema";

const stepIcons = [Sparkles, Building2, Users, Database, Stethoscope, Calendar, Bell, FileText];

function StepIndicator({ step, currentStep, isCompleted, isSkipped }: { 
  step: typeof ONBOARDING_STEPS[0]; 
  currentStep: number; 
  isCompleted: boolean; 
  isSkipped: boolean;
}) {
  const Icon = stepIcons[step.id] || Sparkles;
  const isActive = step.id === currentStep;
  
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
        isActive ? "bg-primary/10 border border-primary/20" : ""
      }`}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
        isCompleted ? "bg-green-500 border-green-500 text-white" :
        isSkipped ? "bg-muted border-muted-foreground/30 text-muted-foreground" :
        isActive ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"
      }`}>
        {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${
          isActive ? "text-foreground" : "text-muted-foreground"
        }`}>
          {step.title}
          {!step.required && <span className="text-xs ml-1">(optionnel)</span>}
        </div>
        {isActive && (
          <div className="text-xs text-muted-foreground truncate">{step.description}</div>
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ data, onComplete }: { data: OnboardingData; onComplete: (patch: Partial<OnboardingData>) => void }) {
  const [practiceType, setPracticeType] = useState<"SOLO" | "CABINET">(data.practiceType || "SOLO");
  const [timezone, setTimezone] = useState(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  const handleContinue = () => {
    onComplete({ practiceType, timezone, language: "fr" });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Bienvenue sur Cassius</h2>
        <p className="text-muted-foreground mt-1">
          Configurons votre espace de travail en quelques étapes.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-3">
          <Label>Type de pratique</Label>
          <RadioGroup value={practiceType} onValueChange={(v) => setPracticeType(v as "SOLO" | "CABINET")}>
            <div className="flex items-center space-x-3 p-3 border rounded-md hover-elevate cursor-pointer">
              <RadioGroupItem value="SOLO" id="solo" />
              <Label htmlFor="solo" className="flex-1 cursor-pointer">
                <div className="font-medium">Praticien solo</div>
                <div className="text-sm text-muted-foreground">Vous exercez seul</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-md hover-elevate cursor-pointer">
              <RadioGroupItem value="CABINET" id="cabinet" />
              <Label htmlFor="cabinet" className="flex-1 cursor-pointer">
                <div className="font-medium">Cabinet / Équipe</div>
                <div className="text-sm text-muted-foreground">Vous travaillez avec des collaborateurs</div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="timezone">Fuseau horaire</Label>
          <Input 
            id="timezone" 
            value={timezone} 
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/Paris"
            data-testid="input-timezone"
          />
          <p className="text-xs text-muted-foreground">Détecté automatiquement</p>
        </div>
      </div>
      
      <Button onClick={handleContinue} className="w-full" data-testid="button-continue-step-0">
        Continuer
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function ClinicStep({ data, onComplete }: { data: OnboardingData; onComplete: (patch: Partial<OnboardingData>) => void }) {
  const [clinicName, setClinicName] = useState(data.clinicName || "");
  const [phone, setPhone] = useState(data.phone || "");
  const [address, setAddress] = useState(data.address || "");
  
  const canContinue = clinicName.trim().length > 0;
  
  const handleContinue = () => {
    if (canContinue) {
      onComplete({ clinicName, phone, address });
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Votre cabinet</h2>
        <p className="text-muted-foreground mt-1">
          Ces informations apparaîtront sur vos documents.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clinicName">Nom du cabinet *</Label>
          <Input 
            id="clinicName" 
            value={clinicName} 
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="Cabinet du Dr. Martin"
            data-testid="input-clinic-name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input 
            id="phone" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01 23 45 67 89"
            data-testid="input-phone"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address">Adresse</Label>
          <Input 
            id="address" 
            value={address} 
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 rue de la Santé, 75000 Paris"
            data-testid="input-address"
          />
        </div>
      </div>
      
      <Button onClick={handleContinue} disabled={!canContinue} className="w-full" data-testid="button-continue-step-1">
        Continuer
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function TeamStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState<"CHIRURGIEN" | "ASSISTANT" | "ADMIN">("ASSISTANT");
  const [invitedCount, setInvitedCount] = useState(0);

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; nom: string; prenom: string; role: string }) => {
      const response = await apiRequest("POST", "/api/settings/collaborators", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi de l'invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation envoyée",
        description: `Une invitation a été envoyée à ${email}`,
      });
      setInvitedCount(prev => prev + 1);
      setEmail("");
      setNom("");
      setPrenom("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/collaborators"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!email) return;
    inviteMutation.mutate({ email, nom, prenom, role });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Votre équipe</h2>
        <p className="text-muted-foreground mt-1">
          Invitez vos collaborateurs à rejoindre Cassius.
        </p>
      </div>
      
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-prenom">Prénom</Label>
              <Input 
                id="invite-prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Jean"
                data-testid="input-invite-prenom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-nom">Nom</Label>
              <Input 
                id="invite-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Dupont"
                data-testid="input-invite-nom"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input 
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@cabinet.fr"
              data-testid="input-invite-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="invite-role" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSISTANT">Assistant</SelectItem>
                <SelectItem value="CHIRURGIEN">Chirurgien</SelectItem>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleInvite} 
            disabled={!email || inviteMutation.isPending}
            className="w-full"
            data-testid="button-send-invite"
          >
            <Mail className="w-4 h-4 mr-2" />
            {inviteMutation.isPending ? "Envoi..." : "Envoyer l'invitation"}
          </Button>
          
          {invitedCount > 0 && (
            <p className="text-sm text-center text-green-600">
              {invitedCount} invitation{invitedCount > 1 ? "s" : ""} envoyée{invitedCount > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1" data-testid="button-skip-step-2">
          <SkipForward className="w-4 h-4 mr-2" />
          Passer
        </Button>
        <Button onClick={onComplete} className="flex-1" data-testid="button-continue-step-2">
          Continuer
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function DataStep({ onComplete }: { onComplete: (patch: Partial<OnboardingData>) => void }) {
  const [mode, setMode] = useState<"import" | "demo" | "manual" | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/onboarding/demo", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Données de démonstration créées",
          description: `${data.created.patients} patients, ${data.created.operations} actes et ${data.created.appointments} rendez-vous ajoutés.`,
        });
        onComplete({ demoModeEnabled: true, importCompleted: true });
      } else {
        toast({
          title: "Information",
          description: data.error || "Mode démo activé.",
        });
        onComplete({ demoModeEnabled: true, importCompleted: true });
      }
    } catch (error) {
      toast({
        title: "Mode démo activé",
        description: "Vous pouvez explorer l'application.",
      });
      onComplete({ demoModeEnabled: true, importCompleted: true });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleManual = () => {
    onComplete({ importCompleted: true });
  };
  
  const handleImport = () => {
    setLocation("/settings/import");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Vos données</h2>
        <p className="text-muted-foreground mt-1">
          Comment souhaitez-vous commencer ?
        </p>
      </div>
      
      <div className="space-y-3">
        <div 
          onClick={() => setMode("import")}
          className={`p-4 border rounded-md cursor-pointer hover-elevate ${mode === "import" ? "border-primary bg-primary/5" : ""}`}
        >
          <div className="font-medium">Importer des patients (CSV)</div>
          <div className="text-sm text-muted-foreground">Importez vos données existantes</div>
        </div>
        
        <div 
          onClick={() => setMode("demo")}
          className={`p-4 border rounded-md cursor-pointer hover-elevate ${mode === "demo" ? "border-primary bg-primary/5" : ""}`}
        >
          <div className="font-medium">Mode démo</div>
          <div className="text-sm text-muted-foreground">Explorez avec des données fictives</div>
        </div>
        
        <div 
          onClick={() => setMode("manual")}
          className={`p-4 border rounded-md cursor-pointer hover-elevate ${mode === "manual" ? "border-primary bg-primary/5" : ""}`}
        >
          <div className="font-medium">Saisie manuelle</div>
          <div className="text-sm text-muted-foreground">Créez vos patients un par un</div>
        </div>
      </div>
      
      <Button 
        onClick={() => {
          if (mode === "import") handleImport();
          else if (mode === "demo") handleDemo();
          else if (mode === "manual") handleManual();
        }}
        disabled={!mode || isLoading}
        className="w-full"
        data-testid="button-continue-step-3"
      >
        {isLoading ? "Création des données..." : mode === "import" ? "Aller à l'import" : "Continuer"}
        {!isLoading && <ChevronRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  );
}

function FirstCaseStep({ onComplete }: { onComplete: (patch: Partial<OnboardingData>) => void }) {
  const [, setLocation] = useLocation();
  
  const handleCreateCase = () => {
    onComplete({ firstCaseCreated: true });
  };
  
  const handleGoToPatients = () => {
    setLocation("/patients");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Premier cas clinique</h2>
        <p className="text-muted-foreground mt-1">
          Créez votre premier acte chirurgical avec un implant.
        </p>
      </div>
      
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Vous pouvez créer un cas maintenant ou le faire plus tard depuis la fiche patient.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleGoToPatients} className="flex-1" data-testid="button-go-patients">
          Voir les patients
        </Button>
        <Button onClick={handleCreateCase} className="flex-1" data-testid="button-continue-step-4">
          Marquer comme fait
          <Check className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function CalendarStep({ onComplete, onSkip }: { onComplete: (patch: Partial<OnboardingData>) => void; onSkip: () => void }) {
  const [, setLocation] = useLocation();
  
  const handleGoToSettings = () => {
    setLocation("/settings/calendar");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Calendrier</h2>
        <p className="text-muted-foreground mt-1">
          Configurez votre agenda et connectez Google Calendar.
        </p>
      </div>
      
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Gérez vos rendez-vous et synchronisez avec Google Calendar.
            </p>
            <Button variant="outline" size="sm" onClick={handleGoToSettings} data-testid="button-go-calendar-settings">
              <ExternalLink className="w-4 h-4 mr-2" />
              Accéder aux paramètres
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1" data-testid="button-skip-step-5">
          <SkipForward className="w-4 h-4 mr-2" />
          Passer
        </Button>
        <Button onClick={() => onComplete({ googleConnected: true })} className="flex-1" data-testid="button-continue-step-5">
          Continuer
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function NotificationsStep({ onComplete, onSkip }: { onComplete: (patch: Partial<OnboardingData>) => void; onSkip: () => void }) {
  const [, setLocation] = useLocation();
  
  const handleGoToSettings = () => {
    setLocation("/settings/notifications");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Notifications</h2>
        <p className="text-muted-foreground mt-1">
          Configurez vos alertes et rappels.
        </p>
      </div>
      
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Recevez des alertes ISQ, rappels de suivi et notifications d'équipe.
            </p>
            <Button variant="outline" size="sm" onClick={handleGoToSettings} data-testid="button-go-notifications-settings">
              <ExternalLink className="w-4 h-4 mr-2" />
              Accéder aux paramètres
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1" data-testid="button-skip-step-6">
          <SkipForward className="w-4 h-4 mr-2" />
          Passer
        </Button>
        <Button onClick={() => onComplete({ notificationsConfigured: true })} className="flex-1" data-testid="button-continue-step-6">
          Continuer
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function DocumentsStep({ onComplete, onSkip }: { onComplete: (patch: Partial<OnboardingData>) => void; onSkip: () => void }) {
  const [, setLocation] = useLocation();
  
  const handleGoToDocuments = () => {
    setLocation("/documents");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Documents</h2>
        <p className="text-muted-foreground mt-1">
          Uploadez vos premiers documents.
        </p>
      </div>
      
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Stockez radiographies, consentements et autres documents.
            </p>
            <Button variant="outline" size="sm" onClick={handleGoToDocuments} data-testid="button-go-documents">
              <ExternalLink className="w-4 h-4 mr-2" />
              Accéder aux documents
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1" data-testid="button-skip-step-7">
          <SkipForward className="w-4 h-4 mr-2" />
          Passer
        </Button>
        <Button onClick={() => onComplete({ documentUploaded: true })} className="flex-1" data-testid="button-continue-step-7">
          Terminer
          <Check className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { 
    state, 
    isLoading, 
    completeStep, 
    skipStep, 
    goToStep,
    finishOnboarding,
    isStepCompleted,
    getProgress,
    canComplete,
    isPending,
    isCompleted 
  } = useOnboarding();
  
  // Handle URL step parameter to navigate directly to a specific step
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const stepParam = urlParams.get('step');
    if (stepParam && state && !isLoading) {
      const targetStep = parseInt(stepParam, 10);
      if (!isNaN(targetStep) && targetStep >= 0 && targetStep <= 7 && targetStep !== state.currentStep) {
        goToStep(targetStep);
        // Clear the step parameter from URL after navigating
        setLocation('/onboarding', { replace: true });
      }
    }
  }, [searchString, state, isLoading, goToStep, setLocation]);
  
  useEffect(() => {
    if (isCompleted) {
      setLocation("/dashboard");
    }
  }, [isCompleted, setLocation]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  
  const currentStep = state?.currentStep ?? 0;
  const data = state?.data ?? {};
  
  const handleComplete = async (step: number, patch?: Partial<OnboardingData>) => {
    try {
      await completeStep(step, patch);
      
      if (step === 7 && canComplete()) {
        const result = await finishOnboarding();
        if (result.success) {
          toast({
            title: "Configuration terminée",
            description: "Bienvenue sur Cassius !",
            className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
          });
          setLocation(result.redirectTo || "/dashboard");
        }
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const handleSkip = async (step: number) => {
    // Required steps cannot be skipped - defensive guard
    const requiredSteps = [0, 1, 3, 4];
    if (requiredSteps.includes(step)) {
      toast({
        title: "Erreur",
        description: "Cette étape est obligatoire et ne peut pas être passée",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await skipStep(step);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };
  
  const handleExit = () => {
    setLocation("/dashboard");
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep data={data} onComplete={(patch) => handleComplete(0, patch)} />;
      case 1:
        return <ClinicStep data={data} onComplete={(patch) => handleComplete(1, patch)} />;
      case 2:
        return <TeamStep onComplete={() => handleComplete(2)} onSkip={() => handleSkip(2)} />;
      case 3:
        return <DataStep onComplete={(patch) => handleComplete(3, patch)} />;
      case 4:
        return <FirstCaseStep onComplete={(patch) => handleComplete(4, patch)} />;
      case 5:
        return <CalendarStep onComplete={(patch) => handleComplete(5, patch)} onSkip={() => handleSkip(5)} />;
      case 6:
        return <NotificationsStep onComplete={(patch) => handleComplete(6, patch)} onSkip={() => handleSkip(6)} />;
      case 7:
        return <DocumentsStep onComplete={(patch) => handleComplete(7, patch)} onSkip={() => handleSkip(7)} />;
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Mise en route Cassius</h1>
            <p className="text-sm text-muted-foreground">
              Étape {currentStep + 1} sur {ONBOARDING_STEPS.length}
            </p>
          </div>
          <Button variant="ghost" onClick={handleExit} data-testid="button-exit-onboarding">
            Continuer plus tard
          </Button>
        </div>
        
        <Progress value={getProgress()} className="mb-8" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            {ONBOARDING_STEPS.map((step) => (
              <StepIndicator
                key={step.id}
                step={step}
                currentStep={currentStep}
                isCompleted={isStepCompleted(step.id)}
                isSkipped={state?.skippedSteps?.[String(step.id)] === true}
              />
            ))}
          </div>
          
          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4" data-testid="button-back">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Retour
                </Button>
              )}
              
              {isPending ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                renderStep()
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
