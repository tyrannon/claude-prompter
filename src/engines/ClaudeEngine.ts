/**
 * Anthropic Claude Engine for multi-shot orchestration
 */

import { BaseEngine, EngineConfig, PromptRequest, EngineResponse } from './BaseEngine';

export class ClaudeEngine extends BaseEngine {
  constructor(config: Partial<EngineConfig> = {}) {
    super({
      name: 'claude',
      model: 'claude-3-sonnet-20240229',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 30000,
      ...config
    });
  }

  async execute(request: PromptRequest): Promise<EngineResponse> {
    const startTime = new Date();
    this.validateConfig();

    if (!process.env.ANTHROPIC_API_KEY && !this.config.apiKey) {
      return this.createErrorResponse('Anthropic API key not configured', startTime);
    }

    try {
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
      const response = await fetch(this.config.baseUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: request.systemPrompt || 'You are Claude, a helpful AI assistant.',
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      return {
        content: data.content[0].text,
        model: this.config.model,
        engine: this.config.name,
        timestamp: new Date(),
        executionTime: Date.now() - startTime.getTime(),
        tokenUsage: data.usage ? {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        metadata: {
          ...request.metadata,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          anthropicVersion: '2023-06-01'
        }
      };
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Unknown Claude error',
        startTime
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testRequest: PromptRequest = {
        prompt: 'Test connection',
        systemPrompt: 'Respond with "OK"'
      };
      const response = await this.execute(testRequest);
      return !response.error;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      maxTokens: 200000, // Claude 3 has large context window
      supportsStreaming: true,
      supportsSystemPrompts: true,
      costPerToken: 0.000015 // Approximate cost per token for Claude 3 Sonnet
    };
  }
}