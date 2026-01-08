import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, Circle, SkipForward } from "lucide-react";
import { useLocation } from "wouter";

export function OnboardingChecklist() {
  const [, setLocation] = useLocation();
  const { state, isLoading, isCompleted, getProgress, isStepCompleted, isStepSkipped } = useOnboarding();
  
  if (isLoading || isCompleted) {
    return null;
  }
  
  const progress = getProgress();
  
  const handleResumeOnboarding = (step?: number) => {
    if (step !== undefined) {
      setLocation(`/onboarding?step=${step}`);
    } else {
      setLocation("/onboarding");
    }
  };
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Configuration en cours</CardTitle>
          <Button size="sm" onClick={() => handleResumeOnboarding()} data-testid="button-resume-onboarding">
            Reprendre
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
    </Card>
  );
}
