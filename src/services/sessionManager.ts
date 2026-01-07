// src/services/sessionManager.ts
class SessionManager {
  private static instance: SessionManager;
  private currentUserId: string | null = null;
  private readonly SESSION_KEY = 'current_user_session';
  private readonly SESSION_TIMESTAMP_KEY = 'session_timestamp';
  private readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000;

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Set user session on login
  setUserSession(userId: string): void {
    this.currentUserId = userId;
    sessionStorage.setItem(this.SESSION_KEY, userId);
    localStorage.setItem(this.SESSION_KEY, userId);
    localStorage.setItem(this.SESSION_TIMESTAMP_KEY, Date.now().toString());
    console.log(`Session: User ${userId} logged in`);
  }

  // Get current user session
  getCurrentUser(): string | null {
    if (!this.currentUserId) {
      this.currentUserId = sessionStorage.getItem(this.SESSION_KEY);
      const sessionUser = sessionStorage.getItem(this.SESSION_KEY);
      const localUser = localStorage.getItem(this.SESSION_KEY);
      const timestamp = localStorage.getItem(this.SESSION_TIMESTAMP_KEY);

       if (sessionUser && !localUser) {
        this.clearSession();
        return null;
      }
      
      // Check if session expired
      if (timestamp) {
        const sessionAge = Date.now() - parseInt(timestamp);
        if (sessionAge > this.SESSION_EXPIRY) {
          this.clearSession();
          return null;
        }
      }
      
      this.currentUserId = sessionUser || localUser;
    
    }
    return this.currentUserId;
  }

  // Clear session on logout
  clearSession(): void {
    this.currentUserId = null;
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_TIMESTAMP_KEY);
    localStorage.removeItem('loginTime');
    console.log('Session: User logged out');
  }

  // Check if session exists
  hasSession(): boolean {
    return !!this.getCurrentUser();
  }

  updateSessionTimestamp(): void {
    if (this.hasSession()) {
      localStorage.setItem(this.SESSION_TIMESTAMP_KEY, Date.now().toString());
    }
  }
}

export default SessionManager.getInstance();