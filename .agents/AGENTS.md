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
- **Forfaits KIVO MATIQUE (Tarifs Officiels)** :
  - **FREE** : **0 FCFA / mois** (Gratuit) — Limité (max 3 documents/mois, 1 utilisateur, modèles essentiels).
  - **PRO** : **3 990 FCFA / mois** — Factures & devis illimités, 1 utilisateur, tous les modèles pro, IA, paiements Stripe & Mobile Money.
    - *Annuel PRO (-20%)* : **38 380 FCFA / an** (soit **3 190 FCFA / mois**).
  - **BUSINESS** : **9 990 FCFA / mois** — Tout Pro + 5 sièges inclus, gestion membres & rôles, multi-devises, remboursements & API.
    - *Annuel BUSINESS (-20%)* : **95 880 FCFA / an** (soit **7 990 FCFA / mois**).
    - *Membre supplémentaire* : **+1 500 FCFA / mois** par utilisateur additionnel.

## 4. Paiements & Stripe
- Support pour Stripe (Carte bancaire Visa/Mastercard) et Mobile Money (Wave, Orange Money, MTN MoMo).
- Possibilité de marquer une facture comme "Remboursée" (Refunded) avec traçabilité dans l'historique d'activités.

## 5. Expérience Utilisateur (UX / UI)
- **Prévisualisation en direct (Live Preview)** : Panneau d'édition à gauche et aperçu PDF imprimable ultra-réaliste à droite mis à jour en temps réel.
- **Internationalisation (i18n)** : Support dynamique des langues (Français, English, Español).
- **Sécurité des actions destructives** : Modal de confirmation avec choix "Annuler" et "Supprimer".
## 6. Règle de Validation de Syntaxe Pré-Commit (OBLIGATOIRE)
- **Avant CHAQUE commit**, lancer systématiquement la vérification de syntaxe :
  ```bash
  node --check app.js
  # et sur chaque fichier dans js/ :
  node --check js/auth.js
  node --check js/supabase-client.js
  node --check js/ai-assistant.js
  node --check js/payment-provider.js
  node --check js/whatsapp-helper.js
  node --check js/i18n.js
  node --check js/doc-templates.js
  ```
- Si une seule erreur de syntaxe apparaît, la corriger IMMÉDIATEMENT avant de commiter ou de pousser.
- **Interdiction absolue** de pousser un commit sans validation préalable avec `node --check`.
