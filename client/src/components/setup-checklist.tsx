import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronRight, Circle, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  actionUrl: string;
}

interface ChecklistData {
  completedCount: number;
  totalCount: number;
  items: ChecklistItem[];
}

export function SetupChecklist() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("cassius_checklist_dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  const { data: checklist, isLoading } = useQuery<ChecklistData>({
    queryKey: ["/api/onboarding/checklist"],
    refetchInterval: 30000,
  });

  const handleDismiss = () => {
    localStorage.setItem("cassius_checklist_dismissed", "true");
    setIsDismissed(true);
  };

  const handleNavigate = (url: string) => {
    setLocation(url);
  };

  if (isLoading || isDismissed) {
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
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleDismiss}
              data-testid="button-dismiss-setup-checklist"
            >
              <X className="w-4 h-4" />
            </Button>
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
                  className="flex items-center gap-2 text-sm py-1.5 cursor-pointer hover-elevate rounded px-2 -mx-2"
                  onClick={() => handleNavigate(item.actionUrl)}
                  data-testid={`checklist-item-${item.id}`}
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
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
