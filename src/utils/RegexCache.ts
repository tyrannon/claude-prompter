/**
 * High-performance regex caching system for pattern matching operations
 * Provides compiled regex caching with LRU eviction and performance tracking
 */

import { LRUCache } from './LRUCache';

/**
 * Configuration for regex caching behavior
 */
export interface RegexCacheConfig {
  /** Maximum number of compiled regexes to cache */
  maxCacheSize: number;
  /** Enable performance tracking */
  enablePerformanceTracking: boolean;
  /** Enable cache statistics collection */
  enableStatistics: boolean;
  /** Default regex flags to apply */
  defaultFlags: string;
}

/**
 * Statistics for regex cache performance
 */
export interface RegexCacheStats {
  /** Total number of regex lookups */
  totalLookups: number;
  /** Number of cache hits */
  cacheHits: number;
  /** Number of cache misses */
  cacheMisses: number;
  /** Cache hit ratio (0-100) */
  hitRatio: number;
  /** Total compilation time in milliseconds */
  totalCompilationTime: number;
  /** Average compilation time per regex */
  averageCompilationTime: number;
  /** Number of regexes currently cached */
  cacheSize: number;
  /** Total memory usage estimate */
  estimatedMemoryUsage: number;
}

/**
 * Cached regex entry with metadata
 */
interface CachedRegex {
  /** Compiled regular expression */
  regex: RegExp;
  /** Original pattern string */
  pattern: string;
  /** Regex flags used */
  flags: string;
  /** Number of times this regex has been used */
  usageCount: number;
  /** Last time this regex was accessed */
  lastAccessed: Date;
  /** Time taken to compile this regex */
  compilationTime: number;
}

/**
 * Pattern matching result with performance data
 */
export interface MatchResult {
  /** Whether pattern matched */
  matched: boolean;
  /** Match results from RegExp.exec() or null */
  matches: RegExpExecArray | null;
  /** All matches from global regex or empty array */
  allMatches: RegExpExecArray[];
  /** Time taken for the match operation */
  matchTime: number;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Batch pattern matching for multiple patterns against single content
 */
export interface BatchMatchResult {
  /** Map of pattern -> match results */
  results: Map<string, MatchResult>;
  /** Total time for all matches */
  totalTime: number;
  /** Number of patterns that matched */
  matchCount: number;
  /** Performance breakdown */
  performance: {
    cacheHits: number;
    cacheMisses: number;
    compilationTime: number;
    matchTime: number;
  };
}

/**
 * High-performance regex cache with LRU eviction and performance tracking
 */
export class RegexCache {
  private cache: LRUCache<CachedRegex>;
  private config: RegexCacheConfig;
  private stats: RegexCacheStats;

  constructor(config?: Partial<RegexCacheConfig>) {
    this.config = {
      maxCacheSize: 100,
      enablePerformanceTracking: true,
      enableStatistics: true,
      defaultFlags: 'gi',
      ...config
    };

    this.cache = new LRUCache<CachedRegex>(this.config.maxCacheSize);
    this.stats = this.createEmptyStats();
  }

  /**
   * Gets or compiles a regex with caching
   * @param pattern - Regex pattern string
   * @param flags - Optional regex flags (defaults to config.defaultFlags)
   * @returns Compiled RegExp object
   */
  getRegex(pattern: string, flags?: string): RegExp {
    const actualFlags = flags ?? this.config.defaultFlags;
    const cacheKey = `${pattern}::${actualFlags}`;
    
    if (this.config.enableStatistics) {
      this.stats.totalLookups++;
    }

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (this.config.enableStatistics) {
        this.stats.cacheHits++;
        cached.usageCount++;
        cached.lastAccessed = new Date();
      }
      return cached.regex;
    }

    // Cache miss - compile new regex
    if (this.config.enableStatistics) {
      this.stats.cacheMisses++;
    }

    const compilationStart = this.config.enablePerformanceTracking ? Date.now() : 0;
    
    let compiledRegex: RegExp;
    try {
      compiledRegex = new RegExp(pattern, actualFlags);
    } catch (error) {
      throw new Error(`Invalid regex pattern "${pattern}" with flags "${actualFlags}": ${error instanceof Error ? error.message : String(error)}`);
    }

    const compilationTime = this.config.enablePerformanceTracking ? Date.now() - compilationStart : 0;

    // Create cache entry
    const cacheEntry: CachedRegex = {
      regex: compiledRegex,
      pattern,
      flags: actualFlags,
      usageCount: 1,
      lastAccessed: new Date(),
      compilationTime
    };

    // Store in cache
    this.cache.set(cacheKey, cacheEntry);

    // Update statistics
    if (this.config.enableStatistics) {
      this.stats.totalCompilationTime += compilationTime;
      this.stats.averageCompilationTime = this.stats.totalCompilationTime / this.stats.cacheMisses;
    }

    return compiledRegex;
  }

  /**
   * Tests if a pattern matches content with performance tracking
   * @param pattern - Regex pattern
   * @param content - Content to test against
   * @param flags - Optional regex flags
   * @returns MatchResult with performance data
   */
  test(pattern: string, content: string, flags?: string): MatchResult {
    const matchStart = this.config.enablePerformanceTracking ? Date.now() : 0;
    const fromCache = this.cache.has(`${pattern}::${flags ?? this.config.defaultFlags}`);
    
    try {
      const regex = this.getRegex(pattern, flags);
      const matched = regex.test(content);
      
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      
      return {
        matched,
        matches: null,
        allMatches: [],
        matchTime,
        fromCache
      };
    } catch (error) {
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      return {
        matched: false,
        matches: null,
        allMatches: [],
        matchTime,
        fromCache
      };
    }
  }

  /**
   * Executes regex against content and returns matches with performance tracking
   * @param pattern - Regex pattern
   * @param content - Content to match against
   * @param flags - Optional regex flags
   * @returns MatchResult with match data and performance info
   */
  exec(pattern: string, content: string, flags?: string): MatchResult {
    const matchStart = this.config.enablePerformanceTracking ? Date.now() : 0;
    const fromCache = this.cache.has(`${pattern}::${flags ?? this.config.defaultFlags}`);
    
    try {
      const regex = this.getRegex(pattern, flags);
      const matches = regex.exec(content);
      const matched = matches !== null;
      
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      
      return {
        matched,
        matches,
        allMatches: matches ? [matches] : [],
        matchTime,
        fromCache
      };
    } catch (error) {
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      return {
        matched: false,
        matches: null,
        allMatches: [],
        matchTime,
        fromCache
      };
    }
  }

  /**
   * Finds all matches of a pattern in content
   * @param pattern - Regex pattern (automatically adds global flag if not present)
   * @param content - Content to search
   * @param flags - Optional regex flags
   * @returns MatchResult with all matches
   */
  findAll(pattern: string, content: string, flags?: string): MatchResult {
    const matchStart = this.config.enablePerformanceTracking ? Date.now() : 0;
    
    // Ensure global flag is present for findAll
    const actualFlags = flags ?? this.config.defaultFlags;
    const globalFlags = actualFlags.includes('g') ? actualFlags : actualFlags + 'g';
    
    const fromCache = this.cache.has(`${pattern}::${globalFlags}`);
    
    try {
      const regex = this.getRegex(pattern, globalFlags);
      const allMatches: RegExpExecArray[] = [];
      let match: RegExpExecArray | null;
      
      // Reset regex lastIndex to ensure we start from beginning
      regex.lastIndex = 0;
      
      while ((match = regex.exec(content)) !== null) {
        allMatches.push(match);
        
        // Prevent infinite loop on zero-length matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
      
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      
      return {
        matched: allMatches.length > 0,
        matches: allMatches.length > 0 ? allMatches[0] : null,
        allMatches,
        matchTime,
        fromCache
      };
    } catch (error) {
      const matchTime = this.config.enablePerformanceTracking ? Date.now() - matchStart : 0;
      return {
        matched: false,
        matches: null,
        allMatches: [],
        matchTime,
        fromCache
      };
    }
  }

  /**
   * Tests multiple patterns against content efficiently
   * @param patterns - Array of regex patterns or Map of pattern->flags
   * @param content - Content to test against
   * @returns BatchMatchResult with all results and performance data
   */
  batchTest(patterns: string[] | Map<string, string>, content: string): BatchMatchResult {
    const batchStart = this.config.enablePerformanceTracking ? Date.now() : 0;
    const results = new Map<string, MatchResult>();
    
    let cacheHits = 0;
    let cacheMisses = 0;
    let compilationTime = 0;
    let matchTime = 0;
    let matchCount = 0;

    const patternEntries = Array.isArray(patterns) 
      ? patterns.map(p => [p, this.config.defaultFlags] as [string, string])
      : Array.from(patterns.entries());

    for (const [pattern, flags] of patternEntries) {
      const result = this.test(pattern, content, flags);
      results.set(pattern, result);
      
      if (result.matched) {
        matchCount++;
      }
      
      if (this.config.enablePerformanceTracking) {
        matchTime += result.matchTime;
        if (result.fromCache) {
          cacheHits++;
        } else {
          cacheMisses++;
        }
      }
    }

    const totalTime = this.config.enablePerformanceTracking ? Date.now() - batchStart : 0;

    return {
      results,
      totalTime,
      matchCount,
      performance: {
        cacheHits,
        cacheMisses,
        compilationTime,
        matchTime
      }
    };
  }

  /**
   * Precompiles a set of patterns for better performance
   * @param patterns - Array of patterns or Map of pattern->flags to precompile
   */
  precompile(patterns: string[] | Map<string, string>): void {
    const patternEntries = Array.isArray(patterns) 
      ? patterns.map(p => [p, this.config.defaultFlags] as [string, string])
      : Array.from(patterns.entries());

    for (const [pattern, flags] of patternEntries) {
      try {
        this.getRegex(pattern, flags);
      } catch (error) {
        console.warn(`Failed to precompile regex pattern "${pattern}":`, error);
      }
    }
  }

  /**
   * Gets cache performance statistics
   */
  getStats(): RegexCacheStats {
    return {
      ...this.stats,
      cacheSize: this.cache.size(),
      hitRatio: this.stats.totalLookups > 0 ? (this.stats.cacheHits / this.stats.totalLookups) * 100 : 0,
      estimatedMemoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Clears all cached regexes and resets statistics
   */
  clear(): void {
    this.cache.clear();
    this.stats = this.createEmptyStats();
  }

  /**
   * Gets information about cached regexes
   */
  getCacheInfo(): Array<{
    pattern: string;
    flags: string;
    usageCount: number;
    lastAccessed: Date;
    compilationTime: number;
  }> {
    const info: Array<{
      pattern: string;
      flags: string;
      usageCount: number;
      lastAccessed: Date;
      compilationTime: number;
    }> = [];

    const keys = this.cache.keys();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached) {
        info.push({
          pattern: cached.pattern,
          flags: cached.flags,
          usageCount: cached.usageCount,
          lastAccessed: cached.lastAccessed,
          compilationTime: cached.compilationTime
        });
      }
    }

    return info.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Reconfigures the cache with new settings
   */
  reconfigure(newConfig: Partial<RegexCacheConfig>): void {
    const oldMaxSize = this.config.maxCacheSize;
    this.config = { ...this.config, ...newConfig };
    
    // Create new cache with new size if needed
    if (oldMaxSize !== this.config.maxCacheSize) {
      const oldCache = this.cache;
      this.cache = new LRUCache<CachedRegex>(this.config.maxCacheSize);
      
      // Copy most recently used items to new cache
      const keys = oldCache.keys();
      const keysToKeep = keys.slice(0, this.config.maxCacheSize);
      for (const key of keysToKeep) {
        const value = oldCache.get(key);
        if (value) {
          this.cache.set(key, value);
        }
      }
    }
  }

  /**
   * Creates empty statistics object
   */
  private createEmptyStats(): RegexCacheStats {
    return {
      totalLookups: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: 0,
      totalCompilationTime: 0,
      averageCompilationTime: 0,
      cacheSize: 0,
      estimatedMemoryUsage: 0
    };
  }

  /**
   * Estimates memory usage of cached regexes
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    const keys = this.cache.keys();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached) {
        // Rough estimation: key + pattern + flags + metadata
        totalSize += key.length * 2; // UTF-16
        totalSize += cached.pattern.length * 2;
        totalSize += cached.flags.length * 2;
        totalSize += 100; // Estimate for RegExp object and metadata
      }
    }
    
    return totalSize;
  }
}

/**
 * Global regex cache instance for shared use across the application
 */
export const globalRegexCache = new RegexCache({
  maxCacheSize: 200,
  enablePerformanceTracking: true,
  enableStatistics: true,
  defaultFlags: 'gi'
});