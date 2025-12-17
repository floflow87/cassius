import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Upload } from "lucide-react";
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
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Operation, Implant } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  type: z.enum(["PANORAMIQUE", "CBCT", "RETROALVEOLAIRE"]),
  date: z.string().min(1, "La date est requise"),
  operationId: z.string().optional(),
  implantId: z.string().optional(),
  url: z.string().min(1, "Veuillez télécharger une image"),
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
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "PANORAMIQUE",
      date: new Date().toISOString().split("T")[0],
      url: "",
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
      setUploadedUrl("");
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

  const handleGetUploadParameters = async () => {
    const res = await apiRequest("POST", "/api/objects/upload", {});
    const data = await res.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => {
    setUploadError("");
    if (result.successful && result.successful.length > 0) {
      const uploadUrl = result.successful[0].uploadURL;
      if (uploadUrl) {
        try {
          const res = await apiRequest("PUT", "/api/radios/upload-complete", {
            uploadURL: uploadUrl,
          });
          const data = await res.json();
          setUploadedUrl(data.objectPath);
          form.setValue("url", data.objectPath);
          // Auto-fill title from filename if empty
          const fileName = result.successful[0].name || "Radio";
          if (!form.getValues("title")) {
            form.setValue("title", fileName.replace(/\.[^/.]+$/, ""));
          }
          // Capture file metadata
          if (result.successful[0].type) {
            form.setValue("mimeType", result.successful[0].type);
          }
          if (result.successful[0].size) {
            form.setValue("sizeBytes", result.successful[0].size);
          }
          toast({
            title: "Image televersee",
            description: "L'image a ete televersee avec succes.",
          });
        } catch (error) {
          setUploadError("Impossible de finaliser le telechargement. Veuillez reessayer.");
          form.setValue("url", "");
          setUploadedUrl("");
          toast({
            title: "Erreur",
            description: "Impossible de finaliser le telechargement.",
            variant: "destructive",
          });
        }
      }
    } else if (result.failed && result.failed.length > 0) {
      setUploadError("Le telechargement a echoue. Veuillez reessayer.");
      toast({
        title: "Erreur",
        description: "Le telechargement a echoue.",
        variant: "destructive",
      });
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
                        Site {imp.siteFdi} - {imp.marque}
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
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  {uploadedUrl ? (
                    <div className="p-3 border rounded-md bg-muted/50 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">Image téléchargée</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadedUrl("");
                          form.setValue("url", "");
                        }}
                      >
                        Changer
                      </Button>
                    </div>
                  ) : (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={10485760}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      variant="outline"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Televerser une image
                    </ObjectUploader>
                  )}
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                  <Input type="hidden" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={mutation.isPending || !uploadedUrl}
            data-testid="button-submit-radio"
          >
            {mutation.isPending ? "Enregistrement..." : "Enregistrer la radio"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
