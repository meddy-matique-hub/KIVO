/**
 * KIVO MATIQUE — Authentication Management
 *
 * FIX (A.1): Added _initialized guard + _authSubscription storage to prevent
 * duplicate onAuthStateChange listeners when init() is called more than once.
 * Root cause of: doubled SIGNED_IN logs, silent logout, doubled screens on mobile.
 */

window.KivoAuth = {
  session: null,
  user: null,
  _initialized: false,
  _authSubscription: null,

  init: async function() {
    // ── GUARD: Prevent double-initialization ─────────────────────────────
    if (this._initialized) {
      console.warn('[KivoAuth] init() already called — skipping duplicate initialization.');
      return;
    }
    this._initialized = true;
    // ─────────────────────────────────────────────────────────────────────

    console.log('[KivoAuth] Initializing Auth...');
    if (!window.KivoDb || !window.KivoDb.supabase) {
      console.error('[KivoAuth] Supabase client is not available.');
      this._initialized = false; // allow retry if supabase loads late
      return;
    }

    // Check current session and validate with getUser() to prevent stale tokens (25s timeout)
    try {
      const getSessionPromise = KivoDb.supabase.auth.getSession();
      const { data: { session }, error } = await Promise.race([
        getSessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth getSession timeout (25s)')), 25000))
      ]);
      if (error) {
        console.error('[KivoAuth] getSession error:', error);
      }
      if (session) {
        // Validate with server that token is still authentic and user exists
        const getUserPromise = KivoDb.supabase.auth.getUser();
        const { data: userData, error: userError } = await Promise.race([
          getUserPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Auth getUser timeout (25s)')), 25000))
        ]);
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

    // Capture the user id known BEFORE registering the listener.
    // Supabase fires SIGNED_IN synchronously on subscription for existing sessions,
    // so we must not rely on this.user (still null at that point) to guard against
    // re-triggering handlePostLogin on boot — which would re-show the loading overlay.
    const _bootUserId = this.user?.id || null;

    // ── Unsubscribe any previous listener before creating a new one ───────
    if (this._authSubscription) {
      try { this._authSubscription.unsubscribe(); } catch (_) {}
      this._authSubscription = null;
      console.log('[KivoAuth] Previous auth subscription cleaned up.');
    }
    // ─────────────────────────────────────────────────────────────────────

    // [AUDIT A.1] — Count real registrations of onAuthStateChange (not event fires)
    window.__KIVO_AUTH_LISTENER_COUNT = (window.__KIVO_AUTH_LISTENER_COUNT || 0) + 1;
    const _auditStack = new Error().stack;
    console.log(
      '[AUDIT] onAuthStateChange enregistré pour la ' + window.__KIVO_AUTH_LISTENER_COUNT + 'ème fois.\nStack trace:\n' + _auditStack
    );
    if (window._kivoDebugLog) {
      window._kivoDebugLog('[AUDIT] onAuthStateChange #' + window.__KIVO_AUTH_LISTENER_COUNT + ' Stack:' + (_auditStack.split('\n')[2] || ''));
    }
    // Listen for auth state changes — callback MUST be synchronous without await
    // to avoid supabase-js v2 deadlocks on getSession()
    const { data: { subscription } } = KivoDb.supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[KivoAuth] Auth event: ${event}`);

      setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
          this.session = null;
          this.user = null;
          this._isLoggingIn = false;
          if (window.KivoApp) {
            window.KivoApp.isSessionLoading = false;
            window.KivoApp._isAuthenticating = false;
            window.KivoApp.state = JSON.parse(JSON.stringify(window.KivoApp.BLANK_STATE));
            window.KivoApp.state.isOnboarded = false;
            window.KivoApp.supabaseConnected = false;
            window.KivoApp.navigate('landing');
          }
        } else if (event === 'SIGNED_IN' && session?.user) {
          // Use prevUserId from closure (captured before listener registered) to
          // distinguish a real new login from Supabase's boot-time SIGNED_IN replay.
          const prevUserId = this.user?.id || _bootUserId;
          this.session = session;
          this.user = session.user;
          // Only trigger post-login workflow if user was previously not logged in
          // or changed user, preventing background token refreshes from kicking user to dashboard
          if (!prevUserId || prevUserId !== session.user.id) {
            await this.handlePostLogin(session);
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          console.log('[KivoAuth] Auth event: PASSWORD_RECOVERY');
          this.session = session;
          this.user = session?.user;
          if (window.KivoApp && typeof window.KivoApp.showResetPasswordView === 'function') {
            window.KivoApp.showResetPasswordView();
          }
        }
      }, 0);
    });

    // Store the subscription so we can unsubscribe if init() is ever called again
    this._authSubscription = subscription;

    // Note: password recovery is handled exclusively via the PASSWORD_RECOVERY
    // event in onAuthStateChange above. Manual hash checks are intentionally
    // removed to prevent false positives on normal navigation hashes.
  },

  /**
   * Resets the initialized flag — use only for testing or full app teardown.
   */
  reset: function() {
    if (this._authSubscription) {
      try { this._authSubscription.unsubscribe(); } catch (_) {}
      this._authSubscription = null;
    }
    this._initialized = false;
    this.session = null;
    this.user = null;
    this._isLoggingIn = false;
  },

  /**
   * Called after a real sign-in (explicit credentials or OAuth callback).
   */
  handlePostLogin: async function(session) {
    if (!session || !session.user) return;
    if (this._isLoggingIn) return;
    const now = Date.now();
    if (this._lastLoggedInUserId === session.user.id && (now - (this._lastLoginTimestamp || 0)) < 4000) {
      console.log('[KivoAuth] Debouncing duplicate handlePostLogin within 4s for:', session.user.id);
      return;
    }
    this._isLoggingIn = true;
    this._lastLoggedInUserId = session.user.id;
    this._lastLoginTimestamp = now;

    try {
      console.log('[KivoAuth] handlePostLogin — user:', session.user.email);
      this.session = session;
      this.user = session.user;

      // Delegate to KivoApp to sync data and determine route (onboarding vs dashboard)
      if (window.KivoApp) {
        await window.KivoApp.onUserAuthenticated(session.user);
      }
    } finally {
      this._isLoggingIn = false;
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
    if (data && data.session) {
      this.session = data.session;
      this.user = data.user;
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
      return await window.KivoApp.logout(true);
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
