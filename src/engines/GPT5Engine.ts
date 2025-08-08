/**
 * GPT-5 Family Engine with A/B Testing Support
 */

import { BaseEngine, EngineConfig, PromptRequest, EngineResponse } from './BaseEngine';
import { callOpenAI } from '../utils/openaiClient';
import { modelRegistry, ModelConfig } from '../models/ModelRegistry';
import { abTesting, TestResult } from '../models/ABTestingFramework';
import { Logger } from '../utils/logger';

const logger = new Logger('GPT5Engine');

export interface GPT5Config extends EngineConfig {
  modelVariant?: 'flagship' | 'mini' | 'nano';
  enableABTesting?: boolean;
  preferredModel?: string;
  fallbackModel?: string;
}

export class GPT5Engine extends BaseEngine {
  private modelConfig: ModelConfig;
  private enableABTesting: boolean;
  private testId?: string;

  constructor(config: Partial<GPT5Config> = {}) {
    // Determine which model to use
    let modelId = config.model || 'gpt-5-mini'; // Default to mini for balance
    
    if (config.modelVariant) {
      modelId = `gpt-5${config.modelVariant === 'flagship' ? '' : `-${config.modelVariant}`}`;
    }

    // Check if A/B testing should select the model
    if (config.enableABTesting) {
      const selection = abTesting.selectModel({
        preferredModel: config.preferredModel,
        taskType: config.name
      });
      modelId = selection.modelId;
      if (selection.testId) {
        logger.info(`A/B test active: selected ${modelId}`, { testId: selection.testId });
      }
    }

    const modelConfig = modelRegistry.getModel(modelId);
    if (!modelConfig) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    super({
      name: config.name || 'gpt5',
      model: modelConfig.apiIdentifier,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? modelConfig.capabilities.maxTokens,
      timeout: config.timeout ?? 30000,
      ...config
    });

    this.modelConfig = modelConfig;
    this.enableABTesting = config.enableABTesting ?? false;
  }

  async execute(request: PromptRequest): Promise<EngineResponse> {
    const startTime = new Date();
    this.validateConfig();

    if (!process.env.OPENAI_API_KEY && !this.config.apiKey) {
      return this.createErrorResponse('OpenAI API key not configured', startTime);
    }

    try {
      // Track request start for A/B testing
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Execute with selected model
      const response = await this.callWithModel(
        request,
        this.modelConfig,
        requestId
      );

      const executionTime = Date.now() - startTime.getTime();

      // Record A/B test result if testing is enabled
      if (this.enableABTesting) {
        await this.recordTestResult(requestId, executionTime, response, false);
      }

      return {
        content: response.content,
        model: this.modelConfig.apiIdentifier,
        engine: `${this.config.name} (${this.modelConfig.name})`,
        timestamp: new Date(),
        executionTime,
        tokenUsage: response.tokenUsage,
        metadata: {
          ...request.metadata,
          modelFamily: this.modelConfig.family,
          modelVariant: this.modelConfig.variant,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          testId: this.testId,
          estimatedCost: response.estimatedCost
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime.getTime();
      
      // Record failed test result
      if (this.enableABTesting) {
        await this.recordTestResult('error', executionTime, null, true);
      }

      // Try fallback model if available
      if (this.config.fallbackModel) {
        logger.warn(`Primary model failed, trying fallback: ${this.config.fallbackModel}`, { error });
        return this.executeWithFallback(request, startTime);
      }

      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Unknown GPT-5 error',
        startTime
      );
    }
  }

  private async callWithModel(
    request: PromptRequest,
    model: ModelConfig,
    requestId: string
  ): Promise<{
    content: string;
    tokenUsage?: { prompt: number; completion: number; total: number };
    estimatedCost?: number;
  }> {
    // Use the existing callOpenAI but override the model in the API call
    // This requires modifying the openaiClient to accept a model parameter
    // For now, we'll use the standard call and track the model separately
    
    const response = await callOpenAI(
      request.prompt,
      request.systemPrompt || this.getSystemPromptForModel(model),
      { 
        command: 'gpt5-engine',
        sessionId: requestId
      }
    );

    // Estimate token usage and cost
    const estimatedInputTokens = Math.ceil(request.prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(response.length / 4);
    const estimatedCost = modelRegistry.estimateCost(
      model.id,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    return {
      content: response,
      tokenUsage: {
        prompt: estimatedInputTokens,
        completion: estimatedOutputTokens,
        total: estimatedInputTokens + estimatedOutputTokens
      },
      estimatedCost
    };
  }

  private getSystemPromptForModel(model: ModelConfig): string {
    // Customize system prompt based on model capabilities
    const basePrompt = 'You are a helpful AI assistant.';
    
    if (model.capabilities.reasoningLevel === 'superhuman') {
      return `${basePrompt} You have advanced reasoning capabilities and can handle complex, multi-step problems with exceptional clarity and depth.`;
    } else if (model.capabilities.reasoningLevel === 'expert') {
      return `${basePrompt} You excel at complex reasoning, code generation, and analytical tasks.`;
    } else if (model.capabilities.reasoningLevel === 'advanced') {
      return `${basePrompt} You are optimized for efficient, high-quality responses across a wide range of tasks.`;
    } else {
      return `${basePrompt} You are optimized for quick, concise responses to straightforward queries.`;
    }
  }

  private async executeWithFallback(
    request: PromptRequest,
    startTime: Date
  ): Promise<EngineResponse> {
    try {
      const fallbackModel = modelRegistry.getModel(this.config.fallbackModel!);
      if (!fallbackModel) {
        throw new Error(`Fallback model ${this.config.fallbackModel} not found`);
      }

      const response = await this.callWithModel(
        request,
        fallbackModel,
        `fallback_${Date.now()}`
      );

      return {
        content: response.content,
        model: fallbackModel.apiIdentifier,
        engine: `${this.config.name} (${fallbackModel.name} - fallback)`,
        timestamp: new Date(),
        executionTime: Date.now() - startTime.getTime(),
        tokenUsage: response.tokenUsage,
        metadata: {
          ...request.metadata,
          modelFamily: fallbackModel.family,
          modelVariant: fallbackModel.variant,
          isFallback: true,
          estimatedCost: response.estimatedCost
        }
      };
    } catch (fallbackError) {
      return this.createErrorResponse(
        `Both primary and fallback models failed: ${fallbackError}`,
        startTime
      );
    }
  }

  private async recordTestResult(
    requestId: string,
    executionTime: number,
    response: any,
    errorOccurred: boolean
  ): Promise<void> {
    if (!this.testId) return;

    const result: TestResult = {
      modelId: this.modelConfig.id,
      requestId: `${this.testId}_${requestId}`,
      timestamp: new Date(),
      metrics: {
        responseTime: executionTime,
        tokenUsage: response?.tokenUsage || { input: 0, output: 0, total: 0 },
        cost: response?.estimatedCost || 0,
        errorOccurred
      }
    };

    await abTesting.recordResult(result);
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
      maxTokens: this.modelConfig.capabilities.maxTokens,
      supportsStreaming: this.modelConfig.capabilities.supportsStreaming,
      supportsSystemPrompts: true,
      supportsFunctionCalling: this.modelConfig.capabilities.supportsFunctionCalling,
      supportsVision: this.modelConfig.capabilities.supportsVision,
      costPerToken: (this.modelConfig.pricing.inputCostPer1K + this.modelConfig.pricing.outputCostPer1K) / 2000,
      reasoningLevel: this.modelConfig.capabilities.reasoningLevel,
      speed: this.modelConfig.capabilities.speed,
      specializations: this.modelConfig.capabilities.specializations
    };
  }

  /**
   * Static factory methods for convenience
   */
  static flagship(config?: Partial<GPT5Config>): GPT5Engine {
    return new GPT5Engine({ ...config, name: 'gpt-5-flagship', modelVariant: 'flagship' });
  }

  static mini(config?: Partial<GPT5Config>): GPT5Engine {
    return new GPT5Engine({ ...config, name: 'gpt-5-mini', modelVariant: 'mini' });
  }

  static nano(config?: Partial<GPT5Config>): GPT5Engine {
    return new GPT5Engine({ ...config, name: 'gpt-5-nano', modelVariant: 'nano' });
  }

  static withABTesting(config?: Partial<GPT5Config>): GPT5Engine {
    return new GPT5Engine({ ...config, name: 'gpt-5-ab', enableABTesting: true });
  }
}