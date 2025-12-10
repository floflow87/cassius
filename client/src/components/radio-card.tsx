import { useState } from "react";
import { Calendar, FileImage, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Radio } from "@shared/schema";

interface RadioCardProps {
  radio: Radio;
}

const typeLabels: Record<string, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Rétro-alvéolaire",
};

export function RadioCard({ radio }: RadioCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getImageUrl = () => {
    if (radio.url.startsWith("/objects/")) {
      return radio.url;
    }
    return radio.url;
  };

  return (
    <>
      <Card
        className="hover-elevate cursor-pointer overflow-hidden"
        onClick={() => setDialogOpen(true)}
        data-testid={`card-radio-${radio.id}`}
      >
        <div className="aspect-video bg-muted relative">
          {radio.url ? (
            <img
              src={getImageUrl()}
              alt={`Radio ${typeLabels[radio.type]}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `<div class="w-full h-full flex items-center justify-center"><svg class="h-12 w-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileImage className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <Badge variant="secondary" className="absolute top-2 right-2">
            {typeLabels[radio.type] || radio.type}
          </Badge>
        </div>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(radio.date)}</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">{typeLabels[radio.type]}</Badge>
              <span className="text-sm text-muted-foreground font-normal">
                {formatDate(radio.date)}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-md overflow-hidden">
            {radio.url ? (
              <img
                src={getImageUrl()}
                alt={`Radio ${typeLabels[radio.type]}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileImage className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
