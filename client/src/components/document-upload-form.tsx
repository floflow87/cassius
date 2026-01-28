import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Upload, FileText, X, Loader2, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_DOC_TYPES = ["application/pdf"];
const ACCEPTED_RADIO_TYPES = ["image/jpeg", "image/png", "image/dicom", "application/dicom", "application/pdf"];

const TAG_OPTIONS = [
  { value: "DEVIS", label: "Devis" },
  { value: "CONSENTEMENT", label: "Consentement" },
  { value: "COMPTE_RENDU", label: "Compte-rendu" },
  { value: "ASSURANCE", label: "Assurance" },
  { value: "AUTRE", label: "Autre" },
];

const RADIO_TYPE_OPTIONS = [
  { value: "PANORAMIQUE", label: "Panoramique" },
  { value: "CBCT", label: "CBCT" },
  { value: "RETROALVEOLAIRE", label: "Rétroalvéolaire" },
];

type FileUploadType = "document" | "radio";

const documentFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  tags: z.array(z.string()).default([]),
  filePath: z.string().min(1, "Veuillez telecharger un fichier PDF"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});

const radioFormSchema = z.object({
  typeRadio: z.enum(["PANORAMIQUE", "CBCT", "RETROALVEOLAIRE"], { required_error: "Veuillez sélectionner un type de radio" }),
  dateRadio: z.date({ required_error: "Veuillez sélectionner une date" }),
  filePath: z.string().min(1, "Veuillez telecharger un fichier"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});

type DocumentFormData = z.infer<typeof documentFormSchema>;
type RadioFormData = z.infer<typeof radioFormSchema>;

interface DocumentUploadFormProps {
  patientId: string;
  onSuccess?: () => void;
}

export function DocumentUploadForm({
  patientId,
  onSuccess,
}: DocumentUploadFormProps) {
  const { toast } = useToast();
  const [fileType, setFileType] = useState<FileUploadType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; path: string } | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      tags: [],
      filePath: "",
      fileName: "",
      mimeType: "",
      sizeBytes: 0,
    },
  });

  const radioForm = useForm<RadioFormData>({
    resolver: zodResolver(radioFormSchema),
    defaultValues: {
      typeRadio: undefined,
      dateRadio: undefined,
      filePath: "",
      fileName: "",
      mimeType: "",
      sizeBytes: 0,
    },
  });

  const documentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const res = await apiRequest("POST", "/api/documents", {
        ...data,
        patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/tree"] });
      toast({
        title: "Document ajouté",
        description: "Le document a été enregistré.",
        variant: "success",
      });
      resetAll();
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

  const radioMutation = useMutation({
    mutationFn: async (data: RadioFormData) => {
      const res = await apiRequest("POST", `/api/radios`, {
        patientId,
        type: data.typeRadio,
        title: data.fileName || `Radio ${data.typeRadio}`,
        date: format(data.dateRadio, "yyyy-MM-dd"),
        filePath: data.filePath,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "radios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/tree"] });
      toast({
        title: "Radio ajoutée",
        description: "La radiographie a été enregistrée.",
        variant: "success",
      });
      resetAll();
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

  const resetAll = () => {
    setFileType(null);
    setUploadedFile(null);
    setUploadError("");
    documentForm.reset();
    radioForm.reset();
  };

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
    if (fileType === "document") {
      documentForm.setValue("filePath", "");
      documentForm.setValue("fileName", "");
      documentForm.setValue("mimeType", "");
      documentForm.setValue("sizeBytes", 0);
    } else {
      radioForm.setValue("filePath", "");
      radioForm.setValue("fileName", "");
      radioForm.setValue("mimeType", "");
      radioForm.setValue("sizeBytes", 0);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleTag = (tag: string) => {
    const currentTags = documentForm.getValues("tags");
    if (currentTags.includes(tag)) {
      documentForm.setValue("tags", currentTags.filter(t => t !== tag));
    } else {
      documentForm.setValue("tags", [...currentTags, tag]);
    }
  };

  const onSubmitDocument = (data: DocumentFormData) => {
    documentMutation.mutate(data);
  };

  const onSubmitRadio = (data: RadioFormData) => {
    radioMutation.mutate(data);
  };

  const selectedTags = documentForm.watch("tags");

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
    const acceptedTypes = fileType === "radio" ? ACCEPTED_RADIO_TYPES : ACCEPTED_DOC_TYPES;
    
    if (!acceptedTypes.includes(file.type)) {
      if (fileType === "radio") {
        setUploadError("Type de fichier non supporté. Utilisez des images (JPEG, PNG) ou PDF.");
      } else {
        setUploadError("Type de fichier non supporté. Utilisez uniquement des fichiers PDF.");
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Le fichier est trop volumineux. Maximum 10 Mo.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const uploadEndpoint = fileType === "radio" 
        ? "/api/radios/upload-url" 
        : "/api/documents/upload-url";
      
      const urlRes = await apiRequest("POST", uploadEndpoint, {
        patientId,
        fileName: file.name,
        mimeType: file.type,
      });
      
      // Check if response is OK before parsing JSON
      if (!urlRes.ok) {
        const errorText = await urlRes.text().catch(() => "Unknown error");
        console.error("Upload URL request failed:", urlRes.status, errorText);
        throw new Error(`Erreur serveur: ${urlRes.status}`);
      }
      
      // Check content type before parsing
      const contentType = urlRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await urlRes.text();
        console.error("Expected JSON but got:", contentType, text.substring(0, 200));
        throw new Error("Réponse serveur invalide");
      }
      
      const urlData = await urlRes.json();
      
      if (!urlData.signedUrl || !urlData.filePath) {
        console.error("Missing signedUrl or filePath in response:", urlData);
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
      
      if (fileType === "document") {
        documentForm.setValue("filePath", urlData.filePath);
        documentForm.setValue("fileName", file.name);
        documentForm.setValue("mimeType", file.type);
        documentForm.setValue("sizeBytes", file.size);

        if (!documentForm.getValues("title")) {
          documentForm.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
        }
      } else {
        radioForm.setValue("filePath", urlData.filePath);
        radioForm.setValue("fileName", file.name);
        radioForm.setValue("mimeType", file.type);
        radioForm.setValue("sizeBytes", file.size);
      }

      toast({
        title: "Fichier téléversé",
        description: "Le fichier a été téléversé avec succès.",
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
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const getAcceptedTypes = () => {
    if (fileType === "radio") {
      return ".jpg,.jpeg,.png,.pdf,.dcm,image/jpeg,image/png,application/pdf,application/dicom";
    }
    return ".pdf,application/pdf";
  };

  // Step 1: Choose file type
  if (!fileType) {
    return (
      <div className="space-y-4">
        <Label className="font-light text-muted-foreground">Quel type de fichier souhaitez-vous ajouter ?</Label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFileType("radio")}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
            data-testid="button-type-radio"
          >
            <Image className="h-10 w-10 text-blue-500" />
            <span className="font-medium">Radiographie</span>
            <span className="text-xs text-muted-foreground text-center">
              Panoramique, CBCT, Rétroalvéolaire
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFileType("document")}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
            data-testid="button-type-document"
          >
            <File className="h-10 w-10 text-muted-foreground" />
            <span className="font-medium">Document</span>
            <span className="text-xs text-muted-foreground text-center">
              Devis, Consentement, Compte-rendu
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Radio form
  if (fileType === "radio") {
    return (
      <Form {...radioForm}>
        <form onSubmit={radioForm.handleSubmit(onSubmitRadio)} className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAll}
              data-testid="button-back-type"
            >
              <X className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Radiographie
            </Badge>
          </div>

          <FormField
            control={radioForm.control}
            name="typeRadio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-light">Type de radio</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-radio-type">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RADIO_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={radioForm.control}
            name="dateRadio"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="font-light">Date de la radio</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-radio-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: fr })
                        ) : (
                          <span>Sélectionner une date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={radioForm.control}
            name="filePath"
            render={() => (
              <FormItem>
                <FormLabel className="font-light">Fichier image</FormLabel>
                <FormControl>
                  <div>
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                        <Image className="h-5 w-5 text-blue-500" />
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
                          accept={getAcceptedTypes()}
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isUploading}
                          data-testid="input-radio-file"
                        />
                        <div 
                          onClick={handleFileClick}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                            isDragging 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-muted-foreground/25 hover:border-blue-500/50 hover:bg-muted/50"
                          }`}
                          data-testid="dropzone-radio"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="text-sm">Téléversement...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Cliquez ou déposez une image (JPEG, PNG) ou PDF
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
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={radioMutation.isPending || isUploading || !uploadedFile}
            data-testid="button-submit-radio"
          >
            {radioMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer la radiographie"
            )}
          </Button>
        </form>
      </Form>
    );
  }

  // Step 2: Document form
  return (
    <Form {...documentForm}>
      <form onSubmit={documentForm.handleSubmit(onSubmitDocument)} className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            data-testid="button-back-type"
          >
            <X className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Badge variant="outline">
            Document
          </Badge>
        </div>

        <FormField
          control={documentForm.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-light">Nom du document</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ex: Devis prothèse" 
                  {...field} 
                  data-testid="input-document-title" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={documentForm.control}
          name="tags"
          render={() => (
            <FormItem>
              <FormLabel className="font-light">Tags</FormLabel>
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
          control={documentForm.control}
          name="filePath"
          render={() => (
            <FormItem>
              <FormLabel className="font-light">Fichier PDF</FormLabel>
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
                        accept={getAcceptedTypes()}
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
                            <span className="text-sm">Téléversement...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Cliquez ou déposez un fichier PDF
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
          disabled={documentMutation.isPending || isUploading || !uploadedFile}
          data-testid="button-submit-document"
        >
          {documentMutation.isPending ? (
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
