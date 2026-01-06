import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
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
  Pencil
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

interface Organisation {
  id: string;
  nom: string;
  adresse?: string | null;
  timezone?: string;
  createdAt: string;
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

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/settings/profile"],
  });

  const userIsAdmin = profile?.role === "ADMIN";

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6" data-testid="settings-page">
      <div className="w-full">
        <Tabs defaultValue="security" className="w-full">
          <TabsList className="bg-transparent p-0 h-auto gap-6 border-b-0 mb-6">
            <TabsTrigger 
              value="security" 
              className="text-sm font-light rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 gap-2" 
              data-testid="nav-security"
            >
              <Shield className="w-4 h-4" />
              Informations & Sécurité
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="text-sm font-light rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 gap-2" 
              data-testid="nav-notifications"
            >
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            {userIsAdmin && (
              <TabsTrigger 
                value="collaborators" 
                className="text-sm font-light rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 gap-2" 
                data-testid="nav-collaborators"
              >
                <Users className="w-4 h-4" />
                Collaborateurs
              </TabsTrigger>
            )}
            {userIsAdmin && (
              <TabsTrigger 
                value="organization" 
                className="text-sm font-light rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 gap-2" 
                data-testid="nav-organization"
              >
                <Building2 className="w-4 h-4" />
                Organisation
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="integrations" 
              className="text-sm font-light rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 gap-2" 
              data-testid="nav-integrations"
            >
              <Link2 className="w-4 h-4" />
              Intégrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security">
            {profile && <SecuritySection profile={profile} onProfileUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/settings/profile"] })} />}
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
          
          <TabsContent value="integrations">
            <IntegrationsSection />
          </TabsContent>
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
      toast({ title: "Profil mis à jour" });
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
      toast({ title: "Mot de passe modifié", description: "Votre mot de passe a été mis à jour avec succès." });
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
            <CardTitle className="flex items-center gap-2 font-light">
              <User className="w-5 h-5" />
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
              <Label className="text-muted-foreground text-sm font-light">Nom</Label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.nom}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, nom: e.target.value }))}
                  data-testid="input-user-nom"
                />
              ) : (
                <p className="font-light" data-testid="text-user-nom">{profile.nom || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-sm font-light">Prénom</Label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.prenom}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, prenom: e.target.value }))}
                  data-testid="input-user-prenom"
                />
              ) : (
                <p className="font-light" data-testid="text-user-prenom">{profile.prenom || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-sm font-light">Email / Identifiant</Label>
              <p className="font-light" data-testid="text-user-username">{profile.username}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm font-light">Rôle</Label>
              <div className="mt-1">
                <Badge variant={getRoleBadgeVariant(profile.role)} data-testid="badge-user-role">
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
            </div>
          </div>
          {profile.organisationNom && (
            <div>
              <Label className="text-muted-foreground text-sm font-light">Organisation</Label>
              <p className="font-light" data-testid="text-user-org">{profile.organisationNom}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-light">
            <Lock className="w-5 h-5" />
            Sécurité du compte
          </CardTitle>
          <CardDescription className="font-light">
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
                        <p className="text-sm text-destructive/70 italic font-light mt-1">
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
    </div>
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
      toast({ title: "Google Calendar déconnecté" });
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
      toast({ title: "Synchronisation démarrée" });
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
      <div>
        <h2 className="text-2xl font-bold">Intégrations</h2>
        <p className="text-muted-foreground">Connectez vos services externes pour synchroniser vos données.</p>
      </div>

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
                <CardTitle className="text-base whitespace-nowrap">Google Calendar</CardTitle>
                <CardDescription>Synchronisez vos rendez-vous avec Google Calendar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            {googleLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            ) : googleStatus?.connected ? (
              <>
                {googleStatus.email && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Compte connecté</Label>
                    <p className="font-medium text-sm">{googleStatus.email}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm">Synchronisation automatique</Label>
                    <p className="text-xs text-muted-foreground">
                      Les rendez-vous sont synchronisés automatiquement
                    </p>
                  </div>
                  <Switch
                    checked={googleStatus.integration?.isEnabled ?? false}
                    onCheckedChange={(checked) => toggleSyncMutation.mutate(checked)}
                    disabled={toggleSyncMutation.isPending}
                    data-testid="switch-google-sync"
                  />
                </div>

                {googleStatus.integration?.targetCalendarName && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Calendrier cible</Label>
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {googleStatus.integration.targetCalendarName}
                    </p>
                  </div>
                )}

                {googleStatus.integration?.lastSyncAt && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Dernière synchronisation</Label>
                    <p className="text-sm">
                      {new Date(googleStatus.integration.lastSyncAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                )}

                {googleStatus.integration?.syncErrorCount && googleStatus.integration.syncErrorCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{googleStatus.integration.syncErrorCount} erreurs de synchronisation</span>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncNowMutation.mutate()}
                    disabled={syncNowMutation.isPending}
                    data-testid="button-sync-now"
                  >
                    {syncNowMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Synchroniser maintenant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectGoogleMutation.mutate()}
                    disabled={disconnectGoogleMutation.isPending}
                    className="text-destructive"
                    data-testid="button-disconnect-google"
                  >
                    Déconnecter
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                {!googleStatus?.configured && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">L'intégration Google n'est pas configurée. Contactez l'administrateur.</span>
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
                  Connecter Google Calendar
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
                <CardTitle className="text-base whitespace-nowrap">Gmail</CardTitle>
                <CardDescription>Synchronisez vos emails avec Google Gmail</CardDescription>
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
                <CardTitle className="text-base whitespace-nowrap">Google Meet</CardTitle>
                <CardDescription>Intégrez vos visioconférences avec Google Meet</CardDescription>
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
                <CardTitle className="text-base whitespace-nowrap">Microsoft Outlook</CardTitle>
                <CardDescription>Synchronisez vos emails avec Microsoft Outlook</CardDescription>
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

  const { data: collaborators = [], isLoading } = useQuery<Collaborator[]>({
    queryKey: ["/api/settings/collaborators"],
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
      toast({ title: "Collaborateur invité", description: "Un email d'invitation a été envoyé au collaborateur." });
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
      toast({ title: "Rôle mis à jour" });
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
      toast({ title: "Collaborateur supprimé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Collaborateurs</h2>
          <p className="text-muted-foreground">Gérez les membres de votre organisation et leurs permissions.</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Permissions par rôle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
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
          <CardTitle>Membres de l'organisation</CardTitle>
          <CardDescription>{collaborators.length} collaborateur(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Chargement...
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-muted-foreground py-4">Aucun collaborateur trouvé.</p>
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
                        <p className="font-medium">
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
                      <p className="text-sm text-muted-foreground">{collab.email || collab.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={collab.role}
                      onValueChange={(role) => updateRoleMutation.mutate({ id: collab.id, role })}
                      disabled={collab.type === "invitation"}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-role-${collab.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                        <SelectItem value="CHIRURGIEN">Collaborateur</SelectItem>
                        <SelectItem value="ASSISTANT">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Hide delete button for current user (type=user and same id) */}
                    {!(collab.type === "user" && collab.id === currentUser?.id) && (
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
    timezone: "Europe/Paris",
  });

  useEffect(() => {
    if (organisation && !isEditing) {
      setFormData({
        nom: organisation.nom || "",
        adresse: organisation.adresse || "",
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
      toast({ title: "Organisation mise à jour" });
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
      <div>
        <h2 className="text-2xl font-bold">Organisation</h2>
        <p className="text-muted-foreground">Informations et paramètres de votre cabinet.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
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
                <Label htmlFor="org-nom">Nom du cabinet</Label>
                <Input
                  id="org-nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  data-testid="input-org-nom"
                />
              </div>
              <div>
                <Label htmlFor="org-adresse">Adresse</Label>
                <Input
                  id="org-adresse"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  data-testid="input-org-adresse"
                />
              </div>
              <div>
                <Label htmlFor="org-timezone">Fuseau horaire</Label>
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
                <Label className="text-muted-foreground text-sm">Nom du cabinet</Label>
                <p className="font-medium" data-testid="text-org-nom">{organisation?.nom || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Adresse</Label>
                <p className="font-medium" data-testid="text-org-adresse">{organisation?.adresse || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Fuseau horaire</Label>
                <p className="font-medium" data-testid="text-org-timezone">{organisation?.timezone || "Europe/Paris"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Date de création</Label>
                <p className="text-sm text-muted-foreground">
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
}

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  ALERTS_REMINDERS: { label: "Alertes et rappels", description: "Mesures ISQ, rendez-vous, rappels cliniques" },
  TEAM_ACTIVITY: { label: "Activité équipe", description: "Modifications de dossiers, documents ajoutés" },
  IMPORTS: { label: "Imports", description: "Résultats des imports de patients" },
  SYSTEM: { label: "Système", description: "Mises à jour et annonces du système" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  NONE: "Désactivé",
  IMMEDIATE: "Immédiat",
  DIGEST: "Résumé quotidien",
};

function NotificationsSection() {
  const { toast } = useToast();
  
  const { data: preferences, isLoading } = useQuery<NotificationPreference[]>({
    queryKey: ["/api/notifications/preferences"],
  });
  
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ category, updates }: { category: string; updates: Partial<NotificationPreference> }) => {
      return apiRequest("PATCH", `/api/notifications/preferences/${category}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({ title: "Préférences mises à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
  
  const getPreference = (type: string) => {
    return preferences?.find(p => p.category === type) || {
      category: type,
      inAppEnabled: true,
      emailEnabled: false,
      frequency: "IMMEDIATE" as const,
    };
  };
  
  const handleFrequencyChange = (type: string, frequency: string) => {
    updatePreferenceMutation.mutate({ 
      category: type, 
      updates: { frequency: frequency as NotificationPreference["frequency"] } 
    });
  };
  
  const handleToggleInApp = (type: string, enabled: boolean) => {
    updatePreferenceMutation.mutate({ 
      category: type, 
      updates: { inAppEnabled: enabled } 
    });
  };
  
  const handleToggleEmail = (type: string, enabled: boolean) => {
    updatePreferenceMutation.mutate({ 
      category: type, 
      updates: { emailEnabled: enabled } 
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notifications</h2>
        <p className="text-muted-foreground">Configurez comment et quand vous recevez les notifications.</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Préférences par type
          </CardTitle>
          <CardDescription>
            Personnalisez les notifications pour chaque catégorie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, { label, description }]) => {
                const pref = getPreference(type);
                return (
                  <div key={type} className="pb-6 border-b last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h4 className="font-medium">{label}</h4>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label className="text-sm text-muted-foreground mb-2 block">Fréquence</Label>
                        <Select 
                          value={pref.frequency} 
                          onValueChange={(v) => handleFrequencyChange(type, v)}
                          disabled={updatePreferenceMutation.isPending}
                        >
                          <SelectTrigger data-testid={`select-frequency-${type}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">{FREQUENCY_LABELS.NONE}</SelectItem>
                            <SelectItem value="IMMEDIATE">{FREQUENCY_LABELS.IMMEDIATE}</SelectItem>
                            <SelectItem value="DAILY_DIGEST">{FREQUENCY_LABELS.DAILY_DIGEST}</SelectItem>
                            <SelectItem value="WEEKLY_DIGEST">{FREQUENCY_LABELS.WEEKLY_DIGEST}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`inapp-${type}`}
                          checked={pref.inAppEnabled}
                          onCheckedChange={(v) => handleToggleInApp(type, v)}
                          disabled={updatePreferenceMutation.isPending || pref.frequency === "NONE"}
                          data-testid={`switch-inapp-${type}`}
                        />
                        <Label htmlFor={`inapp-${type}`} className="text-sm">
                          Dans l'app
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`email-${type}`}
                          checked={pref.emailEnabled}
                          onCheckedChange={(v) => handleToggleEmail(type, v)}
                          disabled={updatePreferenceMutation.isPending || pref.frequency === "NONE"}
                          data-testid={`switch-email-${type}`}
                        />
                        <Label htmlFor={`email-${type}`} className="text-sm">
                          Email
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Résumés par email
          </CardTitle>
          <CardDescription>
            Recevez un récapitulatif de vos notifications non lues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Si vous choisissez "Résumé quotidien" ou "Résumé hebdomadaire" pour une catégorie, 
            vous recevrez un email récapitulatif à la fréquence choisie, regroupant toutes les 
            notifications non lues de cette catégorie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
