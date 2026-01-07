// src/services/sessionManager.ts
class SessionManager {
  private static instance: SessionManager;
  private currentUserId: string | null = null;
  private readonly SESSION_KEY = 'current_user_session';

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
    console.log(`Session: User ${userId} logged in`);
  }

  // Get current user session
  getCurrentUser(): string | null {
    if (!this.currentUserId) {
      this.currentUserId = sessionStorage.getItem(this.SESSION_KEY);
    }
    return this.currentUserId;
  }

  // Clear session on logout
  clearSession(): void {
    this.currentUserId = null;
    sessionStorage.removeItem(this.SESSION_KEY);
    console.log('Session: User logged out');
  }

  // Check if session exists
  hasSession(): boolean {
    return !!this.getCurrentUser();
  }
}

export default SessionManager.getInstance();