/**
 * Local Model Engine (Ollama, llama.cpp, etc.)
 */

import { BaseEngine, EngineConfig, PromptRequest, EngineResponse } from './BaseEngine';

export interface LocalEngineConfig extends EngineConfig {
  endpoint: string; // Local endpoint URL
  format?: 'ollama' | 'llamacpp' | 'custom';
}

export class LocalEngine extends BaseEngine {
  private localConfig: LocalEngineConfig;

  constructor(config: Partial<LocalEngineConfig> & { endpoint: string }) {
    const fullConfig: LocalEngineConfig = {
      name: 'local',
      model: 'llama2',
      endpoint: config.endpoint,
      format: 'ollama',
      temperature: 0.7,
      maxTokens: 2048,
      timeout: 60000, // Local models might be slower
      ...config
    };
    
    super(fullConfig);
    this.localConfig = fullConfig;
  }

  async execute(request: PromptRequest): Promise<EngineResponse> {
    const startTime = new Date();
    this.validateConfig();

    try {
      const response = await this.callLocalModel(request);
      
      return {
        content: response.content,
        model: this.config.model,
        engine: this.config.name,
        timestamp: new Date(),
        executionTime: Date.now() - startTime.getTime(),
        tokenUsage: response.tokenUsage,
        metadata: {
          ...request.metadata,
          endpoint: this.localConfig.endpoint,
          format: this.localConfig.format,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        }
      };
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Unknown local model error',
        startTime
      );
    }
  }

  private async callLocalModel(request: PromptRequest): Promise<{
    content: string;
    tokenUsage?: { prompt: number; completion: number; total: number };
  }> {
    const format = this.localConfig.format || 'ollama';

    switch (format) {
      case 'ollama':
        return this.callOllama(request);
      case 'llamacpp':
        return this.callLlamaCpp(request);
      case 'custom':
        return this.callCustomEndpoint(request);
      default:
        throw new Error(`Unsupported local model format: ${format}`);
    }
  }

  private async callOllama(request: PromptRequest): Promise<{
    content: string;
    tokenUsage?: { prompt: number; completion: number; total: number };
  }> {
    const response = await fetch(`${this.localConfig.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: this.buildPrompt(request),
        temperature: this.config.temperature,
        options: {
          num_predict: this.config.maxTokens,
          temperature: this.config.temperature
        },
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      content: data.response,
      tokenUsage: data.prompt_eval_count && data.eval_count ? {
        prompt: data.prompt_eval_count,
        completion: data.eval_count,
        total: data.prompt_eval_count + data.eval_count
      } : undefined
    };
  }

  private async callLlamaCpp(request: PromptRequest): Promise<{
    content: string;
  }> {
    const response = await fetch(`${this.localConfig.endpoint}/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: this.buildPrompt(request),
        temperature: this.config.temperature,
        n_predict: this.config.maxTokens,
        stop: ["</s>", "\n\nUser:", "\n\nAssistant:"]
      })
    });

    if (!response.ok) {
      throw new Error(`llama.cpp API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      content: data.content
    };
  }

  private async callCustomEndpoint(request: PromptRequest): Promise<{
    content: string;
  }> {
    const response = await fetch(this.localConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: this.buildPrompt(request),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`Custom endpoint error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      content: data.response || data.content || data.text
    };
  }

  private buildPrompt(request: PromptRequest): string {
    if (request.systemPrompt) {
      return `System: ${request.systemPrompt}\n\nUser: ${request.prompt}\n\nAssistant:`;
    }
    return request.prompt;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const healthEndpoint = this.localConfig.format === 'ollama' 
        ? `${this.localConfig.endpoint}/api/tags`
        : this.localConfig.endpoint;
        
      const response = await fetch(healthEndpoint, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      maxTokens: this.config.maxTokens || 2048,
      supportsStreaming: this.localConfig.format === 'ollama',
      supportsSystemPrompts: true,
      costPerToken: 0 // Local models are "free" after setup
    };
  }
}