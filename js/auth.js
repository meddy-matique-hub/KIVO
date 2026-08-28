/**
 * KIVO MATIQUE — Authentication Management
 */

window.KivoAuth = {
  session: null,
  user: null,

  init: async function() {
    console.log('[KivoAuth] Initializing Auth...');
    
    // Check current session
    const { data: { session }, error } = await KivoDb.supabase.auth.getSession();
    if (error) {
      console.error('[KivoAuth] getSession error:', error);
    }
    
    this.session = session;
    this.user = session?.user || null;

    // Listen for auth state changes
    KivoDb.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[KivoAuth] Auth event: ${event}`);
      this.session = session;
      this.user = session?.user || null;
      
      if (event === 'SIGNED_IN' && session) {
        // User just signed in (from modal-login or view-auth or OAuth redirect)
        await this.handlePostLogin(session);
      } else if (event === 'SIGNED_OUT') {
        // Session was cleared — close modal and return to landing page
        const loginModal = document.getElementById('modal-login');
        if (loginModal) loginModal.style.display = 'none';
        if (window.KivoApp) {
          KivoApp.navigate('landing');
        }
      }
    });
  },

  /**
   * Called after any successful sign-in.
   * Closes login modal, loads data from Supabase, routes user to dashboard or onboarding.
   */
  handlePostLogin: async function(session) {
    console.log('[KivoAuth] handlePostLogin — user:', session.user.email);

    // 1. Close login modal
    const loginModal = document.getElementById('modal-login');
    if (loginModal) loginModal.style.display = 'none';

    // 2. Store user email in app state
    if (window.KivoApp) {
      // Ensure app state is initialized
      if (!KivoApp.state) {
        KivoApp.state = JSON.parse(JSON.stringify(KivoApp.BLANK_STATE));
      }
      // Load any previously saved local state
      KivoApp.loadState();
      // Safely set user email (override if needed)
      KivoApp.state.userEmail = session.user?.email || '';
      KivoApp.supabaseConnected = true;

      // Load data from Supabase (this also sets isOnboarded if business_settings exist)
      try {
        await KivoApp.syncFromSupabase();
      } catch(e) {
        console.error('[KivoAuth] syncFromSupabase error after login:', e);
      }

      // Route: if onboarded → dashboard, else → onboarding
      if (KivoApp.state.isOnboarded) {
        KivoApp.showToast(`Bienvenue sur KIVO MATIQUE, ${KivoApp.state.business?.owner || session.user?.email} ! 👋`, 'success');
        KivoApp.navigate('dashboard');
      } else {
        KivoApp.showToast('Connexion réussie ! Configurons votre espace.', 'info');
        KivoApp.navigate('onboarding');
      }
    }
  },

  handleAuthRedirect: function() {
    if (!this.session) {
      console.warn('[KivoAuth] No active session. App data might fail RLS.');
      document.getElementById('modal-login').style.display = 'flex';
    } else {
      console.log('[KivoAuth] User is authenticated:', this.user.email);
      document.getElementById('modal-login').style.display = 'none';
    }
  },

  signUp: async function(email, password, displayName) {
    const { data, error } = await KivoDb.supabase.auth.signUp({
      email,
      password,
      options: displayName ? { data: { full_name: displayName } } : {}
    });
    if (error) {
      console.error('[KivoAuth] signUp error:', error.message);
      return { error };
    }
    return { data };
  },

  signIn: async function(email, password) {
    const { data, error } = await KivoDb.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[KivoAuth] signIn error:', error.message);
      return { error };
    }
    return { data };
  },

  signInWithGoogle: async function() {
    console.log('[KivoAuth] Initiating Google OAuth...');
    const { data, error } = await KivoDb.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) {
      console.error('[KivoAuth] Google OAuth error:', error.message);
      return { error };
    }
    return { data };
  },

  signOut: async function() {
    const { error } = await KivoDb.supabase.auth.signOut();
    if (error) console.error('[KivoAuth] signOut error:', error.message);
    else console.log('[KivoAuth] Successfully signed out.');
  }
};

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
  KivoAuth.init();
});
