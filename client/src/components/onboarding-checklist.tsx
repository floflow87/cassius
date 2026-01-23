import { useState, useMemo } from "react";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronDown, ChevronRight, Circle, SkipForward, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function OnboardingChecklist() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const { 
    state, 
    isLoading, 
    isCompleted, 
    isDismissed,
    getProgress, 
    isStepCompleted, 
    isStepSkipped,
    dismissOnboarding,
    isPending
  } = useOnboarding();
  
  if (isLoading || isCompleted || isDismissed) {
    return null;
  }
  
  const progress = getProgress();
  
  const resumeTargetStep = useMemo(() => {
    const firstIncomplete = ONBOARDING_STEPS.find(s => !isStepCompleted(s.id) && !isStepSkipped(s.id));
    return firstIncomplete ? firstIncomplete.id : 1;
  }, [isStepCompleted, isStepSkipped]);

  const handleDismiss = async () => {
    try {
      await dismissOnboarding();
      toast({
        title: "Configuration masquée",
        description: "Vous pouvez la réactiver depuis les paramètres.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de masquer la configuration",
        variant: "destructive",
      });
    }
  };
  
  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <button 
            type="button"
            onClick={toggleOpen}
            className="flex items-center gap-2 hover-elevate rounded p-1 -m-1" 
            data-testid="button-toggle-onboarding"
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">Configuration en cours</CardTitle>
            {!isOpen && (
              <span className="text-sm text-muted-foreground ml-2">({progress}%)</span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              className="text-xs text-muted-foreground italic font-light"
              onClick={handleDismiss}
              disabled={isPending}
              data-testid="button-dismiss-onboarding"
            >
              <EyeOff className="w-3.5 h-3.5 mr-1" />
              Ne plus afficher
            </Button>
            <Button 
              asChild
              size="sm" 
              data-testid="button-resume-onboarding"
            >
              <a href={`/onboarding?step=${resumeTargetStep}`}>
                Reprendre
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="space-y-1">
            {ONBOARDING_STEPS.map((step) => {
              const completed = isStepCompleted(step.id);
              const skipped = isStepSkipped(step.id);
              
              return (
                <a 
                  key={step.id}
                  href={`/onboarding?step=${step.id}`}
                  className="w-full flex items-center gap-2 text-sm py-1 cursor-pointer hover-elevate rounded px-2 -mx-2 text-left no-underline"
                  data-testid={`onboarding-step-${step.id}`}
                >
                  {completed ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : skipped ? (
                    <SkipForward className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={completed ? "text-muted-foreground line-through" : skipped ? "text-muted-foreground" : ""}>
                    {step.title}
                  </span>
                  {!step.required && !completed && !skipped && (
                    <span className="text-xs text-muted-foreground">(optionnel)</span>
                  )}
                </a>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
