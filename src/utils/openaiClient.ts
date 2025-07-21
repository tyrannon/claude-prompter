import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import { TokenCounter } from './tokenCounter';
import { DatabaseManager } from '../data/DatabaseManager';
import { ClaudePrompterError, ErrorCode, ErrorHandler, ErrorFactory } from './errorHandler';
import { CircuitBreakerRegistry } from './circuitBreaker';
import { Logger } from './logger';

// Load environment variables
dotenv.config();

// Initialize services
const tokenCounter = new TokenCounter();
const dbManager = new DatabaseManager();
const logger = new Logger('OpenAIClient');
const circuitBreaker = CircuitBreakerRegistry.getOrCreate('openai', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  monitoringPeriod: 300000 // 5 minutes
});

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Legacy OpenAIError class - deprecated, use ClaudePrompterError instead
export class OpenAIError extends Error {
  constructor(public statusCode: number, public statusText: string, public details?: any) {
    super(`OpenAI API Error (${statusCode}): ${statusText}`);
    this.name = 'OpenAIError';
  }
}

/**
 * Parse OpenAI API error and convert to ClaudePrompterError
 */
function parseOpenAIError(statusCode: number, statusText: string, responseBody: any): ClaudePrompterError {
  logger.debug('Parsing OpenAI API error', {
    statusCode,
    statusText,
    responseBody
  });

  // Determine error code based on HTTP status
  let errorCode: ErrorCode;
  let isRetryable = false;

  switch (statusCode) {
    case 401:
      errorCode = ErrorCode.API_AUTHENTICATION_FAILED;
      break;
    case 429:
      errorCode = ErrorCode.API_RATE_LIMIT;
      isRetryable = true;
      break;
    case 402:
      errorCode = ErrorCode.API_QUOTA_EXCEEDED;
      break;
    case 503:
    case 502:
    case 504:
      errorCode = ErrorCode.API_SERVICE_UNAVAILABLE;
      isRetryable = true;
      break;
    default:
      if (statusCode >= 500) {
        errorCode = ErrorCode.API_SERVICE_UNAVAILABLE;
        isRetryable = true;
      } else {
        errorCode = ErrorCode.API_NETWORK_ERROR;
      }
  }

  // Extract retry-after header if available
  const retryAfter = responseBody?.headers?.['retry-after'];

  return new ClaudePrompterError(
    errorCode,
    `OpenAI API error: ${statusText}`,
    {
      isRetryable,
      context: {
        statusCode,
        statusText,
        retryAfter,
        details: responseBody
      }
    }
  );
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a retryable error
      if (error instanceof ClaudePrompterError && !error.isRetryable) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      
      logger.info(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error)
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Helper function to record failed API usage
 */
async function recordFailedUsage(
  options: { command?: string; batchId?: string; sessionId?: string },
  inputTokens: number,
  startTime: number,
  errorMessage: string
): Promise<void> {
  try {
    await dbManager.recordUsage({
      command: options.command || 'prompt',
      inputTokens,
      outputTokens: 0,
      success: false,
      errorMessage,
      durationMs: Date.now() - startTime,
      batchId: options.batchId,
      sessionId: options.sessionId
    });
  } catch (dbError) {
    // Don't let database errors prevent error reporting
    logger.warn('Failed to record usage in database', { error: dbError });
  }
}

/**
 * Call OpenAI's GPT-4o model with a prompt
 * @param prompt The user prompt to send
 * @param systemPrompt Optional system prompt for context
 * @param options Additional options like command name for tracking
 * @returns The assistant's response text
 */
export async function callOpenAI(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  options: { command?: string; batchId?: string; sessionId?: string } = {}
): Promise<string> {
  return ErrorHandler.withErrorHandling(async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw ErrorFactory.apiKeyMissing();
    }

    return circuitBreaker.execute(async () => {
      return withRetry(async () => {
        return await callOpenAIInternal(prompt, systemPrompt, options);
      }, 2, 1000);
    });
  }, { command: options.command, batchId: options.batchId });
}

/**
 * Internal OpenAI API call with error handling
 */
async function callOpenAIInternal(
  prompt: string,
  systemPrompt: string,
  options: { command?: string; batchId?: string; sessionId?: string }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  // Count input tokens and validate
  const inputTokens = tokenCounter.countChatTokens(messages);
  const startTime = Date.now();

  // Validate message sizes
  if (inputTokens > 90000) { // Leave room for response
    throw new ClaudePrompterError(
      ErrorCode.VALIDATION_ERROR,
      'Input too large. Please reduce the prompt size.',
      {
        context: { inputTokens, maxTokens: 90000 }
      }
    );
  }

  const payload = {
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 4000,
  };

  logger.debug('Making OpenAI API request', {
    inputTokens,
    command: options.command,
    batchId: options.batchId
  });

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload)
      // Note: node-fetch doesn't support timeout option directly
    });
  } catch (error) {
    // Handle network errors
    const networkError = new ClaudePrompterError(
      ErrorCode.API_NETWORK_ERROR,
      'Network error occurred while calling OpenAI API',
      {
        isRetryable: true,
        context: { originalError: error instanceof Error ? error.message : String(error) }
      }
    );

    await recordFailedUsage(options, inputTokens, startTime, networkError.message);
    throw networkError;
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    
    const apiError = parseOpenAIError(response.status, response.statusText, errorData);
    
    // Record failed usage
    await recordFailedUsage(options, inputTokens, startTime, apiError.message);
    
    throw apiError;
  }

  let data: OpenAIResponse;
  try {
    data = (await response.json()) as OpenAIResponse;
  } catch (error) {
    const parseError = new ClaudePrompterError(
      ErrorCode.API_NETWORK_ERROR,
      'Failed to parse OpenAI API response',
      {
        isRetryable: true,
        context: { parseError: error instanceof Error ? error.message : String(error) }
      }
    );
    
    await recordFailedUsage(options, inputTokens, startTime, parseError.message);
    throw parseError;
  }
  
  // Extract the assistant's response
  const assistantMessage = data.choices[0]?.message?.content;
  
  if (!assistantMessage) {
    const noContentError = new ClaudePrompterError(
      ErrorCode.API_SERVICE_UNAVAILABLE,
      'No response content received from OpenAI',
      {
        isRetryable: true,
        context: { response: data }
      }
    );
    
    await recordFailedUsage(options, inputTokens, startTime, noContentError.message);
    throw noContentError;
  }

  // Count output tokens and record usage
  const outputTokens = tokenCounter.count(assistantMessage);
  const actualTokens = data.usage || { 
    prompt_tokens: inputTokens, 
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens
  };
  
  try {
    await dbManager.recordUsage({
      command: options.command || 'prompt',
      inputTokens: actualTokens.prompt_tokens,
      outputTokens: actualTokens.completion_tokens,
      success: true,
      durationMs: Date.now() - startTime,
      batchId: options.batchId,
      sessionId: options.sessionId,
      metadata: {
        model: data.model,
        finishReason: data.choices[0]?.finish_reason
      }
    });
  } catch (dbError) {
    // Log but don't fail the request for database errors
    logger.warn('Failed to record successful usage in database', { error: dbError });
  }

  // Log token usage summary
  console.log(`\n💰 ${tokenCounter.getSummary(actualTokens.prompt_tokens, actualTokens.completion_tokens)}`);

  logger.debug('OpenAI API call completed successfully', {
    inputTokens: actualTokens.prompt_tokens,
    outputTokens: actualTokens.completion_tokens,
    duration: Date.now() - startTime
  });

  return assistantMessage.trim();
}

/**
 * Call OpenAI with streaming support (returns an async iterator)
 */
export async function* callOpenAIStream(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.'
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const payload = {
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 4000,
    stream: true,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new OpenAIError(response.status, response.statusText, errorData);
  }

  if (!response.body) throw new Error('No response body');
  
  // Convert node-fetch response to readable stream
  const stream = Readable.from(response.body as any);
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore parsing errors for incomplete chunks
        }
      }
    }
  }
}

/**
 * Stream OpenAI responses with a callback function
 */
export async function streamOpenAI(
  messages: Array<{role: string; content: string}>,
  onChunk: (chunk: string) => void,
  options: {
    temperature?: number;
    max_tokens?: number;
    command?: string;
    batchId?: string;
    sessionId?: string;
  } = {}
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  // Count input tokens
  const inputTokens = tokenCounter.countChatTokens(messages as OpenAIMessage[]);
  const startTime = Date.now();
  let fullResponse = '';

  const payload = {
    model: 'gpt-4o',
    messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 4000,
    stream: true,
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch {
        parsedError = errorData;
      }
      
      // Record failed usage
      await dbManager.recordUsage({
        command: options.command || 'chat',
        inputTokens,
        outputTokens: 0,
        success: false,
        errorMessage: `${response.status}: ${response.statusText}`,
        durationMs: Date.now() - startTime,
        batchId: options.batchId,
        sessionId: options.sessionId
      });
      
      throw new OpenAIError(response.status, response.statusText, parsedError);
    }

    if (!response.body) throw new Error('No response body');
    
    // Convert node-fetch response to readable stream
    const stream = Readable.from(response.body as any);
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            // Record successful usage
            const outputTokens = tokenCounter.count(fullResponse);
            await dbManager.recordUsage({
              command: options.command || 'chat',
              inputTokens,
              outputTokens,
              success: true,
              durationMs: Date.now() - startTime,
              batchId: options.batchId,
              sessionId: options.sessionId,
              metadata: {
                model: 'gpt-4o',
                stream: true
              }
            });
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              onChunk(content);
            }
          } catch {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof OpenAIError) {
      throw error;
    }
    
    // Record error if not already recorded
    if (!(error instanceof Error && error.message?.includes('OpenAI API Error'))) {
      await dbManager.recordUsage({
        command: options.command || 'chat',
        inputTokens,
        outputTokens: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
        batchId: options.batchId,
        sessionId: options.sessionId
      });
    }
    
    throw new Error(`Failed to stream from OpenAI API: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}