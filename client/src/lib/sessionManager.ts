/**
 * Session Manager for handling user conversation sessions
 * Generates and maintains unique session IDs for each conversation
 */

const SESSION_KEY = 'chat_session_id';

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get the current session ID from localStorage
 * If no session exists, create a new one
 */
export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
    console.log('🆕 Created new session:', sessionId);
  }
  
  return sessionId;
}

/**
 * Create a new session (used when starting a new conversation)
 */
export function createNewSession(): string {
  const sessionId = generateSessionId();
  localStorage.setItem(SESSION_KEY, sessionId);
  console.log('🔄 Started new session:', sessionId);
  return sessionId;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  console.log('🗑️ Cleared session');
}

/**
 * Check if a session exists
 */
export function hasSession(): boolean {
  return localStorage.getItem(SESSION_KEY) !== null;
}

