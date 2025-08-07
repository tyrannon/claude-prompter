/**
 * Abstract base class for all AI model engines in the multi-shot orchestrator
 */

export interface EngineConfig {
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface PromptRequest {
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EngineResponse {
  content: string;
  model: string;
  engine: string;
  timestamp: Date;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  metadata?: Record<string, any>;
  executionTime: number;
  error?: string;
}

export abstract class BaseEngine {
  protected config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  /**
   * Execute a prompt request and return response
   */
  abstract execute(request: PromptRequest): Promise<EngineResponse>;

  /**
   * Test if the engine is available and configured correctly
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get engine capabilities and limitations
   */
  abstract getCapabilities(): {
    maxTokens: number;
    supportsStreaming: boolean;
    supportsSystemPrompts: boolean;
    costPerToken?: number;
  };

  /**
   * Validate configuration before execution
   */
  protected validateConfig(): void {
    if (!this.config.name || !this.config.model) {
      throw new Error('Engine configuration must include name and model');
    }
  }

  /**
   * Create standardized error response
   */
  protected createErrorResponse(error: string, startTime: Date): EngineResponse {
    return {
      content: '',
      model: this.config.model,
      engine: this.config.name,
      timestamp: new Date(),
      executionTime: Date.now() - startTime.getTime(),
      error
    };
  }

  /**
   * Get engine display name for CLI output
   */
  getDisplayName(): string {
    return `${this.config.name} (${this.config.model})`;
  }

  /**
   * Get engine configuration (sanitized)
   */
  getConfig(): Omit<EngineConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}