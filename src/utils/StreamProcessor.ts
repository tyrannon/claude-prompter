/**
 * High-performance streaming processor for handling large datasets
 * Provides memory-efficient processing with pagination and streaming capabilities
 */

/**
 * Configuration for streaming operations
 */
export interface StreamConfig {
  /** Number of items to process per chunk */
  chunkSize: number;
  /** Maximum memory usage before forcing processing (in bytes) */
  maxMemoryUsage: number;
  /** Enable streaming mode (process items as they come) */
  enableStreaming: boolean;
  /** Concurrency limit for parallel processing */
  concurrencyLimit: number;
  /** Timeout for processing operations */
  timeoutMs: number;
}

/**
 * Pagination configuration and state
 */
export interface PaginationConfig {
  /** Number of items per page */
  pageSize: number;
  /** Current page number (0-based) */
  currentPage: number;
  /** Total number of items available */
  totalItems?: number;
  /** Enable cursor-based pagination */
  useCursor: boolean;
  /** Cursor position for cursor-based pagination */
  cursor?: string;
}

/**
 * Paginated result container
 */
export interface PaginatedResult<T> {
  /** Items in current page */
  items: T[];
  /** Pagination metadata */
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
  /** Processing performance metrics */
  performance: {
    processingTime: number;
    itemsProcessed: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

/**
 * Stream processing result
 */
export interface StreamResult<T> {
  /** Processed items */
  items: T[];
  /** Stream metadata */
  metadata: {
    totalProcessed: number;
    chunksProcessed: number;
    processingTime: number;
    averageChunkTime: number;
    memoryPeak: number;
    errors: Array<{ chunk: number; error: string }>;
  };
  /** Whether stream completed successfully */
  completed: boolean;
}

/**
 * Streaming processor with pagination support
 */
export class StreamProcessor<T, R> {
  private config: StreamConfig;
  private processingFunction: (items: T[]) => Promise<R[]>;
  private errorHandler: (error: Error, chunk: T[]) => void;

  constructor(
    processingFunction: (items: T[]) => Promise<R[]>,
    config?: Partial<StreamConfig>,
    errorHandler?: (error: Error, chunk: T[]) => void
  ) {
    this.config = {
      chunkSize: 50,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      enableStreaming: true,
      concurrencyLimit: 3,
      timeoutMs: 30000,
      ...config
    };
    
    this.processingFunction = processingFunction;
    this.errorHandler = errorHandler || ((error, chunk) => {
      console.warn(`Stream processing error for chunk of ${chunk.length} items:`, error.message);
    });
  }

  /**
   * Processes items with pagination
   * @param items - Array of items to process
   * @param paginationConfig - Pagination configuration
   * @returns Paginated result with processed items
   */
  async processPaginated(
    items: T[],
    paginationConfig: PaginationConfig
  ): Promise<PaginatedResult<R>> {
    const startTime = Date.now();
    const memoryStart = this.estimateMemoryUsage();
    
    const { pageSize, currentPage, useCursor, cursor } = paginationConfig;
    
    let paginatedItems: T[];
    let totalItems = items.length;
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;
    
    if (useCursor && cursor) {
      // Cursor-based pagination
      const cursorIndex = this.findCursorIndex(items, cursor);
      const startIndex = cursorIndex + 1;
      const endIndex = Math.min(startIndex + pageSize, items.length);
      
      paginatedItems = items.slice(startIndex, endIndex);
      
      if (endIndex < items.length) {
        nextCursor = this.generateCursor(items[endIndex - 1]);
      }
      if (startIndex > 0) {
        previousCursor = this.generateCursor(items[startIndex - 1]);
      }
    } else {
      // Offset-based pagination
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, items.length);
      paginatedItems = items.slice(startIndex, endIndex);
    }
    
    // Process paginated items
    let processedItems: R[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    
    try {
      if (paginatedItems.length > 0) {
        processedItems = await this.processChunk(paginatedItems);
        cacheMisses = paginatedItems.length; // Simplified for now
      }
    } catch (error) {
      this.errorHandler(error as Error, paginatedItems);
    }
    
    const processingTime = Date.now() - startTime;
    const memoryEnd = this.estimateMemoryUsage();
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return {
      items: processedItems,
      pagination: {
        currentPage,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: useCursor ? !!nextCursor : (currentPage + 1) < totalPages,
        hasPreviousPage: useCursor ? !!previousCursor : currentPage > 0,
        nextCursor,
        previousCursor
      },
      performance: {
        processingTime,
        itemsProcessed: paginatedItems.length,
        memoryUsage: memoryEnd - memoryStart,
        cacheHits,
        cacheMisses
      }
    };
  }

  /**
   * Processes items in streaming mode
   * @param items - Array of items to process
   * @returns Stream processing result
   */
  async processStream(items: T[]): Promise<StreamResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: Array<{ chunk: number; error: string }> = [];
    
    let totalProcessed = 0;
    let chunksProcessed = 0;
    let memoryPeak = 0;
    let chunkTimes: number[] = [];
    
    // Split items into chunks
    const chunks = this.createChunks(items, this.config.chunkSize);
    
    // Process chunks with controlled concurrency
    const semaphore = this.createSemaphore(this.config.concurrencyLimit);
    const chunkPromises = chunks.map((chunk, index) =>
      semaphore(async () => {
        const chunkStart = Date.now();
        
        try {
          const chunkResults = await this.processChunk(chunk);
          results.push(...chunkResults);
          totalProcessed += chunk.length;
          chunksProcessed++;
          
          const chunkTime = Date.now() - chunkStart;
          chunkTimes.push(chunkTime);
          
          // Track memory usage
          const currentMemory = this.estimateMemoryUsage();
          memoryPeak = Math.max(memoryPeak, currentMemory);
          
          // Force garbage collection if memory is high
          if (currentMemory > this.config.maxMemoryUsage) {
            if (global.gc) {
              global.gc();
            }
          }
          
        } catch (error) {
          errors.push({
            chunk: index,
            error: error instanceof Error ? error.message : String(error)
          });
          this.errorHandler(error as Error, chunk);
        }
      })
    );
    
    // Wait for all chunks to complete
    await Promise.all(chunkPromises);
    
    const totalTime = Date.now() - startTime;
    const averageChunkTime = chunkTimes.length > 0 ? 
      chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length : 0;
    
    return {
      items: results,
      metadata: {
        totalProcessed,
        chunksProcessed,
        processingTime: totalTime,
        averageChunkTime,
        memoryPeak,
        errors
      },
      completed: errors.length === 0
    };
  }

  /**
   * Processes items with automatic mode selection based on size
   * @param items - Array of items to process
   * @param options - Processing options
   * @returns Either paginated or stream result based on size
   */
  async processAutomatic(
    items: T[],
    options: {
      pagination?: PaginationConfig;
      preferStreaming?: boolean;
      streamThreshold?: number;
    } = {}
  ): Promise<PaginatedResult<R> | StreamResult<R>> {
    const { 
      pagination, 
      preferStreaming = false, 
      streamThreshold = 1000 
    } = options;
    
    // Decide processing mode based on item count and preferences
    const useStreaming = preferStreaming || items.length > streamThreshold;
    
    if (useStreaming && !pagination) {
      return this.processStream(items);
    } else {
      const defaultPagination: PaginationConfig = {
        pageSize: 50,
        currentPage: 0,
        useCursor: false,
        ...pagination
      };
      return this.processPaginated(items, defaultPagination);
    }
  }

  /**
   * Creates an async iterator for streaming large datasets
   * @param items - Array of items to process
   * @yields Processed chunks as they complete
   */
  async* streamIterator(items: T[]): AsyncGenerator<R[], void, unknown> {
    const chunks = this.createChunks(items, this.config.chunkSize);
    
    for (const chunk of chunks) {
      try {
        const results = await this.processChunk(chunk);
        yield results;
      } catch (error) {
        this.errorHandler(error as Error, chunk);
        yield []; // Yield empty array on error
      }
    }
  }

  /**
   * Processes a single chunk of items
   * @param chunk - Chunk of items to process
   * @returns Processed results
   */
  private async processChunk(chunk: T[]): Promise<R[]> {
    return new Promise<R[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Chunk processing timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      this.processingFunction(chunk)
        .then(results => {
          clearTimeout(timeout);
          resolve(results);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Creates chunks from array of items
   * @param items - Items to chunk
   * @param chunkSize - Size of each chunk
   * @returns Array of chunks
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Creates a semaphore for controlling concurrency
   * @param limit - Maximum concurrent operations
   * @returns Semaphore function
   */
  private createSemaphore(limit: number) {
    let running = 0;
    const queue: Array<() => void> = [];

    return async <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const execute = async () => {
          running++;
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            running--;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next();
            }
          }
        };

        if (running < limit) {
          execute();
        } else {
          queue.push(execute);
        }
      });
    };
  }

  /**
   * Estimates current memory usage
   * @returns Estimated memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0; // Fallback for non-Node environments
  }

  /**
   * Finds index of item by cursor
   * @param items - Array of items
   * @param cursor - Cursor string
   * @returns Index of cursor item
   */
  private findCursorIndex(items: T[], cursor: string): number {
    // Simple implementation - in real use case, this would be more sophisticated
    const index = parseInt(cursor, 10);
    return isNaN(index) ? 0 : Math.max(0, Math.min(index, items.length - 1));
  }

  /**
   * Generates cursor for an item
   * @param item - Item to generate cursor for
   * @returns Cursor string
   */
  private generateCursor(_item: T): string {
    // Simple implementation - in real use case, this would use item properties
    return Date.now().toString();
  }

  /**
   * Reconfigures the stream processor
   * @param newConfig - New configuration options
   */
  reconfigure(newConfig: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets current configuration
   * @returns Current stream configuration
   */
  getConfig(): StreamConfig {
    return { ...this.config };
  }
}