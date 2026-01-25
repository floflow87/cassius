# Cassius - Documentation des Modules

Cette documentation couvre l'ensemble des fonctionnalités de Cassius, la plateforme de gestion pour implantologistes dentaires.

---

## 1. Tableau de Bord (Dashboard)

### Description
Le tableau de bord offre une vue d'ensemble de l'activité de votre cabinet avec des statistiques clés et des raccourcis vers les actions les plus courantes.

### Fonctionnalités
- **Statistiques principales** : Nombre de patients actifs, opérations du mois, taux de succès
- **Statistiques secondaires** : Implants posés, radiographies, rendez-vous à venir
- **Rendez-vous à venir** : Liste des prochains RDV avec accès rapide aux fiches patients
- **Patients à surveiller** : Alertes cliniques (ISQ bas, complications, suivis manqués)
- **Implants récents avec ISQ** : Suivi des mesures ISQ des dernières poses
- **Personnalisation** : Réorganisation et masquage des blocs selon vos préférences

### Actions rapides
- Créer un nouveau patient
- Planifier un rendez-vous
- Enregistrer un nouvel acte chirurgical

---

## 2. Patients

### Description
Gestion complète des dossiers patients avec historique médical, suivi des traitements et documentation.

### Fonctionnalités
- **Liste des patients** : Recherche, filtrage par statut, tri alphabétique
- **Fiche patient complète** :
  - Informations personnelles (nom, prénom, date de naissance, contact)
  - Historique médical (antécédents, allergies, traitements en cours)
  - Notes médicales confidentielles
  - Statut du suivi (En suivi, Succès, Complication, Échec)

### Statuts patient
| Statut | Description |
|--------|-------------|
| EN_SUIVI | Patient avec traitement en cours |
| SUCCES | Traitement terminé avec succès |
| COMPLICATION | Complication détectée nécessitant attention |
| ECHEC | Échec du traitement |

### Onglets de la fiche patient
1. **Résumé** : Vue d'ensemble avec alertes et statistiques
2. **Historique** : Timeline des événements (visites, opérations, mesures)
3. **Implants** : Liste des implants posés avec suivi ISQ
4. **Radiographies** : Galerie des images radiographiques
5. **Documents** : Fichiers et documents attachés
6. **Notes** : Notes médicales et observations

---

## 3. Actes Chirurgicaux (Opérations)

### Description
Documentation détaillée des interventions chirurgicales avec suivi des implants posés.

### Fonctionnalités
- **Liste des actes** : Historique complet des interventions
- **Création d'acte** :
  - Sélection du patient
  - Date et heure de l'intervention
  - Type d'opération
  - Observations pré et post-opératoires
- **Ajout d'implants** : Association des implants posés pendant l'intervention
- **Suivi post-opératoire** : Notes et observations après l'intervention

### Types d'opérations
- Pose d'implant simple
- Pose d'implants multiples
- Extraction + implant immédiat
- Reprise d'implant
- Chirurgie guidée
- Greffe osseuse
- Régénération osseuse guidée (ROG)

---

## 4. Catalogue d'Implants

### Description
Bibliothèque de référence des implants disponibles dans votre cabinet.

### Fonctionnalités
- **Liste du catalogue** : Tous les modèles d'implants référencés
- **Fiche implant** :
  - Marque et fabricant
  - Référence produit
  - Dimensions (diamètre × longueur)
  - Type de connexion
  - Plateforme
- **Statistiques par modèle** :
  - Nombre de poses
  - Taux de succès moyen
  - Dernière utilisation

### Ajout d'implants au catalogue
1. Cliquer sur "Nouvel implant"
2. Renseigner la marque et la référence
3. Indiquer les dimensions
4. Sauvegarder

---

## 5. Implants Posés (Suivi ISQ)

### Description
Suivi individuel de chaque implant posé avec historique des mesures ISQ.

### Fonctionnalités
- **Liste des implants posés** : Filtrable par patient, marque, statut
- **Fiche implant posé** :
  - Position anatomique (numéro de dent)
  - Date de pose
  - Historique des mesures ISQ
  - Tendance d'ostéointégration
  - Statut actuel

### Mesures ISQ (Implant Stability Quotient)
| Valeur ISQ | Interprétation |
|------------|----------------|
| > 70 | Excellente stabilité |
| 65-70 | Bonne stabilité |
| 55-65 | Stabilité moyenne (surveillance) |
| < 55 | Stabilité insuffisante (alerte) |

### Tendances ISQ
- **Croissante** : Bonne ostéointégration
- **Stable** : Évolution normale
- **Décroissante** : Attention requise

### Statuts d'implant
| Statut | Description |
|--------|-------------|
| EN_SUIVI | Implant en cours d'ostéointégration |
| OSTEOINTEGRE | Implant parfaitement intégré |
| COMPLICATION | Problème détecté |
| ECHEC | Implant à déposer |

---

## 6. Calendrier & Rendez-vous

### Description
Planification et suivi des rendez-vous avec intégration Google Calendar.

### Fonctionnalités
- **Vue calendrier** : Jour, semaine, mois
- **Création de RDV** :
  - Sélection du patient
  - Type de rendez-vous
  - Date, heure de début et fin
  - Description
- **Types de rendez-vous** :
  - Consultation
  - Suivi post-opératoire
  - Chirurgie
  - Contrôle
  - Urgence
- **Statuts** : À venir, Terminé, Annulé

### Intégration Google Calendar
- Synchronisation bidirectionnelle
- Les RDV créés dans Cassius apparaissent dans Google Calendar
- Les événements Google peuvent être importés
- Bouton de synchronisation manuelle

### Configuration Google Calendar
1. Aller dans Paramètres > Intégrations
2. Cliquer sur "Connecter Google Calendar"
3. Autoriser l'accès
4. Sélectionner le calendrier cible

---

## 7. Radiographies & Documents

### Description
Stockage sécurisé des images radiographiques et documents médicaux.

### Fonctionnalités
- **Upload de fichiers** : Glisser-déposer ou sélection
- **Types supportés** : JPEG, PNG, PDF, DICOM
- **Organisation** : Par patient et par date
- **Visualisation** : Affichage en plein écran avec zoom
- **Annotations** : Possibilité d'ajouter des notes

### Bonnes pratiques
- Nommer clairement les fichiers
- Associer chaque radio au patient concerné
- Indiquer la date de prise de vue

---

## 8. Notifications & Alertes

### Description
Système de notifications pour ne manquer aucun événement important.

### Types de notifications
| Type | Description |
|------|-------------|
| ALERT | Alertes cliniques (ISQ bas, complications) |
| REMINDER | Rappels de rendez-vous et suivis |
| ACTIVITY | Activité de l'équipe |
| IMPORT | Importations de données |
| SYSTEM | Messages système |

### Alertes automatiques (Flags)
Le système détecte automatiquement :
- **ISQ_CRITICAL** : ISQ inférieur à 55
- **ISQ_LOW** : ISQ entre 55 et 65
- **ISQ_DECLINING** : Tendance ISQ à la baisse
- **NO_POSTOP_FOLLOWUP** : Pas de suivi post-op après 7 jours
- **NO_RECENT_ISQ** : Pas de mesure ISQ récente

### Préférences de notification
- Notifications in-app
- Notifications email
- Digest quotidien par email

---

## 9. Statistiques & Rapports

### Description
Analyses détaillées de l'activité du cabinet et des résultats cliniques.

### Tableaux de bord disponibles
1. **Vue d'ensemble** : Statistiques globales
2. **Analyse clinique** : Taux de succès par type d'implant, marque, site
3. **Évolution ISQ** : Courbes de suivi dans le temps
4. **Activité** : Volume d'opérations par période

### Métriques clés
- Nombre total de patients
- Nombre d'implants posés
- Taux de succès global
- Taux de complications
- ISQ moyen à la pose
- ISQ moyen à 3 mois
- ISQ moyen à 6 mois

### Filtres
- Par période (dates)
- Par modèle d'implant
- Par patient
- Par opération
- Par type d'implant (standard, mini-implant)

---

## 10. Paramètres

### Description
Configuration de votre compte et de votre organisation.

### Sections disponibles

#### Profil utilisateur
- Nom, prénom, email
- Mot de passe
- Photo de profil
- Rôle (Administrateur, Chirurgien, Assistant)

#### Organisation
- Nom du cabinet
- Adresse, téléphone, email
- Logo
- Fuseau horaire

#### Équipe
- Liste des membres
- Invitation de nouveaux membres
- Gestion des rôles et permissions

#### Intégrations
- Google Calendar : Connexion et synchronisation
- État des connexions actives

#### Notifications
- Préférences de notification par type
- Activation/désactivation des emails
- Fréquence des digests

#### Sécurité
- Historique des connexions
- Sessions actives
- Authentification à deux facteurs (à venir)

---

## 11. Import de Données

### Description
Importation en masse de patients depuis des fichiers externes.

### Formats supportés
- CSV (Comma Separated Values)
- Excel (.xlsx)

### Colonnes attendues
| Colonne | Obligatoire | Format |
|---------|-------------|--------|
| nom | Oui | Texte |
| prenom | Oui | Texte |
| date_naissance | Oui | YYYY-MM-DD |
| sexe | Oui | M ou F |
| email | Non | Email valide |
| telephone | Non | Texte |
| adresse | Non | Texte |

### Processus d'import
1. Préparer votre fichier selon le format attendu
2. Cliquer sur "Importer des patients"
3. Sélectionner ou glisser-déposer le fichier
4. Vérifier l'aperçu des données
5. Confirmer l'import

---

## 12. Partage de Dossier

### Description
Génération de liens de partage pour transmettre des informations à des confrères.

### Fonctionnalités
- Création de lien de partage sécurisé
- Durée de validité configurable
- Protection par mot de passe optionnelle
- Sélection des informations à partager

### Informations partageables
- Fiche patient (informations de base)
- Historique des opérations
- Mesures ISQ
- Radiographies sélectionnées

---

## 13. Onboarding (Premier démarrage)

### Description
Assistant de configuration pour les nouveaux utilisateurs.

### Étapes
1. **Bienvenue** : Configuration du profil
2. **Clinique & Sécurité** : Informations du cabinet
3. **Équipe & Rôles** : Invitation des collaborateurs (optionnel)
4. **Données** : Import ou création de patients
5. **Premier cas clinique** : Création du premier acte
6. **Calendrier** : Configuration de l'agenda (optionnel)
7. **Notifications** : Personnalisation des alertes (optionnel)
8. **Documents** : Upload d'un premier document (optionnel)

### Progression
- Les étapes obligatoires sont marquées
- Possibilité de passer les étapes optionnelles
- Reprise possible à tout moment

---

## 14. Authentification & Sécurité

### Description
Gestion sécurisée des accès utilisateurs.

### Fonctionnalités
- **Inscription** : Création de compte avec validation email
- **Connexion** : Email + mot de passe
- **Connexion Google** : OAuth via Google
- **Mot de passe oublié** : Réinitialisation par email
- **Vérification email** : Confirmation de l'adresse email

### Rôles utilisateurs
| Rôle | Permissions |
|------|-------------|
| ADMIN | Accès complet, gestion de l'équipe et des paramètres |
| CHIRURGIEN | Accès aux patients, opérations, calendrier |
| ASSISTANT | Accès limité (consultation, agenda) |

### Multi-tenant
- Isolation complète des données par organisation
- Chaque cabinet a son propre espace sécurisé
- Les utilisateurs ne voient que les données de leur organisation

---

## 15. Support & Aide

### Description
Assistance aux utilisateurs.

### Canaux disponibles
- **Chat en direct** : Widget Crisp intégré à l'application
- **Documentation** : Ce guide et la FAQ
- **Email support** : Contact direct

---

## Glossaire

| Terme | Définition |
|-------|------------|
| ISQ | Implant Stability Quotient - Mesure de la stabilité d'un implant (0-100) |
| Ostéointégration | Processus de fusion de l'implant avec l'os |
| Flag | Alerte clinique automatique |
| Digest | Résumé périodique envoyé par email |
| Multi-tenant | Architecture permettant l'isolation des données par organisation |

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Ctrl+K | Recherche globale |
| N | Nouveau patient (depuis la liste) |
| R | Nouveau rendez-vous (depuis le calendrier) |

---

*Documentation générée pour Cassius v1.0 - Janvier 2026*
