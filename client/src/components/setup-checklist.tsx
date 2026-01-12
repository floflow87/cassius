import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, ChevronRight, Circle, Sparkles, X, Play } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  actionUrl: string;
  wizardStep: number | null;
}

interface ChecklistData {
  completedCount: number;
  totalCount: number;
  items: ChecklistItem[];
}

export function SetupChecklist() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDismissed: serverDismissed, isLoading: onboardingLoading, dismissOnboarding } = useOnboarding();
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("cassius_checklist_open");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("cassius_checklist_open", String(isOpen));
  }, [isOpen]);

  const { data: checklist, isLoading } = useQuery<ChecklistData>({
    queryKey: ["/api/onboarding/checklist"],
    refetchInterval: 30000,
  });

  const markDoneMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("POST", `/api/onboarding/checklist/${itemId}/mark-done`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      if (data.allCompleted) {
        toast({
          title: "Félicitations !",
          description: "Vous avez terminé la configuration de Cassius.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de marquer comme fait",
        variant: "destructive",
      });
    },
  });

  const handleDismiss = async () => {
    try {
      await dismissOnboarding();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de masquer la checklist",
        variant: "destructive",
      });
    }
  };

  const handleResume = () => {
    // Find first incomplete item with a wizard step
    const firstIncomplete = checklist?.items.find(item => !item.completed && item.wizardStep !== null);
    if (firstIncomplete && firstIncomplete.wizardStep !== null) {
      // Navigate to onboarding wizard at the specific step
      setLocation(`/onboarding?step=${firstIncomplete.wizardStep}`);
    } else {
      // Fallback to first incomplete item's actionUrl
      const anyIncomplete = checklist?.items.find(item => !item.completed);
      if (anyIncomplete) {
        setLocation(anyIncomplete.actionUrl);
      }
    }
  };

  if (isLoading || onboardingLoading || serverDismissed) {
    return null;
  }

  if (!checklist || checklist.completedCount === checklist.totalCount) {
    return null;
  }

  const progress = Math.round((checklist.completedCount / checklist.totalCount) * 100);
  const remaining = checklist.totalCount - checklist.completedCount;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover-elevate rounded p-1 -m-1" data-testid="button-toggle-setup-checklist">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Finaliser la mise en route</CardTitle>
                {!isOpen && (
                  <span className="text-sm text-muted-foreground ml-2">({progress}%)</span>
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                onClick={handleResume}
                data-testid="button-resume-setup-checklist"
              >
                <Play className="w-3 h-3 mr-1" />
                Reprendre
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleDismiss}
                data-testid="button-dismiss-setup-checklist"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs mt-1 font-light">
            Encore {remaining} étape{remaining > 1 ? "s" : ""} pour une expérience optimale
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{checklist.completedCount}/{checklist.totalCount}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="space-y-1">
              {checklist.items.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-sm py-1.5 hover-elevate rounded px-2 -mx-2"
                  data-testid={`checklist-item-${item.id}`}
                >
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => item.wizardStep !== null ? setLocation(`/onboarding?step=${item.wizardStep}`) : setLocation(item.actionUrl)}
                  >
                    {item.completed ? (
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={item.completed ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                    </span>
                  </div>
                  {!item.completed && (
                    <Checkbox 
                      checked={false}
                      onCheckedChange={() => markDoneMutation.mutate(item.id)}
                      disabled={markDoneMutation.isPending}
                      data-testid={`checklist-checkbox-${item.id}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
