import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import logoBlue from "@assets/logo_Cassius_Plan_de_travail_1_copie_1765897934649.png";
import logoWhite from "@assets/logo_Cassius_Plan_de_travail_1_copie_Plan_de_travail_1_copie_2_1765897934649.png";

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login", {
        username: data.email,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Cassius",
        variant: "success",
      });
      onLoginSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Échec de connexion",
        description: error.message || "Identifiants incorrects",
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const features = [
    "Documentez chaque implant avec précision",
    "Centralisez radios et visites de contrôle",
    "Analysez vos performances cliniques",
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-gray-950 p-8 lg:p-12">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img 
              src={logoBlue} 
              alt="Cassius" 
              className="h-[80px] object-contain"
              data-testid="img-logo-blue"
            />
          </div>

          {/* Form */}
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-8" data-testid="text-connexion-title">
              Connexion
            </h2>

            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Adresse email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="votre@email.com" 
                          className="h-11 border-gray-300 dark:border-gray-700"
                          {...field} 
                          data-testid="input-email" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            className="h-11 border-gray-300 dark:border-gray-700 pr-11"
                            {...field} 
                            data-testid="input-password" 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <div className="flex justify-end">
                        <Link 
                          href="/forgot-password"
                          className="text-sm text-primary hover:underline"
                          data-testid="link-forgot-password"
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-remember"
                        />
                      </FormControl>
                      <FormLabel className="text-sm text-muted-foreground font-normal cursor-pointer">
                        Se souvenir de moi
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium" 
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    "Connexion..."
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Request access */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Vous n'avez pas de compte ?
              </p>
              <Link 
                href="/register"
                className="text-sm text-primary hover:underline font-medium mt-1 inline-block"
                data-testid="link-request-access"
              >
                Demander un accès
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
            className="h-[120px] object-contain mb-3"
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
