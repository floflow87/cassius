import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { Check, ChevronDown, ChevronUp, Circle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  username: string;
  nom: string | null;
  prenom: string | null;
}

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

  const { data: user } = useQuery<UserInfo>({
    queryKey: ["/api/auth/user"],
  });
  
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
  
  const userName = user?.prenom || user?.username || "vous";
  
  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-blue-200 bg-white dark:bg-gray-900 dark:border-blue-800">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white"
        data-testid="button-toggle-onboarding"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-xs font-bold">
            {progress}%
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Commencez ici {userName}</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>
      
      {isOpen && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {ONBOARDING_STEPS.map((step) => {
            const completed = isStepCompleted(step.id);
            const skipped = isStepSkipped(step.id);
            
            return (
              <a 
                key={step.id}
                href={`/onboarding?step=${step.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                  completed && "bg-gray-50/50 dark:bg-gray-800/50"
                )}
                data-testid={`onboarding-step-${step.id}`}
              >
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                  completed 
                    ? "bg-green-500 text-white" 
                    : "border-2 border-gray-300 dark:border-gray-600"
                )}>
                  {completed && <Check className="w-4 h-4" />}
                </div>
                <span className={cn(
                  "text-sm",
                  completed 
                    ? "text-gray-400 line-through dark:text-gray-500" 
                    : skipped 
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-gray-700 dark:text-gray-200"
                )}>
                  {step.title}
                </span>
              </a>
            );
          })}
          
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isPending}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              data-testid="button-dismiss-onboarding"
            >
              Ne plus afficher
            </button>
            <a
              href={`/onboarding?step=${resumeTargetStep}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              data-testid="button-resume-onboarding"
            >
              Reprendre →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
