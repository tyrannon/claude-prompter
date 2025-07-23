import { ConversationEntry, Session } from './session.types';

/**
 * Metadata cache entry for fast session operations
 * Contains lightweight data that can be loaded without parsing full session files
 */
export interface SessionMetadataCache {
  // Core session metadata
  sessionId: string;
  projectName: string;
  createdDate: Date;
  lastAccessed: Date;
  status: 'active' | 'archived' | 'completed';
  tags: string[];
  description?: string;
  
  // Performance metrics (computed once, cached)
  conversationCount: number;
  lastEntryTimestamp?: Date;
  languages: string[];          // Extracted programming languages
  patterns: string[];           // Detected coding patterns
  fileSize: number;            // Physical file size in bytes
  
  // Cache control metadata
  lastCacheUpdate: Date;
  cacheVersion: string;
  filePath: string;
}

/**
 * Lazy-loaded session data structure
 * Allows selective loading of heavy data (history, context) on demand
 */
export interface LazySessionData {
  metadata: SessionMetadataCache;
  history?: ConversationEntry[];     // Loaded on demand
  context?: Session['context'];      // Loaded on demand
  isFullyLoaded: boolean;
  loadedAt?: Date;
}

/**
 * Configuration for caching behavior
 */
export interface CacheConfiguration {
  // Memory cache limits
  maxSessionDataCacheSize: number;   // Max sessions kept in memory (default: 20)
  maxMetadataCacheAge: number;       // Max age in ms before cache refresh (default: 5 min)
  
  // Performance tuning
  concurrentFileReads: number;       // Max concurrent file operations (default: 5)
  forceRebuildThreshold: number;     // Auto-rebuild cache after N sessions (default: 100)
  
  // File system options
  enableFilesystemWatcher: boolean;  // Watch for file changes (default: true)
  cacheFileName: string;             // Cache file name (default: .metadata-cache.json)
}

/**
 * Options for lazy loading operations
 */
export interface LazyLoadOptions {
  includeHistory?: boolean;
  includeContext?: boolean;
  historyLimit?: number;     // Limit number of conversation entries loaded
  historyPage?: number;      // For pagination
  forceRefresh?: boolean;    // Force reload from disk
}

/**
 * Cache performance statistics
 */
export interface CacheStats {
  // Cache state
  metadataCacheSize: number;
  sessionDataCacheSize: number;
  totalSessions: number;
  
  // Performance metrics
  cacheHitRate: number;           // Percentage of requests served from cache
  averageLoadTime: number;        // Average session load time in ms
  cacheBuildTime: number;         // Time to build metadata cache in ms
  
  // Timestamps
  lastCacheUpdate: Date;
  lastCacheRebuild: Date;
  
  // Memory usage
  estimatedMemoryUsage: number;   // Estimated cache memory usage in bytes
}

/**
 * Cache entry validation result
 */
export interface CacheValidationResult {
  isValid: boolean;
  reason?: string;
  lastModified?: Date;
  fileExists: boolean;
}

/**
 * Search result with metadata
 */
export interface SessionSearchResult {
  sessionId: string;
  metadata: SessionMetadataCache;
  matchType: 'metadata' | 'content' | 'both';
  relevanceScore: number;
  matchedFields: string[];
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  successful: number;
  failed: number;
  errors: Array<{ sessionId: string; error: string }>;
  totalTime: number;
}

/**
 * LRU Cache entry for session data
 */
export interface LRUCacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
}

/**
 * File watcher event for cache invalidation
 */
export interface FileWatcherEvent {
  type: 'added' | 'changed' | 'removed';
  sessionId: string;
  filePath: string;
  timestamp: Date;
}