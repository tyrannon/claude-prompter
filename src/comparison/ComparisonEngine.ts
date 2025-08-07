/**
 * Comparison Engine for analyzing differences between AI responses
 */

import { EngineResponse } from '../engines/BaseEngine';
import chalk from 'chalk';
import { diffWords, diffSentences } from 'diff';

export interface ComparisonResult {
  similarities: number; // 0-100 percentage
  differences: DifferenceAnalysis[];
  keyInsights: string[];
  recommendation?: string;
}

export interface DifferenceAnalysis {
  type: 'content' | 'style' | 'accuracy' | 'completeness' | 'approach';
  description: string;
  engines: string[];
  severity: 'low' | 'medium' | 'high';
  examples?: string[];
}

export interface QualityScore {
  engine: string;
  scores: {
    accuracy: number;
    clarity: number;
    completeness: number;
    helpfulness: number;
    overall: number;
  };
  reasoning: string[];
  strengths: string[];
  weaknesses: string[];
}

export class ComparisonEngine {
  /**
   * Compare multiple engine responses
   */
  compare(responses: Map<string, EngineResponse>): ComparisonResult {
    const validResponses = this.filterValidResponses(responses);
    
    if (validResponses.size < 2) {
      return {
        similarities: 0,
        differences: [],
        keyInsights: ['Insufficient responses for comparison'],
        recommendation: 'Need at least 2 successful responses to compare'
      };
    }

    const similarities = this.calculateSimilarities(validResponses);
    const differences = this.analyzeDifferences(validResponses);
    const insights = this.generateKeyInsights(validResponses, similarities, differences);
    const recommendation = this.generateRecommendation(validResponses, similarities, differences);

    return {
      similarities,
      differences,
      keyInsights: insights,
      recommendation
    };
  }

  /**
   * Generate side-by-side comparison
   */
  generateSideBySideComparison(responses: Map<string, EngineResponse>): string {
    const validResponses = this.filterValidResponses(responses);
    const engines = Array.from(validResponses.keys());
    
    if (engines.length === 0) {
      return chalk.red('No valid responses to compare');
    }

    let comparison = chalk.bold.cyan('┌─ Side-by-Side Comparison ─┐\n\n');
    
    // Response content comparison
    comparison += chalk.bold('📝 Response Content:\n');
    comparison += '─'.repeat(80) + '\n\n';
    
    for (const engine of engines) {
      const response = validResponses.get(engine)!;
      comparison += chalk.bold.yellow(`${engine.toUpperCase()}:\n`);
      comparison += response.content.substring(0, 300);
      if (response.content.length > 300) {
        comparison += chalk.gray('... (truncated)');
      }
      comparison += '\n\n';
    }

    // Metrics comparison
    comparison += chalk.bold('📊 Response Metrics:\n');
    comparison += '─'.repeat(80) + '\n';
    comparison += this.formatMetricsTable(validResponses);
    
    return comparison;
  }

  /**
   * Generate detailed diff analysis
   */
  generateDiffAnalysis(responseA: EngineResponse, responseB: EngineResponse): string {
    const engineA = responseA.engine;
    const engineB = responseB.engine;
    
    let analysis = chalk.bold.cyan(`\n🔍 Detailed Diff: ${engineA} vs ${engineB}\n`);
    analysis += '─'.repeat(60) + '\n\n';

    // Word-level differences
    const wordDiff = diffWords(responseA.content, responseB.content);
    analysis += chalk.bold('Word-level differences:\n');
    
    let diffOutput = '';
    wordDiff.forEach(part => {
      if (part.added) {
        diffOutput += chalk.green(`[+${engineB}] ${part.value}`);
      } else if (part.removed) {
        diffOutput += chalk.red(`[-${engineA}] ${part.value}`);
      } else {
        diffOutput += part.value.length > 50 
          ? part.value.substring(0, 50) + '...'
          : part.value;
      }
    });
    
    analysis += diffOutput + '\n\n';

    // Sentence-level differences
    const sentenceDiff = diffSentences(responseA.content, responseB.content);
    const addedSentences = sentenceDiff.filter(part => part.added).length;
    const removedSentences = sentenceDiff.filter(part => part.removed).length;
    
    analysis += chalk.bold('Sentence-level summary:\n');
    analysis += `${chalk.green(`+${addedSentences} sentences unique to ${engineB}`)}\n`;
    analysis += `${chalk.red(`-${removedSentences} sentences unique to ${engineA}`)}\n`;

    return analysis;
  }

  /**
   * Filter out error responses
   */
  private filterValidResponses(responses: Map<string, EngineResponse>): Map<string, EngineResponse> {
    const valid = new Map<string, EngineResponse>();
    
    for (const [engine, response] of responses) {
      if (!response.error && response.content.trim()) {
        valid.set(engine, response);
      }
    }
    
    return valid;
  }

  /**
   * Calculate content similarities between responses
   */
  private calculateSimilarities(responses: Map<string, EngineResponse>): number {
    const responseArray = Array.from(responses.values());
    
    if (responseArray.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responseArray.length; i++) {
      for (let j = i + 1; j < responseArray.length; j++) {
        const similarity = this.calculateTextSimilarity(
          responseArray[i].content,
          responseArray[j].content
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return Math.round(totalSimilarity / comparisons);
  }

  /**
   * Calculate text similarity using basic word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return (intersection.size / union.size) * 100;
  }

  /**
   * Analyze key differences between responses
   */
  private analyzeDifferences(responses: Map<string, EngineResponse>): DifferenceAnalysis[] {
    const differences: DifferenceAnalysis[] = [];
    const responseArray = Array.from(responses.entries());

    // Length differences
    const lengths = responseArray.map(([engine, response]) => ({
      engine,
      length: response.content.length
    }));

    const maxLength = Math.max(...lengths.map(l => l.length));
    const minLength = Math.min(...lengths.map(l => l.length));
    
    if ((maxLength - minLength) / maxLength > 0.3) {
      differences.push({
        type: 'completeness',
        description: 'Significant difference in response lengths',
        engines: lengths.map(l => l.engine),
        severity: 'medium',
        examples: lengths.map(l => `${l.engine}: ${l.length} characters`)
      });
    }

    // Speed differences
    const speeds = responseArray.map(([engine, response]) => ({
      engine,
      time: response.executionTime
    }));

    const maxTime = Math.max(...speeds.map(s => s.time));
    const minTime = Math.min(...speeds.map(s => s.time));
    
    if ((maxTime - minTime) / minTime > 1.0) {
      differences.push({
        type: 'approach',
        description: 'Significant difference in response times',
        engines: speeds.map(s => s.engine),
        severity: 'low',
        examples: speeds.map(s => `${s.engine}: ${s.time}ms`)
      });
    }

    // Content style analysis (basic)
    const styles = this.analyzeContentStyles(responses);
    if (styles.differences.length > 0) {
      differences.push({
        type: 'style',
        description: 'Different communication styles detected',
        engines: Array.from(responses.keys()),
        severity: 'low',
        examples: styles.differences
      });
    }

    return differences;
  }

  /**
   * Analyze content styles
   */
  private analyzeContentStyles(responses: Map<string, EngineResponse>): {
    differences: string[];
  } {
    const styles: string[] = [];
    
    for (const [engine, response] of responses) {
      const content = response.content.toLowerCase();
      
      // Technical vs conversational
      const technicalWords = (content.match(/\b(algorithm|implementation|architecture|framework|optimization)\b/g) || []).length;
      const conversationalWords = (content.match(/\b(i think|perhaps|might|could|would suggest)\b/g) || []).length;
      
      if (technicalWords > conversationalWords * 2) {
        styles.push(`${engine}: Technical/formal approach`);
      } else if (conversationalWords > technicalWords * 2) {
        styles.push(`${engine}: Conversational/informal approach`);
      }
      
      // Code-heavy vs explanation-heavy
      const codeBlocks = (content.match(/```/g) || []).length / 2;
      const explanationSentences = (content.match(/\./g) || []).length;
      
      if (codeBlocks > explanationSentences / 10) {
        styles.push(`${engine}: Code-focused response`);
      }
    }
    
    return { differences: styles };
  }

  /**
   * Generate key insights from comparison
   */
  private generateKeyInsights(
    responses: Map<string, EngineResponse>,
    similarities: number,
    differences: DifferenceAnalysis[]
  ): string[] {
    const insights: string[] = [];
    
    // Similarity insights
    if (similarities > 80) {
      insights.push(`High consensus (${similarities}% similarity) - all models agree on core approach`);
    } else if (similarities > 50) {
      insights.push(`Moderate agreement (${similarities}% similarity) - models share some common ground`);
    } else {
      insights.push(`Low consensus (${similarities}% similarity) - models took different approaches`);
    }
    
    // Performance insights
    const speeds = Array.from(responses.values()).map(r => r.executionTime);
    const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const fastestEngine = Array.from(responses.entries())
      .reduce((fastest, [engine, response]) => 
        response.executionTime < fastest.time ? { engine, time: response.executionTime } : fastest,
        { engine: '', time: Infinity }
      );
    
    insights.push(`Fastest response: ${fastestEngine.engine} (${fastestEngine.time}ms, ${Math.round(avgSpeed)}ms avg)`);
    
    // Content insights
    const lengths = Array.from(responses.values()).map(r => r.content.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    
    if (Math.max(...lengths) - Math.min(...lengths) > avgLength * 0.5) {
      insights.push('Response lengths vary significantly - different levels of detail provided');
    }
    
    // Difference insights
    const severeDiffs = differences.filter(d => d.severity === 'high').length;
    if (severeDiffs > 0) {
      insights.push(`${severeDiffs} significant differences detected - careful review recommended`);
    }
    
    return insights;
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    responses: Map<string, EngineResponse>,
    similarities: number,
    _differences: DifferenceAnalysis[]
  ): string {
    if (responses.size === 1) {
      return 'Single response available - consider running additional models for comparison';
    }
    
    if (similarities > 80) {
      return 'High consensus detected - any response would be suitable, choose based on style preference';
    } else if (similarities > 50) {
      return 'Moderate agreement - review differences and choose based on specific needs';
    } else {
      return 'Low consensus - careful analysis recommended, consider the context and requirements';
    }
  }

  /**
   * Format metrics comparison table
   */
  private formatMetricsTable(responses: Map<string, EngineResponse>): string {
    const engines = Array.from(responses.keys());
    let table = '';
    
    // Header
    table += `${'Engine'.padEnd(15)} | ${'Time'.padEnd(8)} | ${'Length'.padEnd(8)} | ${'Model'.padEnd(20)}\n`;
    table += '─'.repeat(15) + '─┼─' + '─'.repeat(8) + '─┼─' + '─'.repeat(8) + '─┼─' + '─'.repeat(20) + '\n';
    
    // Rows
    for (const engine of engines) {
      const response = responses.get(engine)!;
      table += `${engine.padEnd(15)} | ${(response.executionTime + 'ms').padEnd(8)} | ${(response.content.length + 'ch').padEnd(8)} | ${response.model.padEnd(20)}\n`;
    }
    
    return table;
  }
}