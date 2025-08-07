/**
 * Performance Metrics Collection System for Multi-Shot Orchestration
 */

export interface ModelPerformance {
  modelName: string;
  engine: string;
  executionTime: number; // milliseconds
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number; // USD
  qualityScore?: number; // 1-10 scale
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface PerformanceMetrics {
  runId: string;
  timestamp: Date;
  prompt: string;
  models: ModelPerformance[];
  totalCost: number;
  totalTime: number;
  successRate: number; // 0-1
  averageQualityScore?: number;
  userFeedback?: UserFeedback;
  taskComplexity?: number; // 1-10 scale
  contextMetadata: {
    concurrent: boolean;
    maxConcurrency?: number;
    timeout: number;
    retries: number;
  };
}

export interface UserFeedback {
  runId: string;
  userId?: string;
  overallSatisfaction: number; // 1-5 scale
  bestModel?: string;
  worstModel?: string;
  comments?: string;
  timestamp: Date;
}

export interface QualityCriteria {
  accuracy: number; // 1-10
  relevance: number; // 1-10
  completeness: number; // 1-10
  clarity: number; // 1-10
  helpfulness: number; // 1-10
}

export interface PerformanceTrend {
  metric: string;
  period: 'hour' | 'day' | 'week' | 'month';
  trend: 'improving' | 'declining' | 'stable';
  changePercentage: number;
  dataPoints: Array<{ timestamp: Date; value: number }>;
}

export interface CostAnalysis {
  totalSpent: number;
  costByModel: Map<string, number>;
  avgCostPerRequest: number;
  costSavingsVsBaseline: number;
  projectedMonthlyCost: number;
  recommendations: string[];
}

export class PerformanceTracker {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private trends: Map<string, PerformanceTrend[]> = new Map();

  /**
   * Record performance metrics for a multi-shot run
   */
  recordRun(metrics: PerformanceMetrics): void {
    this.metrics.set(metrics.runId, metrics);
    this.updateTrends(metrics);
    
    // Persist to storage
    this.persistMetrics(metrics);
    
    console.log(`📊 Performance recorded: ${metrics.runId} (${metrics.models.length} models, ${metrics.totalTime}ms, $${metrics.totalCost.toFixed(4)})`);
  }

  /**
   * Get performance metrics for a specific run
   */
  getRunMetrics(runId: string): PerformanceMetrics | undefined {
    return this.metrics.get(runId);
  }

  /**
   * Get performance summary for a time period
   */
  getPerformanceSummary(timeRange: { start: Date; end: Date }): {
    totalRuns: number;
    totalCost: number;
    avgResponseTime: number;
    avgQualityScore: number;
    successRate: number;
    topModels: Array<{ model: string; usage: number; avgScore: number }>;
  } {
    const runsInRange = Array.from(this.metrics.values())
      .filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);

    if (runsInRange.length === 0) {
      return {
        totalRuns: 0,
        totalCost: 0,
        avgResponseTime: 0,
        avgQualityScore: 0,
        successRate: 0,
        topModels: []
      };
    }

    const totalCost = runsInRange.reduce((sum, m) => sum + m.totalCost, 0);
    const avgResponseTime = runsInRange.reduce((sum, m) => sum + m.totalTime, 0) / runsInRange.length;
    const avgQualityScore = runsInRange
      .filter(m => m.averageQualityScore !== undefined)
      .reduce((sum, m) => sum + m.averageQualityScore!, 0) / runsInRange.length || 0;
    
    const successfulRuns = runsInRange.filter(m => m.successRate > 0).length;
    const successRate = successfulRuns / runsInRange.length;

    // Calculate top models
    const modelStats = new Map<string, { usage: number; totalScore: number; count: number }>();
    
    for (const run of runsInRange) {
      for (const model of run.models) {
        const key = `${model.modelName} (${model.engine})`;
        const existing = modelStats.get(key) || { usage: 0, totalScore: 0, count: 0 };
        existing.usage++;
        if (model.qualityScore) {
          existing.totalScore += model.qualityScore;
          existing.count++;
        }
        modelStats.set(key, existing);
      }
    }

    const topModels = Array.from(modelStats.entries())
      .map(([model, stats]) => ({
        model,
        usage: stats.usage,
        avgScore: stats.count > 0 ? stats.totalScore / stats.count : 0
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);

    return {
      totalRuns: runsInRange.length,
      totalCost,
      avgResponseTime,
      avgQualityScore,
      successRate,
      topModels
    };
  }

  /**
   * Analyze cost efficiency across models
   */
  analyzeCostEfficiency(timeRange?: { start: Date; end: Date }): CostAnalysis {
    let runs = Array.from(this.metrics.values());
    
    if (timeRange) {
      runs = runs.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
    }

    if (runs.length === 0) {
      return {
        totalSpent: 0,
        costByModel: new Map(),
        avgCostPerRequest: 0,
        costSavingsVsBaseline: 0,
        projectedMonthlyCost: 0,
        recommendations: ['No data available for analysis']
      };
    }

    const totalSpent = runs.reduce((sum, run) => sum + run.totalCost, 0);
    const costByModel = new Map<string, number>();
    
    for (const run of runs) {
      for (const model of run.models) {
        const key = `${model.modelName} (${model.engine})`;
        const existing = costByModel.get(key) || 0;
        costByModel.set(key, existing + model.cost);
      }
    }

    const avgCostPerRequest = totalSpent / runs.length;
    
    // Calculate baseline cost (if all requests used GPT-4o)
    const gpt4oCostEstimate = runs.length * 0.008; // Estimated GPT-4o cost
    const costSavingsVsBaseline = Math.max(0, gpt4oCostEstimate - totalSpent);
    
    // Project monthly cost based on current usage
    const daysOfData = Math.max(1, (Date.now() - runs[0].timestamp.getTime()) / (1000 * 60 * 60 * 24));
    const projectedMonthlyCost = (totalSpent / daysOfData) * 30;

    // Generate recommendations
    const recommendations: string[] = [];
    const localModelCost = Array.from(costByModel.entries())
      .filter(([model]) => model.includes('tinyllama') || model.includes('local'))
      .reduce((sum, [_, cost]) => sum + cost, 0);
    
    const cloudModelCost = totalSpent - localModelCost;
    
    if (cloudModelCost > localModelCost * 5) {
      recommendations.push('Consider using local models more frequently for simple tasks');
    }
    
    if (avgCostPerRequest > 0.01) {
      recommendations.push('Average cost per request is high - review model selection strategy');
    }
    
    if (costSavingsVsBaseline > 0) {
      recommendations.push(`Great! You're saving $${costSavingsVsBaseline.toFixed(4)} vs baseline GPT-4o usage`);
    }

    return {
      totalSpent,
      costByModel,
      avgCostPerRequest,
      costSavingsVsBaseline,
      projectedMonthlyCost,
      recommendations
    };
  }

  /**
   * Get performance trends for specific metrics
   */
  getTrends(metric: 'cost' | 'responseTime' | 'qualityScore' | 'successRate', period: 'day' | 'week' = 'day'): PerformanceTrend | undefined {
    const trends = this.trends.get(metric);
    return trends?.find(t => t.period === period);
  }

  /**
   * Record user feedback for a run
   */
  recordUserFeedback(feedback: UserFeedback): void {
    const metrics = this.metrics.get(feedback.runId);
    if (metrics) {
      metrics.userFeedback = feedback;
      this.persistMetrics(metrics);
      console.log(`👤 User feedback recorded for ${feedback.runId}: ${feedback.overallSatisfaction}/5`);
    }
  }

  /**
   * Get quality insights and recommendations
   */
  getQualityInsights(): {
    avgQualityByModel: Map<string, number>;
    qualityTrends: PerformanceTrend[];
    recommendations: string[];
  } {
    const runs = Array.from(this.metrics.values());
    const modelQuality = new Map<string, { total: number; count: number }>();

    for (const run of runs) {
      for (const model of run.models) {
        if (model.qualityScore) {
          const key = `${model.modelName} (${model.engine})`;
          const existing = modelQuality.get(key) || { total: 0, count: 0 };
          existing.total += model.qualityScore;
          existing.count++;
          modelQuality.set(key, existing);
        }
      }
    }

    const avgQualityByModel = new Map<string, number>();
    for (const [model, stats] of modelQuality.entries()) {
      avgQualityByModel.set(model, stats.total / stats.count);
    }

    const qualityTrends = this.trends.get('qualityScore') || [];
    
    const recommendations: string[] = [];
    const sortedModels = Array.from(avgQualityByModel.entries())
      .sort(([, a], [, b]) => b - a);
    
    if (sortedModels.length > 0) {
      const [bestModel, bestScore] = sortedModels[0];
      const [worstModel, worstScore] = sortedModels[sortedModels.length - 1];
      
      if (bestScore - worstScore > 2) {
        recommendations.push(`Consider using ${bestModel} more often (avg quality: ${bestScore.toFixed(1)})`);
      }
      
      if (worstScore < 6) {
        recommendations.push(`${worstModel} shows low quality scores (avg: ${worstScore.toFixed(1)}) - review its usage`);
      }
    }

    return {
      avgQualityByModel,
      qualityTrends,
      recommendations
    };
  }

  /**
   * Update performance trends
   */
  private updateTrends(metrics: PerformanceMetrics): void {
    // Update cost trend
    this.updateMetricTrend('cost', metrics.timestamp, metrics.totalCost);
    
    // Update response time trend
    this.updateMetricTrend('responseTime', metrics.timestamp, metrics.totalTime);
    
    // Update quality score trend
    if (metrics.averageQualityScore) {
      this.updateMetricTrend('qualityScore', metrics.timestamp, metrics.averageQualityScore);
    }
    
    // Update success rate trend
    this.updateMetricTrend('successRate', metrics.timestamp, metrics.successRate);
  }

  private updateMetricTrend(metric: string, timestamp: Date, value: number): void {
    const trends = this.trends.get(metric) || [];
    
    // Find or create daily trend
    let dailyTrend = trends.find(t => t.period === 'day');
    if (!dailyTrend) {
      dailyTrend = {
        metric,
        period: 'day',
        trend: 'stable',
        changePercentage: 0,
        dataPoints: []
      };
      trends.push(dailyTrend);
    }

    // Add data point
    dailyTrend.dataPoints.push({ timestamp, value });
    
    // Keep only last 24 hours for daily trend
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    dailyTrend.dataPoints = dailyTrend.dataPoints
      .filter(p => p.timestamp >= dayAgo)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate trend
    if (dailyTrend.dataPoints.length >= 2) {
      const first = dailyTrend.dataPoints[0].value;
      const last = dailyTrend.dataPoints[dailyTrend.dataPoints.length - 1].value;
      const changePercentage = ((last - first) / first) * 100;
      
      dailyTrend.changePercentage = changePercentage;
      
      if (Math.abs(changePercentage) < 5) {
        dailyTrend.trend = 'stable';
      } else if (changePercentage > 0) {
        dailyTrend.trend = metric === 'cost' ? 'declining' : 'improving'; // Cost increase is bad
      } else {
        dailyTrend.trend = metric === 'cost' ? 'improving' : 'declining'; // Cost decrease is good
      }
    }

    this.trends.set(metric, trends);
  }

  /**
   * Persist metrics to storage
   */
  private async persistMetrics(metrics: PerformanceMetrics): Promise<void> {
    // In a real implementation, this would save to a database
    // For now, we'll use the file system
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const metricsDir = path.join(process.cwd(), '.claude-prompter', 'metrics');
    
    try {
      await fs.mkdir(metricsDir, { recursive: true });
      
      const filename = `${metrics.runId}.json`;
      const filepath = path.join(metricsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.warn(`Failed to persist metrics for ${metrics.runId}:`, error);
    }
  }

  /**
   * Load historical metrics from storage
   */
  async loadHistoricalMetrics(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const metricsDir = path.join(process.cwd(), '.claude-prompter', 'metrics');
    
    try {
      const files = await fs.readdir(metricsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filepath = path.join(metricsDir, file);
          const content = await fs.readFile(filepath, 'utf8');
          const metrics: PerformanceMetrics = JSON.parse(content);
          
          // Ensure timestamp is a Date object
          if (typeof metrics.timestamp === 'string') {
            metrics.timestamp = new Date(metrics.timestamp);
          }
          
          // Ensure model timestamps are Date objects
          metrics.models.forEach(model => {
            if (typeof model.timestamp === 'string') {
              model.timestamp = new Date(model.timestamp);
            }
          });
          
          this.metrics.set(metrics.runId, metrics);
          this.updateTrends(metrics);
        } catch (error) {
          console.warn(`Failed to load metrics from ${file}:`, error);
        }
      }
      
      console.log(`📊 Loaded ${this.metrics.size} historical metrics`);
    } catch (error) {
      // Directory doesn't exist yet, that's ok
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = Array.from(this.metrics.values());
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV format
      const headers = ['runId', 'timestamp', 'totalCost', 'totalTime', 'successRate', 'averageQualityScore', 'modelCount'];
      const rows = data.map(m => [
        m.runId,
        m.timestamp.toISOString(),
        m.totalCost,
        m.totalTime,
        m.successRate,
        m.averageQualityScore || 0,
        m.models.length
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }
}