import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, UserPlus } from "lucide-react";
import { Link } from "wouter";
import logoBlue from "@assets/logo_Cassius_Plan_de_travail_1_copie_1765897934649.png";
import logoWhite from "@assets/logo_Cassius_Plan_de_travail_1_copie_Plan_de_travail_1_copie_2_1765897934649.png";

const registerSchema = z.object({
  username: z.string().min(3, "Minimum 3 caractères"),
  password: z.string().min(6, "Minimum 6 caractères"),
  confirmPassword: z.string().min(6, "Minimum 6 caractères"),
  nom: z.string().min(1, "Nom requis"),
  prenom: z.string().min(1, "Prénom requis"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

interface RegisterPageProps {
  onRegisterSuccess: () => void;
}

export default function RegisterPage({ onRegisterSuccess }: RegisterPageProps) {
  const { toast } = useToast();

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      nom: "",
      prenom: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        username: data.username,
        password: data.password,
        nom: data.nom,
        prenom: data.prenom,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Compte créé",
        description: "Bienvenue sur Cassius",
      });
      onRegisterSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Échec de l'inscription",
        description: error.message || "Erreur lors de la création du compte",
        variant: "destructive",
      });
    },
  });

  const onRegister = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const features = [
    "Documentez chaque implant avec précision",
    "Centralisez radios et visites de contrôle",
    "Analysez vos performances cliniques",
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side - Register form */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-gray-950 p-8 lg:p-12">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img 
              src={logoBlue} 
              alt="Cassius" 
              className="h-10 object-contain"
              data-testid="img-logo-blue"
            />
          </div>

          {/* Form */}
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2" data-testid="text-register-title">
              Demander un accès
            </h2>
            <p className="text-muted-foreground mb-8">
              Créez votre compte pour accéder à la plateforme
            </p>

            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={registerForm.control}
                    name="prenom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">Prénom</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Jean" 
                            className="h-11 border-gray-300 dark:border-gray-700"
                            {...field} 
                            data-testid="input-prenom" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="nom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">Nom</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Dupont" 
                            className="h-11 border-gray-300 dark:border-gray-700"
                            {...field} 
                            data-testid="input-nom" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={registerForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Adresse email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="votre@email.com" 
                          className="h-11 border-gray-300 dark:border-gray-700"
                          {...field} 
                          data-testid="input-username" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Mot de passe</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Min. 6 caractères" 
                          className="h-11 border-gray-300 dark:border-gray-700"
                          {...field} 
                          data-testid="input-password" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Confirmez votre mot de passe" 
                          className="h-11 border-gray-300 dark:border-gray-700"
                          {...field} 
                          data-testid="input-confirm-password" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium" 
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    "Création..."
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Créer mon compte
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Back to login */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Vous avez déjà un compte ?
              </p>
              <Link 
                href="/login"
                className="text-sm text-primary hover:underline font-medium mt-1 inline-block"
                data-testid="link-login"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground" data-testid="text-rgpd">
            Données médicales chiffrées et conformes RGPD
          </p>
        </div>
      </div>

      {/* Right side - Blue gradient with features */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary">
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-white/10" />
          <div className="absolute top-[20%] right-[15%] w-[300px] h-[300px] rounded-full bg-white/5" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white/5" />
          <div className="absolute bottom-[10%] right-[-5%] w-[250px] h-[250px] rounded-full bg-white/10" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-white">
          <img 
            src={logoWhite} 
            alt="Cassius" 
            className="h-12 object-contain mb-3"
            data-testid="img-logo-white"
          />
          <p className="text-[15px] italic opacity-90 mb-8" data-testid="text-tagline">
            Votre Mémoire Clinique, Éclairée.
          </p>

          {/* Divider */}
          <div className="w-16 h-0.5 bg-white/60 mb-8" />

          {/* Features */}
          <ul className="space-y-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-base opacity-95" data-testid={`text-feature-${index}`}>
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
