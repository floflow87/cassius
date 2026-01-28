import { useState, useEffect } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/use-onboarding";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Shield, 
  Link2, 
  Users, 
  Building2, 
  Check,
  X,
  Calendar,
  RefreshCw,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  ExternalLink,
  AlertCircle,
  Bell,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Circle,
  SkipForward,
  Sparkles
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import googleCalendarIcon from "@assets/Google_Calendar_icon_(2020).svg_1767601723458.png";
import gmailIcon from "@assets/gmail_1767602212820.png";
import outlookIcon from "@assets/Microsoft_Outlook_Icon_(2025–present).svg_1767602593769.png";
import googleMeetIcon from "@assets/google-meet_1767602721784.png";
import googleLogo from "@assets/logo_Google_1767604702248.png";

const profileFormSchema = z.object({
  nom: z.string().max(100, "Le nom ne peut pas dépasser 100 caractères"),
  prenom: z.string().max(100, "Le prénom ne peut pas dépasser 100 caractères"),
});

type SettingsSection = "security" | "integrations" | "collaborators" | "organization";

interface UserProfile {
  id: string;
  username: string;
  nom: string | null;
  prenom: string | null;
  role: "ADMIN" | "CHIRURGIEN" | "ASSISTANT";
  organisationId: string | null;
  organisationNom?: string;
  wasInvited?: boolean;
}

interface Collaborator {
  id: string;
  username: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  role: "ADMIN" | "CHIRURGIEN" | "ASSISTANT";
  status: "ACTIVE" | "PENDING";
  type: "user" | "invitation";
  expiresAt?: string;
  isOwner?: boolean;
}

interface Organisation {
  id: string;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  timezone?: string;
  createdAt: string;
}

interface GoogleIntegrationStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
  error?: string;
  integration?: {
    id: string;
    isEnabled: boolean;
    targetCalendarId?: string;
    targetCalendarName?: string;
    lastSyncAt?: string;
    syncErrorCount?: number;
    lastSyncError?: string;
  } | null;
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation requise"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const inviteSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["ADMIN", "CHIRURGIEN", "ASSISTANT"]),
  nom: z.string().optional(),
  prenom: z.string().optional(),
});

function getRoleLabel(role: string): string {
  switch (role) {
    case "ADMIN": return "Administrateur";
    case "CHIRURGIEN": return "Collaborateur";
    case "ASSISTANT": return "Assistant";
    default: return role;
  }
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "ADMIN": return "default";
    case "CHIRURGIEN": return "secondary";
    default: return "outline";
  }
}

export default function SettingsPage() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab") || "security";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  
  useEffect(() => {
    const newTab = urlParams.get("tab");
    if (newTab && ["security", "notifications", "collaborators", "organization", "integrations"].includes(newTab)) {
      setActiveTab(newTab);
    }
  }, [searchString]);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/settings/profile"],
  });

  const userIsAdmin = profile?.role === "ADMIN";
  const userIsAssistant = profile?.role === "ASSISTANT";
  const userWasInvited = profile?.wasInvited === true;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto px-6 pb-6" data-testid="settings-page">
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex gap-1 bg-white dark:bg-zinc-900 p-1 rounded-full mb-6 w-fit">
            {[
              { value: "security", label: "Informations & Sécurité", icon: Shield, show: true },
              { value: "notifications", label: "Notifications", icon: Bell, show: true },
              { value: "collaborators", label: "Collaborateurs", icon: Users, show: userIsAdmin },
              { value: "organization", label: "Organisation", icon: Building2, show: userIsAdmin },
              { value: "integrations", label: "Intégrations", icon: Link2, show: !userWasInvited && !userIsAssistant },
            ].filter(tab => tab.show).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full transition-colors duration-200 ${
                  activeTab === tab.value ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-${tab.value}`}
              >
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="settings-tab-indicator"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <tab.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>

          <TabsContent value="security">
            {profile ? (
              <div className="space-y-6">
                <SecuritySection profile={profile} onProfileUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/settings/profile"] })} />
                {!userWasInvited && <OnboardingSettingsSection />}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Chargement du profil...
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="notifications">
            <NotificationsSection />
          </TabsContent>
          
          {userIsAdmin && (
            <TabsContent value="collaborators">
              <CollaboratorsSection />
            </TabsContent>
          )}
          
          {userIsAdmin && (
            <TabsContent value="organization">
              <OrganizationSection />
            </TabsContent>
          )}
          
          {!userWasInvited && (
            <TabsContent value="integrations">
              <IntegrationsSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function SecuritySection({ profile, onProfileUpdate }: { profile: UserProfile; onProfileUpdate: () => void }) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    nom: profile.nom || "",
    prenom: profile.prenom || "",
  });

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileFormData({
        nom: profile.nom || "",
        prenom: profile.prenom || "",
      });
    }
  }, [profile, isEditingProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { nom: string; prenom: string }) => {
      return apiRequest("PUT", "/api/settings/profile", data);
    },
    onSuccess: () => {
      onProfileUpdate();
      setIsEditingProfile(false);
      toast({ title: "Profil mis à jour", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      return apiRequest("POST", "/api/settings/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "Mot de passe modifié", description: "Votre mot de passe a été mis à jour avec succès.", variant: "success" });
      setShowPasswordDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmitPassword = (data: z.infer<typeof passwordSchema>) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-semibold text-sm">
              <User className="w-4 h-4" />
              Profil utilisateur
            </CardTitle>
            {!isEditingProfile ? (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsEditingProfile(true)}
                data-testid="button-edit-profile"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-cancel-profile"
                >
                  Annuler
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    const parsed = profileFormSchema.safeParse(profileFormData);
                    if (!parsed.success) {
                      toast({ title: "Erreur", description: parsed.error.errors[0]?.message || "Données invalides", variant: "destructive" });
                      return;
                    }
                    updateProfileMutation.mutate(profileFormData);
                  }}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs font-light">Nom</Label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.nom}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, nom: e.target.value }))}
                  data-testid="input-user-nom"
                />
              ) : (
                <p className="font-light text-xs" data-testid="text-user-nom">{profile.nom || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs font-light">Prénom</Label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.prenom}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, prenom: e.target.value }))}
                  data-testid="input-user-prenom"
                />
              ) : (
                <p className="font-light text-xs" data-testid="text-user-prenom">{profile.prenom || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs font-light">Email / Identifiant</Label>
              <p className="font-light text-xs" data-testid="text-user-username">{profile.username}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs font-light">Rôle</Label>
              <div className="mt-1">
                <Badge variant={getRoleBadgeVariant(profile.role)} data-testid="badge-user-role">
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
            </div>
          </div>
          {profile.organisationNom && (
            <div>
              <Label className="text-muted-foreground text-xs font-light">Organisation</Label>
              <p className="font-light text-xs" data-testid="text-user-org">{profile.organisationNom}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            Sécurité du compte
          </CardTitle>
          <CardDescription className="font-light text-xs">
            Modifiez votre mot de passe pour sécuriser votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Sheet open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
            <SheetTrigger asChild>
              <Button variant="outline" data-testid="button-change-password">
                <Lock className="w-4 h-4 mr-2" />
                Modifier le mot de passe
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="font-light">Modifier le mot de passe</SheetTitle>
                <SheetDescription className="font-light">
                  Entrez votre mot de passe actuel et choisissez un nouveau mot de passe sécurisé.
                </SheetDescription>
              </SheetHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitPassword)} className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-light">Mot de passe actuel</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showCurrentPassword ? "text" : "password"}
                              {...field}
                              data-testid="input-current-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-light">Nouveau mot de passe</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              {...field}
                              data-testid="input-new-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <p className="text-sm text-destructive italic font-light mt-1">
                          Le nouveau mot de passe doit contenir au moins 8 caractères
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-light">Confirmer le mot de passe</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-confirm-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <SheetFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-submit-password">
                      {changePasswordMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Modifier
                    </Button>
                  </SheetFooter>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      <DeleteAccountSection profile={profile} />
    </div>
  );
}

function DeleteAccountSection({ profile }: { profile: UserProfile }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const REQUIRED_PHRASE = "supprimer mon compte";
  const isPhraseValid = confirmationPhrase.toLowerCase().trim() === REQUIRED_PHRASE;

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/settings/account", {
        confirmationPhrase: confirmationPhrase.toLowerCase().trim(),
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({ 
        title: "Compte supprimé", 
        description: data.message,
        variant: "success" 
      });
      setShowDeleteDialog(false);
      // Redirect to login page
      window.location.href = "/login";
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-sm text-destructive">
          <Trash2 className="w-4 h-4" />
          Supprimer mon compte
        </CardTitle>
        <CardDescription className="font-light text-xs">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive font-light">
              Une fois votre compte supprimé, il est impossible de revenir en arrière. Veuillez en être certain.
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs font-light">
            Pour confirmer, tapez <span className="font-medium text-destructive">{REQUIRED_PHRASE}</span> ci-dessous
          </Label>
          <Input
            value={confirmationPhrase}
            onChange={(e) => setConfirmationPhrase(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            placeholder={REQUIRED_PHRASE}
            className="border-destructive/30 focus-visible:ring-destructive/30 placeholder:text-[10px]"
            data-testid="input-delete-confirmation"
          />
        </div>

        <div className="flex justify-end">
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!isPhraseValid}
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Confirmation de suppression
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Êtes-vous absolument certain de vouloir supprimer votre compte ?</p>
                <p className="font-medium">Cette action est irréversible et entraînera :</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>La suppression définitive de votre compte utilisateur</li>
                  <li>La perte de toutes vos préférences et paramètres</li>
                  <li>Si vous êtes le seul membre de l'organisation, toutes les données de l'organisation seront également supprimées</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAccountMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteAccountMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteAccountMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Oui, supprimer mon compte
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingSettingsSection() {
  const [, setLocation] = useLocation();
  const [isOpenOverride, setIsOpenOverride] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { 
    state, 
    isLoading: onboardingLoading, 
    isCompleted, 
    isDismissed,
    showOnboarding,
    isPending
  } = useOnboarding();

  const { data: checklist, isLoading: checklistLoading } = useQuery<{
    completedCount: number;
    totalCount: number;
    items: Array<{ id: string; label: string; completed: boolean; actionUrl: string; wizardStep: number | null }>;
  }>({
    queryKey: ["/api/onboarding/checklist"],
    refetchInterval: 30000,
  });

  const markDoneMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("POST", `/api/onboarding/checklist/${itemId}/mark-done`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      if (data.allCompleted) {
        toast({
          title: "Félicitations !",
          description: "Vous avez terminé la configuration de Cassius.",
          className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de marquer comme fait",
        variant: "destructive",
      });
    },
  });

  const isLoading = onboardingLoading || checklistLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <CardTitle className="font-semibold text-sm">Configuration initiale</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = checklist && checklist.totalCount > 0 ? Math.round((checklist.completedCount / checklist.totalCount) * 100) : 0;
  const allCompleted = checklist && checklist.totalCount > 0 && checklist.completedCount === checklist.totalCount;
  const isOpen = isOpenOverride !== null ? isOpenOverride : !allCompleted;
  const setIsOpen = setIsOpenOverride;
  const statusBadge = allCompleted ? (
    <Badge variant="default" className="bg-green-500 hover:bg-green-600">Terminé</Badge>
  ) : (
    <Badge variant="secondary">En cours</Badge>
  );

  const handleResumeFirstIncomplete = () => {
    console.log("[Settings] handleResumeFirstIncomplete called, checklist:", checklist);
    // Find first incomplete item with a wizard step
    const firstIncomplete = checklist?.items.find((item: any) => !item.completed && item.wizardStep !== null);
    console.log("[Settings] First incomplete with wizardStep:", firstIncomplete);
    if (firstIncomplete && firstIncomplete.wizardStep !== null) {
      console.log("[Settings] Navigating to /onboarding?step=" + firstIncomplete.wizardStep);
      setLocation(`/onboarding?step=${firstIncomplete.wizardStep}`);
    } else {
      // Fallback to first incomplete item's actionUrl
      const anyIncomplete = checklist?.items.find((item: any) => !item.completed);
      console.log("[Settings] Fallback - any incomplete:", anyIncomplete);
      if (anyIncomplete) {
        console.log("[Settings] Navigating to:", anyIncomplete.actionUrl);
        setLocation(anyIncomplete.actionUrl);
      } else {
        // If no incomplete items, go to onboarding step 1
        console.log("[Settings] No incomplete items, going to /onboarding?step=1");
        setLocation("/onboarding?step=1");
      }
    }
  };

  const handleShowOnboarding = async () => {
    try {
      await showOnboarding();
      toast({
        title: "Configuration réactivée",
        description: "La progression s'affiche à nouveau sur le tableau de bord.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de réactiver la configuration",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover-elevate rounded p-1 -m-1" data-testid="button-toggle-onboarding-settings">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  Configuration initiale
                </CardTitle>
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {statusBadge}
              {!allCompleted && (
                <Button size="sm" onClick={handleResumeFirstIncomplete} data-testid="button-resume-onboarding-settings">
                  Reprendre
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="font-light text-xs">
            Suivez les étapes pour configurer complètement votre espace Cassius.
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progression globale</span>
                <span className="font-medium">{checklist?.completedCount || 0}/{checklist?.totalCount || 0}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="space-y-1">
              {checklist?.items.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs py-2 px-2 -mx-2 rounded hover-elevate"
                  data-testid={`settings-onboarding-step-${item.id}`}
                >
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => item.wizardStep !== null ? setLocation(`/onboarding?step=${item.wizardStep}`) : setLocation(item.actionUrl)}
                  >
                    {item.completed ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={item.completed ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.completed && (
                      <Checkbox 
                        checked={false}
                        onCheckedChange={() => markDoneMutation.mutate(item.id)}
                        disabled={markDoneMutation.isPending}
                        data-testid={`settings-checkbox-${item.id}`}
                      />
                    )}
                    <Badge variant={item.completed ? "default" : "outline"} className={item.completed ? "bg-green-500 hover:bg-green-600" : ""}>
                      {item.completed ? "Validé" : "À faire"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {isDismissed && !allCompleted && (
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShowOnboarding}
                  disabled={isPending}
                  data-testid="button-show-onboarding"
                >
                  Afficher sur le tableau de bord
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function IntegrationsSection() {
  const { toast } = useToast();

  const { data: googleStatus, isLoading: googleLoading } = useQuery<GoogleIntegrationStatus>({
    queryKey: ["/api/integrations/google/status"],
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/connect", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible d'obtenir l'URL d'autorisation");
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/integrations/google/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Google Calendar déconnecté", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sync/trigger");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Synchronisation démarrée", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/integrations/google/settings", { isEnabled: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
        {/* Google Calendar - Active Integration */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              {googleStatus?.connected ? (
                <Badge variant="default" className="bg-green-600 text-[11px]" data-testid="badge-google-connected">
                  <Check className="w-3 h-3 mr-1" />
                  Connecté
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]" data-testid="badge-google-disconnected">
                  Non connecté
                </Badge>
              )}
            </div>
            <div className="flex items-start gap-3">
              <img src={googleCalendarIcon} alt="Google Calendar" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Google Calendar</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos rendez-vous avec Google Calendar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {googleLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            ) : googleStatus?.connected ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Votre compte Google est connecté.{" "}
                  <Link 
                    href="/settings/google-calendar" 
                    className="text-primary hover:underline"
                    data-testid="link-google-calendar-details"
                  >
                    Voir les détails
                  </Link>
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/google-calendar" className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid="button-configure-google"
                    >
                      Configurer
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => disconnectGoogleMutation.mutate()}
                    disabled={disconnectGoogleMutation.isPending}
                    data-testid="button-disconnect-google"
                  >
                    Déconnecter
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                {!googleStatus?.configured && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">L'intégration Google n'est pas configurée. Contactez l'administrateur.</span>
                  </div>
                )}
                <Button
                  onClick={() => connectGoogleMutation.mutate()}
                  disabled={connectGoogleMutation.isPending || !googleStatus?.configured}
                  data-testid="button-connect-google"
                >
                  {connectGoogleMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <img src={googleLogo} alt="Google" className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-xs">Connecter Google Calendar</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gmail - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={gmailIcon} alt="Gmail" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Gmail</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos emails avec Google Gmail</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>

        {/* Google Meet - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={googleMeetIcon} alt="Google Meet" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Google Meet</CardTitle>
                <CardDescription className="text-xs">Intégrez vos visioconférences avec Google Meet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>

        {/* Microsoft Outlook - Coming Soon */}
        <Card className="flex flex-col !bg-white dark:!bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex justify-end mb-2">
              <Badge variant="outline" className="text-[11px]">Bientôt disponible</Badge>
            </div>
            <div className="flex items-start gap-3">
              <img src={outlookIcon} alt="Microsoft Outlook" className="w-10 h-10 flex-shrink-0" />
              <div>
                <CardTitle className="text-sm whitespace-nowrap">Microsoft Outlook</CardTitle>
                <CardDescription className="text-xs">Synchronisez vos emails avec Microsoft Outlook</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
        </Card>
      </div>
    </div>
  );
}

function CollaboratorsSection() {
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const { toast } = useToast();

  // Get current user to prevent self-deletion
  const { data: currentUser } = useQuery<UserProfile>({
    queryKey: ["/api/settings/profile"],
  });

  const { data: collaboratorsData = [], isLoading } = useQuery<Collaborator[]>({
    queryKey: ["/api/settings/collaborators"],
  });

  const collaborators = [...collaboratorsData].sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return 0;
  });

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "CHIRURGIEN",
      nom: "",
      prenom: "",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteSchema>) => {
      return apiRequest("POST", "/api/settings/collaborators", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/collaborators"] });
      toast({ title: "Collaborateur invité", description: "Un email d'invitation a été envoyé au collaborateur.", variant: "success" });
      setShowInviteSheet(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return apiRequest("PATCH", `/api/settings/collaborators/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/collaborators"] });
      toast({ title: "Rôle mis à jour", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteCollaboratorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/settings/collaborators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/collaborators"] });
      toast({ title: "Collaborateur supprimé", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions par rôle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <Badge variant="default">Administrateur</Badge>
              <p className="text-muted-foreground">
                Accès complet : patients, actes, implants, documents, paramètres, intégrations
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">Collaborateur</Badge>
              <p className="text-muted-foreground">
                Accès métier : patients, actes, implants, documents, calendrier
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">Assistant</Badge>
              <p className="text-muted-foreground">
                Accès limité : consultation patients, calendrier, documents (sans modifications critiques)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-sm">Membres de l'organisation</CardTitle>
              <CardDescription className="text-xs">{collaborators.length} collaborateur(s)</CardDescription>
            </div>
            <Sheet open={showInviteSheet} onOpenChange={setShowInviteSheet}>
              <SheetTrigger asChild>
                <Button data-testid="button-invite-collaborator">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Ajouter un collaborateur</SheetTitle>
                  <SheetDescription>
                    Invitez un nouveau membre à rejoindre votre organisation.
                  </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="prenom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-invite-prenom" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-invite-nom" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (identifiant)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-invite-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rôle</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-invite-role">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ADMIN">Administrateur</SelectItem>
                              <SelectItem value="CHIRURGIEN">Collaborateur</SelectItem>
                              <SelectItem value="ASSISTANT">Assistant</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            Un email sera envoyé au collaborateur afin de l'inviter à se connecter à Cassius.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <SheetFooter className="mt-6">
                      <Button type="button" variant="outline" onClick={() => setShowInviteSheet(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-submit-invite">
                        {inviteMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                        Inviter
                      </Button>
                    </SheetFooter>
                  </form>
                </Form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Chargement...
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-muted-foreground text-xs py-4">Aucun collaborateur trouvé.</p>
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border flex-wrap"
                  data-testid={`collaborator-row-${collab.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {collab.prenom && collab.nom
                            ? `${collab.prenom} ${collab.nom}`
                            : collab.username}
                        </p>
                        {collab.status === "PENDING" ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                            Invitation envoyée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                            Compte activé
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{collab.email || collab.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {collab.isOwner ? (
                      <Badge variant="default" className="text-xs">
                        Propriétaire
                      </Badge>
                    ) : (
                      <Select
                        defaultValue={collab.role}
                        onValueChange={(role) => updateRoleMutation.mutate({ id: collab.id, role })}
                        disabled={collab.type === "invitation"}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-role-${collab.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN" className="text-xs">Administrateur</SelectItem>
                          <SelectItem value="CHIRURGIEN" className="text-xs">Collaborateur</SelectItem>
                          <SelectItem value="ASSISTANT" className="text-xs">Assistant</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {/* Hide delete button for current user (type=user and same id) or owner */}
                    {!(collab.type === "user" && collab.id === currentUser?.id) && !collab.isOwner && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-${collab.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {collab.type === "invitation" ? "Annuler l'invitation" : "Supprimer le collaborateur"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {collab.type === "invitation"
                                ? `Êtes-vous sûr de vouloir annuler l'invitation pour ${collab.email} ?`
                                : `Êtes-vous sûr de vouloir supprimer ${collab.prenom && collab.nom ? `${collab.prenom} ${collab.nom}` : collab.username} ? Cette action est irréversible.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCollaboratorMutation.mutate(collab.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${collab.id}`}
                            >
                              {collab.type === "invitation" ? "Annuler l'invitation" : "Supprimer"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrganizationSection() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: organisation, isLoading } = useQuery<Organisation>({
    queryKey: ["/api/settings/organisation"],
  });

  const [formData, setFormData] = useState({
    nom: "",
    adresse: "",
    telephone: "",
    timezone: "Europe/Paris",
  });

  useEffect(() => {
    if (organisation && !isEditing) {
      setFormData({
        nom: organisation.nom || "",
        adresse: organisation.adresse || "",
        telephone: organisation.telephone || "",
        timezone: organisation.timezone || "Europe/Paris",
      });
    }
  }, [organisation, isEditing]);

  const updateOrgMutation = useMutation({
    mutationFn: async (data: Partial<Organisation>) => {
      return apiRequest("PUT", "/api/settings/organisation", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/organisation"] });
      toast({ title: "Organisation mise à jour", variant: "success" });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = () => {
    if (organisation) {
      setFormData({
        nom: organisation.nom || "",
        adresse: organisation.adresse || "",
        telephone: organisation.telephone || "",
        timezone: organisation.timezone || "Europe/Paris",
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    updateOrgMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4" />
              Informations du cabinet
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleEdit} data-testid="button-edit-org">
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Chargement...
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="org-nom" className="font-light">Nom du cabinet</Label>
                <Input
                  id="org-nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  data-testid="input-org-nom"
                />
              </div>
              <div>
                <Label htmlFor="org-adresse" className="font-light">Adresse</Label>
                <Input
                  id="org-adresse"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  data-testid="input-org-adresse"
                />
              </div>
              <div>
                <Label htmlFor="org-telephone" className="font-light">Téléphone</Label>
                <Input
                  id="org-telephone"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="+33 1 23 45 67 89"
                  data-testid="input-org-telephone"
                />
              </div>
              <div>
                <Label htmlFor="org-timezone" className="font-light">Fuseau horaire</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger data-testid="select-org-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="Europe/Brussels">Europe/Brussels</SelectItem>
                    <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                    <SelectItem value="America/Montreal">America/Montreal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateOrgMutation.isPending} data-testid="button-save-org">
                  {updateOrgMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs font-light">Nom du cabinet</Label>
                <p className="font-medium text-xs" data-testid="text-org-nom">{organisation?.nom || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs font-light">Adresse</Label>
                <p className="font-medium text-xs" data-testid="text-org-adresse">{organisation?.adresse || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs font-light">Téléphone</Label>
                <p className="font-medium text-xs" data-testid="text-org-telephone">{organisation?.telephone || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs font-light">Fuseau horaire</Label>
                <p className="font-medium text-xs" data-testid="text-org-timezone">{organisation?.timezone || "Europe/Paris"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs font-light">Date de création</Label>
                <p className="text-xs text-muted-foreground">
                  {organisation?.createdAt
                    ? new Date(organisation.createdAt).toLocaleDateString("fr-FR")
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface NotificationPreference {
  id: string;
  category: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  frequency: "NONE" | "IMMEDIATE" | "DIGEST";
  digestTime?: string;
  disabledTypes?: string[];
}

interface NotificationTypeInfo {
  type: string;
  label: string;
  description: string;
  category: "ALERTS_REMINDERS" | "TEAM_ACTIVITY" | "IMPORTS" | "SYSTEM";
}

const NOTIFICATION_TYPES: NotificationTypeInfo[] = [
  { type: "ISQ_LOW", label: "ISQ bas", description: "Alerte quand un ISQ est inférieur au seuil critique", category: "ALERTS_REMINDERS" },
  { type: "ISQ_DECLINING", label: "ISQ en déclin", description: "Alerte quand l'ISQ baisse significativement", category: "ALERTS_REMINDERS" },
  { type: "UNSTABLE_ISQ_HISTORY", label: "Historique ISQ instable", description: "Alerte pour plusieurs ISQ bas consécutifs", category: "ALERTS_REMINDERS" },
  { type: "NO_POSTOP_FOLLOWUP", label: "Suivi post-op manquant", description: "Rappel si pas de suivi après une chirurgie", category: "ALERTS_REMINDERS" },
  { type: "NO_RECENT_VISIT", label: "Visite récente manquante", description: "Rappel si le patient n'a pas eu de visite récente", category: "ALERTS_REMINDERS" },
  { type: "SURGERY_NO_FOLLOWUP_PLANNED", label: "Suivi non planifié", description: "Rappel si aucun suivi n'est planifié", category: "ALERTS_REMINDERS" },
  { type: "FOLLOWUP_TO_SCHEDULE", label: "Suivi à planifier", description: "Rappel pour planifier un suivi", category: "ALERTS_REMINDERS" },
  { type: "APPOINTMENT_CREATED", label: "Nouveau rendez-vous", description: "Notification lors de la création d'un rendez-vous", category: "TEAM_ACTIVITY" },
  { type: "PATIENT_UPDATED", label: "Patient modifié", description: "Notification quand un dossier patient est modifié", category: "TEAM_ACTIVITY" },
  { type: "DOCUMENT_ADDED", label: "Document ajouté", description: "Notification lors de l'ajout d'un document", category: "TEAM_ACTIVITY" },
  { type: "RADIO_ADDED", label: "Radio ajoutée", description: "Notification lors de l'ajout d'une radiographie", category: "TEAM_ACTIVITY" },
  { type: "NOTE_ADDED", label: "Note ajoutée", description: "Notification lors de l'ajout d'une note sur un dossier patient", category: "TEAM_ACTIVITY" },
  { type: "NEW_MEMBER_JOINED", label: "Nouveau membre", description: "Notification quand un collaborateur rejoint l'équipe", category: "TEAM_ACTIVITY" },
  { type: "ROLE_CHANGED", label: "Rôle modifié", description: "Notification quand un rôle est modifié", category: "TEAM_ACTIVITY" },
  { type: "INVITATION_SENT", label: "Invitation envoyée", description: "Confirmation d'envoi d'invitation", category: "TEAM_ACTIVITY" },
  { type: "IMPORT_STARTED", label: "Import démarré", description: "Notification au début d'un import", category: "IMPORTS" },
  { type: "IMPORT_COMPLETED", label: "Import terminé", description: "Notification quand un import est terminé", category: "IMPORTS" },
  { type: "IMPORT_PARTIAL", label: "Import partiel", description: "Notification si l'import a des erreurs partielles", category: "IMPORTS" },
  { type: "IMPORT_FAILED", label: "Import échoué", description: "Notification si l'import a échoué", category: "IMPORTS" },
  { type: "SYNC_ERROR", label: "Erreur de synchronisation", description: "Erreur de synchronisation avec les services externes", category: "SYSTEM" },
  { type: "EMAIL_ERROR", label: "Erreur d'email", description: "Erreur lors de l'envoi d'un email", category: "SYSTEM" },
  { type: "SYSTEM_MAINTENANCE", label: "Maintenance système", description: "Annonces de maintenance programmée", category: "SYSTEM" },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof Bell }> = {
  ALERTS_REMINDERS: { label: "Alertes et rappels cliniques", icon: AlertCircle },
  TEAM_ACTIVITY: { label: "Activité de l'équipe", icon: Users },
  IMPORTS: { label: "Imports de données", icon: RefreshCw },
  SYSTEM: { label: "Système", icon: Shield },
};

type TypePreferenceMode = "inapp" | "email" | "both" | "disabled";

interface TypePreferences {
  [type: string]: {
    inApp: boolean;
    email: boolean;
  };
}

function NotificationsSection() {
  const { toast } = useToast();
  const [localPrefs, setLocalPrefs] = useState<Record<string, TypePreferences>>({});
  
  const { data: preferences, isLoading } = useQuery<NotificationPreference[]>({
    queryKey: ["/api/notifications/preferences"],
  });
  
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ category, updates }: { category: string; updates: Partial<NotificationPreference> }) => {
      return apiRequest("PATCH", `/api/notifications/preferences/${category}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (preferences) {
      const prefs: Record<string, TypePreferences> = {};
      NOTIFICATION_TYPES.forEach(nt => {
        if (!prefs[nt.category]) prefs[nt.category] = {};
        const catPref = preferences.find(p => p.category === nt.category);
        const disabledTypes = catPref?.disabledTypes || [];
        const disabledEmails = (catPref as any)?.disabledEmailTypes || [];
        prefs[nt.category][nt.type] = {
          inApp: !disabledTypes.includes(nt.type),
          email: !disabledEmails.includes(nt.type),
        };
      });
      setLocalPrefs(prefs);
    }
  }, [preferences]);
  
  const getPreference = (category: string): NotificationPreference => {
    return preferences?.find(p => p.category === category) || {
      id: "",
      category,
      userId: "",
      inAppEnabled: true,
      emailEnabled: false,
      frequency: "IMMEDIATE" as const,
      disabledTypes: [],
    };
  };

  const getTypePrefs = (category: string, type: string) => {
    return localPrefs[category]?.[type] || { inApp: true, email: false };
  };

  const handleToggleInApp = (category: string, type: string, enabled: boolean) => {
    const pref = getPreference(category);
    const currentDisabled = pref.disabledTypes || [];
    
    let newDisabled: string[];
    if (enabled) {
      newDisabled = currentDisabled.filter(t => t !== type);
    } else {
      newDisabled = [...currentDisabled, type];
    }
    
    setLocalPrefs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: { ...prev[category]?.[type], inApp: enabled }
      }
    }));
    
    updatePreferenceMutation.mutate({
      category,
      updates: { disabledTypes: newDisabled }
    });
  };

  const handleToggleEmail = (category: string, type: string, enabled: boolean) => {
    const pref = getPreference(category) as any;
    const currentDisabled = pref.disabledEmailTypes || [];
    
    let newDisabled: string[];
    if (enabled) {
      newDisabled = currentDisabled.filter((t: string) => t !== type);
    } else {
      newDisabled = [...currentDisabled, type];
    }
    
    setLocalPrefs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: { ...prev[category]?.[type], email: enabled }
      }
    }));
    
    updatePreferenceMutation.mutate({
      category,
      updates: { disabledEmailTypes: newDisabled } as any
    });
  };

  const handleToggleCategory = (category: string, enabled: boolean) => {
    const typesInCategory = NOTIFICATION_TYPES.filter(t => t.category === category).map(t => t.type);
    
    const newCatPrefs: TypePreferences = {};
    typesInCategory.forEach(type => {
      newCatPrefs[type] = { inApp: enabled, email: enabled };
    });
    
    setLocalPrefs(prev => ({
      ...prev,
      [category]: newCatPrefs
    }));
    
    updatePreferenceMutation.mutate({
      category,
      updates: { 
        disabledTypes: enabled ? [] : typesInCategory,
        disabledEmailTypes: enabled ? [] : typesInCategory,
        inAppEnabled: enabled,
        emailEnabled: enabled
      } as any
    });
  };

  const isCategoryFullyEnabled = (category: string): boolean => {
    const typesInCategory = NOTIFICATION_TYPES.filter(t => t.category === category);
    return typesInCategory.every(nt => {
      const prefs = getTypePrefs(category, nt.type);
      return prefs.inApp || prefs.email;
    });
  };

  const isCategoryPartiallyEnabled = (category: string): boolean => {
    const typesInCategory = NOTIFICATION_TYPES.filter(t => t.category === category);
    const enabledCount = typesInCategory.filter(nt => {
      const prefs = getTypePrefs(category, nt.type);
      return prefs.inApp || prefs.email;
    }).length;
    return enabledCount > 0 && enabledCount < typesInCategory.length;
  };

  const categories = ["ALERTS_REMINDERS", "TEAM_ACTIVITY", "IMPORTS", "SYSTEM"] as const;

  const [digestPrefs, setDigestPrefs] = useState<Record<string, "none" | "daily" | "weekly">>({});

  const getDigestPref = (type: string): "none" | "daily" | "weekly" => {
    return digestPrefs[type] || "none";
  };

  const handleDigestChange = (type: string, value: string) => {
    setDigestPrefs(prev => ({
      ...prev,
      [type]: value as "none" | "daily" | "weekly"
    }));
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const categoryInfo = CATEGORY_LABELS[category];
            const CategoryIcon = categoryInfo.icon;
            const typesInCategory = NOTIFICATION_TYPES.filter(t => t.category === category);
            const isFullyEnabled = isCategoryFullyEnabled(category);
            const isPartiallyEnabled = isCategoryPartiallyEnabled(category);

            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{categoryInfo.label}</CardTitle>
                        <CardDescription className="text-xs">
                          {typesInCategory.length} types de notifications
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPartiallyEnabled && (
                        <Badge variant="secondary" className="text-xs">Partiel</Badge>
                      )}
                      <Switch
                        checked={isFullyEnabled || isPartiallyEnabled}
                        onCheckedChange={(v) => handleToggleCategory(category, v)}
                        disabled={updatePreferenceMutation.isPending}
                        data-testid={`switch-category-${category}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border rounded-md divide-y">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                      <div className="col-span-3">Type</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-3 text-center">Résumé</div>
                      <div className="col-span-1 text-center">In-App</div>
                      <div className="col-span-2 text-center">Email</div>
                    </div>
                    {typesInCategory.map((notifType) => {
                      const typePrefs = getTypePrefs(category, notifType.type);
                      const isDisabled = !typePrefs.inApp && !typePrefs.email;
                      const digestValue = getDigestPref(notifType.type);
                      return (
                        <div 
                          key={notifType.type} 
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${isDisabled ? "opacity-50" : ""}`}
                        >
                          <div className="col-span-3">
                            <span className={`text-xs font-medium ${isDisabled ? "text-muted-foreground" : ""}`}>
                              {notifType.label}
                            </span>
                          </div>
                          <div className="col-span-3">
                            <span className="text-xs text-muted-foreground">{notifType.description}</span>
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <Select 
                              value={digestValue} 
                              onValueChange={(v) => handleDigestChange(notifType.type, v)}
                              disabled={!typePrefs.email}
                            >
                              <SelectTrigger className="h-8 text-xs w-[140px]" data-testid={`select-digest-${notifType.type}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Immédiat</SelectItem>
                                <SelectItem value="daily">Soir, 19h</SelectItem>
                                <SelectItem value="weekly">Vendredi, 19h</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <Switch
                              checked={typePrefs.inApp}
                              onCheckedChange={(v) => handleToggleInApp(category, notifType.type, v)}
                              disabled={updatePreferenceMutation.isPending}
                              data-testid={`switch-inapp-${notifType.type}`}
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <Switch
                              checked={typePrefs.email}
                              onCheckedChange={(v) => handleToggleEmail(category, notifType.type, v)}
                              disabled={updatePreferenceMutation.isPending}
                              data-testid={`switch-email-${notifType.type}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
