/**
 * SUPER Intelligent Model Router with AI-Powered Analysis
 * Automatically selects optimal models based on prompt analysis and historical performance
 */

import { EngineConfig } from '../engines/BaseEngine';
import { PerformanceTracker } from '../metrics/PerformanceMetrics';
import { callOpenAI } from '../utils/openaiClient';

export interface PromptAnalysis {
  topics: string[];
  complexity: number; // 1-10 scale
  taskType: TaskType;
  urgency: 'low' | 'medium' | 'high';
  expectedResponseLength: 'short' | 'medium' | 'long';
  requiresCreativity: boolean;
  requiresAccuracy: boolean;
  technicalDepth: number; // 1-10 scale
  estimatedTokens: number;
}

export type TaskType = 
  | 'code-generation' 
  | 'code-review' 
  | 'architecture-design'
  | 'debugging'
  | 'documentation'
  | 'analysis'
  | 'creative-writing'
  | 'question-answering'
  | 'planning'
  | 'brainstorming'
  | 'data-processing'
  | 'general-chat';

export interface ModelSelection {
  engineName: string;
  model: string;
  confidence: number; // 0-1 scale
  reasoning: string[];
  estimatedCost: number;
  estimatedTime: number;
  estimatedQuality: number; // 1-10 scale
  priority: number; // 1 = highest priority
}

export interface UserPreferences {
  userId?: string;
  budgetLimit?: number;
  maxResponseTime?: number;
  minQualityScore?: number;
  preferredModels?: string[];
  avoidModels?: string[];
  costSensitivity: 'low' | 'medium' | 'high';
  speedSensitivity: 'low' | 'medium' | 'high';
  qualitySensitivity: 'low' | 'medium' | 'high';
}

export interface RoutingDecision {
  primaryModel: ModelSelection;
  backupModels: ModelSelection[];
  hybridStrategy?: {
    tryLocalFirst: boolean;
    fallbackToCloud: boolean;
    parallelExecution: boolean;
  };
  totalEstimatedCost: number;
  totalEstimatedTime: number;
  confidence: number;
  explanation: string[];
}

export class IntelligentRouter {
  private performanceTracker: PerformanceTracker;
  private availableEngines: Map<string, EngineConfig> = new Map();
  
  constructor(performanceTracker?: PerformanceTracker) {
    this.performanceTracker = performanceTracker || new PerformanceTracker();
  }

  /**
   * Register available engines for routing decisions
   */
  registerEngine(engineName: string, config: EngineConfig): void {
    this.availableEngines.set(engineName, config);
  }

  /**
   * Analyze prompt using AI-powered analysis
   */
  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    try {
      const analysisPrompt = this.createAnalysisPrompt(prompt);
      
      const response = await callOpenAI(
        analysisPrompt,
        'You are a precise prompt analyst. Return only valid JSON.',
        { command: 'intelligent-router-analysis' }
      );

      return this.parseAnalysisResponse(response, prompt);
      
    } catch (error) {
      console.warn('AI prompt analysis failed, using fallback analysis:', error);
      return this.fallbackAnalysis(prompt);
    }
  }

  /**
   * Select optimal models based on analysis and preferences
   */
  async selectOptimalModels(
    analysis: PromptAnalysis, 
    preferences: UserPreferences = { costSensitivity: 'medium', speedSensitivity: 'medium', qualitySensitivity: 'medium' },
    maxModels: number = 3
  ): Promise<RoutingDecision> {
    
    // Get historical performance data
    const historical = await this.getHistoricalPerformance(analysis);
    
    // Score all available engines
    const modelScores = await this.scoreAllModels(analysis, preferences, historical);
    
    // Select best models
    const selectedModels = modelScores
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxModels);

    const primary = selectedModels[0];
    const backups = selectedModels.slice(1);

    // Determine hybrid strategy
    const hybridStrategy = this.determineHybridStrategy(analysis, preferences, selectedModels);

    return {
      primaryModel: primary,
      backupModels: backups,
      hybridStrategy,
      totalEstimatedCost: selectedModels.reduce((sum, model) => sum + model.estimatedCost, 0),
      totalEstimatedTime: Math.max(...selectedModels.map(model => model.estimatedTime)),
      confidence: primary.confidence,
      explanation: this.generateExplanation(analysis, preferences, selectedModels, hybridStrategy)
    };
  }

  /**
   * Create AI analysis prompt
   */
  private createAnalysisPrompt(prompt: string): string {
    return `Analyze this prompt and return a JSON object with the following structure:

{
  "topics": ["topic1", "topic2", "topic3"],
  "complexity": <1-10>,
  "taskType": "<one of: code-generation, code-review, architecture-design, debugging, documentation, analysis, creative-writing, question-answering, planning, brainstorming, data-processing, general-chat>",
  "urgency": "<low/medium/high>",
  "expectedResponseLength": "<short/medium/long>",
  "requiresCreativity": <boolean>,
  "requiresAccuracy": <boolean>,
  "technicalDepth": <1-10>,
  "estimatedTokens": <number>
}

Analysis criteria:
- Complexity: 1=simple questions, 10=complex architecture/system design
- TaskType: Primary type of task requested
- Urgency: Based on language like "urgent", "asap", "when you have time"
- ResponseLength: short=<200 words, medium=200-800 words, long=>800 words
- RequiresCreativity: Whether creative/original thinking is needed
- RequiresAccuracy: Whether factual accuracy is critical
- TechnicalDepth: 1=non-technical, 10=deep technical expertise needed
- EstimatedTokens: Rough estimate of response tokens needed

Prompt to analyze:
"""
${prompt}
"""

Return only the JSON object:`;
  }

  /**
   * Parse AI analysis response
   */
  private parseAnalysisResponse(response: string, originalPrompt: string): PromptAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        topics: parsed.topics || [],
        complexity: Math.max(1, Math.min(10, parsed.complexity || 5)),
        taskType: parsed.taskType || 'general-chat',
        urgency: parsed.urgency || 'medium',
        expectedResponseLength: parsed.expectedResponseLength || 'medium',
        requiresCreativity: parsed.requiresCreativity || false,
        requiresAccuracy: parsed.requiresAccuracy || true,
        technicalDepth: Math.max(1, Math.min(10, parsed.technicalDepth || 5)),
        estimatedTokens: parsed.estimatedTokens || 300
      };
      
    } catch (error) {
      console.warn('Failed to parse AI analysis, using fallback:', error);
      return this.fallbackAnalysis(originalPrompt);
    }
  }

  /**
   * Fallback analysis when AI analysis fails
   */
  private fallbackAnalysis(prompt: string): PromptAnalysis {
    const words = prompt.split(/\s+/).length;
    
    // Basic keyword detection
    const codeKeywords = ['code', 'function', 'class', 'algorithm', 'implement', 'debug', 'bug', 'error'];
    const creativeKeywords = ['creative', 'write', 'story', 'brainstorm', 'generate', 'ideas'];
    const technicalKeywords = ['architecture', 'system', 'database', 'api', 'framework', 'design'];
    const urgencyKeywords = ['urgent', 'asap', 'quickly', 'fast', 'immediate'];

    const hasCodeKeywords = codeKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
    const hasCreativeKeywords = creativeKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
    const hasTechnicalKeywords = technicalKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
    const hasUrgencyKeywords = urgencyKeywords.some(keyword => prompt.toLowerCase().includes(keyword));

    return {
      topics: this.extractBasicTopics(prompt),
      complexity: Math.min(10, Math.max(1, Math.floor(words / 10) + (hasTechnicalKeywords ? 3 : 0))),
      taskType: hasCodeKeywords ? 'code-generation' : hasCreativeKeywords ? 'creative-writing' : 'question-answering',
      urgency: hasUrgencyKeywords ? 'high' : 'medium',
      expectedResponseLength: words > 50 ? 'long' : words > 20 ? 'medium' : 'short',
      requiresCreativity: hasCreativeKeywords,
      requiresAccuracy: !hasCreativeKeywords,
      technicalDepth: hasTechnicalKeywords ? 8 : hasCodeKeywords ? 6 : 3,
      estimatedTokens: Math.min(2000, Math.max(100, words * 3))
    };
  }

  /**
   * Extract basic topics from prompt
   */
  private extractBasicTopics(prompt: string): string[] {
    const words = prompt.toLowerCase().split(/\s+/);
    const topicKeywords = [
      'react', 'javascript', 'typescript', 'python', 'node', 'api', 'database',
      'architecture', 'design', 'testing', 'deployment', 'security', 'performance'
    ];
    
    return topicKeywords.filter(topic => 
      words.some(word => word.includes(topic))
    ).slice(0, 5);
  }

  /**
   * Get historical performance data for similar prompts
   */
  private async getHistoricalPerformance(_analysis: PromptAnalysis): Promise<Map<string, number>> {
    // Load historical metrics
    await this.performanceTracker.loadHistoricalMetrics();
    
    // Get performance summary for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const summary = this.performanceTracker.getPerformanceSummary({
      start: thirtyDaysAgo,
      end: new Date()
    });

    // Convert to map for easier lookup
    const performanceMap = new Map<string, number>();
    
    summary.topModels.forEach(model => {
      performanceMap.set(model.model, model.avgScore);
    });

    return performanceMap;
  }

  /**
   * Score all available models for the given analysis and preferences
   */
  private async scoreAllModels(
    analysis: PromptAnalysis,
    preferences: UserPreferences,
    historical: Map<string, number>
  ): Promise<ModelSelection[]> {
    
    const selections: ModelSelection[] = [];

    for (const [engineName, config] of this.availableEngines.entries()) {
      const selection = await this.scoreModel(engineName, config, analysis, preferences, historical);
      selections.push(selection);
    }

    return selections;
  }

  /**
   * Score a single model for the given analysis
   */
  private async scoreModel(
    engineName: string,
    config: EngineConfig,
    analysis: PromptAnalysis,
    preferences: UserPreferences,
    historical: Map<string, number>
  ): Promise<ModelSelection> {
    
    let score = 0;
    const reasoning: string[] = [];
    
    // Base model capabilities
    const modelCapabilities = this.getModelCapabilities(engineName, config.model);
    
    // Historical performance
    const historicalScore = historical.get(`${config.model} (${engineName})`) || 7;
    score += historicalScore * 0.3;
    reasoning.push(`Historical avg: ${historicalScore.toFixed(1)}/10`);

    // Task type matching
    const taskMatch = this.getTaskTypeMatch(analysis.taskType, modelCapabilities);
    score += taskMatch * 0.25;
    reasoning.push(`Task match: ${(taskMatch * 10).toFixed(1)}/10`);

    // Complexity handling
    const complexityMatch = this.getComplexityMatch(analysis.complexity, modelCapabilities);
    score += complexityMatch * 0.2;
    reasoning.push(`Complexity fit: ${(complexityMatch * 10).toFixed(1)}/10`);

    // Cost efficiency
    const estimatedCost = this.estimateModelCost(engineName, analysis.estimatedTokens);
    const costScore = this.getCostScore(estimatedCost, preferences.costSensitivity);
    score += costScore * 0.15;
    reasoning.push(`Cost efficiency: ${(costScore * 10).toFixed(1)}/10`);

    // Speed requirements
    const estimatedTime = this.estimateModelTime(engineName, analysis.estimatedTokens);
    const speedScore = this.getSpeedScore(estimatedTime, preferences.speedSensitivity);
    score += speedScore * 0.1;
    reasoning.push(`Speed score: ${(speedScore * 10).toFixed(1)}/10`);

    return {
      engineName,
      model: config.model,
      confidence: Math.min(1, score / 10),
      reasoning,
      estimatedCost,
      estimatedTime,
      estimatedQuality: score,
      priority: score
    };
  }

  /**
   * Get model capabilities
   */
  private getModelCapabilities(engineName: string, _model: string) {
    const capabilities = {
      codeGeneration: 7,
      creativity: 7,
      accuracy: 7,
      speed: 5,
      costEfficiency: 5,
      complexityHandling: 7
    };

    // Model-specific adjustments
    switch (engineName.toLowerCase()) {
      case 'gpt-4o':
        return { ...capabilities, accuracy: 10, complexityHandling: 10, costEfficiency: 3 };
      case 'gpt-4o-mini':
        return { ...capabilities, accuracy: 8, complexityHandling: 8, speed: 8, costEfficiency: 8 };
      case 'claude-sonnet':
        return { ...capabilities, accuracy: 9, creativity: 9, complexityHandling: 9, costEfficiency: 4 };
      case 'claude-haiku':
        return { ...capabilities, speed: 9, costEfficiency: 8, complexityHandling: 6 };
      case 'tinyllama':
      case 'local':
        return { ...capabilities, speed: 9, costEfficiency: 10, accuracy: 6, complexityHandling: 5 };
      default:
        return capabilities;
    }
  }

  /**
   * Get task type matching score
   */
  private getTaskTypeMatch(taskType: TaskType, capabilities: any): number {
    const taskRequirements = {
      'code-generation': { codeGeneration: 1.0, accuracy: 0.8 },
      'code-review': { accuracy: 1.0, codeGeneration: 0.8 },
      'architecture-design': { complexityHandling: 1.0, accuracy: 0.9 },
      'debugging': { accuracy: 1.0, codeGeneration: 0.7 },
      'creative-writing': { creativity: 1.0, accuracy: 0.6 },
      'analysis': { accuracy: 1.0, complexityHandling: 0.8 },
      'general-chat': { accuracy: 0.7, creativity: 0.6 }
    } as const;

    const requirements = taskRequirements[taskType] || { accuracy: 0.8 };
    
    let score = 0;
    for (const [req, weight] of Object.entries(requirements)) {
      score += (capabilities[req as keyof typeof capabilities] / 10) * (weight as number);
    }
    
    return score / Object.keys(requirements).length;
  }

  /**
   * Get complexity matching score
   */
  private getComplexityMatch(complexity: number, capabilities: any): number {
    const complexityThreshold = capabilities.complexityHandling;
    
    if (complexity <= complexityThreshold) {
      return 1.0; // Perfect match
    } else {
      // Penalize models that can't handle the complexity
      const overage = complexity - complexityThreshold;
      return Math.max(0.3, 1.0 - (overage * 0.15));
    }
  }

  /**
   * Estimate model cost
   */
  private estimateModelCost(engineName: string, estimatedTokens: number): number {
    const promptTokens = Math.ceil(estimatedTokens * 0.3);
    const completionTokens = Math.ceil(estimatedTokens * 0.7);
    
    switch (engineName.toLowerCase()) {
      case 'gpt-4o':
        return (promptTokens * 0.005 + completionTokens * 0.015) / 1000;
      case 'gpt-4o-mini':
        return (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;
      case 'claude-sonnet':
        return (promptTokens * 0.003 + completionTokens * 0.015) / 1000;
      case 'claude-haiku':
        return (promptTokens * 0.00025 + completionTokens * 0.00125) / 1000;
      case 'tinyllama':
      case 'local':
        return 0;
      default:
        return (promptTokens * 0.001 + completionTokens * 0.002) / 1000;
    }
  }

  /**
   * Estimate model response time
   */
  private estimateModelTime(engineName: string, estimatedTokens: number): number {
    const baseTime = {
      'gpt-4o': 15000,
      'gpt-4o-mini': 8000,
      'claude-sonnet': 10000,
      'claude-haiku': 5000,
      'tinyllama': 3000,
      'local': 3000
    } as const;

    const base = baseTime[engineName as keyof typeof baseTime] || 8000;
    return base + (estimatedTokens * 2); // Add time based on token complexity
  }

  /**
   * Get cost score based on cost sensitivity
   */
  private getCostScore(cost: number, sensitivity: 'low' | 'medium' | 'high'): number {
    const thresholds = {
      low: { good: 0.01, acceptable: 0.05 },
      medium: { good: 0.005, acceptable: 0.02 },
      high: { good: 0.001, acceptable: 0.01 }
    };

    const threshold = thresholds[sensitivity];
    
    if (cost <= threshold.good) return 1.0;
    if (cost <= threshold.acceptable) return 0.7;
    return Math.max(0.2, 1.0 - (cost - threshold.acceptable) * 20);
  }

  /**
   * Get speed score based on speed sensitivity
   */
  private getSpeedScore(time: number, sensitivity: 'low' | 'medium' | 'high'): number {
    const thresholds = {
      low: { good: 30000, acceptable: 60000 },
      medium: { good: 15000, acceptable: 30000 },
      high: { good: 5000, acceptable: 15000 }
    };

    const threshold = thresholds[sensitivity];
    
    if (time <= threshold.good) return 1.0;
    if (time <= threshold.acceptable) return 0.7;
    return Math.max(0.2, 1.0 - (time - threshold.acceptable) / 10000);
  }

  /**
   * Determine hybrid strategy
   */
  private determineHybridStrategy(
    analysis: PromptAnalysis,
    preferences: UserPreferences,
    selectedModels: ModelSelection[]
  ): { tryLocalFirst: boolean; fallbackToCloud: boolean; parallelExecution: boolean } | undefined {
    
    const hasLocalModel = selectedModels.some(m => m.engineName.includes('local') || m.engineName.includes('tinyllama'));
    const hasCloudModel = selectedModels.some(m => !m.engineName.includes('local') && !m.engineName.includes('tinyllama'));
    
    if (hasLocalModel && hasCloudModel) {
      return {
        tryLocalFirst: analysis.complexity <= 6 && preferences.costSensitivity !== 'low',
        fallbackToCloud: true,
        parallelExecution: analysis.urgency === 'high' || preferences.speedSensitivity === 'high'
      };
    }
    
    return undefined;
  }

  /**
   * Generate explanation for routing decision
   */
  private generateExplanation(
    analysis: PromptAnalysis,
    _preferences: UserPreferences,
    selectedModels: ModelSelection[],
    hybridStrategy?: { tryLocalFirst: boolean; fallbackToCloud: boolean; parallelExecution: boolean }
  ): string[] {
    
    const explanations: string[] = [];
    
    explanations.push(`Task: ${analysis.taskType} with complexity ${analysis.complexity}/10`);
    explanations.push(`Primary model: ${selectedModels[0].model} (confidence: ${(selectedModels[0].confidence * 100).toFixed(1)}%)`);
    
    if (hybridStrategy) {
      if (hybridStrategy.tryLocalFirst) {
        explanations.push('Strategy: Try local model first for cost efficiency');
      }
      if (hybridStrategy.parallelExecution) {
        explanations.push('Strategy: Parallel execution for faster results');
      }
    }
    
    explanations.push(`Estimated cost: $${selectedModels[0].estimatedCost.toFixed(4)}`);
    explanations.push(`Estimated time: ${(selectedModels[0].estimatedTime / 1000).toFixed(1)}s`);
    
    return explanations;
  }
}