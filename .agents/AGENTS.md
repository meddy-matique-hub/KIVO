# KIVO MATIQUE - Directives et Règles du Projet

## 1. Identité de Marque & Branding
- **Nom officiel** : KIVO MATIQUE
- **Tagline** : Business, simplified. / L'assistant commercial & facturation des entreprises.
- **Design System** : Mode sombre & clair moderne, cartes épurées avec effet de verre (glassmorphism), typographie Google Fonts (Inter + Outfit), gradients doux (Indigo à Violet).

## 2. Système de Facturation & Numérotation
- **Numérotation automatique** : Séquentielle avec préfixe personnalisable (`FAC-YYYY-0001` ou `DEV-YYYY-0001`).
- **TVA / Taxe** : Gestion flexible de la TVA (18% par défaut zone FCFA, 20% FR, 0% exonéré). Affichage systématique HT (Hors Taxe), TVA (Montant de la taxe), TTC (Toutes Taxes Comprises).
- **Types de Clients** :
  - **Entreprise (B2B)** : nécessite la raison sociale, le numéro SIRET/NINEA/TVA intracommunautaire.
  - **Particulier (B2C)** : prénom/nom et coordonnées.

## 3. Tarification & Abonnements (Subscriptions)
- **Devises supportées** : FCFA (XOF/XAF), EUR (€), USD ($), CAD ($), GBP (£).
- **Forfaits KIVO MATIQUE** :
  - **Gratuit** : Limité (max 3 factures/mois, fonctionnalités de base).
  - **Pro** : **2 600 FCFA / mois** (~4 € / mois) — Factures illimitées, export PDF, relances automatiques, paiement Mobile Money & Carte.
  - **Business** : **7 000 FCFA / mois** (~11 € / mois) — Multi-devises, relances IA avancées, support Stripe complet, remboursements & rapports analytiques.

## 4. Paiements & Stripe
- Support pour Stripe (Carte bancaire Visa/Mastercard) et Mobile Money (Wave, Orange Money, MTN MoMo).
- Possibilité de marquer une facture comme "Remboursée" (Refunded) avec traçabilité dans l'historique d'activités.

## 5. Expérience Utilisateur (UX / UI)
- **Prévisualisation en direct (Live Preview)** : Panneau d'édition à gauche et aperçu PDF imprimable ultra-réaliste à droite mis à jour en temps réel.
- **Internationalisation (i18n)** : Support dynamique des langues (Français, English, Español).
- **Sécurité des actions destructives** : Modal de confirmation avec choix "Annuler" et "Supprimer".
- **Responsive Mobile** : Support complet sur smartphone et tablettes, menu tiroir et navigation fluide.

