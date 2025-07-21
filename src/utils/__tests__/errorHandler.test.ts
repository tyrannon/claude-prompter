import { ClaudePrompterError, ErrorCode, ErrorHandler, ErrorFactory } from '../errorHandler';

describe('ClaudePrompterError', () => {
  it('should create error with all properties', () => {
    const error = new ClaudePrompterError(
      ErrorCode.API_RATE_LIMIT,
      'Rate limit exceeded',
      {
        isRetryable: true,
        context: { retryAfter: 60 }
      }
    );

    expect(error.code).toBe(ErrorCode.API_RATE_LIMIT);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.isRetryable).toBe(true);
    expect(error.context).toEqual({ retryAfter: 60 });
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.name).toBe('ClaudePrompterError');
  });

  it('should default isRetryable to false', () => {
    const error = new ClaudePrompterError(ErrorCode.FILE_NOT_FOUND, 'File not found');
    expect(error.isRetryable).toBe(false);
  });

  it('should generate user-friendly messages', () => {
    const error = new ClaudePrompterError(ErrorCode.API_KEY_MISSING, 'API key missing');
    const userMessage = error.toUserMessage();
    expect(userMessage).toContain('OpenAI API key is missing');
    expect(userMessage).toContain('.env file');
  });

  it('should provide suggested actions for known error codes', () => {
    const error = new ClaudePrompterError(ErrorCode.API_RATE_LIMIT, 'Rate limit');
    const suggestions = error.getSuggestedActions();
    
    expect(suggestions).toContain('Wait 60 seconds before retrying');
    expect(suggestions).toContain('Reduce --parallel option to limit concurrent requests');
  });

  it('should provide default suggestions for unknown error codes', () => {
    const error = new ClaudePrompterError(ErrorCode.INTERNAL_ERROR, 'Internal error');
    const suggestions = error.getSuggestedActions();
    
    expect(suggestions).toContain('Please check the error details and try again');
  });
});

describe('ErrorFactory', () => {
  it('should create API key missing error', () => {
    const error = ErrorFactory.apiKeyMissing();
    
    expect(error.code).toBe(ErrorCode.API_KEY_MISSING);
    expect(error.isRetryable).toBe(false);
    expect(error.message).toContain('OpenAI API key');
  });

  it('should create rate limit error', () => {
    const error = ErrorFactory.apiRateLimit(120);
    
    expect(error.code).toBe(ErrorCode.API_RATE_LIMIT);
    expect(error.isRetryable).toBe(true);
    expect(error.context?.retryAfter).toBe(120);
  });

  it('should create file not found error with context', () => {
    const filePath = '/path/to/missing.json';
    const error = ErrorFactory.fileNotFound(filePath);
    
    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.context?.filePath).toBe(filePath);
    expect(error.message).toContain(filePath);
  });

  it('should create cost limit exceeded error with amounts', () => {
    const estimated = 15.50;
    const limit = 10.00;
    const error = ErrorFactory.batchCostLimitExceeded(estimated, limit);
    
    expect(error.code).toBe(ErrorCode.BATCH_COST_LIMIT_EXCEEDED);
    expect(error.context?.estimatedCost).toBe(estimated);
    expect(error.context?.costLimit).toBe(limit);
    expect(error.message).toContain('$15.50');
    expect(error.message).toContain('$10.00');
  });

  it('should create invalid batch format error', () => {
    const details = 'Missing message field';
    const error = ErrorFactory.invalidBatchFormat(details);
    
    expect(error.code).toBe(ErrorCode.BATCH_INVALID_FORMAT);
    expect(error.context?.details).toBe(details);
    expect(error.message).toContain(details);
  });
});

describe('ErrorHandler', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle ClaudePrompterError with user-friendly output', () => {
    const error = new ClaudePrompterError(
      ErrorCode.FILE_NOT_FOUND,
      'File not found',
      { context: { filePath: 'test.json' } }
    );

    ErrorHandler.handle(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Error: File not found. Please verify the file path.')
    );
  });

  it('should show suggested actions for retryable errors', () => {
    const error = new ClaudePrompterError(
      ErrorCode.API_RATE_LIMIT,
      'Rate limit exceeded',
      { isRetryable: true }
    );

    ErrorHandler.handle(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔄 This error is retryable')
    );
  });

  it('should handle generic Error instances', () => {
    const error = new Error('Generic error message');

    ErrorHandler.handle(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Error: Generic error message')
    );
  });

  it('should handle SyntaxError with helpful suggestion', () => {
    const error = new SyntaxError('Unexpected token in JSON');

    ErrorHandler.handle(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('JSON parsing error')
    );
  });

  it('should handle unknown error types', () => {
    const error = 'String error';

    ErrorHandler.handle(error);

    // Check that the error message contains the expected text somewhere in the calls
    const errorCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(errorCalls).toContain('❌ An unexpected error occurred');
  });

  it('should wrap functions with error handling', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await ErrorHandler.withErrorHandling(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should add context to ClaudePrompterError in withErrorHandling', async () => {
    const originalError = new ClaudePrompterError(
      ErrorCode.FILE_NOT_FOUND,
      'File not found',
      { context: { filePath: 'test.json' } }
    );

    const mockFn = jest.fn().mockRejectedValue(originalError);
    const additionalContext = { operation: 'test' };

    await expect(
      ErrorHandler.withErrorHandling(mockFn, additionalContext)
    ).rejects.toThrow(ClaudePrompterError);
  });

  it('should pass through non-ClaudePrompterError unchanged', async () => {
    const originalError = new Error('Generic error');
    const mockFn = jest.fn().mockRejectedValue(originalError);

    await expect(
      ErrorHandler.withErrorHandling(mockFn, { context: 'test' })
    ).rejects.toBe(originalError);
  });
});

describe('Error Code Coverage', () => {
  it('should have all error codes defined', () => {
    const errorCodes = Object.values(ErrorCode);
    expect(errorCodes.length).toBeGreaterThan(10);
    
    // Check that all error codes are strings
    errorCodes.forEach(code => {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it('should generate user messages for all error codes', () => {
    const errorCodes = Object.values(ErrorCode);
    
    errorCodes.forEach(code => {
      const error = new ClaudePrompterError(code, 'Test message');
      const userMessage = error.toUserMessage();
      
      expect(userMessage).toBeTruthy();
      expect(typeof userMessage).toBe('string');
      expect(userMessage.length).toBeGreaterThan(0);
    });
  });
});