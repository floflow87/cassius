import { useState, useEffect } from "react";
import { Calendar, FileImage, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioDrawer } from "@/components/radio-drawer";
import type { Radio } from "@shared/types";

interface RadioCardProps {
  radio: Radio & { signedUrl?: string | null };
  patientId: string;
}

const typeLabels: Record<string, string> = {
  PANORAMIQUE: "Panoramique",
  CBCT: "CBCT",
  RETROALVEOLAIRE: "Retro-alveolaire",
};

export function RadioCard({ radio, patientId }: RadioCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [freshSignedUrl, setFreshSignedUrl] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  useEffect(() => {
    if (radio.filePath && !radio.signedUrl && !radio.url && !freshSignedUrl && !thumbnailLoading) {
      setThumbnailLoading(true);
      fetch(`/api/radios/${radio.id}/signed-url`, { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.signedUrl) {
            setFreshSignedUrl(data.signedUrl);
          }
        })
        .catch(err => console.error("Failed to load thumbnail URL:", err))
        .finally(() => setThumbnailLoading(false));
    }
  }, [radio.id, radio.filePath, radio.signedUrl, radio.url, freshSignedUrl, thumbnailLoading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getImageUrl = () => {
    if (freshSignedUrl) return freshSignedUrl;
    if (radio.signedUrl) return radio.signedUrl;
    if (radio.url) return radio.url.startsWith("/objects/") ? radio.url : `/objects/${radio.url}`;
    return "";
  };

  return (
    <>
      <Card
        className="group relative overflow-hidden cursor-pointer hover-elevate"
        onClick={() => setDrawerOpen(true)}
        data-testid={`card-radio-${radio.id}`}
      >
        <div className="aspect-square bg-muted">
          {thumbnailLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
          ) : getImageUrl() && !imageError ? (
            <img
              src={getImageUrl()}
              alt={radio.title || `Radio ${typeLabels[radio.type]}`}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileImage className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <Badge variant="secondary" className="absolute top-2 left-2">
            {typeLabels[radio.type] || radio.type}
          </Badge>
        </div>
        <CardContent className="p-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid={`text-radio-title-${radio.id}`}>
              {radio.title || "Sans titre"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(radio.date)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <RadioDrawer
        radio={radio}
        patientId={patientId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
