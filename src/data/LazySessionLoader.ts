import fs from 'fs/promises';
import path from 'path';
import { 
  LazySessionData, 
  LazyLoadOptions, 
  SessionMetadataCache, 
  CacheConfiguration 
} from '../types/cache.types';
import { Session, ConversationEntry } from '../types/session.types';
import { SessionCacheManager } from './SessionCacheManager';
import { LRUCache } from '../utils/LRUCache';

/**
 * Handles lazy loading of session data
 * Provides on-demand loading of session history and context while maintaining performance
 */
export class LazySessionLoader {
  private cacheManager: SessionCacheManager;
  private sessionDataCache: LRUCache<LazySessionData>;
  private sessionDirectory: string;
  private loadTimeTracker: Map<string, number> = new Map();

  constructor(cacheManager: SessionCacheManager, sessionDirectory: string, config?: CacheConfiguration) {
    this.cacheManager = cacheManager;
    this.sessionDirectory = sessionDirectory;
    this.sessionDataCache = new LRUCache<LazySessionData>(
      config?.maxSessionDataCacheSize || 20
    );
  }

  /**
   * Loads a session with lazy loading options
   */
  async loadSessionLazy(sessionId: string, options: LazyLoadOptions = {}): Promise<LazySessionData | null> {
    const startTime = Date.now();
    
    try {
      // Try to get from session data cache first
      const cached = this.sessionDataCache.get(sessionId);
      if (cached && !options.forceRefresh) {
        // Check if we have all the required data
        const hasHistory = !options.includeHistory || cached.history !== undefined;
        const hasContext = !options.includeContext || cached.context !== undefined;
        
        if (hasHistory && hasContext) {
          this.recordLoadTime(sessionId, Date.now() - startTime);
          return cached;
        }
      }

      // Get metadata first
      const metadata = await this.cacheManager.getSessionMetadata(sessionId);
      if (!metadata) {
        return null;
      }

      // Create lazy session data with metadata only
      const lazyData: LazySessionData = {
        metadata,
        isFullyLoaded: false,
        loadedAt: new Date()
      };

      // Load history if requested
      if (options.includeHistory) {
        lazyData.history = await this.loadSessionHistory(sessionId, options);
      }

      // Load context if requested
      if (options.includeContext) {
        lazyData.context = await this.loadSessionContext(sessionId);
      }

      // Mark as fully loaded if we loaded everything
      lazyData.isFullyLoaded = Boolean(lazyData.history && lazyData.context);

      // Cache the result
      this.sessionDataCache.set(sessionId, lazyData);

      this.recordLoadTime(sessionId, Date.now() - startTime);
      return lazyData;

    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Loads full session data (backward compatibility)
   */
  async loadFullSession(sessionId: string): Promise<Session | null> {
    const lazyData = await this.loadSessionLazy(sessionId, {
      includeHistory: true,
      includeContext: true
    });

    if (!lazyData || !lazyData.history || !lazyData.context) {
      return null;
    }

    // Convert LazySessionData back to Session format
    return {
      metadata: {
        sessionId: lazyData.metadata.sessionId,
        projectName: lazyData.metadata.projectName,
        createdDate: lazyData.metadata.createdDate,
        lastAccessed: lazyData.metadata.lastAccessed,
        status: lazyData.metadata.status,
        description: lazyData.metadata.description,
        tags: lazyData.metadata.tags
      },
      history: lazyData.history,
      context: lazyData.context
    };
  }

  /**
   * Loads only the conversation history for a session
   */
  async loadSessionHistory(sessionId: string, options: LazyLoadOptions = {}): Promise<ConversationEntry[]> {
    const filePath = path.join(this.sessionDirectory, `${sessionId}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);
      
      if (!session.history || !Array.isArray(session.history)) {
        return [];
      }

      let history = session.history;

      // Apply pagination if requested
      if (options.historyPage !== undefined && options.historyLimit !== undefined) {
        const startIndex = options.historyPage * options.historyLimit;
        const endIndex = startIndex + options.historyLimit;
        history = history.slice(startIndex, endIndex);
      } else if (options.historyLimit !== undefined) {
        // Just limit the results
        history = history.slice(-options.historyLimit); // Get latest entries
      }

      // Convert string dates to Date objects
      return history.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));

    } catch (error) {
      console.error(`Failed to load history for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Loads only the context for a session
   */
  async loadSessionContext(sessionId: string): Promise<Session['context']> {
    const filePath = path.join(this.sessionDirectory, `${sessionId}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Try to extract context without full parsing for performance
      const contextMatch = content.match(/"context"\s*:\s*(\{.*?\})/s);
      
      if (contextMatch) {
        try {
          return JSON.parse(contextMatch[1]);
        } catch {
          // Fall back to full parsing
        }
      }

      // Fallback to full parsing
      const session = JSON.parse(content);
      return session.context || {
        variables: {},
        decisions: [],
        trackedIssues: []
      };

    } catch (error) {
      console.error(`Failed to load context for session ${sessionId}:`, error);
      return {
        variables: {},
        decisions: [],
        trackedIssues: []
      };
    }
  }

  /**
   * Streams conversation history in chunks
   */
  async *streamSessionHistory(sessionId: string, chunkSize: number = 10): AsyncGenerator<ConversationEntry[]> {
    let page = 0;
    
    while (true) {
      const chunk = await this.loadSessionHistory(sessionId, {
        historyPage: page,
        historyLimit: chunkSize
      });
      
      if (chunk.length === 0) {
        break;
      }
      
      yield chunk;
      page++;
      
      if (chunk.length < chunkSize) {
        break; // Last chunk
      }
    }
  }

  /**
   * Gets a specific page of conversation history
   */
  async getHistoryPage(sessionId: string, page: number, limit: number): Promise<ConversationEntry[]> {
    return this.loadSessionHistory(sessionId, {
      historyPage: page,
      historyLimit: limit
    });
  }

  /**
   * Preloads multiple sessions into cache
   */
  async preloadSessions(sessionIds: string[], options: LazyLoadOptions = {}): Promise<void> {
    const concurrencyLimit = 3; // Limit concurrent loads
    
    for (let i = 0; i < sessionIds.length; i += concurrencyLimit) {
      const batch = sessionIds.slice(i, i + concurrencyLimit);
      const promises = batch.map(sessionId => this.loadSessionLazy(sessionId, options));
      
      await Promise.allSettled(promises);
    }
  }

  /**
   * Gets session data from cache (without loading from disk)
   */
  getFromCache(sessionId: string): LazySessionData | undefined {
    return this.sessionDataCache.get(sessionId);
  }

  /**
   * Removes session from cache
   */
  evictFromCache(sessionId: string): boolean {
    return this.sessionDataCache.delete(sessionId);
  }

  /**
   * Clears all cached session data
   */
  clearCache(): void {
    this.sessionDataCache.clear();
    this.loadTimeTracker.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    averageLoadTime: number;
    estimatedMemoryUsage: number;
  } {
    const cacheStats = this.sessionDataCache.getStats();
    
    // Calculate average load time
    const loadTimes = Array.from(this.loadTimeTracker.values());
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length 
      : 0;

    return {
      size: cacheStats.size,
      hitRate: cacheStats.hitRate,
      averageLoadTime,
      estimatedMemoryUsage: this.sessionDataCache.estimateMemoryUsage()
    };
  }

  /**
   * Records load time for performance tracking
   */
  private recordLoadTime(sessionId: string, timeMs: number): void {
    this.loadTimeTracker.set(sessionId, timeMs);
    
    // Keep only the last 100 load times to prevent memory growth
    if (this.loadTimeTracker.size > 100) {
      const oldestKey = this.loadTimeTracker.keys().next().value;
      this.loadTimeTracker.delete(oldestKey);
    }
  }

  /**
   * Optimizes cache by evicting least recently used items
   */
  optimizeCache(): number {
    // Evict items older than 30 minutes
    const thirtyMinutes = 30 * 60 * 1000;
    const evicted = this.sessionDataCache.evictOlderThan(thirtyMinutes);
    
    return evicted;
  }

  /**
   * Validates cached session data against disk
   */
  async validateCachedSession(sessionId: string): Promise<boolean> {
    const cached = this.sessionDataCache.get(sessionId);
    if (!cached) {
      return false;
    }

    try {
      const filePath = path.join(this.sessionDirectory, `${sessionId}.json`);
      const stats = await fs.stat(filePath);
      
      // Check if file was modified after we cached it
      return stats.mtime <= (cached.loadedAt || new Date());
    } catch {
      // File doesn't exist or can't be accessed
      this.evictFromCache(sessionId);
      return false;
    }
  }

  /**
   * Bulk loads metadata for multiple sessions (used by analytics commands)
   */
  async bulkLoadMetadata(sessionIds: string[]): Promise<SessionMetadataCache[]> {
    const results: SessionMetadataCache[] = [];
    
    // Load in batches to avoid overwhelming the system
    const batchSize = 10;
    
    for (let i = 0; i < sessionIds.length; i += batchSize) {
      const batch = sessionIds.slice(i, i + batchSize);
      const promises = batch.map(async sessionId => {
        const metadata = await this.cacheManager.getSessionMetadata(sessionId);
        return metadata;
      });
      
      const batchResults = await Promise.allSettled(promises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }
    
    return results;
  }

  /**
   * Searches session content (loads content on demand for search)
   */
  async searchSessionContent(sessionIds: string[], query: string): Promise<Array<{
    sessionId: string;
    metadata: SessionMetadataCache;
    matches: Array<{ type: 'prompt' | 'response'; content: string; index: number }>;
  }>> {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const sessionId of sessionIds) {
      try {
        const metadata = await this.cacheManager.getSessionMetadata(sessionId);
        if (!metadata) continue;
        
        const history = await this.loadSessionHistory(sessionId);
        const matches = [];
        
        for (let i = 0; i < history.length; i++) {
          const entry = history[i];
          
          if (entry.prompt.toLowerCase().includes(lowerQuery)) {
            matches.push({
              type: 'prompt' as const,
              content: entry.prompt,
              index: i
            });
          }
          
          if (entry.response.toLowerCase().includes(lowerQuery)) {
            matches.push({
              type: 'response' as const,
              content: entry.response,
              index: i
            });
          }
        }
        
        if (matches.length > 0) {
          results.push({ sessionId, metadata, matches });
        }
        
      } catch (error) {
        console.warn(`Failed to search session ${sessionId}:`, error);
      }
    }
    
    return results;
  }
}