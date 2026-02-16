import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import type { SurgeryImplantWithDetails } from "@shared/types";

interface SurgeryImplantEditSheetProps {
  surgeryImplant: SurgeryImplantWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const calculateWeightedISQ = (v: string, m: string, d: string): number | null => {
  const vest = v ? parseFloat(v) : null;
  const mes = m ? parseFloat(m) : null;
  const dis = d ? parseFloat(d) : null;
  
  if (vest === null && mes === null && dis === null) return null;
  
  let sum = 0;
  let count = 0;
  if (vest !== null && !isNaN(vest)) { sum += vest * 2; count += 2; }
  if (mes !== null && !isNaN(mes)) { sum += mes; count += 1; }
  if (dis !== null && !isNaN(dis)) { sum += dis; count += 1; }
  
  if (count === 0) return null;
  return Math.round((sum / count) * 10) / 10;
};

export function SurgeryImplantEditSheet({
  surgeryImplant,
  open,
  onOpenChange,
  onSuccess,
}: SurgeryImplantEditSheetProps) {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    siteFdi: "",
    positionImplant: "",
    typeOs: "",
    miseEnCharge: "",
    greffeOsseuse: false,
    typeGreffe: "",
    greffeQuantite: "",
    isqVestibulaire: "",
    isqMesial: "",
    isqDistal: "",
    statut: "EN_SUIVI",
  });

  const calculatedISQ = calculateWeightedISQ(
    formData.isqVestibulaire,
    formData.isqMesial,
    formData.isqDistal
  );

  useEffect(() => {
    if (surgeryImplant) {
      setFormData({
        siteFdi: surgeryImplant.siteFdi || "",
        positionImplant: surgeryImplant.positionImplant || "",
        typeOs: surgeryImplant.typeOs || "",
        miseEnCharge: surgeryImplant.miseEnCharge || "",
        greffeOsseuse: surgeryImplant.greffeOsseuse || false,
        typeGreffe: surgeryImplant.typeGreffe || "",
        greffeQuantite: surgeryImplant.greffeQuantite || "",
        isqVestibulaire: surgeryImplant.isqVestibulaire?.toString() || "",
        isqMesial: surgeryImplant.isqMesial?.toString() || "",
        isqDistal: surgeryImplant.isqDistal?.toString() || "",
        statut: surgeryImplant.statut || "EN_SUIVI",
      });
    }
  }, [surgeryImplant]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const isqPoseValue = calculateWeightedISQ(data.isqVestibulaire, data.isqMesial, data.isqDistal);
      return apiRequest("PATCH", `/api/surgery-implants/${surgeryImplant?.id}`, {
        siteFdi: data.siteFdi || null,
        positionImplant: data.positionImplant || null,
        typeOs: data.typeOs || null,
        miseEnCharge: data.miseEnCharge || null,
        greffeOsseuse: data.greffeOsseuse,
        typeGreffe: data.typeGreffe || null,
        greffeQuantite: data.greffeQuantite || null,
        isqPose: isqPoseValue !== null ? Math.round(isqPoseValue) : null,
        isqVestibulaire: data.isqVestibulaire ? parseInt(data.isqVestibulaire) : null,
        isqMesial: data.isqMesial ? parseInt(data.isqMesial) : null,
        isqDistal: data.isqDistal ? parseInt(data.isqDistal) : null,
        statut: data.statut,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgery-implants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      toast({
        title: "Modifications enregistrées",
        description: "Les informations de l'implant ont été mises à jour.",
        variant: "success",
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (!surgeryImplant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Modifier l'implant posé</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="p-3 bg-muted rounded-md mb-4">
            <p className="text-sm font-medium">{surgeryImplant.implant.marque}</p>
            <p className="text-xs text-muted-foreground">
              {surgeryImplant.implant.diametre}mm x {surgeryImplant.implant.longueur}mm
              {surgeryImplant.implant.referenceFabricant && ` - ${surgeryImplant.implant.referenceFabricant}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteFdi">Site FDI</Label>
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
            <Label>Statut</Label>
            <Select
              value={formData.statut}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, statut: value }))}
            >
              <SelectTrigger data-testid="select-statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EN_SUIVI">En suivi</SelectItem>
                <SelectItem value="SUCCES">Succès</SelectItem>
                <SelectItem value="COMPLICATION">Complication</SelectItem>
                <SelectItem value="ECHEC">Échec</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">ISQ à la pose (V / M / D)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Vestibulaire</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="V"
                  value={formData.isqVestibulaire}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isqVestibulaire: e.target.value }))}
                  data-testid="input-isq-vest"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Mésial</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="M"
                  value={formData.isqMesial}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isqMesial: e.target.value }))}
                  data-testid="input-isq-mesial"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Distal</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="D"
                  value={formData.isqDistal}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isqDistal: e.target.value }))}
                  data-testid="input-isq-distal"
                />
              </div>
            </div>
            {calculatedISQ !== null && (
              <p className="text-xs text-muted-foreground">
                Moyenne pondérée : <span className="font-mono font-medium">{calculatedISQ}</span>
              </p>
            )}
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
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label htmlFor="typeGreffe">Type de greffe</Label>
                <Input
                  id="typeGreffe"
                  value={formData.typeGreffe}
                  onChange={(e) => setFormData((prev) => ({ ...prev, typeGreffe: e.target.value }))}
                  placeholder="Ex: Autogène, Xénogreffe..."
                  data-testid="input-type-greffe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="greffeQuantite">Quantité de greffe</Label>
                <Input
                  id="greffeQuantite"
                  value={formData.greffeQuantite}
                  onChange={(e) => setFormData((prev) => ({ ...prev, greffeQuantite: e.target.value }))}
                  placeholder="Ex: 0.5cc, 1g..."
                  data-testid="input-greffe-quantite"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-implant">
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
