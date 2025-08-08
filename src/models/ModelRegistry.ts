/**
 * Model Registry for GPT-4 and GPT-5 families with A/B testing support
 */

export enum ModelFamily {
  GPT4 = 'gpt-4',
  GPT5 = 'gpt-5'
}

export enum ModelVariant {
  FLAGSHIP = 'flagship',
  MINI = 'mini',
  NANO = 'nano',
  TURBO = 'turbo'
}

export interface ModelCapabilities {
  maxTokens: number;
  contextWindow: number;
  reasoningLevel: 'basic' | 'advanced' | 'expert' | 'superhuman';
  speed: 'ultrafast' | 'fast' | 'medium' | 'slow';
  specializations: string[];
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;
}

export interface PricingTier {
  inputCostPer1K: number;  // Cost per 1K input tokens
  outputCostPer1K: number; // Cost per 1K output tokens
  batchDiscount?: number;   // Percentage discount for batch API
}

export interface PerformanceProfile {
  avgLatencyMs: number;
  p95LatencyMs: number;
  throughputRPS: number;
  reliability: number; // 0-1 score
}

export interface ModelConfig {
  id: string;
  name: string;
  family: ModelFamily;
  variant: ModelVariant;
  apiIdentifier: string; // The actual model string for API calls
  capabilities: ModelCapabilities;
  pricing: PricingTier;
  performance: PerformanceProfile;
  releaseDate: Date;
  deprecated?: boolean;
  recommendedFor: string[];
  notRecommendedFor?: string[];
}

export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, ModelConfig> = new Map();

  private constructor() {
    this.initializeModels();
  }

  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  private initializeModels() {
    // GPT-4 Family (existing)
    this.registerModel({
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      family: ModelFamily.GPT4,
      variant: ModelVariant.FLAGSHIP,
      apiIdentifier: 'gpt-4o',
      capabilities: {
        maxTokens: 4096,
        contextWindow: 128000,
        reasoningLevel: 'expert',
        speed: 'medium',
        specializations: ['code', 'analysis', 'creative', 'multimodal'],
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsStreaming: true
      },
      pricing: {
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.015
      },
      performance: {
        avgLatencyMs: 1200,
        p95LatencyMs: 3000,
        throughputRPS: 100,
        reliability: 0.99
      },
      releaseDate: new Date('2024-05-13'),
      recommendedFor: ['complex reasoning', 'code generation', 'multimodal tasks']
    });

    // GPT-5 Family (NEW!)
    this.registerModel({
      id: 'gpt-5',
      name: 'GPT-5 Flagship',
      family: ModelFamily.GPT5,
      variant: ModelVariant.FLAGSHIP,
      apiIdentifier: 'gpt-5',
      capabilities: {
        maxTokens: 8192,
        contextWindow: 256000,
        reasoningLevel: 'superhuman',
        speed: 'medium',
        specializations: ['reasoning', 'code', 'analysis', 'creative', 'multimodal', 'agents'],
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsStreaming: true
      },
      pricing: {
        inputCostPer1K: 0.008,
        outputCostPer1K: 0.024,
        batchDiscount: 0.5
      },
      performance: {
        avgLatencyMs: 1500,
        p95LatencyMs: 3500,
        throughputRPS: 80,
        reliability: 0.995
      },
      releaseDate: new Date('2025-01-08'),
      recommendedFor: ['complex reasoning', 'advanced code generation', 'research', 'long-context tasks', 'agent workflows']
    });

    this.registerModel({
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      family: ModelFamily.GPT5,
      variant: ModelVariant.MINI,
      apiIdentifier: 'gpt-5-mini',
      capabilities: {
        maxTokens: 4096,
        contextWindow: 128000,
        reasoningLevel: 'advanced',
        speed: 'fast',
        specializations: ['code', 'analysis', 'creative', 'chat'],
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsStreaming: true
      },
      pricing: {
        inputCostPer1K: 0.002,
        outputCostPer1K: 0.006,
        batchDiscount: 0.5
      },
      performance: {
        avgLatencyMs: 600,
        p95LatencyMs: 1500,
        throughputRPS: 200,
        reliability: 0.99
      },
      releaseDate: new Date('2025-01-08'),
      recommendedFor: ['general tasks', 'chat', 'code completion', 'cost-sensitive applications']
    });

    this.registerModel({
      id: 'gpt-5-nano',
      name: 'GPT-5 Nano',
      family: ModelFamily.GPT5,
      variant: ModelVariant.NANO,
      apiIdentifier: 'gpt-5-nano',
      capabilities: {
        maxTokens: 2048,
        contextWindow: 32000,
        reasoningLevel: 'basic',
        speed: 'ultrafast',
        specializations: ['chat', 'simple-tasks', 'classification'],
        supportsVision: false,
        supportsFunctionCalling: true,
        supportsStreaming: true
      },
      pricing: {
        inputCostPer1K: 0.0005,
        outputCostPer1K: 0.0015,
        batchDiscount: 0.5
      },
      performance: {
        avgLatencyMs: 200,
        p95LatencyMs: 500,
        throughputRPS: 500,
        reliability: 0.98
      },
      releaseDate: new Date('2025-01-08'),
      recommendedFor: ['simple tasks', 'high-volume processing', 'real-time applications'],
      notRecommendedFor: ['complex reasoning', 'long-form generation']
    });
  }

  registerModel(config: ModelConfig): void {
    this.models.set(config.id, config);
  }

  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id);
  }

  getAllModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getModelsByFamily(family: ModelFamily): ModelConfig[] {
    return this.getAllModels().filter(m => m.family === family);
  }

  getActiveModels(): ModelConfig[] {
    return this.getAllModels().filter(m => !m.deprecated);
  }

  getBestModelForTask(requirements: {
    taskType?: string;
    maxLatencyMs?: number;
    maxCostPer1K?: number;
    minReasoningLevel?: 'basic' | 'advanced' | 'expert' | 'superhuman';
    requiresVision?: boolean;
  }): ModelConfig | null {
    let candidates = this.getActiveModels();

    // Filter by requirements
    if (requirements.requiresVision) {
      candidates = candidates.filter(m => m.capabilities.supportsVision);
    }

    if (requirements.maxLatencyMs) {
      candidates = candidates.filter(m => m.performance.avgLatencyMs <= requirements.maxLatencyMs);
    }

    if (requirements.maxCostPer1K) {
      candidates = candidates.filter(m => 
        m.pricing.inputCostPer1K <= requirements.maxCostPer1K
      );
    }

    if (requirements.minReasoningLevel) {
      const levelOrder = ['basic', 'advanced', 'expert', 'superhuman'];
      const minLevel = levelOrder.indexOf(requirements.minReasoningLevel);
      candidates = candidates.filter(m => 
        levelOrder.indexOf(m.capabilities.reasoningLevel) >= minLevel
      );
    }

    if (requirements.taskType) {
      // Prioritize models recommended for this task
      candidates.sort((a, b) => {
        const aRecommended = a.recommendedFor.some(r => 
          r.toLowerCase().includes(requirements.taskType!.toLowerCase())
        );
        const bRecommended = b.recommendedFor.some(r => 
          r.toLowerCase().includes(requirements.taskType!.toLowerCase())
        );
        return (bRecommended ? 1 : 0) - (aRecommended ? 1 : 0);
      });
    }

    // Return best candidate (sorted by newest and most capable)
    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Get estimated cost for a request
   */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;

    const inputCost = (inputTokens / 1000) * model.pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * model.pricing.outputCostPer1K;
    return inputCost + outputCost;
  }
}

export const modelRegistry = ModelRegistry.getInstance();