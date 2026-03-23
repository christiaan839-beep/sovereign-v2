/**
 * Structured API Logger
 * Tracks API usage, errors, and performance across the platform.
 * Keeps an in-memory ring buffer of the last 500 requests for the live terminal.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  clientIp: string;
  error?: string;
}

const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];

export const apiLogger = {
  log: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const fullEntry: LogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString()
    };
    
    // Add to buffer
    logBuffer.push(fullEntry);
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift(); // Keep only the latest MAX_LOGS
    }

    // Also output to standard console for Vercel/Docker logs
    if (entry.status >= 400) {
      console.error(`[API ERROR] ${entry.method} ${entry.route} - ${entry.status} (${entry.durationMs}ms) - ${entry.error || 'Unknown'}`);
    } else {
      console.log(`[API] ${entry.method} ${entry.route} - ${entry.status} (${entry.durationMs}ms)`);
    }
  },

  getRecentLogs: () => {
    return [...logBuffer].reverse(); // Newest first
  },
  
  clear: () => {
    logBuffer.length = 0;
  }
};
