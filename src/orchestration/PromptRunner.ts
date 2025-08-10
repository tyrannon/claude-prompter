/**
 * Multi-shot prompt execution engine with parallel and sequential support
 */

import { BaseEngine, PromptRequest, EngineResponse } from '../engines/BaseEngine';
import { OutputManager, OutputConfig, OutputResult } from './OutputManager';
import { Semaphore } from '../utils/Semaphore';
import { PerformanceTracker, PerformanceMetrics, ModelPerformance } from '../metrics/PerformanceMetrics';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface RunConfig {
  engines: Map<string, BaseEngine>;
  concurrent: boolean;
  maxConcurrency?: number;
  timeout?: number;
  retries?: number;
  outputConfig: OutputConfig;
  continueOnError?: boolean;
  progressCallback?: (update: ProgressUpdate) => void;
  debug?: boolean;
}

export interface ProgressUpdate {
  engineName: string;
  status: 'started' | 'completed' | 'failed';
  result?: EngineResponse;
  error?: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export interface RunResult {
  success: boolean;
  runId: string;
  results: Map<string, EngineResponse>;
  executionTime: number;
  errors: string[];
  outputResult?: OutputResult;
}

export class PromptRunner {
  private config: RunConfig;
  private outputManager: OutputManager;
  private semaphore?: Semaphore;
  private spinners: Map<string, Ora> = new Map();
  private performanceTracker: PerformanceTracker;

  constructor(config: RunConfig) {
    this.config = {
      concurrent: true,
      maxConcurrency: 5,
      timeout: 60000,
      retries: 1,
      continueOnError: true,
      ...config
    };

    this.outputManager = new OutputManager(this.config.outputConfig);
    this.performanceTracker = new PerformanceTracker();
    
    if (this.config.concurrent && this.config.maxConcurrency) {
      this.semaphore = new Semaphore(this.config.maxConcurrency);
    }

    // Load historical metrics on startup
    this.performanceTracker.loadHistoricalMetrics().catch(err => {
      console.warn('Failed to load historical metrics:', err);
    });
  }

  /**
   * Execute prompt across multiple engines
   */
  async run(request: PromptRequest): Promise<RunResult> {
    const startTime = Date.now();
    const engines = Array.from(this.config.engines.entries());
    const results = new Map<string, EngineResponse>();
    const errors: string[] = [];

    console.log(chalk.cyan(`\n🚀 Starting multi-shot run with ${engines.length} engines...`));
    console.log(chalk.gray(`Strategy: ${this.config.concurrent ? 'Parallel' : 'Sequential'}`));
    
    if (this.config.concurrent && this.config.maxConcurrency) {
      console.log(chalk.gray(`Max Concurrency: ${this.config.maxConcurrency}`));
    }

    // Show engines being executed
    const engineNames = engines.map(([name]) => name);
    console.log(chalk.gray(`Models: ${engineNames.join(', ')}`));
    console.log(chalk.gray(`Timeout: ${(this.config.timeout || 120000) / 1000}s per engine`));
    
    if (this.config.debug) {
      console.log(chalk.magenta('\n🐛 DEBUG MODE ENABLED'));
      console.log(chalk.gray(`Debug: Continue on error: ${this.config.continueOnError}`));
      console.log(chalk.gray(`Debug: Retry attempts: ${this.config.retries || 1}`));
      console.log(chalk.gray(`Debug: Output strategy: ${this.config.outputConfig.strategy}`));
    }
    console.log('');

    // Initialize output manager
    await this.outputManager.initialize();

    try {
      if (this.config.concurrent) {
        await this.runConcurrent(engines, request, results, errors);
      } else {
        await this.runSequential(engines, request, results, errors);
      }

      // Save results
      const outputResult = await this.outputManager.saveResults(
        request.prompt,
        engines.map(([name]) => name),
        results
      );

      const executionTime = Date.now() - startTime;
      const successCount = Array.from(results.values()).filter(r => !r.error).length;
      const runId = this.outputManager.getRunId();

      // Collect and record performance metrics
      await this.collectAndRecordMetrics(runId, request, results, executionTime);

      console.log(chalk.green(`\n✅ Multi-shot run completed in ${(executionTime / 1000).toFixed(1)}s`));
      
      // Create a simple progress bar for completion
      const completionRate = successCount / engines.length;
      const progressBar = this.createProgressBar(completionRate);
      console.log(`Progress: ${progressBar} ${successCount}/${engines.length} engines`);
      
      if (errors.length > 0) {
        console.log(chalk.yellow(`⚠ ${errors.length} errors occurred`));
        if (errors.length <= 3) {
          errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
        }
      }

      // Show timing breakdown if available
      this.showTimingBreakdown(results);

      return {
        success: successCount > 0,
        runId,
        results,
        executionTime,
        errors,
        outputResult
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.log(chalk.red(`\n❌ Multi-shot run failed after ${executionTime}ms`));
      console.log(chalk.red(`Error: ${errorMessage}`));

      return {
        success: false,
        runId: this.outputManager.getRunId(),
        results,
        executionTime,
        errors: [...errors, errorMessage]
      };
    } finally {
      // Clean up any remaining spinners
      this.spinners.forEach(spinner => spinner.stop());
      this.spinners.clear();
    }
  }

  /**
   * Run engines concurrently with semaphore control
   */
  private async runConcurrent(
    engines: [string, BaseEngine][],
    request: PromptRequest,
    results: Map<string, EngineResponse>,
    errors: string[]
  ): Promise<void> {
    const promises = engines.map(([name, engine]) => 
      this.executeWithSemaphore(name, engine, request, results, errors)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Run engines sequentially
   */
  private async runSequential(
    engines: [string, BaseEngine][],
    request: PromptRequest,
    results: Map<string, EngineResponse>,
    errors: string[]
  ): Promise<void> {
    for (const [name, engine] of engines) {
      await this.executeSingle(name, engine, request, results, errors);
      
      // Small delay between sequential runs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Execute single engine with semaphore protection
   */
  private async executeWithSemaphore(
    name: string,
    engine: BaseEngine,
    request: PromptRequest,
    results: Map<string, EngineResponse>,
    errors: string[]
  ): Promise<void> {
    if (this.semaphore) {
      await this.semaphore.acquire();
    }

    try {
      await this.executeSingle(name, engine, request, results, errors);
    } finally {
      if (this.semaphore) {
        this.semaphore.release();
      }
    }
  }

  /**
   * Execute single engine with retry logic
   */
  private async executeSingle(
    name: string,
    engine: BaseEngine,
    request: PromptRequest,
    results: Map<string, EngineResponse>,
    errors: string[]
  ): Promise<void> {
    if (this.config.debug) {
      console.log(chalk.magenta(`🐛 Debug: Starting execution for engine: ${name}`));
      console.log(chalk.gray(`   Model: ${engine.getConfig().model}`));
      console.log(chalk.gray(`   Prompt length: ${request.prompt.length} chars`));
    }

    const spinner = ora({
      text: `Running ${name}...`,
      color: 'cyan',
      spinner: 'dots12'
    }).start();

    this.spinners.set(name, spinner);

    let lastError: string | undefined;
    let attempts = 0;
    const maxRetries = this.config.retries || 1;

    while (attempts <= maxRetries) {
      attempts++;

      try {
        // Update spinner text for retry attempts
        if (attempts > 1) {
          spinner.text = `Running ${name} (attempt ${attempts}/${maxRetries + 1})...`;
        }

        const response = await Promise.race([
          engine.execute(request),
          this.createTimeoutPromise(name)
        ]);

        if (response.error) {
          lastError = response.error;
          if (attempts <= maxRetries) {
            spinner.text = `Retrying ${name} due to error: ${response.error}`;
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }

        results.set(name, response);
        
        if (response.error) {
          spinner.fail(chalk.red(`${name} failed: ${response.error}`));
          errors.push(`${name}: ${response.error}`);
          
          if (this.config.debug) {
            console.log(chalk.magenta(`🐛 Debug: ${name} error details:`));
            console.log(chalk.red(`   Error: ${response.error}`));
            console.log(chalk.gray(`   Attempts made: ${attempts}`));
          }
        } else {
          spinner.succeed(chalk.green(`${name} completed (${response.executionTime}ms)`));
          
          if (this.config.debug) {
            console.log(chalk.magenta(`🐛 Debug: ${name} success details:`));
            console.log(chalk.gray(`   Response length: ${response.content.length} chars`));
            console.log(chalk.gray(`   Token usage: ${JSON.stringify(response.tokenUsage)}`));
            console.log(chalk.gray(`   Model: ${response.model}`));
          }
        }

        this.notifyProgress(name, 'completed', results.size, this.config.engines.size, response);
        break;

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempts <= maxRetries) {
          spinner.text = `Retrying ${name} due to error: ${lastError}`;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
          continue;
        }

        // Final failure
        const errorResponse: EngineResponse = {
          content: '',
          model: engine.getConfig().model,
          engine: name,
          timestamp: new Date(),
          executionTime: 0,
          error: lastError
        };

        results.set(name, errorResponse);
        spinner.fail(chalk.red(`${name} failed after ${attempts} attempts: ${lastError}`));
        errors.push(`${name}: ${lastError}`);

        this.notifyProgress(name, 'failed', results.size, this.config.engines.size, undefined, lastError);
        
        if (!this.config.continueOnError) {
          throw new Error(`Engine ${name} failed: ${lastError}`);
        }
        break;
      }
    }

    this.spinners.delete(name);
  }

  /**
   * Create timeout promise for engine execution
   */
  private createTimeoutPromise(engineName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Engine ${engineName} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  /**
   * Notify progress callback if provided
   */
  private notifyProgress(
    engineName: string,
    status: 'started' | 'completed' | 'failed',
    completed: number,
    total: number,
    result?: EngineResponse,
    error?: string
  ): void {
    if (this.config.progressCallback) {
      this.config.progressCallback({
        engineName,
        status,
        result,
        error,
        progress: {
          completed,
          total,
          percentage: Math.round((completed / total) * 100)
        }
      });
    }
  }

  /**
   * Get available engines status
   */
  async getEngineStatus(): Promise<Map<string, boolean>> {
    const status = new Map<string, boolean>();
    const engines = Array.from(this.config.engines.entries());
    
    const checks = engines.map(async ([name, engine]) => {
      try {
        const isAvailable = await engine.isAvailable();
        status.set(name, isAvailable);
      } catch {
        status.set(name, false);
      }
    });

    await Promise.all(checks);
    return status;
  }

  /**
   * Get run configuration summary
   */
  getConfigSummary(): string {
    const engineNames = Array.from(this.config.engines.keys());
    const strategy = this.config.concurrent ? 'Parallel' : 'Sequential';
    const concurrency = this.config.maxConcurrency || 'Unlimited';
    const timeout = this.config.timeout || 60000;

    return `
Multi-Shot Configuration:
- Strategy: ${strategy}
- Engines: ${engineNames.join(', ')}
- Max Concurrency: ${concurrency}
- Timeout: ${timeout}ms
- Retries: ${this.config.retries}
- Continue on Error: ${this.config.continueOnError}
- Output Strategy: ${this.config.outputConfig.strategy}
    `.trim();
  }

  /**
   * Collect and record performance metrics for the run
   */
  private async collectAndRecordMetrics(
    runId: string,
    request: PromptRequest,
    results: Map<string, EngineResponse>,
    totalTime: number
  ): Promise<void> {
    try {
      // Convert results to ModelPerformance array
      const models: ModelPerformance[] = [];
      let totalCost = 0;
      let qualityScores: number[] = [];

      for (const [engineName, response] of results.entries()) {
        // Calculate cost based on model type and usage
        const cost = this.calculateModelCost(engineName, response);
        totalCost += cost;

        // Estimate quality score (in production this would be more sophisticated)
        const qualityScore = response.error ? 0 : this.estimateQualityScore(engineName, response);
        if (qualityScore > 0) {
          qualityScores.push(qualityScore);
        }

        const modelPerformance: ModelPerformance = {
          modelName: response.model,
          engine: engineName,
          executionTime: response.executionTime || 0,
          tokenUsage: response.tokenUsage ? {
            promptTokens: response.tokenUsage.prompt,
            completionTokens: response.tokenUsage.completion,
            totalTokens: response.tokenUsage.total
          } : undefined,
          cost,
          qualityScore: qualityScore > 0 ? qualityScore : undefined,
          success: !response.error,
          error: response.error,
          timestamp: response.timestamp
        };

        models.push(modelPerformance);
      }

      // Calculate success rate
      const successfulModels = models.filter(m => m.success).length;
      const successRate = models.length > 0 ? successfulModels / models.length : 0;

      // Calculate average quality score
      const averageQualityScore = qualityScores.length > 0 ? 
        qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 
        undefined;

      // Estimate task complexity (basic implementation)
      const taskComplexity = this.estimateTaskComplexity(request.prompt);

      // Create performance metrics
      const performanceMetrics: PerformanceMetrics = {
        runId,
        timestamp: new Date(),
        prompt: request.prompt,
        models,
        totalCost,
        totalTime,
        successRate,
        averageQualityScore,
        taskComplexity,
        contextMetadata: {
          concurrent: this.config.concurrent,
          maxConcurrency: this.config.maxConcurrency,
          timeout: this.config.timeout || 60000,
          retries: this.config.retries || 1
        }
      };

      // Record metrics
      this.performanceTracker.recordRun(performanceMetrics);

    } catch (error) {
      console.warn('Failed to record performance metrics:', error);
    }
  }

  /**
   * Calculate estimated cost for a model response
   */
  private calculateModelCost(engineName: string, response: EngineResponse): number {
    // Cost calculation based on model and token usage
    if (response.tokenUsage) {
      const { prompt: promptTokens, completion: completionTokens } = response.tokenUsage;
      
      // Model-specific pricing (simplified)
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
          return 0; // Local models have no API cost
        default:
          // Default estimation for unknown models
          return (promptTokens * 0.001 + completionTokens * 0.002) / 1000;
      }
    }

    // Fallback cost estimation based on response length
    const responseLength = response.content.length;
    const estimatedTokens = Math.ceil(responseLength / 4); // Rough estimate: 4 chars per token
    
    switch (engineName.toLowerCase()) {
      case 'gpt-4o':
        return estimatedTokens * 0.01 / 1000;
      case 'gpt-4o-mini':
        return estimatedTokens * 0.0003 / 1000;
      case 'tinyllama':
      case 'local':
        return 0;
      default:
        return estimatedTokens * 0.002 / 1000;
    }
  }

  /**
   * Estimate quality score based on response characteristics
   */
  private estimateQualityScore(engineName: string, response: EngineResponse): number {
    if (response.error) return 0;

    // Basic quality scoring based on response characteristics
    let score = 5; // Base score

    // Length factor (not too short, not too long)
    const responseLength = response.content.length;
    if (responseLength > 100 && responseLength < 5000) {
      score += 1;
    } else if (responseLength < 50) {
      score -= 1;
    }

    // Response time factor (faster is better, but not too fast)
    const responseTime = response.executionTime || 0;
    if (responseTime > 1000 && responseTime < 30000) {
      score += 1;
    } else if (responseTime > 60000) {
      score -= 1;
    }

    // Model-specific adjustments based on known capabilities
    switch (engineName.toLowerCase()) {
      case 'gpt-4o':
        score += 2; // Premium model
        break;
      case 'gpt-4o-mini':
        score += 1; // Good balance
        break;
      case 'claude-sonnet':
        score += 2; // High quality
        break;
      case 'tinyllama':
        score -= 1; // Local model, lower expectations
        break;
    }

    // Content quality indicators (basic checks)
    if (response.content.includes('```')) score += 0.5; // Contains code
    if (response.content.includes('\n-') || response.content.includes('\n*')) score += 0.5; // Contains lists
    if (response.content.length > 500) score += 0.5; // Detailed response

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Estimate task complexity based on prompt characteristics
   */
  private estimateTaskComplexity(prompt: string): number {
    let complexity = 3; // Base complexity

    // Length factor
    if (prompt.length > 500) complexity += 1;
    if (prompt.length > 1000) complexity += 1;

    // Keyword indicators
    const complexKeywords = [
      'architecture', 'design', 'implement', 'system', 'algorithm',
      'optimization', 'performance', 'scalability', 'security',
      'integration', 'analysis', 'strategy', 'framework'
    ];

    const keywordMatches = complexKeywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword)
    ).length;

    complexity += Math.min(3, keywordMatches);

    // Question complexity
    const questionMarks = (prompt.match(/\?/g) || []).length;
    if (questionMarks > 2) complexity += 1;

    // Multi-part requests
    if (prompt.includes('1)') || prompt.includes('a)') || prompt.includes('first')) {
      complexity += 2;
    }

    return Math.min(10, Math.max(1, complexity));
  }

  /**
   * Get performance tracker instance
   */
  getPerformanceTracker(): PerformanceTracker {
    return this.performanceTracker;
  }

  /**
   * Create a visual progress bar for terminal display
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const completed = Math.floor(percentage * width);
    const remaining = width - completed;
    const filledBar = chalk.green('█'.repeat(completed));
    const emptyBar = chalk.gray('░'.repeat(remaining));
    return `${filledBar}${emptyBar} ${(percentage * 100).toFixed(0)}%`;
  }

  /**
   * Show timing breakdown for completed engines
   */
  private showTimingBreakdown(results: Map<string, EngineResponse>): void {
    const timings: Array<{ name: string; time: number; success: boolean }> = [];
    
    for (const [name, response] of results.entries()) {
      timings.push({
        name,
        time: response.executionTime,
        success: !response.error
      });
    }

    if (timings.length === 0) return;

    // Sort by execution time
    timings.sort((a, b) => a.time - b.time);

    console.log(chalk.cyan('\n⏱️  Timing Breakdown:'));
    timings.forEach(({ name, time, success }) => {
      const status = success ? chalk.green('✓') : chalk.red('✗');
      const timeStr = time > 10000 ? `${(time / 1000).toFixed(1)}s` : `${time}ms`;
      console.log(`  ${status} ${name.padEnd(20)} ${chalk.gray(timeStr)}`);
    });
  }
}