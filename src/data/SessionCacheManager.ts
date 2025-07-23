import fs from 'fs/promises';
import path from 'path';
import { 
  SessionMetadataCache, 
  CacheConfiguration, 
  CacheStats, 
  CacheValidationResult
} from '../types/cache.types';
import { ConcurrentFileProcessor, ConcurrentProcessingConfig } from './ConcurrentFileProcessor';
import { globalRegexCache } from '../utils/RegexCache';

/**
 * Manages metadata caching for session files
 * Provides fast access to session metadata without loading full session content
 */
export class SessionCacheManager {
  private metadataCache: Map<string, SessionMetadataCache>;
  private sessionDirectory: string;
  private cacheFilePath: string;
  private config: CacheConfiguration;
  private isInitialized: boolean = false;
  private fileProcessor: ConcurrentFileProcessor;

  constructor(sessionDirectory: string, config?: Partial<CacheConfiguration>) {
    this.sessionDirectory = sessionDirectory;
    this.metadataCache = new Map();
    
    // Set default configuration
    this.config = {
      maxSessionDataCacheSize: 20,
      maxMetadataCacheAge: 5 * 60 * 1000, // 5 minutes
      concurrentFileReads: 5,
      forceRebuildThreshold: 100,
      enableFilesystemWatcher: true,
      cacheFileName: '.metadata-cache.json',
      ...config
    };
    
    this.cacheFilePath = path.join(sessionDirectory, this.config.cacheFileName);
    
    // Initialize concurrent file processor with optimized settings
    this.fileProcessor = new ConcurrentFileProcessor({
      maxConcurrentReads: this.config.concurrentFileReads,
      maxConcurrentWrites: 3,
      operationTimeoutMs: 10000, // 10 second timeout
      batchSize: Math.max(10, this.config.concurrentFileReads * 2),
      enablePerformanceTracking: true
    });
  }

  /**
   * Initializes the cache manager by loading existing cache or building new one
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.loadMetadataCache();
    } catch (error) {
      console.warn('Failed to load metadata cache, rebuilding...', error);
      await this.rebuildCache();
    }
    
    this.isInitialized = true;
  }

  /**
   * Loads metadata cache from disk
   */
  async loadMetadataCache(): Promise<void> {
    try {
      const cacheData = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(cacheData);
      
      // Convert date strings back to Date objects
      for (const [sessionId, metadata] of Object.entries(parsed)) {
        const typedMetadata = metadata as any;
        this.metadataCache.set(sessionId, {
          ...typedMetadata,
          createdDate: new Date(typedMetadata.createdDate),
          lastAccessed: new Date(typedMetadata.lastAccessed),
          lastCacheUpdate: new Date(typedMetadata.lastCacheUpdate),
          lastEntryTimestamp: typedMetadata.lastEntryTimestamp ? new Date(typedMetadata.lastEntryTimestamp) : undefined
        });
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      // Cache file doesn't exist, will be created on first save
    }
  }

  /**
   * Saves metadata cache to disk
   */
  async saveMetadataCache(): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(this.metadataCache.entries());
      await fs.writeFile(this.cacheFilePath, JSON.stringify(cacheObject, null, 2));
    } catch (error) {
      console.error('Failed to save metadata cache:', error);
      throw error;
    }
  }

  /**
   * Rebuilds the entire metadata cache by scanning all session files using concurrent processing
   */
  async rebuildCache(): Promise<void> {
    console.log('Rebuilding session metadata cache with concurrent processing...');
    const startTime = Date.now();
    
    this.metadataCache.clear();
    
    try {
      const files = await fs.readdir(this.sessionDirectory);
      const sessionFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('.'));
      
      if (sessionFiles.length === 0) {
        console.log('No session files found to cache');
        return;
      }
      
      // Create full file paths for concurrent processing
      const filePaths = sessionFiles.map(file => path.join(this.sessionDirectory, file));
      
      // Process files concurrently using the file processor
      const processingResult = await this.fileProcessor.processFilesInBatches(
        filePaths,
        async (filePath, content) => {
          const fileName = path.basename(filePath);
          const sessionId = fileName.replace('.json', '');
          
          // Extract metadata from file content
          const metadata = this.extractMetadataFromContent(content, filePath, sessionId);
          
          if (metadata) {
            this.metadataCache.set(sessionId, metadata);
          }
          
          return metadata;
        }
      );
      
      const totalTime = Date.now() - startTime;
      
      // Save the rebuilt cache
      await this.saveMetadataCache();
      
      console.log(`Cache rebuild complete: ${processingResult.successful.length} successful, ${processingResult.failed.length} failed, ${totalTime}ms`);
      
      if (this.fileProcessor.getStats().totalOperations > 0) {
        const stats = this.fileProcessor.getStats();
        console.log(`Performance: avg ${stats.averageProcessingTime.toFixed(1)}ms/file, ${stats.concurrencyUtilization.toFixed(1)}% concurrency utilization`);
      }
      
      if (processingResult.failed.length > 0) {
        console.warn('Errors during cache rebuild:', processingResult.failed.slice(0, 5)); // Show first 5 errors
      }
      
    } catch (error) {
      console.error('Failed to rebuild cache:', error);
      throw error;
    }
  }

  /**
   * Extracts metadata from a single session file without loading full content
   */
  private async extractMetadataFromFile(fileName: string): Promise<SessionMetadataCache | null> {
    const filePath = path.join(this.sessionDirectory, fileName);
    const sessionId = fileName.replace('.json', '');
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.extractMetadataFromContent(content, filePath, sessionId);
    } catch (error) {
      console.warn(`Failed to extract metadata from ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Extracts metadata from file content (used by both individual and concurrent processing)
   */
  private extractMetadataFromContent(content: string, filePath: string, sessionId: string): SessionMetadataCache | null {
    try {
      // Try to extract metadata without full JSON parsing for performance
      const metadataMatch = content.match(/"metadata"\s*:\s*(\{[^{}]*\})/);
      let metadata: any;
      
      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1]);
        } catch {
          // Fall back to full parsing if regex approach fails
          const session = JSON.parse(content);
          metadata = session.metadata;
        }
      } else {
        // Full parse as fallback
        const session = JSON.parse(content);
        metadata = session.metadata;
      }
      
      // Count conversations using cached regex for performance
      const promptResult = globalRegexCache.findAll('"prompt"\\s*:', content);
      const conversationCount = promptResult.allMatches.length;
      
      // Extract languages from content (lightweight analysis)
      const languages = this.extractLanguagesQuick(content);
      
      // Extract patterns from content (lightweight analysis)  
      const patterns = this.extractPatternsQuick(content);
      
      // Find last entry timestamp using cached regex
      const timestampResult = globalRegexCache.findAll('"timestamp"\\s*:\\s*"([^"]+)"', content);
      let lastEntryTimestamp: Date | undefined;
      if (timestampResult.allMatches.length > 0) {
        const lastMatch = timestampResult.allMatches[timestampResult.allMatches.length - 1];
        const timestampValue = lastMatch[1]; // First capture group
        if (timestampValue) {
          lastEntryTimestamp = new Date(timestampValue);
        }
      }
      
      // Get file size (estimate for concurrent processing where we might not have stats)
      const fileSize = Buffer.byteLength(content, 'utf-8');
      
      return {
        sessionId,
        projectName: metadata.projectName || 'unknown',
        createdDate: new Date(metadata.createdDate),
        lastAccessed: new Date(metadata.lastAccessed),
        status: metadata.status || 'active',
        tags: metadata.tags || [],
        description: metadata.description,
        conversationCount,
        lastEntryTimestamp,
        languages,
        patterns,
        fileSize,
        lastCacheUpdate: new Date(),
        cacheVersion: '1.0.0',
        filePath
      };
      
    } catch (error) {
      console.warn(`Failed to extract metadata from content:`, error);
      return null;
    }
  }

  /**
   * Quick language extraction using cached regex patterns
   */
  private extractLanguagesQuick(content: string): string[] {
    const languages = new Set<string>();
    const langPatterns = new Map([
      ['javascript', '\\b(javascript|js|nodejs|npm|yarn)\\b'],
      ['typescript', '\\b(typescript|ts)\\b'],
      ['python', '\\b(python|py|pip|django|flask)\\b'],
      ['react', '\\b(react|jsx|tsx)\\b'],
      ['css', '\\b(css|scss|sass|styled)\\b'],
      ['sql', '\\b(sql|mysql|postgres|sqlite)\\b'],
      ['go', '\\b(golang|go)\\b'],
      ['rust', '\\b(rust|cargo)\\b'],
      ['java', '\\b(java|spring|maven)\\b'],
      ['php', '\\b(php|laravel|composer)\\b']
    ]);
    
    // Use batch testing for optimal performance
    const batchResult = globalRegexCache.batchTest(langPatterns, content);
    
    for (const [lang, result] of batchResult.results.entries()) {
      if (result.matched) {
        languages.add(lang);
      }
    }
    
    return Array.from(languages);
  }

  /**
   * Quick pattern extraction using cached regex patterns
   */
  private extractPatternsQuick(content: string): string[] {
    const patterns = new Set<string>();
    const patternMap = new Map([
      ['async-await', 'async|await|promise'],
      ['error-handling', 'try|catch|error|exception|throw'],
      ['testing', 'test|jest|mocha|vitest|describe|it\\('],
      ['api-integration', 'api|endpoint|http|axios|fetch'],
      ['authentication', 'auth|jwt|token|login|session'],
      ['state-management', 'state|redux|zustand|context'],
      ['component-patterns', 'component|react|vue|angular'],
      ['database', 'database|sql|mongo|postgres|query']
    ]);
    
    // Use batch testing for optimal performance
    const batchResult = globalRegexCache.batchTest(patternMap, content);
    
    for (const [pattern, result] of batchResult.results.entries()) {
      if (result.matched) {
        patterns.add(pattern);
      }
    }
    
    return Array.from(patterns);
  }

  /**
   * Gets metadata for a specific session
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadataCache | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const cached = this.metadataCache.get(sessionId);
    if (cached) {
      // Check if cache entry is still valid
      const validation = await this.validateCacheEntry(cached);
      if (validation.isValid) {
        return cached;
      } else {
        // Re-extract metadata for this session
        const fileName = `${sessionId}.json`;
        const freshMetadata = await this.extractMetadataFromFile(fileName);
        if (freshMetadata) {
          this.metadataCache.set(sessionId, freshMetadata);
          await this.saveMetadataCache();
          return freshMetadata;
        }
      }
    }
    
    return null;
  }

  /**
   * Gets all cached session metadata
   */
  async getAllSessionMetadata(): Promise<SessionMetadataCache[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return Array.from(this.metadataCache.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  /**
   * Updates metadata for a specific session
   */
  async updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadataCache>): Promise<void> {
    const existing = this.metadataCache.get(sessionId);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        lastCacheUpdate: new Date()
      };
      this.metadataCache.set(sessionId, updated);
      await this.saveMetadataCache();
    }
  }

  /**
   * Invalidates cache entry for a specific session
   */
  async invalidateSessionCache(sessionId: string): Promise<void> {
    this.metadataCache.delete(sessionId);
    await this.saveMetadataCache();
  }

  /**
   * Validates a cache entry against the actual file
   */
  private async validateCacheEntry(cached: SessionMetadataCache): Promise<CacheValidationResult> {
    try {
      const stats = await fs.stat(cached.filePath);
      const fileModified = stats.mtime;
      const cacheAge = Date.now() - cached.lastCacheUpdate.getTime();
      
      return {
        isValid: cacheAge < this.config.maxMetadataCacheAge && 
                fileModified <= cached.lastCacheUpdate,
        lastModified: fileModified,
        fileExists: true
      };
    } catch (error) {
      return {
        isValid: false,
        reason: 'File not found or inaccessible',
        fileExists: false
      };
    }
  }

  /**
   * Searches metadata using text matching
   */
  async searchMetadata(query: string): Promise<SessionMetadataCache[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const lowerQuery = query.toLowerCase();
    const results: SessionMetadataCache[] = [];
    
    for (const metadata of this.metadataCache.values()) {
      // Search in project name, description, tags
      const searchableText = [
        metadata.projectName,
        metadata.description || '',
        ...metadata.tags,
        ...metadata.languages,
        ...metadata.patterns
      ].join(' ').toLowerCase();
      
      if (searchableText.includes(lowerQuery)) {
        results.push(metadata);
      }
    }
    
    return results.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  /**
   * Gets cache performance statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const metadataArray = Array.from(this.metadataCache.values());
    const cacheUpdateTimes = metadataArray.map(m => m.lastCacheUpdate.getTime());
    
    return {
      metadataCacheSize: this.metadataCache.size,
      sessionDataCacheSize: 0, // Will be filled by LazySessionLoader
      totalSessions: this.metadataCache.size,
      cacheHitRate: 0, // Will be tracked by usage
      averageLoadTime: 0, // Will be tracked by usage
      cacheBuildTime: 0, // Will be tracked during rebuild
      lastCacheUpdate: metadataArray.length > 0 ? 
        new Date(Math.max(...cacheUpdateTimes)) : new Date(),
      lastCacheRebuild: new Date(), // Track this during rebuild
      estimatedMemoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimates memory usage of the metadata cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const metadata of this.metadataCache.values()) {
      // Rough estimation based on JSON serialization
      totalSize += JSON.stringify(metadata).length * 2; // UTF-16 encoding
    }
    
    return totalSize;
  }

  /**
   * Cleans up stale cache entries
   */
  async cleanupStaleEntries(): Promise<number> {
    let removedCount = 0;
    const staleEntries: string[] = [];
    
    for (const [sessionId, metadata] of this.metadataCache.entries()) {
      const validation = await this.validateCacheEntry(metadata);
      if (!validation.isValid) {
        staleEntries.push(sessionId);
      }
    }
    
    for (const sessionId of staleEntries) {
      this.metadataCache.delete(sessionId);
      removedCount++;
    }
    
    if (removedCount > 0) {
      await this.saveMetadataCache();
    }
    
    return removedCount;
  }

  /**
   * Gets concurrent processing statistics
   */
  getProcessingStats() {
    return {
      fileProcessor: this.fileProcessor.getStats(),
      semaphores: this.fileProcessor.getSemaphoreStats()
    };
  }

  /**
   * Reconfigures concurrent processing settings
   */
  reconfigureProcessing(config: Partial<ConcurrentProcessingConfig>): void {
    this.fileProcessor.reconfigure(config);
  }

  /**
   * Cleans up resources
   */
  cleanup(): void {
    this.fileProcessor.cleanup();
  }
}