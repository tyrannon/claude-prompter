/**
 * OpenAI GPT Engine - refactored from existing openaiClient
 */

import { BaseEngine, EngineConfig, PromptRequest, EngineResponse } from './BaseEngine';
import { callOpenAI } from '../utils/openaiClient';

export class GPTEngine extends BaseEngine {
  constructor(config: Partial<EngineConfig> = {}) {
    super({
      name: 'gpt',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000,
      ...config
    });
  }

  async execute(request: PromptRequest): Promise<EngineResponse> {
    const startTime = new Date();
    this.validateConfig();

    if (!process.env.OPENAI_API_KEY && !this.config.apiKey) {
      return this.createErrorResponse('OpenAI API key not configured', startTime);
    }

    try {
      const response = await callOpenAI(
        request.prompt,
        request.systemPrompt || 'You are a helpful AI assistant.',
        { command: 'multi-shot' }
      );

      return {
        content: response,
        model: this.config.model,
        engine: this.config.name,
        timestamp: new Date(),
        executionTime: Date.now() - startTime.getTime(),
        metadata: {
          ...request.metadata,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        }
      };
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Unknown OpenAI error',
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
      maxTokens: 128000,
      supportsStreaming: true,
      supportsSystemPrompts: true,
      costPerToken: 0.00003 // Approximate cost per token for GPT-4o
    };
  }
}