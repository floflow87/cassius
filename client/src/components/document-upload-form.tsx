import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Upload, FileText, X, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf"];

const TAG_OPTIONS = [
  { value: "DEVIS", label: "Devis" },
  { value: "CONSENTEMENT", label: "Consentement" },
  { value: "COMPTE_RENDU", label: "Compte-rendu" },
  { value: "ASSURANCE", label: "Assurance" },
  { value: "AUTRE", label: "Autre" },
];

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  tags: z.array(z.string()).default([]),
  filePath: z.string().min(1, "Veuillez telecharger un fichier PDF"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DocumentUploadFormProps {
  patientId: string;
  onSuccess?: () => void;
}

export function DocumentUploadForm({
  patientId,
  onSuccess,
}: DocumentUploadFormProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; path: string } | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      tags: [],
      filePath: "",
      fileName: "",
      mimeType: "",
      sizeBytes: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/documents", {
        ...data,
        patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast({
        title: "Document ajoute",
        description: "Le document a ete enregistre.",
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

  const toggleTag = (tag: string) => {
    const currentTags = form.getValues("tags");
    if (currentTags.includes(tag)) {
      form.setValue("tags", currentTags.filter(t => t !== tag));
    } else {
      form.setValue("tags", [...currentTags, tag]);
    }
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const selectedTags = form.watch("tags");
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Type de fichier non supporte. Utilisez uniquement des fichiers PDF.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Le fichier est trop volumineux. Maximum 10 Mo.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const urlRes = await apiRequest("POST", "/api/documents/upload-url", {
        patientId,
        fileName: file.name,
        mimeType: file.type,
      });
      const urlData = await urlRes.json();
      
      if (!urlData.signedUrl || !urlData.filePath) {
        throw new Error("Impossible d'obtenir l'URL d'upload");
      }

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
        throw new Error(`Echec du televersement: ${uploadRes.status}`);
      }

      setUploadedFile({ name: file.name, path: urlData.filePath });
      form.setValue("filePath", urlData.filePath);
      form.setValue("fileName", file.name);
      form.setValue("mimeType", file.type);
      form.setValue("sizeBytes", file.size);

      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }

      toast({
        title: "Fichier televerse",
        description: "Le fichier a ete televerse avec succes.",
        variant: "success",
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError("Impossible de televerser le fichier. Veuillez reessayer.");
      toast({
        title: "Erreur",
        description: "Impossible de televerser le fichier.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
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
                  placeholder="Ex: Devis prothese" 
                  {...field} 
                  data-testid="input-document-title" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={() => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => (
                  <Badge
                    key={tag.value}
                    variant={selectedTags.includes(tag.value) ? "default" : "outline"}
                    className="cursor-pointer toggle-elevate"
                    onClick={() => toggleTag(tag.value)}
                    data-testid={`tag-${tag.value}`}
                  >
                    {tag.label}
                  </Badge>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="filePath"
          render={() => (
            <FormItem>
              <FormLabel>Fichier PDF</FormLabel>
              <FormControl>
                <div>
                  {uploadedFile ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="flex-1 truncate text-sm">{uploadedFile.name}</span>
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
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isUploading}
                        data-testid="input-document-file"
                      />
                      <div 
                        onClick={handleFileClick}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                          isDragging 
                            ? "border-primary bg-primary/10" 
                            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                        }`}
                        data-testid="dropzone-document"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Televersement...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Cliquez ou deposez un fichier PDF
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {uploadError && (
                    <p className="text-sm text-destructive mt-2">{uploadError}</p>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={mutation.isPending || isUploading || !uploadedFile}
          data-testid="button-submit-document"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer le document"
          )}
        </Button>
      </form>
    </Form>
  );
}
