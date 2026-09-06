/**
 * KIVO MATIQUE — Authentication Management
 */

window.KivoAuth = {
  session: null,
  user: null,

  init: async function() {
    console.log('[KivoAuth] Initializing Auth...');
    if (!window.KivoDb || !window.KivoDb.supabase) {
      console.error('[KivoAuth] Supabase client is not available.');
      return;
    }
    
    // Check current session
    try {
      const { data: { session }, error } = await KivoDb.supabase.auth.getSession();
      if (error) {
        console.error('[KivoAuth] getSession error:', error);
      }
      this.session = session;
      this.user = session?.user || null;
    } catch (e) {
      console.error('[KivoAuth] Error checking initial session:', e);
    }

    // Listen for auth state changes without triggering unwanted background redirects
    KivoDb.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[KivoAuth] Auth event: ${event}`);
      const prevUserId = this.user?.id;
      this.session = session;
      this.user = session?.user || null;

      if (event === 'SIGNED_OUT') {
        const loginModal = document.getElementById('modal-login');
        if (loginModal) loginModal.style.display = 'none';
        if (window.KivoApp) {
          KivoApp.state = JSON.parse(JSON.stringify(KivoApp.BLANK_STATE));
          KivoApp.supabaseConnected = false;
          KivoApp.navigate('landing');
        }
      } else if (event === 'SIGNED_IN' && session) {
        // Only trigger post-login workflow if user was previously not logged in
        // or changed user, preventing background token refreshes from kicking user to dashboard
        if (!prevUserId || prevUserId !== session.user.id) {
          await this.handlePostLogin(session);
        }
      }
    });
  },

  /**
   * Called after a real sign-in (explicit credentials or OAuth callback).
   */
  handlePostLogin: async function(session) {
    if (!session || !session.user) return;
    console.log('[KivoAuth] handlePostLogin — user:', session.user.email);

    // 1. Close login modal
    const loginModal = document.getElementById('modal-login');
    if (loginModal) loginModal.style.display = 'none';

    // 2. Delegate to KivoApp to sync data and determine route (onboarding vs dashboard)
    if (window.KivoApp) {
      await KivoApp.onUserAuthenticated(session.user);
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
    if (error) {
      console.error('[KivoAuth] signOut error:', error.message);
    } else {
      console.log('[KivoAuth] Successfully signed out.');
      this.session = null;
      this.user = null;
    }
  }
};
