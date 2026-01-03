import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import logoBlue from "@assets/logo_Cassius_Plan_de_travail_1_copie_1765897934649.png";

export default function VerifyEmailPage() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState("");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/verify-email", { token });
      return response.json();
    },
    onSuccess: () => {
      setVerificationStatus('success');
    },
    onError: (error: Error) => {
      setVerificationStatus('error');
      setErrorMessage(error.message || "Lien invalide ou expiré");
    },
  });

  useEffect(() => {
    if (token) {
      mutation.mutate();
    } else {
      setVerificationStatus('error');
      setErrorMessage("Lien de vérification manquant");
    }
  }, []);

  if (verificationStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Vérification de votre email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Vérification échouée</CardTitle>
            <CardDescription>
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Le lien de vérification a peut-être expiré ou a déjà été utilisé. Vous pouvez demander un nouveau lien depuis vos paramètres.
            </p>
            <Link href="/login">
              <Button className="w-full" data-testid="button-go-login">
                Aller à la connexion
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoBlue} alt="Cassius" className="h-12 object-contain" />
          </div>
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>Email vérifié !</CardTitle>
          <CardDescription>
            Votre adresse email a été confirmée avec succès. Vous avez maintenant accès à toutes les fonctionnalités de Cassius.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button className="w-full" data-testid="button-go-dashboard">
              Accéder au tableau de bord
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
