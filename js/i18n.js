/**
 * KIVO MATIQUE — Système Internationalisation (i18n)
 * Phase 1 : Français (défaut) & Anglais
 * Architecture extensible avec support pour paramètres et sélecteur dynamique
 */

window.KivoI18n = {
  currentLang: 'fr',

  translations: {
    fr: {
      // ── Menu de navigation ───────────────────────────────────
      nav_dashboard: 'Tableau de bord',
      nav_documents: 'Facturation',
      nav_clients: 'Clients',
      nav_services: 'Services / Prestations',
      nav_catalog: 'Modèles',
      nav_ai: 'Création avec IA',
      nav_analytics: 'Rapports',
      nav_settings: 'Paramètres',
      nav_profile: 'Mon profil',
      nav_pricing: 'Abonnement & Paiement',
      nav_team: 'Équipe',
      nav_integrations: 'Intégrations',
      nav_new_doc: '+ Nouveau document',

      // ── Tableau de bord : Salutations & Métriques ─────────────
      greeting_morning: 'Bonjour',
      greeting_afternoon: 'Bonjour',
      greeting_evening: 'Bonsoir',
      dash_greeting_default: 'Bonjour,',
      dash_revenue: "Chiffre d'affaires",
      dash_pending: 'Factures en attente',
      dash_paid: 'Factures payées',
      dash_clients: 'Clients actifs',
      dash_recent_activity: 'Activité récente',
      dash_no_activity: 'Aucune activité récente enregistrée',
      dash_no_recent_invoices: 'Aucune facture récente',
      dash_quick_invoice: 'Créer une facture',
      dash_quick_quote: 'Créer un devis',
      dash_quick_client: 'Nouveau client',
      dash_conversion_rate: 'Taux de conversion',
      dash_view_all: 'Voir tout',

      // ── Statuts de documents ─────────────────────────────────
      status_draft: 'Brouillon',
      status_sent: 'Envoyée',
      status_viewed: 'Consultée',
      status_paid: 'Payée',
      status_overdue: 'En retard',
      status_cancelled: 'Annulée',
      status_refunded: 'Remboursée',
      status_accepted: 'Accepté',
      status_rejected: 'Refusé',

      // ── En-têtes de tableaux (Factures & Lignes) ─────────────
      th_number: 'Numéro',
      th_client: 'Client',
      th_date: 'Date',
      th_issue_date: "Date d'émission",
      th_due_date: 'Échéance',
      th_amount: 'Montant',
      th_total: 'Total',
      th_status: 'Statut',
      th_actions: 'Actions',
      th_type: 'Type',
      th_description: 'Description',
      th_qty: 'Quantité',
      th_price: 'Prix Unitaire',
      th_tax: 'TVA',

      // ── Boutons d'action visibles ────────────────────────────
      btn_save: 'Enregistrer',
      btn_save_changes: 'Enregistrer les modifications',
      btn_download_pdf: 'Télécharger PDF',
      btn_print: 'Imprimer',
      btn_create: 'Créer',
      btn_delete: 'Supprimer',
      btn_cancel: 'Annuler',
      btn_back: 'Retour',
      btn_edit: 'Modifier',
      btn_pay_online: 'Payer en ligne',
      btn_accept_quote: 'Accepter le devis',
      btn_share_whatsapp: 'Partager sur WhatsApp',
      btn_filter: 'Filtrer',

      // ── Textes de la Facture / Devis (Imprimable & PDF) ───────
      doc_invoice: 'FACTURE',
      doc_quote: 'DEVIS',
      doc_issue_date_label: "Date d'émission :",
      doc_due_date_label: "Date d'échéance :",
      doc_billed_to: 'Client / Facturé à',
      doc_contact: 'Contact',
      doc_select_client: '(Sélectionnez un client)',
      doc_subtotal_ht: 'Sous-total HT :',
      doc_vat_calc: 'Calcul de TVA :',
      doc_discount: 'Réduction :',
      doc_total_ttc: 'TOTAL TTC :',
      doc_total_amount: 'TOTAL :',
      doc_payment_title: 'Paiement & Règlement',
      doc_mode: 'Mode :',
      doc_terms: 'Conditions :',
      doc_notes: 'Notes / Mentions légales',
      doc_empty_items: 'Aucun article saisi',
      doc_untitled_item: 'Article sans désignation',
      doc_paid_badge: 'Facture Payée',
      doc_refunded_badge: 'Remboursée',
      doc_invoice_short: 'Facture',
      doc_quote_short: 'Devis',

      // ── Toasts : Authentification ─────────────────────────────
      toast_login_success: 'Connexion réussie.',
      toast_welcome_setup: 'Bienvenue ! Configurez votre entreprise pour commencer.',
      toast_demo_activated: 'Mode démo KIVO MATIQUE activé ! Compte MD Creative Studio chargé.',
      toast_logout_success: 'Déconnexion réussie.',
      toast_ai_pro_required: '✨ Création avec IA — disponible à partir du forfait PRO. Passez au niveau supérieur pour débloquer cette fonctionnalité.',
      toast_data_not_loaded: 'Données non chargées. Veuillez patienter ou actualiser.',

      // ── Toasts : Logo ─────────────────────────────────────────
      toast_logo_deleted: 'Logo supprimé.',
      toast_logo_removed_invoice: 'Logo retiré de cette facture (profil d\'entreprise inchangé).',
      toast_logo_select_file: 'Veuillez sélectionner un fichier image.',
      toast_logo_imported: 'Logo importé avec succès !',
      toast_logo_applied: 'Logo appliqué à la facture.',
      toast_logo_color_applied: 'Couleur détectée du logo ({color}) et appliquée !',

      // ── Toasts : Langue ───────────────────────────────────────
      toast_lang_applied: 'Langue appliquée : {lang}',

      // ── Toasts : Brouillons ───────────────────────────────────
      toast_draft_restored: 'Brouillon restauré ! Vous pouvez continuer votre saisie.',
      toast_draft_restore_error: 'Erreur lors de la reprise du brouillon.',
      toast_draft_deleted: 'Brouillon supprimé.',

      // ── Toasts : Modèles ──────────────────────────────────────
      toast_template_saved: 'Modèle sauvegardé avec succès !',
      toast_template_save_error: 'Erreur lors de la sauvegarde du modèle.',
      toast_template_deleted: 'Modèle supprimé.',
      toast_template_applied: 'Modèle "{name}" sélectionné et appliqué !',
      toast_template_applied_invoice: 'Modèle "{name}" appliqué à cette facture',
      toast_template_colors_applied: 'Couleurs par défaut du modèle appliquées',
      toast_template_editor_soon: 'L\'éditeur de modèles personnalisés sera bientôt disponible.',
      toast_template_engine_unavail: 'Moteur de modèle indisponible.',

      // ── Toasts : Documents ────────────────────────────────────
      toast_doc_cannot_share_draft: "Terminez et enregistrez la facture avant de la partager",
      toast_doc_cannot_share_draft_quote: "Terminez et enregistrez le devis avant de le partager",
      toast_doc_no_items: 'Veuillez ajouter au moins un article avec une désignation avant d\'enregistrer.',
      toast_doc_ai_required: 'Veuillez saisir une description de votre besoin.',
      toast_doc_ai_filled: 'KIVO MATIQUE AI : Formulaire complété avec succès !',
      toast_doc_free_limit: 'Limite atteinte : Le forfait Gratuit est limité à 3 documents (factures et devis finalisés) par mois. Passez au forfait PRO pour créer des documents en illimité.',
      toast_doc_cloud_fail: 'Document enregistré localement (synchronisation cloud échouée).',
      toast_doc_saved: 'Document {num} enregistré avec succès !',
      toast_doc_refunded: 'Facture {num} remboursée avec succès.',
      toast_doc_delete_error: 'Erreur lors de la suppression sur le serveur.',
      toast_doc_deleted: 'Document {num} supprimé.',
      toast_doc_not_found: 'Ce document n\'existe pas ou a été supprimé.',
      toast_doc_load_error: 'Erreur de chargement du document.',
      toast_doc_not_found_short: 'Document non trouvé.',
      toast_doc_quote_accepted: 'Félicitations ! Devis accepté par le client.',
      toast_doc_no_print: 'Aucun document à imprimer.',
      toast_doc_no_download: 'Aucun document disponible pour le téléchargement.',
      toast_doc_pdf_success: 'Facture téléchargée avec succès !',
      toast_doc_pdf_error: 'Une erreur est survenue lors du téléchargement. Réessayez.',
      toast_doc_print_error: 'Une erreur est survenue lors de l\'impression. Réessayez.',
      toast_doc_html2canvas_missing: 'html2canvas non disponible — vérifiez votre connexion.',
      toast_doc_jspdf_missing: 'jsPDF non disponible — vérifiez votre connexion.',
      toast_doc_supabase_saved: 'Facture enregistrée dans Supabase !',
      toast_doc_local_saved: 'Facture sauvegardée localement (Supabase indisponible).',
      toast_doc_local_only: 'Facture enregistrée localement !',

      // ── Toasts : Clients ──────────────────────────────────────
      toast_client_name_required: 'Veuillez saisir le nom du client.',
      toast_client_save_error: 'Erreur lors de l\'enregistrement du client sur le serveur.',
      toast_client_saved: 'Client {name} ({type}) enregistré avec succès.',
      toast_client_delete_error: 'Erreur lors de la suppression du client sur le serveur.',
      toast_client_deleted: 'Client {name} supprimé.',
      toast_reminder_copied: 'Message de relance copié dans le presse-papier !',

      // ── Toasts : Services / Catalogue ────────────────────────
      toast_item_name_required: 'Veuillez saisir le nom de l\'article ou service.',
      toast_item_price_required: 'Veuillez saisir un prix unitaire valide.',
      toast_item_save_error: 'Erreur lors de la synchronisation de l\'article sur le serveur.',
      toast_item_saved: 'Service / prestation "{name}" enregistré avec succès.',
      toast_item_delete_error: 'Erreur lors de la suppression de l\'article sur le serveur.',
      toast_item_deleted: '"{name}" a été supprimé de vos services & prestations.',
      toast_item_added_to_doc: 'Article "{name}" ajouté',

      // ── Toasts : Équipe / Membres ─────────────────────────────
      toast_team_invite_business_only: 'L\'invitation de membres est réservée au plan Business (9 990 FCFA/mois).',
      toast_team_seats_limit: 'Limite atteinte : 5 sièges inclus dans le plan Business. Ajoutez +1 500 FCFA/mois par siège supplémentaire.',
      toast_team_email_invalid: 'Veuillez saisir une adresse e-mail valide.',
      toast_team_member_exists: 'Ce membre est déjà dans l\'équipe.',
      toast_team_invite_sent: 'Invitation envoyée à {email} ({role}).',
      toast_team_member_removed: 'Membre retiré de l\'équipe.',
      toast_whatsapp_opening: 'Ouverture de WhatsApp...',

      // ── Toasts : Paiements ────────────────────────────────────
      toast_payment_confirmed: 'Paiement de {amount} {currency} confirmé via {provider} !',

      // ── Toasts : Paramètres / Profil ──────────────────────────
      toast_settings_saved: 'Paramètres KIVO MATIQUE enregistrés !',
      toast_settings_cloud_fail: 'Paramètres enregistrés localement (synchronisation cloud échouée).',
      toast_password_updated: 'Mot de passe mis à jour avec succès !',
      toast_password_too_short: 'Le mot de passe doit comporter au moins 8 caractères.',
      toast_password_no_digit: 'Le mot de passe doit contenir au moins un chiffre.',
      toast_password_no_upper: 'Le mot de passe doit contenir au moins une lettre majuscule.',
      toast_password_mismatch: 'Les deux mots de passe ne correspondent pas.',
      toast_password_update_error: 'Erreur lors de la mise à jour du mot de passe.',
      toast_logo_file_invalid: 'Veuillez sélectionner un fichier image valide.',
      toast_palette_applied: 'Palette appliquée',

      // ── Toasts : IA / Assistant ───────────────────────────────
      toast_ai_describe_first: 'Décrivez votre facture dans la zone de texte.',
      toast_ai_structured: 'Facture structurée avec succès !',
      toast_ai_generate_first: 'Générez d\'abord une facture avec l\'IA.',
      toast_ai_loaded_in_editor: 'Facture IA chargée dans l\'éditeur !',
      toast_wizard_reset: 'Assistant réinitialisé au début.',

      // ── Toasts : Onboarding / Plans ───────────────────────────
      toast_workspace_ready: 'Espace prêt. Bon départ sur KIVO MATIQUE !',
      toast_plan_activated: 'Forfait {plan} (KIVO MATIQUE) activé !',

      // ── Toasts : Devise ───────────────────────────────────────
      toast_currency_changed: 'Devise modifiée : 1 {old} = {rate} {new}. Prix convertis.',

      // ── Modals : Titres & Boutons ─────────────────────────────
      modal_confirm_delete_title: 'Confirmer la suppression',
      modal_confirm_logout_title: 'Confirmer la déconnexion',
      modal_confirm_logout_body: 'Êtes-vous sûr(e) de vouloir vous déconnecter de KIVO MATIQUE ?',
      modal_confirm_logout_btn: 'Se déconnecter',
      modal_new_client_title: 'Nouveau Client',
      modal_edit_client_title: 'Modifier le client',
      modal_change_password_title: 'Changer le mot de passe',
      modal_invite_member_title: 'Inviter un membre',
      modal_new_doc_title: 'Créer un document',
      modal_payment_title: 'Sélectionnez votre moyen de paiement',
      modal_payment_checkout_title: 'Règlement en ligne sécurisé',
      modal_client_details_title: 'Détails du client',
      modal_catalog_title: 'Ajouter un service / prestation',
      modal_catalog_edit_title: "Modifier l'article / prestation",
      modal_connected_accounts_title: 'Comptes & Sessions connectés',
      modal_delete_client_title: 'Supprimer le client',
      modal_delete_client_msg: 'Voulez-vous vraiment supprimer le client {name} ?',
      modal_delete_item_confirm: 'Êtes-vous sûr de vouloir supprimer "{name}" de vos services & prestations ?'
    },

    en: {
      // ── Navigation Menu ──────────────────────────────────────
      nav_dashboard: 'Dashboard',
      nav_documents: 'Invoices & Billing',
      nav_clients: 'Clients',
      nav_services: 'Services & Items',
      nav_catalog: 'Templates',
      nav_ai: 'AI Assistant',
      nav_analytics: 'Reports',
      nav_settings: 'Settings',
      nav_profile: 'My Profile',
      nav_pricing: 'Plans & Billing',
      nav_team: 'Team',
      nav_integrations: 'Integrations',
      nav_new_doc: '+ New Document',

      // ── Dashboard : Greetings & Stats ────────────────────────
      greeting_morning: 'Good morning',
      greeting_afternoon: 'Good afternoon',
      greeting_evening: 'Good evening',
      dash_greeting_default: 'Hello,',
      dash_revenue: 'Total Revenue',
      dash_pending: 'Pending Invoices',
      dash_paid: 'Paid Invoices',
      dash_clients: 'Active Clients',
      dash_recent_activity: 'Recent Activity',
      dash_no_activity: 'No recent activity recorded',
      dash_no_recent_invoices: 'No recent invoices',
      dash_quick_invoice: 'Create Invoice',
      dash_quick_quote: 'Create Quote',
      dash_quick_client: 'New Client',
      dash_conversion_rate: 'Conversion Rate',
      dash_view_all: 'View all',

      // ── Document Statuses ────────────────────────────────────
      status_draft: 'Draft',
      status_sent: 'Sent',
      status_viewed: 'Viewed',
      status_paid: 'Paid',
      status_overdue: 'Overdue',
      status_cancelled: 'Cancelled',
      status_refunded: 'Refunded',
      status_accepted: 'Accepted',
      status_rejected: 'Declined',

      // ── Table Headers ────────────────────────────────────────
      th_number: 'Number',
      th_client: 'Client',
      th_date: 'Date',
      th_issue_date: 'Issue Date',
      th_due_date: 'Due Date',
      th_amount: 'Amount',
      th_total: 'Total',
      th_status: 'Status',
      th_actions: 'Actions',
      th_type: 'Type',
      th_description: 'Description',
      th_qty: 'Qty',
      th_price: 'Unit Price',
      th_tax: 'Tax',

      // ── Action Buttons ───────────────────────────────────────
      btn_save: 'Save',
      btn_save_changes: 'Save Changes',
      btn_download_pdf: 'Download PDF',
      btn_print: 'Print',
      btn_create: 'Create',
      btn_delete: 'Delete',
      btn_cancel: 'Cancel',
      btn_back: 'Back',
      btn_edit: 'Edit',
      btn_pay_online: 'Pay Online',
      btn_accept_quote: 'Accept Quote',
      btn_share_whatsapp: 'Share on WhatsApp',
      btn_filter: 'Filter',

      // ── Invoice / Quote Document Texts ───────────────────────
      doc_invoice: 'INVOICE',
      doc_quote: 'QUOTE',
      doc_issue_date_label: 'Issue Date:',
      doc_due_date_label: 'Due Date:',
      doc_billed_to: 'Billed to / Client',
      doc_contact: 'Contact',
      doc_select_client: '(Select a client)',
      doc_subtotal_ht: 'Subtotal (excl. tax):',
      doc_vat_calc: 'Tax calculation:',
      doc_discount: 'Discount:',
      doc_total_ttc: 'TOTAL (incl. tax):',
      doc_total_amount: 'TOTAL:',
      doc_payment_title: 'Payment & Terms',
      doc_mode: 'Method:',
      doc_terms: 'Terms:',
      doc_notes: 'Notes / Legal Notice',
      doc_empty_items: 'No items entered',
      doc_untitled_item: 'Untitled item',
      doc_paid_badge: 'Paid Invoice',
      doc_refunded_badge: 'Refunded',
      doc_invoice_short: 'Invoice',
      doc_quote_short: 'Quote',

      // ── Toasts : Authentication ───────────────────────────────
      toast_login_success: 'Successfully signed in.',
      toast_welcome_setup: 'Welcome! Set up your business to get started.',
      toast_demo_activated: 'KIVO MATIQUE demo mode activated! MD Creative Studio account loaded.',
      toast_logout_success: 'Signed out successfully.',
      toast_ai_pro_required: '✨ AI Creation — available from the PRO plan. Upgrade to unlock this feature.',
      toast_data_not_loaded: 'Data not loaded. Please wait or refresh.',

      // ── Toasts : Logo ─────────────────────────────────────────
      toast_logo_deleted: 'Logo removed.',
      toast_logo_removed_invoice: 'Logo removed from this invoice (business profile unchanged).',
      toast_logo_select_file: 'Please select an image file.',
      toast_logo_imported: 'Logo imported successfully!',
      toast_logo_applied: 'Logo applied to the invoice.',
      toast_logo_color_applied: 'Logo color detected ({color}) and applied!',

      // ── Toasts : Language ─────────────────────────────────────
      toast_lang_applied: 'Language applied: {lang}',

      // ── Toasts : Drafts ───────────────────────────────────────
      toast_draft_restored: 'Draft restored! You can continue editing.',
      toast_draft_restore_error: 'Error restoring draft.',
      toast_draft_deleted: 'Draft deleted.',

      // ── Toasts : Templates ────────────────────────────────────
      toast_template_saved: 'Template saved successfully!',
      toast_template_save_error: 'Error saving template.',
      toast_template_deleted: 'Template deleted.',
      toast_template_applied: 'Template "{name}" selected and applied!',
      toast_template_applied_invoice: 'Template "{name}" applied to this invoice',
      toast_template_colors_applied: 'Default template colors applied',
      toast_template_editor_soon: 'Custom template editor coming soon.',
      toast_template_engine_unavail: 'Template engine unavailable.',

      // ── Toasts : Documents ────────────────────────────────────
      toast_doc_cannot_share_draft: "Finish and save the invoice before sharing it.",
      toast_doc_cannot_share_draft_quote: "Finish and save the quote before sharing it.",
      toast_doc_no_items: 'Please add at least one item with a name before saving.',
      toast_doc_ai_required: 'Please describe your invoice needs.',
      toast_doc_ai_filled: 'KIVO MATIQUE AI: Form filled successfully!',
      toast_doc_free_limit: 'Limit reached: The Free plan allows up to 3 documents (invoices and quotes) per month. Upgrade to PRO for unlimited documents.',
      toast_doc_cloud_fail: 'Document saved locally (cloud sync failed).',
      toast_doc_saved: 'Document {num} saved successfully!',
      toast_doc_refunded: 'Invoice {num} refunded successfully.',
      toast_doc_delete_error: 'Error deleting document from server.',
      toast_doc_deleted: 'Document {num} deleted.',
      toast_doc_not_found: 'This document does not exist or has been deleted.',
      toast_doc_load_error: 'Error loading document.',
      toast_doc_not_found_short: 'Document not found.',
      toast_doc_quote_accepted: 'Congratulations! Quote accepted by the client.',
      toast_doc_no_print: 'No document to print.',
      toast_doc_no_download: 'No document available to download.',
      toast_doc_pdf_success: 'Invoice downloaded successfully!',
      toast_doc_pdf_error: 'An error occurred while downloading. Please try again.',
      toast_doc_print_error: 'An error occurred while printing. Please try again.',
      toast_doc_html2canvas_missing: 'html2canvas not available — check your connection.',
      toast_doc_jspdf_missing: 'jsPDF not available — check your connection.',
      toast_doc_supabase_saved: 'Invoice saved to Supabase!',
      toast_doc_local_saved: 'Invoice saved locally (Supabase unavailable).',
      toast_doc_local_only: 'Invoice saved locally!',

      // ── Toasts : Clients ──────────────────────────────────────
      toast_client_name_required: 'Please enter the client name.',
      toast_client_save_error: 'Error saving client to server.',
      toast_client_saved: 'Client {name} ({type}) saved successfully.',
      toast_client_delete_error: 'Error deleting client from server.',
      toast_client_deleted: 'Client {name} deleted.',
      toast_reminder_copied: 'Follow-up message copied to clipboard!',

      // ── Toasts : Services / Catalog ───────────────────────────
      toast_item_name_required: 'Please enter the item or service name.',
      toast_item_price_required: 'Please enter a valid unit price.',
      toast_item_save_error: 'Error syncing item to server.',
      toast_item_saved: 'Service / item "{name}" saved successfully.',
      toast_item_delete_error: 'Error deleting item from server.',
      toast_item_deleted: '"{name}" has been removed from your services.',
      toast_item_added_to_doc: 'Item "{name}" added',

      // ── Toasts : Team / Members ───────────────────────────────
      toast_team_invite_business_only: 'Member invitations are available on the Business plan (9,990 FCFA/month).',
      toast_team_seats_limit: 'Seat limit reached: 5 seats included in the Business plan. Add +1,500 FCFA/month per extra seat.',
      toast_team_email_invalid: 'Please enter a valid email address.',
      toast_team_member_exists: 'This member is already on the team.',
      toast_team_invite_sent: 'Invitation sent to {email} ({role}).',
      toast_team_member_removed: 'Member removed from team.',
      toast_whatsapp_opening: 'Opening WhatsApp...',

      // ── Toasts : Payments ─────────────────────────────────────
      toast_payment_confirmed: 'Payment of {amount} {currency} confirmed via {provider}!',

      // ── Toasts : Settings / Profile ───────────────────────────
      toast_settings_saved: 'KIVO MATIQUE settings saved!',
      toast_settings_cloud_fail: 'Settings saved locally (cloud sync failed).',
      toast_password_updated: 'Password updated successfully!',
      toast_password_too_short: 'Password must be at least 8 characters.',
      toast_password_no_digit: 'Password must contain at least one number.',
      toast_password_no_upper: 'Password must contain at least one uppercase letter.',
      toast_password_mismatch: 'The two passwords do not match.',
      toast_password_update_error: 'Error updating password.',
      toast_logo_file_invalid: 'Please select a valid image file.',
      toast_palette_applied: 'Palette applied',

      // ── Toasts : AI / Assistant ───────────────────────────────
      toast_ai_describe_first: 'Describe your invoice in the text box.',
      toast_ai_structured: 'Invoice structured successfully!',
      toast_ai_generate_first: 'Generate an invoice with AI first.',
      toast_ai_loaded_in_editor: 'AI invoice loaded in editor!',
      toast_wizard_reset: 'Wizard reset to beginning.',

      // ── Toasts : Onboarding / Plans ───────────────────────────
      toast_workspace_ready: 'Workspace ready. Welcome to KIVO MATIQUE!',
      toast_plan_activated: '{plan} plan (KIVO MATIQUE) activated!',

      // ── Toasts : Currency ─────────────────────────────────────
      toast_currency_changed: 'Currency changed: 1 {old} = {rate} {new}. Prices converted.',

      // ── Modals : Titles & Buttons ─────────────────────────────
      modal_confirm_delete_title: 'Confirm Deletion',
      modal_confirm_logout_title: 'Confirm Sign Out',
      modal_confirm_logout_body: 'Are you sure you want to sign out of KIVO MATIQUE?',
      modal_confirm_logout_btn: 'Sign Out',
      modal_new_client_title: 'New Client',
      modal_edit_client_title: 'Edit Client',
      modal_change_password_title: 'Change Password',
      modal_invite_member_title: 'Invite a Member',
      modal_new_doc_title: 'Create a Document',
      modal_payment_title: 'Select your payment method',
      modal_payment_checkout_title: 'Secure Online Payment',
      modal_client_details_title: 'Client Details',
      modal_catalog_title: 'Add a service / item',
      modal_catalog_edit_title: 'Edit service / item',
      modal_connected_accounts_title: 'Connected Accounts & Sessions',
      modal_delete_client_title: 'Delete Client',
      modal_delete_client_msg: 'Are you sure you want to delete client {name}?',
      modal_delete_item_confirm: 'Are you sure you want to delete "{name}" from your services & items?'
    }
  },

  /**
   * Traduit une clé selon la langue active
   * @param {string} key
   * @param {string} [lang]
   * @returns {string}
   */
  t: function (key, lang) {
    const l = lang || this.currentLang || 'fr';
    const dict = this.translations[l] || this.translations['fr'];
    return dict[key] !== undefined ? dict[key] : (this.translations['fr'][key] || key);
  },

  /**
   * Retourne la salutation appropriée selon l'heure locale
   * @param {string} [firstName]
   * @param {string} [lang]
   * @returns {string}
   */
  getGreeting: function (firstName, lang) {
    const l = lang || this.currentLang || 'fr';
    const hour = new Date().getHours();
    let salutationKey = 'greeting_morning';
    if (hour >= 18 || hour < 5) {
      salutationKey = 'greeting_evening';
    } else if (hour >= 12 && l === 'en') {
      salutationKey = 'greeting_afternoon';
    }
    const salutation = this.t(salutationKey, l);
    return firstName ? `${salutation} ${firstName},` : `${salutation},`;
  },

  /**
   * Définit la langue active
   * @param {string} lang ('fr' | 'en')
   */
  setLang: function (lang) {
    this.currentLang = (lang === 'en') ? 'en' : 'fr';
  }
};
