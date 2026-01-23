import { useState } from "react";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronRight, Circle, SkipForward, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function OnboardingChecklist() {
  const [, setLocation] = useLocation();
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
  
  const handleResumeOnboarding = (step?: number) => {
    if (step !== undefined) {
      setLocation(`/onboarding?step=${step}`);
    } else {
      // Find first incomplete step
      const firstIncomplete = ONBOARDING_STEPS.find(s => !isStepCompleted(s.id) && !isStepSkipped(s.id));
      const targetStep = firstIncomplete ? firstIncomplete.id : 1;
      setLocation(`/onboarding?step=${targetStep}`);
    }
  };

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
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover-elevate rounded p-1 -m-1" data-testid="button-toggle-onboarding">
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
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button 
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
              <Button size="sm" onClick={() => handleResumeOnboarding()} data-testid="button-resume-onboarding">
                Reprendre
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
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
                  <div 
                    key={step.id}
                    className="flex items-center gap-2 text-sm py-1 cursor-pointer hover-elevate rounded px-2 -mx-2"
                    onClick={() => handleResumeOnboarding(step.id)}
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
