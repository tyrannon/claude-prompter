import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  data?: any;
  error?: string;
}

export class Logger {
  private component: string;
  private static logLevel: LogLevel = LogLevel.INFO;
  private static logDir: string = path.join(os.homedir(), '.claude-prompter', 'logs');

  constructor(component: string) {
    this.component = component;
    // Ensure log directory exists
    fs.ensureDirSync(Logger.logDir);
  }

  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  static getLogLevel(): LogLevel {
    return Logger.logLevel;
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    // Don't log if level is below threshold
    if (level > Logger.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      component: this.component,
      message,
      data: this.sanitizeData(data)
    };

    // Add error stack if data contains an error
    if (data instanceof Error) {
      entry.error = data.stack;
    }

    // Write to file
    this.writeToFile(entry);

    // Also log to console in debug mode or for errors
    if (level === LogLevel.ERROR || Logger.logLevel >= LogLevel.DEBUG) {
      console.error(`[${entry.timestamp}] ${entry.level} [${entry.component}] ${entry.message}`);
      if (entry.data) {
        console.error('Data:', JSON.stringify(entry.data, null, 2));
      }
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return undefined;

    // Create a copy to avoid modifying original data
    const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
      // Remove sensitive information
      if (typeof key === 'string' && 
          (key.toLowerCase().includes('key') || 
           key.toLowerCase().includes('token') || 
           key.toLowerCase().includes('password') ||
           key.toLowerCase().includes('secret'))) {
        return '[REDACTED]';
      }
      
      // Handle circular references and functions
      if (typeof value === 'function') {
        return '[Function]';
      }
      
      return value;
    }));

    return sanitized;
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(Logger.logDir, `${today}.log`);
      
      const logLine = JSON.stringify(entry) + '\n';
      
      // Append to log file (async, non-blocking)
      fs.appendFile(logFile, logLine).catch(err => {
        // Fallback to console if file writing fails
        console.error('Failed to write to log file:', err.message);
      });
    } catch (error) {
      // Silent fail - don't let logging errors break the application
    }
  }

  /**
   * Get log files for a specific date range
   */
  static async getLogFiles(days: number = 7): Promise<string[]> {
    try {
      const files: string[] = [];
      const now = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const logFile = path.join(Logger.logDir, `${dateStr}.log`);
        
        if (await fs.pathExists(logFile)) {
          files.push(logFile);
        }
      }
      
      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up old log files
   */
  static async cleanupLogs(keepDays: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(Logger.logDir);
      const now = new Date();
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const dateStr = file.replace('.log', '');
        const fileDate = new Date(dateStr);
        const diffDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays > keepDays) {
          await fs.remove(path.join(Logger.logDir, file));
        }
      }
    } catch (error) {
      // Silent fail - cleanup is not critical
    }
  }
}