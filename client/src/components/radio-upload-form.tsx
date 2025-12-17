import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Upload, FileImage, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Operation, Implant } from "@shared/schema";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  type: z.enum(["PANORAMIQUE", "CBCT", "RETROALVEOLAIRE"]),
  date: z.string().min(1, "La date est requise"),
  operationId: z.string().optional(),
  implantId: z.string().optional(),
  filePath: z.string().min(1, "Veuillez téléverser une image"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RadioUploadFormProps {
  patientId: string;
  operations: Operation[];
  implants: Implant[];
  onSuccess?: () => void;
}

export function RadioUploadForm({
  patientId,
  operations,
  implants,
  onSuccess,
}: RadioUploadFormProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; path: string } | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "PANORAMIQUE",
      date: new Date().toISOString().split("T")[0],
      filePath: "",
      fileName: "",
      mimeType: "",
      sizeBytes: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/radios", {
        ...data,
        patientId,
        operationId: data.operationId || null,
        implantId: data.implantId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({
        title: "Radio ajoutée",
        description: "La radiographie a été enregistrée.",
        variant: "success",
      });
      form.reset();
      setUploadedFile(null);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Type de fichier non supporté. Utilisez JPEG, PNG, GIF, WebP ou PDF.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Le fichier est trop volumineux. Maximum 10 Mo.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      // Step 1: Get signed upload URL from API
      const urlRes = await apiRequest("POST", "/api/radios/upload-url", {
        patientId,
        fileName: file.name,
        mimeType: file.type,
      });
      const urlData = await urlRes.json();
      
      if (!urlData.signedUrl || !urlData.filePath) {
        throw new Error("Impossible d'obtenir l'URL d'upload");
      }

      // Step 2: Upload file directly to Supabase Storage
      const uploadRes = await fetch(urlData.signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
          "x-upsert": "true",
        },
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => "Unknown error");
        console.error("Upload failed:", uploadRes.status, errorText);
        throw new Error(`Échec du téléversement: ${uploadRes.status}`);
      }

      // Step 3: Update form values
      setUploadedFile({ name: file.name, path: urlData.filePath });
      form.setValue("filePath", urlData.filePath);
      form.setValue("fileName", file.name);
      form.setValue("mimeType", file.type);
      form.setValue("sizeBytes", file.size);

      // Auto-fill title from filename if empty
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }

      toast({
        title: "Image téléversée",
        description: "L'image a été téléversée avec succès.",
        variant: "success",
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError("Impossible de téléverser le fichier. Veuillez réessayer.");
      toast({
        title: "Erreur",
        description: "Impossible de téléverser le fichier.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    form.setValue("filePath", "");
    form.setValue("fileName", "");
    form.setValue("mimeType", "");
    form.setValue("sizeBytes", 0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom du document</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ex: Radio panoramique pré-opératoire" 
                  {...field} 
                  data-testid="input-radio-title" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de radio</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-radio-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PANORAMIQUE">Panoramique</SelectItem>
                    <SelectItem value="CBCT">CBCT</SelectItem>
                    <SelectItem value="RETROALVEOLAIRE">Rétro-alvéolaire</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-radio-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {operations.length > 0 && (
          <FormField
            control={form.control}
            name="operationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lier à une opération (optionnel)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une opération" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {operations.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {formatDate(op.dateOperation)} - {op.typeIntervention.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {implants.length > 0 && (
          <FormField
            control={form.control}
            name="implantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lier à un implant (optionnel)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un implant" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {implants.map((imp) => (
                      <SelectItem key={imp.id} value={imp.id}>
                        Site {imp.siteFdi} - {imp.marque} ({imp.diametre}x{imp.longueur}mm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="filePath"
          render={() => (
            <FormItem>
              <FormLabel>Image</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  {!uploadedFile ? (
                    <div className="flex items-center gap-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        onChange={handleFileSelect}
                        className="hidden"
                        id="radio-file-input"
                        data-testid="input-radio-file"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex-1"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Téléversement...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Sélectionner une image
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                      <FileImage className="h-8 w-8 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">Prêt à enregistrer</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Formats acceptés : JPEG, PNG, GIF, WebP, PDF. Taille max : 10 Mo.
                  </p>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={mutation.isPending || isUploading}
            data-testid="button-submit-radio"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Ajouter la radiographie"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
