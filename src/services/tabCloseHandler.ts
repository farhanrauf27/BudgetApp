// src/services/tabCloseHandler.ts
export class TabCloseHandler {
  private static instance: TabCloseHandler;
  private isLoggingOut = false;

  private constructor() {}

  static getInstance(): TabCloseHandler {
    if (!TabCloseHandler.instance) {
      TabCloseHandler.instance = new TabCloseHandler();
    }
    return TabCloseHandler.instance;
  }

  // Setup tab close/browser close detection
  setupTabCloseDetection(): void {
    // Handle browser/tab close
    window.addEventListener('beforeunload', (event) => {
      if (!this.isLoggingOut) {
        // Only clear session if it's a tab/browser close, not a logout
        this.handleTabClose();
      }
    });

    // Handle page visibility change (when switching tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // User switched to another tab or minimized browser
        this.handleTabSwitch();
      }
    });

    // Handle page unload (navigation away)
    window.addEventListener('unload', () => {
      this.handleTabClose();
    });

    console.log('Tab close detection setup complete');
  }

  // Handle tab close/browser close
  private handleTabClose(): void {
    const sessionKey = 'current_user_session';
    
    // Check if we have an active session
    const hasSession = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
    
    if (hasSession) {
      // Remove sessionStorage but keep localStorage for session management
      sessionStorage.removeItem(sessionKey);
      
      // Set a flag that tab was closed
      localStorage.setItem('tab_closed', Date.now().toString());
      
      console.log('Tab closed - sessionStorage cleared');
    }
  }

  // Handle tab switch
  private handleTabSwitch(): void {
    // Update last activity timestamp
    localStorage.setItem('last_activity', Date.now().toString());
  }

  // Check if session should be invalidated on page load
  checkSessionOnLoad(): boolean {
    const tabClosedTime = localStorage.getItem('tab_closed');
    const lastActivity = localStorage.getItem('last_activity');
    
    if (tabClosedTime) {
      const timeSinceTabClose = Date.now() - parseInt(tabClosedTime);
      
      // If tab was closed more than 5 seconds ago, clear session
      if (timeSinceTabClose > 5000) {
        this.clearSession();
        localStorage.removeItem('tab_closed');
        return true;
      }
    }
    
    // Check for idle timeout (30 minutes)
    if (lastActivity) {
      const idleTime = Date.now() - parseInt(lastActivity);
      if (idleTime > 30 * 60 * 1000) { // 30 minutes
        this.clearSession();
        localStorage.removeItem('last_activity');
        return true;
      }
    }
    
    return false;
  }

  // Clear session
  private clearSession(): void {
    const sessionKey = 'current_user_session';
    const timestampKey = 'session_timestamp';
    
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(timestampKey);
    localStorage.removeItem('loginTime');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    
    console.log('Session cleared due to tab close/timeout');
  }

  // Call this when user manually logs out
  manualLogout(): void {
    this.isLoggingOut = true;
    this.clearSession();
    setTimeout(() => {
      this.isLoggingOut = false;
    }, 1000);
  }
}

// Export singleton instance
const tabCloseHandler = TabCloseHandler.getInstance();
export default tabCloseHandler;