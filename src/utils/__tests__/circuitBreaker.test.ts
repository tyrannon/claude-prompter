import { CircuitBreaker, CircuitState, CircuitBreakerRegistry } from '../circuitBreaker';
import { ClaudePrompterError, ErrorCode } from '../errorHandler';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      monitoringPeriod: 5000
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });

    it('should allow execution when CLOSED', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure handling', () => {
    it('should record failures without opening immediately', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // First two failures should not open the circuit
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(2);
    });

    it('should open circuit after reaching failure threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Reach failure threshold (3 failures)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failures).toBe(3);
    });

    it('should throw ClaudePrompterError when circuit is OPEN', async () => {
      const mockFn = jest.fn();
      
      // Trip the circuit
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(errorFn)).rejects.toThrow();
      }
      
      // Now circuit should be OPEN and block execution
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow(ClaudePrompterError);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('success handling', () => {
    it('should reset failure count on success in CLOSED state', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const successFn = jest.fn().mockResolvedValue('success');
      
      // Record some failures
      await expect(circuitBreaker.execute(errorFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(errorFn)).rejects.toThrow();
      
      let stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(2);
      
      // Success should reset failures
      await circuitBreaker.execute(successFn);
      
      stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(0);
    });
  });

  describe('half-open state', () => {
    beforeEach(async () => {
      // Trip the circuit to OPEN
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(errorFn)).rejects.toThrow();
      }
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Wait for timeout (mocked)
      jest.advanceTimersByTime(1100); // timeout is 1000ms
      
      const successFn = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      
      const stats = circuitBreaker.getStats();
      // After one success in HALF_OPEN, still need one more to close
      expect(stats.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after enough successes in HALF_OPEN', async () => {
      // Wait for timeout
      jest.advanceTimersByTime(1100);
      
      const successFn = jest.fn().mockResolvedValue('success');
      
      // Need 2 successes to close (successThreshold = 2)
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0); // Reset after closing
    });

    it('should reopen on failure in HALF_OPEN state', async () => {
      // Wait for timeout
      jest.advanceTimersByTime(1100);
      
      const errorFn = jest.fn().mockRejectedValue(new Error('Still failing'));
      
      // Failure in HALF_OPEN should immediately open the circuit
      await expect(circuitBreaker.execute(errorFn)).rejects.toThrow('Still failing');
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('manual operations', () => {
    it('should allow manual reset', () => {
      // Trip the circuit
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      return Promise.all([
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow(),
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow(),
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow()
      ]).then(() => {
        let stats = circuitBreaker.getStats();
        expect(stats.state).toBe(CircuitState.OPEN);
        
        // Manual reset
        circuitBreaker.manualReset();
        
        stats = circuitBreaker.getStats();
        expect(stats.state).toBe(CircuitState.CLOSED);
        expect(stats.failures).toBe(0);
      });
    });

    it('should provide status messages', () => {
      let status = circuitBreaker.getStatusMessage();
      expect(status).toContain('CLOSED');
      
      // Trip circuit
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      return Promise.all([
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow(),
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow(),
        expect(circuitBreaker.execute(errorFn)).rejects.toThrow()
      ]).then(() => {
        status = circuitBreaker.getStatusMessage();
        expect(status).toContain('OPEN');
      });
    });
  });

  describe('retryable vs non-retryable errors', () => {
    it('should not retry non-retryable ClaudePrompterError', async () => {
      const nonRetryableError = new ClaudePrompterError(
        ErrorCode.FILE_NOT_FOUND,
        'File not found',
        { isRetryable: false }
      );
      
      const mockFn = jest.fn().mockRejectedValue(nonRetryableError);
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toBe(nonRetryableError);
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('should handle retryable errors normally', async () => {
      const retryableError = new ClaudePrompterError(
        ErrorCode.API_RATE_LIMIT,
        'Rate limit',
        { isRetryable: true }
      );
      
      const mockFn = jest.fn().mockRejectedValue(retryableError);
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toBe(retryableError);
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    CircuitBreakerRegistry.resetAll();
  });

  afterEach(() => {
    // Clear registry after each test to prevent interference
    CircuitBreakerRegistry.resetAll();
  });

  it('should create new circuit breaker with default config', () => {
    const breaker = CircuitBreakerRegistry.getOrCreate('registry-test');
    expect(breaker).toBeInstanceOf(CircuitBreaker);
    
    const stats = breaker.getStats();
    expect(stats.state).toBe(CircuitState.CLOSED);
  });

  it('should create circuit breaker with custom config', () => {
    const config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 2000,
      monitoringPeriod: 10000
    };
    
    const breaker = CircuitBreakerRegistry.getOrCreate('test', config);
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('should return existing circuit breaker', () => {
    const breaker1 = CircuitBreakerRegistry.getOrCreate('test');
    const breaker2 = CircuitBreakerRegistry.getOrCreate('test');
    
    expect(breaker1).toBe(breaker2);
  });

  it('should get circuit breaker by name', () => {
    const breaker = CircuitBreakerRegistry.getOrCreate('test');
    const retrieved = CircuitBreakerRegistry.get('test');
    
    expect(retrieved).toBe(breaker);
  });

  it('should return undefined for non-existent circuit breaker', () => {
    const retrieved = CircuitBreakerRegistry.get('nonexistent');
    expect(retrieved).toBeUndefined();
  });

  it('should get all circuit breakers', () => {
    const initialSize = CircuitBreakerRegistry.getAll().size;
    
    CircuitBreakerRegistry.getOrCreate('registry-all-test1');
    CircuitBreakerRegistry.getOrCreate('registry-all-test2');
    
    const all = CircuitBreakerRegistry.getAll();
    expect(all.size).toBe(initialSize + 2);
    expect(all.has('registry-all-test1')).toBe(true);
    expect(all.has('registry-all-test2')).toBe(true);
  });

  it('should get all stats', () => {
    CircuitBreakerRegistry.getOrCreate('registry-stats-test1');
    CircuitBreakerRegistry.getOrCreate('registry-stats-test2');
    
    const allStats = CircuitBreakerRegistry.getAllStats();
    const statKeys = Object.keys(allStats);
    expect(statKeys).toContain('registry-stats-test1');
    expect(statKeys).toContain('registry-stats-test2');
    expect(allStats['registry-stats-test1'].state).toBe(CircuitState.CLOSED);
    expect(allStats['registry-stats-test2'].state).toBe(CircuitState.CLOSED);
  });

  it('should reset all circuit breakers', async () => {
    const breaker1 = CircuitBreakerRegistry.getOrCreate('registry-reset-test1');
    const breaker2 = CircuitBreakerRegistry.getOrCreate('registry-reset-test2');
    
    // Trip both circuits
    const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
    
    for (let i = 0; i < 5; i++) {
      await expect(breaker1.execute(errorFn)).rejects.toThrow();
      await expect(breaker2.execute(errorFn)).rejects.toThrow();
    }
    
    let stats1 = breaker1.getStats();
    let stats2 = breaker2.getStats();
    expect(stats1.state).toBe(CircuitState.OPEN);
    expect(stats2.state).toBe(CircuitState.OPEN);
    
    // Reset all
    CircuitBreakerRegistry.resetAll();
    
    stats1 = breaker1.getStats();
    stats2 = breaker2.getStats();
    expect(stats1.state).toBe(CircuitState.CLOSED);
    expect(stats2.state).toBe(CircuitState.CLOSED);
  });
});

// Set up fake timers for timeout testing
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});