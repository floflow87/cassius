import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Implant } from "@shared/types";

interface SurgeryImplantAddSheetProps {
  operationId: string;
  operationDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode?: "IMPLANT" | "PROTHESE";
}

export function SurgeryImplantAddSheet({
  operationId,
  operationDate,
  open,
  onOpenChange,
  onSuccess,
  mode = "IMPLANT",
}: SurgeryImplantAddSheetProps) {
  const { toast } = useToast();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedImplantId, setSelectedImplantId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    siteFdi: "",
    positionImplant: "",
    typeOs: "",
    miseEnCharge: "",
    greffeOsseuse: false,
    typeGreffe: "",
    isqPose: "",
    statut: "EN_SUIVI",
    mobilite: "",
    typePilier: "",
  });

  const { data: catalogImplants = [], isLoading: loadingCatalog } = useQuery<Implant[]>({
    queryKey: ["/api/implants"],
    enabled: open,
  });

  const filteredCatalog = useMemo(() => {
    return catalogImplants.filter((i) => i.typeImplant === mode);
  }, [catalogImplants, mode]);

  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(filteredCatalog.map((i) => i.marque)));
    return uniqueBrands.sort((a, b) => a.localeCompare(b));
  }, [filteredCatalog]);

  const dimensionsForBrand = useMemo(() => {
    if (!selectedBrand) return [];
    return filteredCatalog
      .filter((i) => i.marque === selectedBrand)
      .sort((a, b) => {
        if (a.diametre !== b.diametre) return a.diametre - b.diametre;
        return a.longueur - b.longueur;
      });
  }, [filteredCatalog, selectedBrand]);

  const selectedImplant = catalogImplants.find((i) => i.id === selectedImplantId);

  const isProthese = mode === "PROTHESE";
  const itemLabel = isProthese ? "prothèse" : "implant";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedImplantId) throw new Error(`Veuillez sélectionner ${isProthese ? "une prothèse" : "un implant"}`);
      if (!formData.siteFdi) throw new Error("Veuillez renseigner le site FDI");

      const payload: Record<string, unknown> = {
        surgeryId: operationId,
        implantId: selectedImplantId,
        siteFdi: formData.siteFdi,
        datePose: operationDate,
        statut: formData.statut,
      };

      if (!isProthese) {
        payload.positionImplant = formData.positionImplant || null;
        payload.typeOs = formData.typeOs || null;
        payload.miseEnCharge = formData.miseEnCharge || null;
        payload.greffeOsseuse = formData.greffeOsseuse;
        payload.typeGreffe = formData.typeGreffe || null;
        payload.isqPose = formData.isqPose ? parseInt(formData.isqPose) : null;
      }

      return apiRequest("POST", `/api/surgery-implants`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId] });
      toast({
        title: isProthese ? "Prothèse ajoutée" : "Implant ajouté",
        description: isProthese ? "La prothèse a été ajoutée à l'intervention." : "L'implant a été ajouté à l'intervention.",
        variant: "success",
      });
      resetForm();
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedBrand(null);
    setSelectedImplantId(null);
    setFormData({
      siteFdi: "",
      positionImplant: "",
      typeOs: "",
      miseEnCharge: "",
      greffeOsseuse: false,
      typeGreffe: "",
      isqPose: "",
      statut: "EN_SUIVI",
      mobilite: "",
      typePilier: "",
    });
  };

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedImplantId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isProthese ? "Ajouter une prothèse" : "Ajouter un implant"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {loadingCatalog ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Marque</Label>
                <Select value={selectedBrand || ""} onValueChange={handleBrandChange}>
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Sélectionner une marque" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand} data-testid={`option-brand-${brand}`}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBrand && (
                <div className="space-y-2">
                  <Label>{isProthese ? "Variante" : "Dimensions"}</Label>
                  <Select value={selectedImplantId || ""} onValueChange={setSelectedImplantId}>
                    <SelectTrigger data-testid="select-dimensions">
                      <SelectValue placeholder={isProthese ? "Sélectionner la variante" : "Sélectionner les dimensions"} />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensionsForBrand.map((item) => (
                        <SelectItem 
                          key={item.id} 
                          value={item.id}
                          data-testid={`option-dimension-${item.id}`}
                        >
                          {isProthese ? (
                            <>
                              {item.referenceFabricant || "Standard"}
                              {item.typeProthese && ` - ${item.typeProthese === "VISSEE" ? "Vissée" : "Scellée"}`}
                            </>
                          ) : (
                            <>
                              {item.diametre}mm x {item.longueur}mm
                              {item.referenceFabricant && ` (${item.referenceFabricant})`}
                            </>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {selectedImplant && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">{isProthese ? "Prothèse sélectionnée" : "Implant sélectionné"}</p>
              <p className="text-sm font-medium">{selectedImplant.marque}</p>
              <p className="text-xs text-muted-foreground">
                {isProthese ? (
                  <>
                    {selectedImplant.referenceFabricant || "Standard"}
                    {selectedImplant.typeProthese && ` - ${selectedImplant.typeProthese === "VISSEE" ? "Vissée" : "Scellée"}`}
                  </>
                ) : (
                  <>
                    {selectedImplant.diametre}mm x {selectedImplant.longueur}mm
                    {selectedImplant.referenceFabricant && ` - ${selectedImplant.referenceFabricant}`}
                  </>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="siteFdi">Site FDI *</Label>
            <Input
              id="siteFdi"
              value={formData.siteFdi}
              onChange={(e) => setFormData((prev) => ({ ...prev, siteFdi: e.target.value }))}
              placeholder="Ex: 11, 21, 36..."
              data-testid="input-site-fdi"
            />
          </div>

          {isProthese ? (
            <>
              <div className="space-y-2">
                <Label>Type de prothèse</Label>
                <Select
                  value={formData.mobilite}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, mobilite: value }))}
                >
                  <SelectTrigger data-testid="select-mobilite">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMOVIBLE">Amovible</SelectItem>
                    <SelectItem value="FIXE">Fixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de connexion</Label>
                <Select
                  value={formData.typePilier}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, typePilier: value }))}
                >
                  <SelectTrigger data-testid="select-type-pilier">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISSE">Vissé</SelectItem>
                    <SelectItem value="SCELLE">Scellé</SelectItem>
                    <SelectItem value="MULTI_UNIT">Multi-unit</SelectItem>
                    <SelectItem value="DROIT">Droit</SelectItem>
                    <SelectItem value="ANGULE">Angulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Position de l'implant</Label>
                <Select
                  value={formData.positionImplant}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, positionImplant: value }))}
                >
                  <SelectTrigger data-testid="select-position">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRESTAL">Crestal</SelectItem>
                    <SelectItem value="SOUS_CRESTAL">Sous-crestal</SelectItem>
                    <SelectItem value="SUPRA_CRESTAL">Supra-crestal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type d'os</Label>
                <Select
                  value={formData.typeOs}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, typeOs: value }))}
                >
                  <SelectTrigger data-testid="select-type-os">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="D1">D1</SelectItem>
                    <SelectItem value="D2">D2</SelectItem>
                    <SelectItem value="D3">D3</SelectItem>
                    <SelectItem value="D4">D4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mise en charge</Label>
                <Select
                  value={formData.miseEnCharge}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, miseEnCharge: value }))}
                >
                  <SelectTrigger data-testid="select-mise-en-charge">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMMEDIATE">Immédiate</SelectItem>
                    <SelectItem value="PRECOCE">Précoce</SelectItem>
                    <SelectItem value="DIFFEREE">Différée</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isqPose">ISQ à la pose</Label>
                <Input
                  id="isqPose"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.isqPose}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isqPose: e.target.value }))}
                  placeholder="0-100"
                  data-testid="input-isq-pose"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="greffeOsseuse">Greffe osseuse</Label>
                <Switch
                  id="greffeOsseuse"
                  checked={formData.greffeOsseuse}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, greffeOsseuse: checked }))}
                  data-testid="switch-greffe"
                />
              </div>

              {formData.greffeOsseuse && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                  <Label htmlFor="typeGreffe">Type de greffe</Label>
                  <Input
                    id="typeGreffe"
                    value={formData.typeGreffe}
                    onChange={(e) => setFormData((prev) => ({ ...prev, typeGreffe: e.target.value }))}
                    placeholder="Ex: Autogène, Xénogreffe..."
                    data-testid="input-type-greffe"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedImplantId || !formData.siteFdi}
              data-testid="button-add-implant"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ajout...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
