import { LRUCacheEntry } from '../types/cache.types';

/**
 * Least Recently Used (LRU) Cache implementation
 * Used for caching session data with automatic eviction of least recently used items
 */
export class LRUCache<T> {
  private cache: Map<string, LRUCacheEntry<T>>;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 20) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Gets an item from the cache
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access statistics
      entry.lastAccessed = new Date();
      entry.accessCount++;
      
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      
      this.hits++;
      return entry.value;
    }
    
    this.misses++;
    return undefined;
  }

  /**
   * Sets an item in the cache
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: string, value: T): void {
    const now = new Date();
    
    // If key already exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccessed = now;
      entry.accessCount++;
      
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return;
    }

    // If cache is at capacity, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Add new entry
    const entry: LRUCacheEntry<T> = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    };

    this.cache.set(key, entry);
  }

  /**
   * Removes an item from the cache
   * @param key Cache key to remove
   * @returns True if item was removed, false if not found
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Checks if a key exists in the cache
   * @param key Cache key to check
   * @returns True if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clears all items from the cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Gets all keys currently in the cache
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Gets all values currently in the cache
   * @returns Array of cached values
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Gets the current size of the cache
   * @returns Number of items in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Gets cache hit rate as a percentage
   * @returns Hit rate (0-100)
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total) * 100;
  }

  /**
   * Gets cache statistics
   * @returns Object with cache performance metrics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : undefined,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : undefined
    };
  }

  /**
   * Evicts entries older than the specified age
   * @param maxAge Maximum age in milliseconds
   * @returns Number of entries evicted
   */
  evictOlderThan(maxAge: number): number {
    const cutoff = new Date(Date.now() - maxAge);
    let evictedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < cutoff) {
        this.cache.delete(key);
        evictedCount++;
      }
    }
    
    return evictedCount;
  }

  /**
   * Gets the least recently used items
   * @param count Number of items to return
   * @returns Array of least recently used cache entries
   */
  getLeastRecentlyUsed(count: number): Array<{ key: string; entry: LRUCacheEntry<T> }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessed.getTime() - b.entry.lastAccessed.getTime());
    
    return entries.slice(0, count);
  }

  /**
   * Estimates memory usage of cached items
   * @returns Estimated memory usage in bytes
   */
  estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation based on JSON serialization
      try {
        totalSize += JSON.stringify(entry.value).length * 2; // 2 bytes per character for UTF-16
      } catch {
        totalSize += 1024; // Fallback estimate for non-serializable objects
      }
    }
    
    return totalSize;
  }
}