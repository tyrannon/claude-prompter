/**
 * A/B Testing Framework for Model Comparison
 */

// Import modelRegistry when needed
import { Logger } from '../utils/logger';

const logger = new Logger('ABTesting');

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  models: string[]; // Model IDs to test
  distribution: Map<string, number>; // Model ID -> percentage (0-100)
  startDate: Date;
  endDate?: Date;
  minSampleSize: number;
  active: boolean;
  criteria: TestCriteria;
}

export interface TestCriteria {
  primaryMetric: 'quality' | 'speed' | 'cost' | 'user_preference';
  secondaryMetrics?: string[];
  successThreshold?: number;
}

export interface TestResult {
  modelId: string;
  requestId: string;
  timestamp: Date;
  metrics: {
    responseTime: number;
    tokenUsage: {
      input: number;
      output: number;
      total: number;
    };
    cost: number;
    qualityScore?: number; // 0-100, from user feedback or automated eval
    userRating?: number; // 1-5 stars
    errorOccurred: boolean;
  };
  metadata?: Record<string, any>;
}

export interface TestAnalysis {
  testId: string;
  modelStats: Map<string, ModelStatistics>;
  winner?: string;
  confidence?: number;
  recommendations: string[];
}

export interface ModelStatistics {
  modelId: string;
  sampleSize: number;
  avgResponseTime: number;
  avgCost: number;
  avgQualityScore: number;
  successRate: number;
  p95ResponseTime: number;
  userPreference: number; // Percentage who preferred this model
}

export class ABTestingFramework {
  private static instance: ABTestingFramework;
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();

  private constructor() {
    this.loadActiveTests();
  }

  static getInstance(): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
    }
    return ABTestingFramework.instance;
  }

  /**
   * Create a new A/B test
   */
  createTest(config: Omit<ABTestConfig, 'id'>): ABTestConfig {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const test: ABTestConfig = {
      ...config,
      id: testId
    };

    // Validate distribution adds up to 100
    const totalPercentage = Array.from(test.distribution.values()).reduce((a, b) => a + b, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Test distribution must sum to 100%, got ${totalPercentage}%`);
    }

    this.activeTests.set(testId, test);
    this.saveActiveTests();
    
    logger.info(`Created A/B test: ${test.name}`, { testId, models: test.models });
    return test;
  }

  /**
   * Select a model based on active A/B tests
   */
  selectModel(context?: {
    taskType?: string;
    preferredModel?: string;
    excludeModels?: string[];
  }): { modelId: string; testId?: string } {
    // Check for active tests
    const activeTest = this.getActiveTestForContext(context);
    
    if (activeTest) {
      // Select based on distribution
      const modelId = this.selectByDistribution(activeTest);
      return { modelId, testId: activeTest.id };
    }

    // No active test, use preferred model or default
    if (context?.preferredModel) {
      return { modelId: context.preferredModel };
    }

    // Default to GPT-5 mini for cost-effectiveness
    return { modelId: 'gpt-5-mini' };
  }

  /**
   * Record test result
   */
  async recordResult(result: TestResult): Promise<void> {
    const testResults = this.testResults.get(result.modelId) || [];
    testResults.push(result);
    this.testResults.set(result.modelId, testResults);

    // TODO: Persist to database when available
    logger.debug('A/B test result recorded', { 
      modelId: result.modelId,
      timestamp: result.timestamp 
    });
  }

  /**
   * Analyze test results
   */
  analyzeTest(testId: string): TestAnalysis {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const modelStats = new Map<string, ModelStatistics>();

    for (const modelId of test.models) {
      const results = this.testResults.get(modelId) || [];
      const testResults = results.filter(r => r.requestId.includes(testId));

      if (testResults.length === 0) {
        continue;
      }

      const stats: ModelStatistics = {
        modelId,
        sampleSize: testResults.length,
        avgResponseTime: this.average(testResults.map(r => r.metrics.responseTime)),
        avgCost: this.average(testResults.map(r => r.metrics.cost)),
        avgQualityScore: this.average(testResults.map(r => r.metrics.qualityScore || 0)),
        successRate: testResults.filter(r => !r.metrics.errorOccurred).length / testResults.length,
        p95ResponseTime: this.percentile(testResults.map(r => r.metrics.responseTime), 95),
        userPreference: this.calculateUserPreference(modelId, testResults)
      };

      modelStats.set(modelId, stats);
    }

    // Determine winner based on primary metric
    const winner = this.determineWinner(modelStats, test.criteria);
    const confidence = this.calculateConfidence(modelStats);

    return {
      testId,
      modelStats,
      winner,
      confidence,
      recommendations: this.generateRecommendations(modelStats, test)
    };
  }

  /**
   * Get or create comparison test between models
   */
  getOrCreateComparisonTest(modelIds: string[]): ABTestConfig {
    // Check if test already exists
    for (const test of this.activeTests.values()) {
      if (test.active && 
          test.models.length === modelIds.length &&
          test.models.every(m => modelIds.includes(m))) {
        return test;
      }
    }

    // Create equal distribution test
    const distribution = new Map<string, number>();
    const percentage = 100 / modelIds.length;
    modelIds.forEach(id => distribution.set(id, percentage));

    return this.createTest({
      name: `Comparison: ${modelIds.join(' vs ')}`,
      description: `Automated comparison test between ${modelIds.join(', ')}`,
      models: modelIds,
      distribution,
      startDate: new Date(),
      minSampleSize: 100,
      active: true,
      criteria: {
        primaryMetric: 'quality',
        secondaryMetrics: ['speed', 'cost']
      }
    });
  }

  /**
   * Get active test for context
   */
  private getActiveTestForContext(context?: {
    taskType?: string;
    preferredModel?: string;
    excludeModels?: string[];
  }): ABTestConfig | null {
    for (const test of this.activeTests.values()) {
      if (!test.active) continue;
      
      // Check if test is still valid
      if (test.endDate && test.endDate < new Date()) {
        test.active = false;
        continue;
      }

      // Check if test includes valid models
      const validModels = test.models.filter(m => 
        !context?.excludeModels?.includes(m)
      );

      if (validModels.length > 0) {
        return test;
      }
    }

    return null;
  }

  /**
   * Select model based on distribution
   */
  private selectByDistribution(test: ABTestConfig): string {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const [modelId, percentage] of test.distribution) {
      cumulative += percentage;
      if (random <= cumulative) {
        return modelId;
      }
    }

    // Fallback to first model
    return test.models[0];
  }

  /**
   * Calculate statistics helpers
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateUserPreference(_modelId: string, results: TestResult[]): number {
    const rated = results.filter(r => r.metrics.userRating !== undefined);
    if (rated.length === 0) return 0;
    
    const avgRating = this.average(rated.map(r => r.metrics.userRating || 0));
    return (avgRating / 5) * 100; // Convert 1-5 rating to percentage
  }

  /**
   * Determine test winner
   */
  private determineWinner(stats: Map<string, ModelStatistics>, criteria: TestCriteria): string | undefined {
    const models = Array.from(stats.values());
    if (models.length === 0) return undefined;

    // Sort by primary metric
    switch (criteria.primaryMetric) {
      case 'quality':
        models.sort((a, b) => b.avgQualityScore - a.avgQualityScore);
        break;
      case 'speed':
        models.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
        break;
      case 'cost':
        models.sort((a, b) => a.avgCost - b.avgCost);
        break;
      case 'user_preference':
        models.sort((a, b) => b.userPreference - a.userPreference);
        break;
    }

    // Check if winner meets threshold
    if (criteria.successThreshold) {
      const winner = models[0];
      const metric = this.getMetricValue(winner, criteria.primaryMetric);
      if (metric >= criteria.successThreshold) {
        return winner.modelId;
      }
    }

    return models[0]?.modelId;
  }

  private getMetricValue(stats: ModelStatistics, metric: string): number {
    switch (metric) {
      case 'quality': return stats.avgQualityScore;
      case 'speed': return 100 - (stats.avgResponseTime / 10); // Convert to 0-100 scale
      case 'cost': return 100 - (stats.avgCost * 100); // Convert to 0-100 scale
      case 'user_preference': return stats.userPreference;
      default: return 0;
    }
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(stats: Map<string, ModelStatistics>): number {
    const models = Array.from(stats.values());
    if (models.length < 2) return 0;

    // Simple confidence based on sample size
    const minSampleSize = Math.min(...models.map(m => m.sampleSize));
    const confidence = Math.min(95, minSampleSize * 0.95); // Cap at 95%
    
    return confidence;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(stats: Map<string, ModelStatistics>, test: ABTestConfig): string[] {
    const recommendations: string[] = [];
    const models = Array.from(stats.values());

    // Check sample size
    const minSamples = Math.min(...models.map(m => m.sampleSize));
    if (minSamples < test.minSampleSize) {
      recommendations.push(`Continue testing: need ${test.minSampleSize - minSamples} more samples`);
    }

    // Find best model for each metric
    const bestQuality = models.reduce((a, b) => a.avgQualityScore > b.avgQualityScore ? a : b);
    const bestSpeed = models.reduce((a, b) => a.avgResponseTime < b.avgResponseTime ? a : b);
    const bestCost = models.reduce((a, b) => a.avgCost < b.avgCost ? a : b);

    recommendations.push(`Best quality: ${bestQuality.modelId} (${bestQuality.avgQualityScore.toFixed(1)}/100)`);
    recommendations.push(`Best speed: ${bestSpeed.modelId} (${bestSpeed.avgResponseTime.toFixed(0)}ms)`);
    recommendations.push(`Best value: ${bestCost.modelId} ($${bestCost.avgCost.toFixed(4)}/request)`);

    // Balanced recommendation
    const balanced = models.map(m => ({
      modelId: m.modelId,
      score: (m.avgQualityScore * 0.4) + ((100 - m.avgResponseTime/10) * 0.3) + ((100 - m.avgCost*100) * 0.3)
    })).sort((a, b) => b.score - a.score)[0];

    recommendations.push(`Best balanced: ${balanced.modelId}`);

    return recommendations;
  }

  /**
   * Persistence methods
   */
  private loadActiveTests(): void {
    // Load from database or file
    // For now, initialize with empty map
    this.activeTests = new Map();
  }

  private saveActiveTests(): void {
    // Save to database or file
    logger.debug('Saving active tests', { count: this.activeTests.size });
  }

  /**
   * Export test results for analysis
   */
  exportResults(testId: string): {
    test: ABTestConfig;
    results: TestResult[];
    analysis: TestAnalysis;
  } {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const results: TestResult[] = [];
    for (const modelId of test.models) {
      const modelResults = this.testResults.get(modelId) || [];
      results.push(...modelResults.filter(r => r.requestId.includes(testId)));
    }

    const analysis = this.analyzeTest(testId);

    return { test, results, analysis };
  }
}

export const abTesting = ABTestingFramework.getInstance();