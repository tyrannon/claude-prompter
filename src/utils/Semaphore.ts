/**
 * A semaphore implementation for controlling concurrent access to resources
 * Limits the number of simultaneous operations to prevent resource exhaustion
 */
export class Semaphore {
  private currentCount: number;
  private maxCount: number;
  private waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }> = [];

  constructor(maxCount: number) {
    if (maxCount <= 0) {
      throw new Error('Semaphore max count must be greater than 0');
    }
    this.maxCount = maxCount;
    this.currentCount = maxCount;
  }

  /**
   * Acquires a permit from the semaphore
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise that resolves when permit is acquired
   */
  async acquire(timeoutMs?: number): Promise<void> {
    if (this.currentCount > 0) {
      this.currentCount--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: {
        resolve: () => void;
        reject: (error: Error) => void;
        timeout?: NodeJS.Timeout;
      } = { resolve, reject };

      if (timeoutMs && timeoutMs > 0) {
        waiter.timeout = setTimeout(() => {
          // Remove from queue if timeout occurs
          const index = this.waitQueue.indexOf(waiter);
          if (index > -1) {
            this.waitQueue.splice(index, 1);
            reject(new Error(`Semaphore acquire timeout after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      this.waitQueue.push(waiter);
    });
  }

  /**
   * Releases a permit back to the semaphore
   */
  release(): void {
    if (this.currentCount >= this.maxCount) {
      throw new Error('Cannot release more permits than maximum');
    }

    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      
      // Clear timeout if it exists
      if (waiter.timeout) {
        clearTimeout(waiter.timeout);
      }
      
      waiter.resolve();
    } else {
      this.currentCount++;
    }
  }

  /**
   * Executes a function with a semaphore permit
   * @param fn - Function to execute
   * @param timeoutMs - Optional timeout for acquiring permit
   * @returns Promise resolving to function result
   */
  async execute<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Gets current number of available permits
   */
  get availablePermits(): number {
    return this.currentCount;
  }

  /**
   * Gets number of waiters in queue
   */
  get queueLength(): number {
    return this.waitQueue.length;
  }

  /**
   * Gets maximum number of permits
   */
  get maxPermits(): number {
    return this.maxCount;
  }

  /**
   * Checks if semaphore is fully utilized
   */
  get isFullyUtilized(): boolean {
    return this.currentCount === 0;
  }

  /**
   * Clears all waiting requests (useful for cleanup)
   */
  clear(): void {
    while (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      
      if (waiter.timeout) {
        clearTimeout(waiter.timeout);
      }
      
      waiter.reject(new Error('Semaphore cleared'));
    }
    
    this.currentCount = this.maxCount;
  }

  /**
   * Returns semaphore statistics
   */
  getStats() {
    return {
      availablePermits: this.currentCount,
      maxPermits: this.maxCount,
      queueLength: this.waitQueue.length,
      utilizationRate: ((this.maxCount - this.currentCount) / this.maxCount) * 100
    };
  }
}

/**
 * Utility class for creating and managing multiple semaphores
 */
export class SemaphoreManager {
  private semaphores: Map<string, Semaphore> = new Map();

  /**
   * Creates or gets a named semaphore
   */
  getSemaphore(name: string, maxCount: number): Semaphore {
    if (!this.semaphores.has(name)) {
      this.semaphores.set(name, new Semaphore(maxCount));
    }
    return this.semaphores.get(name)!;
  }

  /**
   * Removes a semaphore and clears all waiting requests
   */
  removeSemaphore(name: string): void {
    const semaphore = this.semaphores.get(name);
    if (semaphore) {
      semaphore.clear();
      this.semaphores.delete(name);
    }
  }

  /**
   * Clears all semaphores
   */
  clearAll(): void {
    for (const semaphore of this.semaphores.values()) {
      semaphore.clear();
    }
    this.semaphores.clear();
  }

  /**
   * Gets statistics for all semaphores
   */
  getAllStats(): Record<string, ReturnType<Semaphore['getStats']>> {
    const stats: Record<string, ReturnType<Semaphore['getStats']>> = {};
    for (const [name, semaphore] of this.semaphores.entries()) {
      stats[name] = semaphore.getStats();
    }
    return stats;
  }
}