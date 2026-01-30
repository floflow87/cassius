import { useState, type ReactNode } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface PatchNote {
  version: string;
  date: string;
  title: string;
  changes: {
    type: "feature" | "improvement" | "fix" | "breaking";
    description: string;
  }[];
}

const patchNotes: PatchNote[] = [
  {
    version: "1.0.0",
    date: "30 janvier 2026",
    title: "Lancement initial",
    changes: [
      { type: "feature", description: "Gestion complète des patients et dossiers médicaux" },
      { type: "feature", description: "Suivi des implants avec mesures ISQ" },
      { type: "feature", description: "Calendrier avec synchronisation Google Calendar" },
      { type: "feature", description: "Gestion des documents et radiographies" },
      { type: "feature", description: "Tableau de bord personnalisable" },
    ],
  },
];

const typeConfig: Record<string, { label: string; className: string }> = {
  feature: { 
    label: "Nouveau", 
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" 
  },
  improvement: { 
    label: "Amélioration", 
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" 
  },
  fix: { 
    label: "Correction", 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" 
  },
  breaking: { 
    label: "Important", 
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" 
  },
};

interface PatchNotesDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PatchNotesDialog({ trigger, open, onOpenChange }: PatchNotesDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentNote = patchNotes[selectedIndex];

  const goToPrevious = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const goToNext = () => {
    if (selectedIndex < patchNotes.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[85vh]" data-testid="dialog-patch-notes">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouveautés
          </DialogTitle>
          <DialogDescription className="sr-only">
            Liste des mises à jour et nouvelles fonctionnalités de l'application
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Version {currentNote.version}</span>
              <Badge variant="outline" className="text-[10px]">
                {currentNote.date}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{currentNote.title}</p>
          </div>
          {patchNotes.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevious}
                disabled={selectedIndex === 0}
                data-testid="button-previous-patch"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                {selectedIndex + 1} / {patchNotes.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                disabled={selectedIndex === patchNotes.length - 1}
                data-testid="button-next-patch"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3 py-2">
            {currentNote.changes.map((change, i) => {
              const config = typeConfig[change.type];
              return (
                <div key={i} className="flex items-start gap-3">
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] border-0 shrink-0 ${config.className}`}
                  >
                    {config.label}
                  </Badge>
                  <p className="text-xs text-foreground/90">{change.description}</p>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
