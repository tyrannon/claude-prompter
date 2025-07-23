import fs from 'fs/promises';
import { Semaphore } from '../utils/Semaphore';

/**
 * Configuration for concurrent file processing
 */
export interface ConcurrentProcessingConfig {
  /** Maximum number of concurrent file reads */
  maxConcurrentReads: number;
  /** Maximum number of concurrent file writes */
  maxConcurrentWrites: number;
  /** Timeout for file operations in milliseconds */
  operationTimeoutMs: number;
  /** Batch size for processing operations */
  batchSize: number;
  /** Enable detailed performance tracking */
  enablePerformanceTracking: boolean;
}

/**
 * Statistics for concurrent file operations
 */
export interface ProcessingStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  totalProcessingTime: number;
  concurrencyUtilization: number;
  queueWaitTime: number;
}

/**
 * Result of a batch file processing operation
 */
export interface BatchProcessingResult<T> {
  successful: T[];
  failed: Array<{
    filePath: string;
    error: string;
    processingTime?: number;
  }>;
  stats: ProcessingStats;
  processingOrder: string[];
}

/**
 * File operation result with timing information
 */
interface FileOperationResult<T> {
  result: T;
  filePath: string;
  processingTime: number;
  queueWaitTime: number;
}

/**
 * Manages concurrent file processing with semaphore-controlled parallelism
 */
export class ConcurrentFileProcessor {
  private readSemaphore: Semaphore;
  private writeSemaphore: Semaphore;
  private config: ConcurrentProcessingConfig;
  private stats: ProcessingStats;

  constructor(config?: Partial<ConcurrentProcessingConfig>) {
    this.config = {
      maxConcurrentReads: 10,
      maxConcurrentWrites: 5,
      operationTimeoutMs: 30000, // 30 seconds
      batchSize: 20,
      enablePerformanceTracking: true,
      ...config
    };

    this.readSemaphore = new Semaphore(this.config.maxConcurrentReads);
    this.writeSemaphore = new Semaphore(this.config.maxConcurrentWrites);
    
    this.stats = this.createEmptyStats();
  }

  /**
   * Processes multiple files concurrently with controlled parallelism
   * @param filePaths - Array of file paths to process
   * @param processor - Function to process each file
   * @returns BatchProcessingResult with successful and failed operations
   */
  async processFilesInBatches<T>(
    filePaths: string[],
    processor: (filePath: string, content: string) => Promise<T>
  ): Promise<BatchProcessingResult<T>> {
    const startTime = Date.now();
    const successful: T[] = [];
    const failed: Array<{ filePath: string; error: string; processingTime?: number }> = [];
    const processingOrder: string[] = [];
    
    // Reset stats for this operation
    this.stats = this.createEmptyStats();
    
    // Process files in batches to manage memory usage
    const batches = this.createBatches(filePaths, this.config.batchSize);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      if (this.config.enablePerformanceTracking) {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
      }
      
      // Process all files in the current batch concurrently
      const batchPromises = batch.map(filePath => this.processFile(filePath, processor));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results from the batch
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const filePath = batch[i];
        processingOrder.push(filePath);
        
        if (result.status === 'fulfilled') {
          successful.push(result.value.result);
          this.updateStats(result.value.processingTime, result.value.queueWaitTime, true);
        } else {
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failed.push({ filePath, error });
          this.updateStats(0, 0, false);
        }
      }
    }
    
    // Finalize stats
    const totalTime = Date.now() - startTime;
    this.stats.totalProcessingTime = totalTime;
    this.stats.concurrencyUtilization = this.calculateConcurrencyUtilization();
    
    return {
      successful,
      failed,
      stats: { ...this.stats },
      processingOrder
    };
  }

  /**
   * Reads multiple files concurrently
   * @param filePaths - Array of file paths to read
   * @returns BatchProcessingResult with file contents
   */
  async readFilesInBatches(filePaths: string[]): Promise<BatchProcessingResult<{ filePath: string; content: string }>> {
    return this.processFilesInBatches(filePaths, async (filePath, content) => ({
      filePath,
      content
    }));
  }

  /**
   * Writes multiple files concurrently
   * @param writeOperations - Array of write operations {filePath, content}
   * @returns BatchProcessingResult with write confirmations
   */
  async writeFilesInBatches(
    writeOperations: Array<{ filePath: string; content: string }>
  ): Promise<BatchProcessingResult<{ filePath: string; success: boolean }>> {
    const filePaths = writeOperations.map(op => op.filePath);
    const contentMap = new Map(writeOperations.map(op => [op.filePath, op.content]));
    
    return this.processFilesInBatches(filePaths, async (filePath) => {
      const content = contentMap.get(filePath)!;
      await this.writeSemaphore.execute(async () => {
        await fs.writeFile(filePath, content, 'utf-8');
      }, this.config.operationTimeoutMs);
      
      return { filePath, success: true };
    });
  }

  /**
   * Processes a single file with semaphore control
   * @param filePath - Path to the file
   * @param processor - Function to process the file content
   * @returns FileOperationResult with timing information
   */
  private async processFile<T>(
    filePath: string,
    processor: (filePath: string, content: string) => Promise<T>
  ): Promise<FileOperationResult<T>> {
    const queueStartTime = Date.now();
    
    return this.readSemaphore.execute(async () => {
      const queueWaitTime = Date.now() - queueStartTime;
      const processingStartTime = Date.now();
      
      try {
        // Read file with timeout
        const content = await this.readFileWithTimeout(filePath, this.config.operationTimeoutMs);
        
        // Process file content
        const result = await processor(filePath, content);
        
        const processingTime = Date.now() - processingStartTime;
        
        return {
          result,
          filePath,
          processingTime,
          queueWaitTime
        };
      } catch (error) {
        throw new Error(`Failed to process ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, this.config.operationTimeoutMs);
  }

  /**
   * Reads a file with timeout support
   */
  private async readFileWithTimeout(filePath: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`File read timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fs.readFile(filePath, 'utf-8')
        .then(content => {
          clearTimeout(timeout);
          resolve(content);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Creates batches from an array of file paths
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Updates processing statistics
   */
  private updateStats(processingTime: number, queueWaitTime: number, success: boolean): void {
    if (!this.config.enablePerformanceTracking) return;

    this.stats.totalOperations++;
    
    if (success) {
      this.stats.successfulOperations++;
      
      // Update timing statistics
      if (this.stats.minProcessingTime === 0 || processingTime < this.stats.minProcessingTime) {
        this.stats.minProcessingTime = processingTime;
      }
      if (processingTime > this.stats.maxProcessingTime) {
        this.stats.maxProcessingTime = processingTime;
      }
      
      // Update running averages
      const totalSuccessful = this.stats.successfulOperations;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (totalSuccessful - 1) + processingTime) / totalSuccessful;
      this.stats.queueWaitTime = 
        (this.stats.queueWaitTime * (totalSuccessful - 1) + queueWaitTime) / totalSuccessful;
    } else {
      this.stats.failedOperations++;
    }
  }

  /**
   * Calculates current concurrency utilization
   */
  private calculateConcurrencyUtilization(): number {
    const readUtilization = ((this.config.maxConcurrentReads - this.readSemaphore.availablePermits) / this.config.maxConcurrentReads) * 100;
    const writeUtilization = ((this.config.maxConcurrentWrites - this.writeSemaphore.availablePermits) / this.config.maxConcurrentWrites) * 100;
    return Math.max(readUtilization, writeUtilization);
  }

  /**
   * Creates an empty stats object
   */
  private createEmptyStats(): ProcessingStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: 0,
      totalProcessingTime: 0,
      concurrencyUtilization: 0,
      queueWaitTime: 0
    };
  }

  /**
   * Gets current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Gets semaphore statistics for monitoring
   */
  getSemaphoreStats() {
    return {
      readSemaphore: this.readSemaphore.getStats(),
      writeSemaphore: this.writeSemaphore.getStats()
    };
  }

  /**
   * Reconfigures the processor with new settings
   */
  reconfigure(newConfig: Partial<ConcurrentProcessingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Recreate semaphores if limits changed
    if (oldConfig.maxConcurrentReads !== this.config.maxConcurrentReads) {
      this.readSemaphore.clear();
      this.readSemaphore = new Semaphore(this.config.maxConcurrentReads);
    }
    
    if (oldConfig.maxConcurrentWrites !== this.config.maxConcurrentWrites) {
      this.writeSemaphore.clear();
      this.writeSemaphore = new Semaphore(this.config.maxConcurrentWrites);
    }
  }

  /**
   * Cleans up resources and cancels pending operations
   */
  cleanup(): void {
    this.readSemaphore.clear();
    this.writeSemaphore.clear();
  }
}