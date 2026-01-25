import { useState, useMemo } from "react";
import { Search, MessageCircle, Mail, BookOpen, ChevronDown, LayoutDashboard, Users, Stethoscope, Package, Activity, Calendar, FileImage, Bell, BarChart3, Shield, Upload, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  points: string[];
  subsections?: { title: string; items: string[] }[];
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    icon: <HelpCircle className="h-5 w-5" />,
    title: "Bien démarrer avec Cassius",
    description: "Cassius est une plateforme conçue pour accompagner les chirurgiens-dentistes dans la gestion complète de leur activité d'implantologie. Elle centralise les patients, les actes, les implants, les rendez-vous, les documents et le suivi clinique dans un environnement sécurisé et structuré.",
    points: [
      "Centralisation de toutes les données cliniques",
      "Suivi structuré des implants et des mesures ISQ",
      "Réduction des oublis grâce aux alertes automatiques",
      "Gain de temps au quotidien pour le cabinet",
    ],
  },
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Tableau de bord",
    description: "Le tableau de bord vous offre une vision immédiate de l'activité de votre cabinet. Il met en avant les informations essentielles pour piloter votre journée et identifier les situations nécessitant une attention particulière.",
    points: [
      "Statistiques principales : patients actifs, implants posés, taux de succès",
      "Prochains rendez-vous avec accès rapide aux dossiers patients",
      "Patients à surveiller (ISQ bas, complications, suivis manqués)",
      "Derniers implants posés avec mesures ISQ",
      "Personnalisation complète des blocs affichés",
    ],
  },
  {
    id: "patients",
    icon: <Users className="h-5 w-5" />,
    title: "Gestion des patients",
    description: "Chaque patient dispose d'un dossier complet, structuré et évolutif, permettant un suivi clinique précis et sécurisé dans le temps.",
    points: [
      "Informations personnelles et médicales",
      "Historique clinique sous forme de timeline",
      "Implants posés et suivi ISQ",
      "Radiographies et documents",
      "Notes médicales confidentielles",
    ],
    subsections: [
      {
        title: "Statuts patient disponibles",
        items: ["En suivi", "Succès", "Complication", "Échec"],
      },
    ],
  },
  {
    id: "operations",
    icon: <Stethoscope className="h-5 w-5" />,
    title: "Actes chirurgicaux",
    description: "Les actes chirurgicaux permettent de documenter précisément chaque intervention réalisée au cabinet, avec un lien direct vers les implants posés et le suivi post-opératoire.",
    points: [
      "Création d'actes par patient",
      "Association des implants posés",
      "Observations pré et post-opératoires",
      "Historique complet des interventions",
    ],
    subsections: [
      {
        title: "Types d'actes pris en charge",
        items: [
          "Pose d'implant simple ou multiple",
          "Extraction avec implant immédiat",
          "Reprise d'implant",
          "Chirurgie guidée",
          "Greffe osseuse",
          "Régénération osseuse guidée (ROG)",
        ],
      },
    ],
  },
  {
    id: "catalog",
    icon: <Package className="h-5 w-5" />,
    title: "Catalogue d'implants",
    description: "Le catalogue d'implants centralise l'ensemble des références utilisées au cabinet afin d'assurer une traçabilité et une analyse clinique cohérentes.",
    points: [
      "Marque et fabricant",
      "Référence produit",
      "Dimensions et type de connexion",
      "Historique d'utilisation",
      "Statistiques de succès par modèle",
    ],
  },
  {
    id: "isq",
    icon: <Activity className="h-5 w-5" />,
    title: "Implants posés et suivi ISQ",
    description: "Chaque implant posé dispose d'un suivi individualisé, incluant l'historique des mesures ISQ et l'analyse de la stabilité dans le temps.",
    points: [
      "Supérieur à 70 : excellente stabilité",
      "Entre 65 et 70 : bonne stabilité",
      "Entre 55 et 65 : stabilité moyenne nécessitant une surveillance",
      "Inférieur à 55 : alerte clinique",
    ],
    subsections: [
      {
        title: "Tendances détectées",
        items: ["Croissante", "Stable", "Décroissante"],
      },
    ],
  },
  {
    id: "calendar",
    icon: <Calendar className="h-5 w-5" />,
    title: "Calendrier et rendez-vous",
    description: "Cassius intègre un calendrier complet permettant la planification et le suivi des rendez-vous du cabinet, avec une synchronisation possible avec Google Calendar.",
    points: [
      "Vues jour, semaine et mois",
      "Création de rendez-vous associés aux patients",
      "Statuts : à venir, terminé, annulé",
      "Synchronisation bidirectionnelle avec Google Calendar",
    ],
  },
  {
    id: "documents",
    icon: <FileImage className="h-5 w-5" />,
    title: "Documents et radiographies",
    description: "Cassius permet le stockage sécurisé des documents médicaux et des radiographies, directement associés aux dossiers patients.",
    points: [
      "Upload par glisser-déposer",
      "Formats supportés : JPEG, PNG, PDF, DICOM",
      "Visualisation plein écran",
      "Ajout de notes et annotations",
      "Classement par patient et par date",
    ],
  },
  {
    id: "notifications",
    icon: <Bell className="h-5 w-5" />,
    title: "Notifications et alertes",
    description: "Le système de notifications de Cassius vous aide à ne manquer aucun événement important, qu'il soit clinique, organisationnel ou lié à l'activité de l'équipe.",
    points: [
      "Alertes cliniques (ISQ, complications)",
      "Rappels de rendez-vous",
      "Activité de l'équipe",
      "Importations de données",
      "Messages système",
    ],
  },
  {
    id: "stats",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Statistiques et rapports",
    description: "Les tableaux de bord statistiques offrent une analyse détaillée de l'activité du cabinet et des résultats cliniques.",
    points: [
      "Nombre de patients",
      "Nombre d'implants posés",
      "Taux de succès global",
      "Taux de complications",
      "Évolution des mesures ISQ",
    ],
  },
  {
    id: "security",
    icon: <Shield className="h-5 w-5" />,
    title: "Équipe, rôles et sécurité",
    description: "Cassius permet une gestion fine des accès utilisateurs afin de garantir la sécurité des données et le respect des rôles au sein du cabinet.",
    points: [
      "Isolation complète des données par cabinet",
      "Historique des connexions",
      "Gestion des sessions actives",
    ],
    subsections: [
      {
        title: "Rôles disponibles",
        items: ["Administrateur", "Chirurgien", "Assistant"],
      },
    ],
  },
  {
    id: "import",
    icon: <Upload className="h-5 w-5" />,
    title: "Import et partage de données",
    description: "Cassius facilite l'importation de patients existants ainsi que le partage sécurisé d'informations avec des confrères.",
    points: [
      "Import CSV ou Excel avec aperçu",
      "Liens de partage sécurisés",
      "Durée de validité configurable",
      "Protection par mot de passe optionnelle",
    ],
  },
];

const glossaryTerms = [
  {
    term: "ISQ",
    definition: "Implant Stability Quotient, mesure de la stabilité d'un implant sur une échelle de 0 à 100.",
  },
  {
    term: "Ostéointégration",
    definition: "Processus de fusion biologique entre l'implant et l'os environnant.",
  },
  {
    term: "Flag",
    definition: "Alerte clinique automatique générée par le système pour signaler une situation nécessitant une attention particulière.",
  },
  {
    term: "Digest",
    definition: "Résumé périodique envoyé par email regroupant les événements et alertes importants.",
  },
  {
    term: "Multi-tenant",
    definition: "Architecture garantissant une isolation complète des données entre les différentes organisations.",
  },
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpSections;
    const query = searchQuery.toLowerCase();
    return helpSections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query) ||
        section.points.some((point) => point.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  const openCrispChat = () => {
    if (window.$crisp) {
      window.$crisp.push(["do", "chat:open"]);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold mb-3" data-testid="support-title">
            Centre d'aide Cassius
          </h1>
          <p className="text-muted-foreground text-xs max-w-2xl mx-auto">
            Tout ce qu'il faut pour utiliser Cassius efficacement au quotidien, du premier patient au suivi clinique avancé.
          </p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher dans l'aide..."
            className="pl-10 bg-white dark:bg-white dark:text-gray-900 text-sm placeholder:text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="support-search"
          />
        </div>

        <Card className="mb-8 border-primary/20 bg-primary/5" data-testid="support-contact-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold mb-1">Besoin d'aide ?</h2>
                  <p className="text-muted-foreground text-xs">
                    Notre équipe est disponible pour vous accompagner dans l'utilisation de Cassius.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Badge variant="secondary" className="gap-1.5">
                      <MessageCircle className="h-3 w-3" />
                      Chat en direct via Crisp
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      Documentation intégrée
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5">
                      <Mail className="h-3 w-3" />
                      Contact par email
                    </Badge>
                  </div>
                </div>
              </div>
              <Button onClick={openCrispChat} className="shrink-0" data-testid="button-contact-support">
                Contacter le support
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredSections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun résultat pour "{searchQuery}"</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3" data-testid="support-accordion">
            {filteredSections.map((section) => (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg px-4 bg-card"
                data-testid={`support-section-${section.id}`}
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 rounded-lg bg-muted">
                      {section.icon}
                    </div>
                    <span className="font-medium text-sm">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="pl-12 space-y-4">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {section.description}
                    </p>
                    <ul className="space-y-2">
                      {section.points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    {section.subsections?.map((sub, idx) => (
                      <div key={idx} className="mt-4">
                        <h4 className="font-medium text-xs mb-2">{sub.title}</h4>
                        <div className="flex flex-wrap gap-2">
                          {sub.items.map((item, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="mt-10">
          <h2 className="text-base font-semibold mb-4">Glossaire</h2>
          <Accordion type="single" collapsible className="space-y-2" data-testid="glossary-accordion">
            {glossaryTerms.map((item) => (
              <AccordionItem
                key={item.term}
                value={item.term}
                className="border rounded-lg px-4 bg-card"
                data-testid={`glossary-${item.term.toLowerCase()}`}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="font-medium text-xs">{item.term}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="text-muted-foreground text-xs">{item.definition}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <footer className="mt-16 pt-8 border-t text-center">
          <p className="text-muted-foreground text-xs">
            Cassius — Le compagnon des chirurgiens-dentistes
          </p>
          <p className="text-muted-foreground/60 text-[10px] mt-1">
            Documentation Cassius v1.0
          </p>
        </footer>
      </div>
    </ScrollArea>
  );
}

declare global {
  interface Window {
    $crisp?: any[];
  }
}
