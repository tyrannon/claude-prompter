import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { 
  Session, 
  ConversationEntry, 
  SessionSummary,
  Decision,
  TrackedIssue 
} from '../types/session.types';
import { 
  LazySessionData, 
  LazyLoadOptions, 
  CacheConfiguration, 
  SessionMetadataCache,
  CacheStats 
} from '../types/cache.types';
import { SessionCacheManager } from './SessionCacheManager';
import { LazySessionLoader } from './LazySessionLoader';

export class SessionManager {
  private sessionDirectory: string;
  private currentSessionId: string | null = null;
  private cacheManager: SessionCacheManager;
  private lazyLoader: LazySessionLoader;
  private config: CacheConfiguration;
  private enableLazyLoading: boolean;

  constructor(options?: { 
    enableLazyLoading?: boolean; 
    cacheConfig?: Partial<CacheConfiguration> 
  }) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.sessionDirectory = path.join(homeDir, '.claude-prompter', 'sessions');
    this.ensureDirectoryExists();
    
    // Configuration
    this.enableLazyLoading = options?.enableLazyLoading ?? true;
    this.config = {
      maxSessionDataCacheSize: 20,
      maxMetadataCacheAge: 5 * 60 * 1000, // 5 minutes
      concurrentFileReads: 5,
      forceRebuildThreshold: 100,
      enableFilesystemWatcher: true,
      cacheFileName: '.metadata-cache.json',
      ...options?.cacheConfig
    };
    
    // Initialize caching system if enabled
    if (this.enableLazyLoading) {
      this.cacheManager = new SessionCacheManager(this.sessionDirectory, this.config);
      this.lazyLoader = new LazySessionLoader(this.cacheManager, this.sessionDirectory, this.config);
      this.initializeCache();
    }
  }

  private async initializeCache(): Promise<void> {
    if (this.cacheManager) {
      try {
        await this.cacheManager.initialize();
      } catch (error) {
        console.warn('Failed to initialize session cache:', error);
        // Continue without caching if initialization fails
        this.enableLazyLoading = false;
      }
    }
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.sessionDirectory)) {
      fs.mkdirSync(this.sessionDirectory, { recursive: true });
    }
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `session-${timestamp}-${random}`;
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDirectory, `${sessionId}.json`);
  }

  public async createSession(projectName: string, description?: string): Promise<Session> {
    const sessionId = this.generateSessionId();
    const newSession: Session = {
      metadata: {
        sessionId,
        createdDate: new Date(),
        lastAccessed: new Date(),
        projectName,
        description,
        tags: [],
        status: 'active'
      },
      history: [],
      context: {
        variables: {},
        decisions: [],
        trackedIssues: []
      }
    };
    
    await this.saveSession(newSession);
    this.currentSessionId = sessionId;
    return newSession;
  }

  public async loadSession(sessionId: string): Promise<Session | null> {
    if (this.enableLazyLoading && this.lazyLoader) {
      // Use lazy loading for better performance
      const lazyData = await this.lazyLoader.loadSessionLazy(sessionId, {
        includeHistory: true,
        includeContext: true
      });
      
      if (!lazyData || !lazyData.history || !lazyData.context) {
        return null;
      }
      
      // Convert lazy data back to full session format
      const session: Session = {
        metadata: {
          sessionId: lazyData.metadata.sessionId,
          projectName: lazyData.metadata.projectName,
          createdDate: lazyData.metadata.createdDate,
          lastAccessed: new Date(), // Update access time
          status: lazyData.metadata.status,
          description: lazyData.metadata.description,
          tags: lazyData.metadata.tags
        },
        history: lazyData.history,
        context: lazyData.context
      };
      
      // Update metadata cache with new access time
      if (this.cacheManager) {
        await this.cacheManager.updateSessionMetadata(sessionId, {
          lastAccessed: new Date()
        });
      }
      
      this.currentSessionId = sessionId;
      return session;
    } else {
      // Fallback to legacy loading
      return this.loadSessionLegacy(sessionId);
    }
  }

  // Legacy loading method for backward compatibility
  private async loadSessionLegacy(sessionId: string): Promise<Session | null> {
    const sessionPath = this.getSessionPath(sessionId);
    
    try {
      const sessionData = await fsPromises.readFile(sessionPath, 'utf-8');
      const session: Session = JSON.parse(sessionData, (key, value) => {
        // Convert date strings back to Date objects
        if (key.includes('Date') || key === 'timestamp' || key.includes('At')) {
          return new Date(value);
        }
        return value;
      });
      
      session.metadata.lastAccessed = new Date();
      await this.saveSession(session);
      this.currentSessionId = sessionId;
      return session;
    } catch (error) {
      return null;
    }
  }

  public async saveSession(session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(session.metadata.sessionId);
    await fsPromises.writeFile(
      sessionPath, 
      JSON.stringify(session, null, 2)
    );
    
    // Invalidate cache entry to ensure fresh data on next load
    if (this.enableLazyLoading && this.cacheManager) {
      await this.cacheManager.invalidateSessionCache(session.metadata.sessionId);
    }
  }

  public async addConversationEntry(
    sessionId: string, 
    prompt: string, 
    response: string,
    source: 'claude' | 'gpt-4o' | 'user' = 'user',
    metadata?: any
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entry: ConversationEntry = {
      prompt,
      response,
      timestamp: new Date(),
      source,
      metadata
    };

    session.history.push(entry);
    session.metadata.lastAccessed = new Date();
    await this.saveSession(session);
  }

  public async listSessions(): Promise<SessionSummary[]> {
    if (this.enableLazyLoading && this.cacheManager) {
      // Use fast metadata cache for listing
      return this.listSessionsFromCache();
    } else {
      // Fallback to legacy loading
      return this.listSessionsLegacy();
    }
  }

  // Fast session listing using metadata cache
  public async listSessionsFromCache(): Promise<SessionSummary[]> {
    if (!this.cacheManager) {
      throw new Error('Cache manager not initialized');
    }

    const metadataList = await this.cacheManager.getAllSessionMetadata();
    return metadataList.map(metadata => ({
      sessionId: metadata.sessionId,
      projectName: metadata.projectName,
      createdDate: metadata.createdDate,
      lastAccessed: metadata.lastAccessed,
      conversationCount: metadata.conversationCount,
      status: metadata.status,
      tags: metadata.tags
    }));
  }

  // Legacy session listing for backward compatibility
  private async listSessionsLegacy(): Promise<SessionSummary[]> {
    const files = await fsPromises.readdir(this.sessionDirectory);
    const sessions: SessionSummary[] = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        const sessionId = file.replace('.json', '');
        const session = await this.loadSessionLegacy(sessionId);
        if (session) {
          sessions.push({
            sessionId: session.metadata.sessionId,
            projectName: session.metadata.projectName,
            createdDate: session.metadata.createdDate,
            lastAccessed: session.metadata.lastAccessed,
            conversationCount: session.history.length,
            status: session.metadata.status,
            tags: session.metadata.tags
          });
        }
      }
    }

    return sessions.sort((a, b) => 
      b.lastAccessed.getTime() - a.lastAccessed.getTime()
    );
  }

  public async getCurrentSession(): Promise<Session | null> {
    if (!this.currentSessionId) {
      return null;
    }
    return this.loadSession(this.currentSessionId);
  }

  public setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  public async updateContext(
    sessionId: string, 
    context: Partial<Session['context']>
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.context = { ...session.context, ...context };
    await this.saveSession(session);
  }

  public async addDecision(
    sessionId: string,
    decision: string,
    rationale: string,
    relatedFiles?: string[]
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const newDecision: Decision = {
      id: `decision-${Date.now()}`,
      decision,
      rationale,
      timestamp: new Date(),
      relatedFiles
    };

    session.context.decisions = session.context.decisions || [];
    session.context.decisions.push(newDecision);
    await this.saveSession(session);
  }

  public async trackIssue(
    sessionId: string,
    title: string,
    status: TrackedIssue['status'] = 'planning',
    priority: TrackedIssue['priority'] = 'medium'
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const newIssue: TrackedIssue = {
      id: `issue-${Date.now()}`,
      title,
      status,
      priority,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    session.context.trackedIssues = session.context.trackedIssues || [];
    session.context.trackedIssues.push(newIssue);
    await this.saveSession(session);
  }

  public async searchSessions(query: string): Promise<SessionSummary[]> {
    const allSessions = await this.listSessions();
    const results: SessionSummary[] = [];

    for (const summary of allSessions) {
      const session = await this.loadSession(summary.sessionId);
      if (!session) continue;

      // Search in project name, description, and conversation history
      const searchable = [
        session.metadata.projectName,
        session.metadata.description || '',
        ...session.history.map(h => `${h.prompt} ${h.response}`),
        ...(session.metadata.tags || [])
      ].join(' ').toLowerCase();

      if (searchable.includes(query.toLowerCase())) {
        results.push(summary);
      }
    }

    return results;
  }

  public async getAllSessions(): Promise<Session[]> {
    const summaries = await this.listSessions();
    const sessions: Session[] = [];

    for (const summary of summaries) {
      const session = await this.loadSession(summary.sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  public async exportSession(sessionId: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    // Markdown export
    let markdown = `# ${session.metadata.projectName}\n\n`;
    markdown += `**Session ID**: ${session.metadata.sessionId}\n`;
    markdown += `**Created**: ${session.metadata.createdDate.toLocaleString()}\n`;
    markdown += `**Last Accessed**: ${session.metadata.lastAccessed.toLocaleString()}\n\n`;

    if (session.metadata.description) {
      markdown += `## Description\n${session.metadata.description}\n\n`;
    }

    markdown += `## Conversation History\n\n`;
    for (const entry of session.history) {
      markdown += `### ${entry.timestamp.toLocaleString()} (${entry.source})\n`;
      markdown += `**Prompt**: ${entry.prompt}\n\n`;
      markdown += `**Response**: ${entry.response}\n\n`;
      markdown += '---\n\n';
    }

    if (session.context.decisions && session.context.decisions.length > 0) {
      markdown += `## Decisions\n\n`;
      for (const decision of session.context.decisions) {
        markdown += `- **${decision.decision}**: ${decision.rationale}\n`;
      }
    }

    return markdown;
  }

  // ========== NEW LAZY LOADING METHODS ==========

  /**
   * Loads session with lazy loading options (NEW)
   */
  public async loadSessionLazy(sessionId: string, options: LazyLoadOptions = {}): Promise<LazySessionData | null> {
    if (!this.enableLazyLoading || !this.lazyLoader) {
      throw new Error('Lazy loading is not enabled');
    }
    return this.lazyLoader.loadSessionLazy(sessionId, options);
  }

  /**
   * Gets session metadata without loading full content (NEW)
   */
  public async getSessionMetadata(sessionId: string): Promise<SessionMetadataCache | null> {
    if (!this.enableLazyLoading || !this.cacheManager) {
      throw new Error('Lazy loading is not enabled');
    }
    return this.cacheManager.getSessionMetadata(sessionId);
  }

  /**
   * Searches session metadata only (fast) (NEW)
   */
  public async searchSessionMetadata(query: string): Promise<SessionSummary[]> {
    if (!this.enableLazyLoading || !this.cacheManager) {
      // Fallback to legacy search
      return this.searchSessions(query);
    }

    const metadataResults = await this.cacheManager.searchMetadata(query);
    return metadataResults.map(metadata => ({
      sessionId: metadata.sessionId,
      projectName: metadata.projectName,
      createdDate: metadata.createdDate,
      lastAccessed: metadata.lastAccessed,
      conversationCount: metadata.conversationCount,
      status: metadata.status,
      tags: metadata.tags
    }));
  }

  /**
   * Gets sessions by project name (fast) (NEW)
   */
  public async getSessionsByProject(projectName: string): Promise<SessionSummary[]> {
    if (!this.enableLazyLoading || !this.cacheManager) {
      // Fallback to filtering all sessions
      const allSessions = await this.listSessions();
      return allSessions.filter(s => s.projectName.toLowerCase().includes(projectName.toLowerCase()));
    }

    const allMetadata = await this.cacheManager.getAllSessionMetadata();
    return allMetadata
      .filter(metadata => metadata.projectName.toLowerCase().includes(projectName.toLowerCase()))
      .map(metadata => ({
        sessionId: metadata.sessionId,
        projectName: metadata.projectName,
        createdDate: metadata.createdDate,
        lastAccessed: metadata.lastAccessed,
        conversationCount: metadata.conversationCount,
        status: metadata.status,
        tags: metadata.tags
      }));
  }

  /**
   * Loads session history only (NEW)
   */
  public async loadSessionHistory(sessionId: string, options?: LazyLoadOptions): Promise<ConversationEntry[]> {
    if (!this.enableLazyLoading || !this.lazyLoader) {
      // Fallback to loading full session
      const session = await this.loadSession(sessionId);
      return session?.history || [];
    }
    return this.lazyLoader.loadSessionHistory(sessionId, options);
  }

  /**
   * Loads session context only (NEW)
   */
  public async loadSessionContext(sessionId: string): Promise<Session['context']> {
    if (!this.enableLazyLoading || !this.lazyLoader) {
      // Fallback to loading full session
      const session = await this.loadSession(sessionId);
      return session?.context || { variables: {}, decisions: [], trackedIssues: [] };
    }
    return this.lazyLoader.loadSessionContext(sessionId);
  }

  /**
   * Rebuilds metadata cache (NEW)
   */
  public async rebuildMetadataCache(): Promise<void> {
    if (!this.enableLazyLoading || !this.cacheManager) {
      throw new Error('Lazy loading is not enabled');
    }
    await this.cacheManager.rebuildCache();
  }

  /**
   * Gets cache performance statistics (NEW)
   */
  public async getCacheStats(): Promise<CacheStats> {
    if (!this.enableLazyLoading || !this.cacheManager) {
      throw new Error('Lazy loading is not enabled');
    }

    const cacheStats = await this.cacheManager.getCacheStats();
    const loaderStats = this.lazyLoader?.getCacheStats() || {
      size: 0,
      hitRate: 0,
      averageLoadTime: 0,
      estimatedMemoryUsage: 0
    };

    return {
      ...cacheStats,
      sessionDataCacheSize: loaderStats.size,
      cacheHitRate: loaderStats.hitRate,
      averageLoadTime: loaderStats.averageLoadTime,
      estimatedMemoryUsage: cacheStats.estimatedMemoryUsage + loaderStats.estimatedMemoryUsage
    };
  }

  /**
   * Optimizes cache performance (NEW)
   */
  public async optimizeCache(): Promise<{ 
    metadataCleanedUp: number; 
    sessionDataEvicted: number; 
  }> {
    if (!this.enableLazyLoading || !this.cacheManager || !this.lazyLoader) {
      throw new Error('Lazy loading is not enabled');
    }

    const metadataCleanedUp = await this.cacheManager.cleanupStaleEntries();
    const sessionDataEvicted = this.lazyLoader.optimizeCache();

    return { metadataCleanedUp, sessionDataEvicted };
  }

  /**
   * Preloads sessions into cache for better performance (NEW)
   */
  public async preloadSessions(sessionIds: string[], options: LazyLoadOptions = {}): Promise<void> {
    if (!this.enableLazyLoading || !this.lazyLoader) {
      throw new Error('Lazy loading is not enabled');
    }
    await this.lazyLoader.preloadSessions(sessionIds, options);
  }

  /**
   * Checks if lazy loading is enabled (NEW)
   */
  public isLazyLoadingEnabled(): boolean {
    return this.enableLazyLoading;
  }

  /**
   * Enhanced search with both metadata and content search (NEW)
   */
  public async searchSessionsEnhanced(query: string): Promise<SessionSummary[]> {
    if (!this.enableLazyLoading || !this.cacheManager || !this.lazyLoader) {
      // Fallback to legacy search
      return this.searchSessions(query);
    }

    // Phase 1: Fast metadata search
    const metadataResults = await this.searchSessionMetadata(query);
    
    // Phase 2: Content search only if metadata search yields few results
    if (metadataResults.length < 10) {
      const allSessionIds = (await this.listSessionsFromCache()).map(s => s.sessionId);
      const contentResults = await this.lazyLoader.searchSessionContent(allSessionIds, query);
      
      // Merge results (avoid duplicates)
      const existingIds = new Set(metadataResults.map(r => r.sessionId));
      const additionalResults = contentResults
        .filter(r => !existingIds.has(r.sessionId))
        .map(r => ({
          sessionId: r.sessionId,
          projectName: r.metadata.projectName,
          createdDate: r.metadata.createdDate,
          lastAccessed: r.metadata.lastAccessed,
          conversationCount: r.metadata.conversationCount,
          status: r.metadata.status,
          tags: r.metadata.tags
        }));
      
      return [...metadataResults, ...additionalResults];
    }
    
    return metadataResults;
  }
}