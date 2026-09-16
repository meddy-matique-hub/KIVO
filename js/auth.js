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
    
    // Check current session and validate with getUser() to prevent stale tokens
    try {
      const { data: { session }, error } = await KivoDb.supabase.auth.getSession();
      if (error) {
        console.error('[KivoAuth] getSession error:', error);
      }
      if (session) {
        // Validate with server that token is still authentic and user exists
        const { data: userData, error: userError } = await KivoDb.supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.warn('[KivoAuth] Stale or invalid session found — purging.');
          try { await KivoDb.supabase.auth.signOut(); } catch (_) {}
          this.session = null;
          this.user = null;
        } else {
          this.session = session;
          this.user = userData.user;
        }
      } else {
        this.session = null;
        this.user = null;
      }
    } catch (e) {
      console.error('[KivoAuth] Error checking initial session:', e);
      this.session = null;
      this.user = null;
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
        this.session = null;
        this.user = null;
        if (window.KivoApp) {
          KivoApp.state = JSON.parse(JSON.stringify(KivoApp.BLANK_STATE));
          KivoApp.state.isOnboarded = false;
          KivoApp.supabaseConnected = false;
          if (window.location.hash !== '#landing') {
            window.location.hash = '#landing';
          }
          KivoApp.handleRoute();
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
    if (this._handlingLogin === session.user.id) return;
    this._handlingLogin = session.user.id;
    setTimeout(() => { this._handlingLogin = null; }, 2500);

    console.log('[KivoAuth] handlePostLogin — user:', session.user.email);
    this.session = session;
    this.user = session.user;

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
    if (window.KivoApp && typeof window.KivoApp.logout === 'function') {
      return await window.KivoApp.logout();
    }
    try {
      if (window.KivoDb && window.KivoDb.supabase) {
        await KivoDb.supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('[KivoAuth] signOut error:', e);
    }
    this.session = null;
    this.user = null;
  }
};
