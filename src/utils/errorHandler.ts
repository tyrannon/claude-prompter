import chalk from 'chalk';
import { Logger } from './logger';

export enum ErrorCode {
  // API Errors
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_SERVICE_UNAVAILABLE = 'API_SERVICE_UNAVAILABLE',
  
  // Batch Processing Errors
  BATCH_INVALID_FORMAT = 'BATCH_INVALID_FORMAT',
  BATCH_FILE_NOT_FOUND = 'BATCH_FILE_NOT_FOUND',
  BATCH_PROCESSING_FAILED = 'BATCH_PROCESSING_FAILED',
  BATCH_COST_LIMIT_EXCEEDED = 'BATCH_COST_LIMIT_EXCEEDED',
  
  // File System Errors
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  
  // Usage Tracking Errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TOKEN_COUNT_FAILED = 'TOKEN_COUNT_FAILED',
  
  // General Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class ClaudePrompterError extends Error {
  public readonly code: ErrorCode;
  public readonly isRetryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      isRetryable?: boolean;
      context?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ClaudePrompterError';
    this.code = code;
    this.isRetryable = options.isRetryable ?? false;
    this.context = options.context;
    this.timestamp = new Date();
    
    if (options.cause) {
      this.cause = options.cause;
    }
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, ClaudePrompterError);
  }

  /**
   * Creates a user-friendly error message for CLI display
   */
  toUserMessage(): string {
    const errorMessages: Record<ErrorCode, string> = {
      [ErrorCode.API_KEY_MISSING]: 'OpenAI API key is missing. Please add OPENAI_API_KEY to your .env file.',
      [ErrorCode.API_RATE_LIMIT]: 'API rate limit exceeded. Please wait a moment before retrying.',
      [ErrorCode.API_NETWORK_ERROR]: 'Network error occurred. Please check your internet connection.',
      [ErrorCode.API_AUTHENTICATION_FAILED]: 'API authentication failed. Please verify your API key.',
      [ErrorCode.API_QUOTA_EXCEEDED]: 'API quota exceeded. Please check your OpenAI account billing.',
      [ErrorCode.API_SERVICE_UNAVAILABLE]: 'OpenAI service is temporarily unavailable. Please try again later.',
      
      [ErrorCode.BATCH_INVALID_FORMAT]: 'Invalid batch file format. Please check the JSON structure.',
      [ErrorCode.BATCH_FILE_NOT_FOUND]: 'Batch file not found. Please verify the file path.',
      [ErrorCode.BATCH_PROCESSING_FAILED]: 'Batch processing failed. Check the logs for details.',
      [ErrorCode.BATCH_COST_LIMIT_EXCEEDED]: 'Batch processing would exceed cost limit. Increase limit or reduce batch size.',
      
      [ErrorCode.FILE_ACCESS_DENIED]: 'File access denied. Please check file permissions.',
      [ErrorCode.FILE_NOT_FOUND]: 'File not found. Please verify the file path.',
      [ErrorCode.FILE_WRITE_ERROR]: 'Failed to write file. Please check disk space and permissions.',
      [ErrorCode.INVALID_FILE_FORMAT]: 'Invalid file format. Please check the file structure.',
      
      [ErrorCode.USAGE_LIMIT_EXCEEDED]: 'Usage limit exceeded. Adjust your limits or wait until reset.',
      [ErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again.',
      [ErrorCode.TOKEN_COUNT_FAILED]: 'Failed to count tokens. Please try again.',
      
      [ErrorCode.VALIDATION_ERROR]: 'Input validation failed. Please check your parameters.',
      [ErrorCode.CONFIGURATION_ERROR]: 'Configuration error. Please check your settings.',
      [ErrorCode.INTERNAL_ERROR]: 'An internal error occurred. Please report this issue.'
    };

    return errorMessages[this.code] || this.message;
  }

  /**
   * Gets suggested actions for the user based on error code
   */
  getSuggestedActions(): string[] {
    const suggestions: Partial<Record<ErrorCode, string[]>> = {
      [ErrorCode.API_KEY_MISSING]: [
        'Add OPENAI_API_KEY=your-key-here to .env file',
        'Verify the .env file is in the project root',
        'Check if the API key is valid and active'
      ],
      [ErrorCode.API_RATE_LIMIT]: [
        'Wait 60 seconds before retrying',
        'Reduce --parallel option to limit concurrent requests',
        'Use --delay option to add delays between requests'
      ],
      [ErrorCode.API_QUOTA_EXCEEDED]: [
        'Check your OpenAI account billing and usage',
        'Upgrade your OpenAI plan if needed',
        'Set lower daily limits with: claude-prompter usage --limit <amount>'
      ],
      [ErrorCode.BATCH_COST_LIMIT_EXCEEDED]: [
        'Use --dry-run to estimate costs first',
        'Increase cost limit with --max-cost option',
        'Split large batches into smaller ones'
      ],
      [ErrorCode.FILE_NOT_FOUND]: [
        'Verify the file path is correct',
        'Use absolute paths for better reliability',
        'Check if the file exists with: ls -la <filepath>'
      ]
    };

    return suggestions[this.code] || ['Please check the error details and try again'];
  }
}

export class ErrorHandler {
  private static logger = new Logger('ErrorHandler');

  /**
   * Handles errors and provides user-friendly output
   */
  static handle(error: unknown): void {
    if (error instanceof ClaudePrompterError) {
      this.handleClaudePrompterError(error);
    } else if (error instanceof Error) {
      this.handleGenericError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  private static handleClaudePrompterError(error: ClaudePrompterError): void {
    this.logger.error('ClaudePrompter Error', {
      code: error.code,
      message: error.message,
      context: error.context,
      stack: error.stack,
      isRetryable: error.isRetryable
    });

    // Display user-friendly error
    console.error(chalk.red(`\n❌ Error: ${error.toUserMessage()}`));
    
    if (error.context) {
      console.error(chalk.gray('Context:'), JSON.stringify(error.context, null, 2));
    }

    // Show suggested actions
    const suggestions = error.getSuggestedActions();
    if (suggestions.length > 0) {
      console.error(chalk.yellow('\n💡 Suggested actions:'));
      suggestions.forEach(suggestion => {
        console.error(chalk.gray(`  • ${suggestion}`));
      });
    }

    // Show retry information for retryable errors
    if (error.isRetryable) {
      console.error(chalk.blue('\n🔄 This error is retryable. You can try the command again.'));
    }
  }

  private static handleGenericError(error: Error): void {
    this.logger.error('Generic Error', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (error.name === 'SyntaxError') {
      console.error(chalk.yellow('\n💡 This looks like a JSON parsing error. Please check your file format.'));
    }
  }

  private static handleUnknownError(error: unknown): void {
    this.logger.error('Unknown Error', { error: String(error) });
    console.error(chalk.red('\n❌ An unexpected error occurred:'), String(error));
    console.error(chalk.gray('Please report this issue with the full error details.'));
  }

  /**
   * Wraps a function with error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ClaudePrompterError && context) {
        // Add context to existing error (create new object since context is readonly)
        const newError = new ClaudePrompterError(
          error.code,
          error.message,
          {
            isRetryable: error.isRetryable,
            context: { ...error.context, ...context },
            cause: error.cause as Error
          }
        );
        throw newError;
      }
      throw error;
    }
  }
}

/**
 * Utility functions for creating common errors
 */
export const ErrorFactory = {
  apiKeyMissing(): ClaudePrompterError {
    return new ClaudePrompterError(
      ErrorCode.API_KEY_MISSING,
      'OpenAI API key is required but not found'
    );
  },

  apiRateLimit(retryAfter?: number): ClaudePrompterError {
    return new ClaudePrompterError(
      ErrorCode.API_RATE_LIMIT,
      'API rate limit exceeded',
      {
        isRetryable: true,
        context: { retryAfter }
      }
    );
  },

  fileNotFound(filePath: string): ClaudePrompterError {
    return new ClaudePrompterError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      {
        context: { filePath }
      }
    );
  },

  batchCostLimitExceeded(estimated: number, limit: number): ClaudePrompterError {
    return new ClaudePrompterError(
      ErrorCode.BATCH_COST_LIMIT_EXCEEDED,
      `Estimated cost $${estimated.toFixed(4)} exceeds limit $${limit.toFixed(2)}`,
      {
        context: { estimatedCost: estimated, costLimit: limit }
      }
    );
  },

  invalidBatchFormat(details: string): ClaudePrompterError {
    return new ClaudePrompterError(
      ErrorCode.BATCH_INVALID_FORMAT,
      `Invalid batch file format: ${details}`,
      {
        context: { details }
      }
    );
  }
};