import { Logger } from './logger';
import { ClaudePrompterError, ErrorCode } from './errorHandler';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, blocking calls
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  successThreshold: number;    // Number of successes needed to close from half-open
  timeout: number;            // Time in ms before trying half-open
  monitoringPeriod: number;   // Time window to count failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private logger: Logger;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute
      monitoringPeriod: 300000 // 5 minutes
    }
  ) {
    this.logger = new Logger(`CircuitBreaker[${name}]`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new ClaudePrompterError(
        ErrorCode.API_SERVICE_UNAVAILABLE,
        `Circuit breaker is OPEN for ${this.name}. Service may be unavailable.`,
        {
          isRetryable: true,
          context: {
            circuitState: this.state,
            nextAttemptTime: this.nextAttemptTime
          }
        }
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Check if the circuit allows execution
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (this.shouldAttemptReset()) {
          this.moveToHalfOpen();
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = 0;
    }

    this.logger.debug(`Success recorded`, {
      state: this.state,
      successes: this.successes,
      failures: this.failures
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successes = 0; // Reset success count on any failure

    this.logger.warn(`Failure recorded`, {
      state: this.state,
      failures: this.failures,
      error: error instanceof Error ? error.message : String(error)
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.trip();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should trip the circuit
      if (this.failures >= this.config.failureThreshold) {
        this.trip();
      }
    }
  }

  /**
   * Trip the circuit to OPEN state
   */
  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    
    this.logger.error(`Circuit breaker tripped to OPEN`, {
      failures: this.failures,
      nextAttemptTime: this.nextAttemptTime
    });
  }

  /**
   * Move to HALF_OPEN state for testing
   */
  private moveToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
    
    this.logger.info(`Circuit breaker moved to HALF_OPEN for testing`);
  }

  /**
   * Reset circuit to CLOSED state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;
    
    this.logger.info(`Circuit breaker reset to CLOSED`);
  }

  /**
   * Check if we should attempt to reset from OPEN state
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return false;
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Check if failures are within monitoring period
   * (Currently unused but kept for future enhancements)
   */
  // private isWithinMonitoringPeriod(): boolean {
  //   if (!this.lastFailureTime) return false;
  //   return (Date.now() - this.lastFailureTime.getTime()) <= this.config.monitoringPeriod;
  // }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Manual reset of the circuit breaker
   */
  manualReset(): void {
    this.logger.info('Manual reset triggered');
    this.reset();
  }

  /**
   * Get a human-readable status
   */
  getStatusMessage(): string {
    const stats = this.getStats();
    
    switch (stats.state) {
      case CircuitState.CLOSED:
        return `✅ Circuit is CLOSED (${stats.failures} recent failures)`;
      
      case CircuitState.OPEN:
        const waitTime = stats.nextAttemptTime ? 
          Math.max(0, stats.nextAttemptTime.getTime() - Date.now()) : 0;
        return `🚫 Circuit is OPEN (${stats.failures} failures, retry in ${Math.ceil(waitTime / 1000)}s)`;
      
      case CircuitState.HALF_OPEN:
        return `🔄 Circuit is HALF_OPEN (testing with ${stats.successes}/${this.config.successThreshold} successes)`;
      
      default:
        return '❓ Circuit state unknown';
    }
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  static getOrCreate(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.manualReset();
    }
  }
}