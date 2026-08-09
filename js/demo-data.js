/**
 * KIVO SaaS - Demo Data Seed
 * Pre-loaded realistic data for MD Creative Studio (Senegal/Ivory Coast/Central Africa SMB context)
 */

window.KIVO_DEMO_DATA = {
  business: {
    name: "MD Creative Studio",
    owner: "Marc Koffi",
    email: "marc.koffi@mdcreative.design",
    phone: "+221 77 842 19 02",
    industry: "Design & Digital Marketing",
    country: "Sénégal",
    currency: "FCFA",
    currencySymbol: "FCFA",
    address: "Avenue Cheikh Anta Diop, Dakar",
    taxId: "SN-NINEA-849204812",
    logoText: "MD",
    logoBg: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
    bankDetails: {
      bankName: "CBAO Groupe Attijariwafa Bank",
      accountName: "MD CREATIVE STUDIO SARL",
      iban: "SN123 01001 001234567890 12",
      mobileMoney: {
        wave: "+221 77 842 19 02",
        orangeMoney: "+221 77 842 19 02",
        mtn: "+225 07 89 12 34 56"
      }
    },
    documentPrefix: "KVO-",
    templateStyle: "modern",
    subscriptionTier: "Pro",
    subscriptionStatus: "active"
  },

  clients: [
    {
      id: "cli_1",
      name: "Restaurant La Paix",
      company: "Sarl La Paix Food & Drinks",
      contactName: "Jean-Paul Diop",
      email: "direction@lapaix-restaurant.sn",
      phone: "+221 77 500 12 34",
      address: "Almadies, Dakar",
      totalInvoiced: 480000,
      totalPaid: 430000,
      balanceDue: 50000,
      createdAt: "2026-06-15"
    },
    {
      id: "cli_2",
      name: "Maison Event & Wedding",
      company: "Maison Event Africa",
      contactName: "Awa Ndiaye",
      email: "awa@maisonevent.com",
      phone: "+221 78 120 44 88",
      address: "Plateau, Abidjan / Dakar",
      totalInvoiced: 850000,
      totalPaid: 850000,
      balanceDue: 0,
      createdAt: "2026-07-01"
    },
    {
      id: "cli_3",
      name: "Kivu Tech & Design",
      company: "Kivu Innovation Hub",
      contactName: "Samuel Bahembera",
      email: "samuel@kivutech.io",
      phone: "+243 99 876 54 32",
      address: "Goma, RDC",
      totalInvoiced: 350000,
      totalPaid: 0,
      balanceDue: 350000,
      createdAt: "2026-07-20"
    },
    {
      id: "cli_4",
      name: "Boulangerie Artisanale Le Pain Doré",
      company: "Le Pain Doré SARL",
      contactName: "Aminata Traoré",
      email: "contact@lepaindore.sn",
      phone: "+221 76 990 11 22",
      address: "Point E, Dakar",
      totalInvoiced: 180000,
      totalPaid: 180000,
      balanceDue: 0,
      createdAt: "2026-07-28"
    }
  ],

  catalog: [
    {
      id: "prod_1",
      name: "Identité Visuelle & Logo Premium",
      description: "Création de charte graphique complète, logo vectoriel, déclinaisons et guide de marque.",
      price: 250000,
      unit: "projet",
      taxRate: 18
    },
    {
      id: "prod_2",
      name: "Pack 10 Visuals Réseaux Sociaux",
      description: "Conception de 10 visuels pour Instagram & Facebook au format HD.",
      price: 60000,
      unit: "pack",
      taxRate: 18
    },
    {
      id: "prod_3",
      name: "Vidéo Pub & Motion Design (30s)",
      description: "Montage vidéo promotionnel avec sous-titres, musique sous licence et animations.",
      price: 150000,
      unit: "vidéo",
      taxRate: 18
    },
    {
      id: "prod_4",
      name: "Site Web Vitrine responsive",
      description: "Développement landing page moderne, hébergement et nom de domaine 1 an.",
      price: 350000,
      unit: "projet",
      taxRate: 18
    },
    {
      id: "prod_5",
      name: "Flyers A5 Recto/Verso (Impression 1000 ex)",
      description: "Design graphique et impression haute définition sur papier couché 300g.",
      price: 45000,
      unit: "lot",
      taxRate: 18
    }
  ],

  documents: [
    {
      id: "doc_1024",
      number: "KVO-1024",
      type: "invoice",
      status: "paid",
      clientId: "cli_2",
      clientName: "Maison Event & Wedding",
      clientEmail: "awa@maisonevent.com",
      clientPhone: "+221 78 120 44 88",
      issueDate: "2026-08-01",
      dueDate: "2026-08-08",
      items: [
        {
          name: "Vidéo Pub & Motion Design (30s)",
          description: "Vidéo teaser pour le grand salon annuel de l'événementiel.",
          quantity: 2,
          price: 150000,
          total: 300000
        },
        {
          name: "Pack 10 Visuals Réseaux Sociaux",
          description: "Campagne de communication digitale sur Instagram.",
          quantity: 1,
          price: 60000,
          total: 60000
        }
      ],
      subtotal: 360000,
      discount: 10000,
      tax: 0,
      total: 350000,
      amountPaid: 350000,
      notes: "Merci pour votre confiance. Paiement reçu par Wave le 03/08/2026.",
      terms: "Paiement à réception de la facture.",
      publicToken: "inv_token_9842a1",
      viewsCount: 4,
      lastViewedAt: "2026-08-03 14:22"
    },
    {
      id: "doc_1025",
      number: "KVO-1025",
      type: "quote",
      status: "accepted",
      clientId: "cli_1",
      clientName: "Restaurant La Paix",
      clientEmail: "direction@lapaix-restaurant.sn",
      clientPhone: "+221 77 500 12 34",
      issueDate: "2026-08-04",
      dueDate: "2026-08-18",
      items: [
        {
          name: "Identité Visuelle & Logo Premium",
          description: "Refonte du logo du restaurant et nouveau menu plastifié A4.",
          quantity: 1,
          price: 250000,
          total: 250000
        },
        {
          name: "Flyers A5 Recto/Verso (Impression 1000 ex)",
          description: "Lancement de la nouvelle carte gastronomique.",
          quantity: 2,
          price: 45000,
          total: 90000
        }
      ],
      subtotal: 340000,
      discount: 0,
      tax: 0,
      total: 340000,
      amountPaid: 0,
      notes: "Livraison prévue sous 10 jours ouvrés après validation du B.A.T.",
      terms: "Devis valable 30 jours. Acompte de 50% requis avant démarrage.",
      publicToken: "quo_token_1104c9",
      viewsCount: 2,
      lastViewedAt: "2026-08-05 09:10"
    },
    {
      id: "doc_1026",
      number: "KVO-1026",
      type: "invoice",
      status: "overdue",
      clientId: "cli_3",
      clientName: "Kivu Tech & Design",
      clientEmail: "samuel@kivutech.io",
      clientPhone: "+243 99 876 54 32",
      issueDate: "2026-07-15",
      dueDate: "2026-07-30",
      items: [
        {
          name: "Site Web Vitrine responsive",
          description: "Création de la plateforme de présentation Kivu Hub.",
          quantity: 1,
          price: 350000,
          total: 350000
        }
      ],
      subtotal: 350000,
      discount: 0,
      tax: 0,
      total: 350000,
      amountPaid: 0,
      notes: "Règlement par virement bancaire ou Mobile Money (Wave / Orange Money).",
      terms: "Échéance dépassée le 30 juillet 2026.",
      publicToken: "inv_token_8873f4",
      viewsCount: 7,
      lastViewedAt: "2026-08-08 18:45"
    },
    {
      id: "doc_1027",
      number: "KVO-1027",
      type: "invoice",
      status: "sent",
      clientId: "cli_1",
      clientName: "Restaurant La Paix",
      clientEmail: "direction@lapaix-restaurant.sn",
      clientPhone: "+221 77 500 12 34",
      issueDate: "2026-08-07",
      dueDate: "2026-08-14",
      items: [
        {
          name: "Pack 10 Visuals Réseaux Sociaux",
          description: "Visuels promotionnels pour la soirée grillades du samedi.",
          quantity: 1,
          price: 50000,
          total: 50000
        }
      ],
      subtotal: 50000,
      discount: 0,
      tax: 0,
      total: 50000,
      amountPaid: 0,
      notes: "Relance à l'échéance du 14 août.",
      terms: "Paiement à 7 jours.",
      publicToken: "inv_token_7731d2",
      viewsCount: 1,
      lastViewedAt: "2026-08-08 11:30"
    }
  ],

  activities: [
    {
      id: "act_1",
      timestamp: "Il y a 10 min",
      type: "invoice_sent",
      icon: "send",
      title: "Facture #KVO-1027 envoyée",
      details: "Envoyée par WhatsApp à Restaurant La Paix"
    },
    {
      id: "act_2",
      timestamp: "Hier à 18:45",
      type: "view",
      icon: "eye",
      title: "Facture #KVO-1026 consultée",
      details: "Kivu Tech & Design a ouvert le lien public"
    },
    {
      id: "act_3",
      timestamp: "5 août 2026",
      type: "quote_accepted",
      icon: "check-circle",
      title: "Devis #KVO-1025 accepté",
      details: "Validé en ligne par Jean-Paul Diop (340 000 FCFA)"
    },
    {
      id: "act_4",
      timestamp: "3 août 2026",
      type: "payment",
      icon: "dollar-sign",
      title: "Paiement reçu #KVO-1024",
      details: "350 000 FCFA encaissés via Wave Mobile Money"
    }
  ],

  notifications: [
    {
      id: "notif_1",
      type: "overdue",
      title: "Relance nécessaire",
      message: "La facture #KVO-1026 (350 000 FCFA) de Kivu Tech est en retard de 10 jours.",
      time: "Aujourd'hui",
      read: false,
      docId: "doc_1026"
    },
    {
      id: "notif_2",
      type: "quote",
      title: "Devis accepté 🎉",
      message: "Restaurant La Paix a accepté le devis #KVO-1025.",
      time: "5 août",
      read: false,
      docId: "doc_1025"
    },
    {
      id: "notif_3",
      type: "payment",
      title: "Paiement confirmé",
      message: "350 000 FCFA reçus pour la facture #KVO-1024.",
      time: "3 août",
      read: true,
      docId: "doc_1024"
    }
  ]
};
