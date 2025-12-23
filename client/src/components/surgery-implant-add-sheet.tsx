import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
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
}

export function SurgeryImplantAddSheet({
  operationId,
  operationDate,
  open,
  onOpenChange,
  onSuccess,
}: SurgeryImplantAddSheetProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
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
  });

  const { data: catalogImplants = [], isLoading: loadingCatalog } = useQuery<Implant[]>({
    queryKey: ["/api/implants"],
    enabled: open,
  });

  const filteredImplants = catalogImplants.filter((implant) => {
    const search = searchTerm.toLowerCase();
    return (
      implant.marque.toLowerCase().includes(search) ||
      implant.referenceFabricant?.toLowerCase().includes(search) ||
      `${implant.diametre}`.includes(search) ||
      `${implant.longueur}`.includes(search)
    );
  });

  const selectedImplant = catalogImplants.find((i) => i.id === selectedImplantId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedImplantId) throw new Error("Veuillez sélectionner un implant");
      if (!formData.siteFdi) throw new Error("Veuillez renseigner le site FDI");

      return apiRequest("POST", `/api/surgery-implants`, {
        surgeryId: operationId,
        implantId: selectedImplantId,
        siteFdi: formData.siteFdi,
        positionImplant: formData.positionImplant || null,
        typeOs: formData.typeOs || null,
        miseEnCharge: formData.miseEnCharge || null,
        greffeOsseuse: formData.greffeOsseuse,
        typeGreffe: formData.typeGreffe || null,
        isqPose: formData.isqPose ? parseInt(formData.isqPose) : null,
        statut: formData.statut,
        datePose: operationDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId] });
      toast({
        title: "Implant ajouté",
        description: "L'implant a été ajouté à l'intervention.",
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
    setSearchTerm("");
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
    });
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
          <SheetTitle>Ajouter un implant</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Sélectionner un implant du catalogue</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par marque, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-implant"
              />
            </div>
          </div>

          {loadingCatalog ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {filteredImplants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun implant trouvé
                </p>
              ) : (
                filteredImplants.map((implant) => (
                  <div
                    key={implant.id}
                    className={`p-3 cursor-pointer border-b last:border-b-0 hover-elevate ${
                      selectedImplantId === implant.id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedImplantId(implant.id)}
                    data-testid={`option-implant-${implant.id}`}
                  >
                    <p className="text-sm font-medium">{implant.marque}</p>
                    <p className="text-xs text-muted-foreground">
                      {implant.diametre}mm x {implant.longueur}mm
                      {implant.referenceFabricant && ` - ${implant.referenceFabricant}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedImplant && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Implant sélectionné</p>
              <p className="text-sm font-medium">{selectedImplant.marque}</p>
              <p className="text-xs text-muted-foreground">
                {selectedImplant.diametre}mm x {selectedImplant.longueur}mm
                {selectedImplant.referenceFabricant && ` - ${selectedImplant.referenceFabricant}`}
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
