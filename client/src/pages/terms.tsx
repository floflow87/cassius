import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold" data-testid="text-terms-title">
            Conditions d'utilisation
          </h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">1. Objet</h2>
            <p className="text-muted-foreground">
              Les présentes conditions régissent l'accès et l'utilisation de l'application Cassius, plateforme SaaS de gestion de données cliniques.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. Accès au service</h2>
            <p className="text-muted-foreground mb-2">L'accès à Cassius est réservé aux utilisateurs disposant d'un compte.</p>
            <p className="text-muted-foreground mb-2">L'utilisateur est responsable :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>de la confidentialité de ses identifiants</li>
              <li>de l'usage de son compte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Utilisation du service</h2>
            <p className="text-muted-foreground mb-2">L'utilisateur s'engage à :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>utiliser l'application conformément à la loi</li>
              <li>ne pas porter atteinte à la sécurité du service</li>
              <li>ne pas détourner l'usage de la plateforme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Données patients</h2>
            <p className="text-muted-foreground mb-3">
              Les données patients saisies dans Cassius sont sous la responsabilité exclusive du professionnel de santé utilisateur.
            </p>
            <p className="text-muted-foreground text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
              👉 Cassius agit comme un outil technique, non comme responsable médical.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Disponibilité</h2>
            <p className="text-muted-foreground mb-2">
              Cassius s'efforce d'assurer un service disponible en continu, mais ne garantit pas une disponibilité sans interruption.
            </p>
            <p className="text-muted-foreground">Des maintenances peuvent être effectuées.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Sécurité</h2>
            <p className="text-muted-foreground mb-2">L'utilisateur s'engage à :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>ne pas tenter d'accéder aux comptes d'autres utilisateurs</li>
              <li>signaler toute faille de sécurité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Responsabilité</h2>
            <p className="text-muted-foreground mb-2">Cassius ne pourra être tenu responsable :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>d'une mauvaise utilisation du service</li>
              <li>d'erreurs de saisie des utilisateurs</li>
              <li>de décisions médicales prises via l'outil</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Intégrations tierces</h2>
            <p className="text-muted-foreground">
              L'utilisation de services tiers (Google, etc.) est soumise à leurs propres conditions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Résiliation</h2>
            <p className="text-muted-foreground mb-2">L'utilisateur peut supprimer son compte à tout moment.</p>
            <p className="text-muted-foreground">
              Cassius se réserve le droit de suspendre un compte en cas de non-respect des conditions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">10. Évolution du service</h2>
            <p className="text-muted-foreground">
              Cassius peut modifier ses fonctionnalités à tout moment pour améliorer le service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">11. Droit applicable</h2>
            <p className="text-muted-foreground">
              Les présentes conditions sont régies par le droit français.
            </p>
          </section>

        </div>

        <footer className="mt-12 pt-6 border-t text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Cassius —{" "}
            <a href="https://cassiuspro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              Voir le site
            </a>
          </p>
          <p className="text-[11px] text-muted-foreground/60 space-x-3">
            <a href="/privacy" className="hover:underline hover:text-muted-foreground transition-colors">Politique de confidentialité</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
