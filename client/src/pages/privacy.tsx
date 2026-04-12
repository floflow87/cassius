import { Link } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold" data-testid="text-privacy-title">
            Politique de confidentialité
          </h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">1. Introduction</h2>
            <p className="text-muted-foreground">
              La présente politique de confidentialité a pour objectif d'informer les utilisateurs de l'application Cassius sur la manière dont leurs données personnelles sont collectées, utilisées et protégées.
            </p>
            <p className="text-muted-foreground mt-2">
              Cassius est une application SaaS destinée aux professionnels de santé, permettant la gestion de données cliniques, notamment en implantologie.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. Responsable du traitement</h2>
            <p className="text-muted-foreground">Le responsable du traitement des données est :</p>
            <div className="mt-2 pl-4 border-l-2 border-muted text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Cassius</span></p>
              <p>Email : <a href="mailto:contact@cassiuspro.com" className="text-primary underline">contact@cassiuspro.com</a></p>
              <p>Site : <a href="https://cassiuspro.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://cassiuspro.com</a></p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Données collectées</h2>
            <p className="text-muted-foreground mb-3">Nous collectons uniquement les données nécessaires au fonctionnement de l'application.</p>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">a) Données de compte</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Nom</li>
                  <li>Prénom</li>
                  <li>Email</li>
                  <li>Mot de passe (chiffré)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">b) Données professionnelles</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Organisation / cabinet</li>
                  <li>Rôle utilisateur</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">c) Données patients (sous responsabilité du praticien)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Nom / prénom</li>
                  <li>Informations médicales liées aux implants</li>
                  <li>Données de suivi (ISQ, visites, etc.)</li>
                  <li>Documents et radiographies</li>
                </ul>
                <p className="mt-2 text-muted-foreground text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                  ⚠️ Ces données sont sous la responsabilité du professionnel de santé utilisateur.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Utilisation des données</h2>
            <p className="text-muted-foreground mb-2">Les données sont utilisées pour :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Fournir et faire fonctionner l'application</li>
              <li>Gérer les comptes utilisateurs</li>
              <li>Assurer le suivi clinique des patients</li>
              <li>Améliorer l'expérience utilisateur</li>
              <li>Garantir la sécurité et la traçabilité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Intégrations Google</h2>
            <p className="text-muted-foreground mb-3">Cassius peut utiliser des services Google (Google Calendar, Gmail).</p>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-1">a) Google Calendar</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Synchronisation des rendez-vous</li>
                  <li>Aucune utilisation à des fins publicitaires</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">b) Gmail (si activé)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Accès limité aux métadonnées des emails (expéditeur, date)</li>
                  <li>Aucun accès au contenu des emails sans consentement explicite</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-muted-foreground text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
              👉 Cassius n'utilise pas les données Google à des fins commerciales ou publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Partage des données</h2>
            <p className="text-muted-foreground mb-2">Les données ne sont jamais vendues.</p>
            <p className="text-muted-foreground mb-2">Elles peuvent être partagées uniquement avec :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>des prestataires techniques (hébergement, stockage)</li>
              <li>dans le respect strict de la confidentialité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Hébergement et sécurité</h2>
            <p className="text-muted-foreground mb-3">Les données sont hébergées via des services sécurisés (ex : Supabase).</p>
            <p className="text-muted-foreground mb-2">Mesures mises en place :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Chiffrement des données</li>
              <li>Accès sécurisé (authentification)</li>
              <li>Contrôle des accès par rôle</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Durée de conservation</h2>
            <p className="text-muted-foreground mb-2">Les données sont conservées :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>pendant toute la durée d'utilisation du service</li>
              <li>puis supprimées ou anonymisées sur demande</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Droits des utilisateurs</h2>
            <p className="text-muted-foreground mb-2">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Accès à vos données</li>
              <li>Rectification</li>
              <li>Suppression</li>
              <li>Limitation du traitement</li>
              <li>Portabilité</li>
            </ul>
            <p className="mt-3 text-muted-foreground text-xs">
              Pour exercer ces droits :{" "}
              <a href="mailto:contact@cassiuspro.com" className="text-primary underline">
                contact@cassiuspro.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">10. Cookies</h2>
            <p className="text-muted-foreground">
              Cassius utilise des cookies techniques nécessaires au fonctionnement de l'application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">11. Modifications</h2>
            <p className="text-muted-foreground">
              Cette politique peut être modifiée à tout moment.
              Les utilisateurs seront informés en cas de changement majeur.
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
          <p className="text-[11px] text-muted-foreground/60">
            <a href="/terms" className="hover:underline hover:text-muted-foreground transition-colors">Conditions d'utilisation</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
