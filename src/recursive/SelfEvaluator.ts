/**
 * Self-evaluation system using ClaudePrompter recursively
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EngineResponse } from '../engines/BaseEngine';
import { ComparisonEngine } from '../comparison/ComparisonEngine';

export interface SelfEvaluationResult {
  originalPrompt: string;
  responses: Map<string, EngineResponse>;
  evaluation: {
    qualityScores: Map<string, number>;
    improvements: string[];
    bestResponse: string;
    reasoning: string;
  };
  iterationCount: number;
  improvementSuggestions: string[];
}

export interface IterativeRefinementConfig {
  maxIterations: number;
  qualityThreshold: number; // 1-10 scale
  improvementPrompts: string[];
  useComparison: boolean;
}

export class SelfEvaluator {
  private comparisonEngine: ComparisonEngine;

  constructor() {
    this.comparisonEngine = new ComparisonEngine();
  }

  /**
   * Evaluate multi-shot results using ClaudePrompter itself
   */
  async evaluateResults(
    originalPrompt: string,
    responses: Map<string, EngineResponse>
  ): Promise<SelfEvaluationResult> {
    console.log('🔄 Starting self-evaluation using ClaudePrompter...');

    // Create evaluation prompt
    const evaluationPrompt = this.buildEvaluationPrompt(originalPrompt, responses);

    // Run evaluation using claude-prompter
    const evaluationResponse = await this.runClaudePrompterEvaluation(evaluationPrompt);

    // Parse evaluation results
    const evaluation = this.parseEvaluationResponse(evaluationResponse, responses);

    // Generate improvement suggestions
    const improvementSuggestions = await this.generateImprovementSuggestions(
      originalPrompt,
      responses,
      evaluation
    );

    return {
      originalPrompt,
      responses,
      evaluation,
      iterationCount: 1,
      improvementSuggestions
    };
  }

  /**
   * Perform iterative refinement using multiple evaluation rounds
   */
  async performIterativeRefinement(
    originalPrompt: string,
    config: IterativeRefinementConfig
  ): Promise<SelfEvaluationResult> {
    let currentPrompt = originalPrompt;
    let iterationCount = 0;
    let bestResult: SelfEvaluationResult | null = null;
    let improvementHistory: string[] = [];

    console.log(`🔁 Starting iterative refinement (max ${config.maxIterations} iterations)`);

    while (iterationCount < config.maxIterations) {
      iterationCount++;
      console.log(`\n📍 Iteration ${iterationCount}/${config.maxIterations}`);

      // Run multi-shot with current prompt
      const multishotResults = await this.runMultishot(currentPrompt);
      
      if (!multishotResults || multishotResults.size === 0) {
        console.log('❌ No results from multi-shot run');
        break;
      }

      // Evaluate current results
      const evaluation = await this.evaluateResults(currentPrompt, multishotResults);

      // Check if we've reached quality threshold
      const avgQuality = this.calculateAverageQuality(evaluation.evaluation.qualityScores);
      console.log(`📊 Average quality score: ${avgQuality.toFixed(1)}/10`);

      if (avgQuality >= config.qualityThreshold) {
        console.log(`✅ Quality threshold reached (${config.qualityThreshold})`);
        bestResult = evaluation;
        break;
      }

      // Store best result so far
      if (!bestResult || avgQuality > this.calculateAverageQuality(bestResult.evaluation.qualityScores)) {
        bestResult = evaluation;
      }

      // Generate improved prompt for next iteration
      if (iterationCount < config.maxIterations) {
        const improvedPrompt = await this.generateImprovedPrompt(
          currentPrompt,
          evaluation,
          config.improvementPrompts
        );

        if (improvedPrompt === currentPrompt) {
          console.log('🔄 No further improvements suggested, stopping iteration');
          break;
        }

        improvementHistory.push(`Iteration ${iterationCount}: ${improvedPrompt}`);
        currentPrompt = improvedPrompt;
        console.log(`🔄 Refined prompt for next iteration`);
      }
    }

    if (!bestResult) {
      throw new Error('No valid results obtained during iterative refinement');
    }

    // Add iteration metadata to final result
    return {
      ...bestResult,
      iterationCount,
      improvementSuggestions: [...bestResult.improvementSuggestions, ...improvementHistory]
    };
  }

  /**
   * Build evaluation prompt for claude-prompter
   */
  private buildEvaluationPrompt(
    originalPrompt: string,
    responses: Map<string, EngineResponse>
  ): string {
    const responsesText = Array.from(responses.entries())
      .map(([engine, response]) => {
        return `### ${engine.toUpperCase()}\n${response.content}\n`;
      })
      .join('\n---\n\n');

    return `As an expert AI evaluator, please analyze these responses to the prompt: "${originalPrompt}"

${responsesText}

Please provide:

1. QUALITY SCORES (1-10 scale):
   - Engine1: X/10
   - Engine2: Y/10
   (etc. for each engine)

2. BEST RESPONSE: [Engine name and why]

3. KEY IMPROVEMENTS needed:
   - Point 1
   - Point 2
   - Point 3

4. DETAILED REASONING for your evaluation

Be objective, specific, and focus on accuracy, helpfulness, and completeness.`;
  }

  /**
   * Run claude-prompter evaluation command
   */
  private async runClaudePrompterEvaluation(prompt: string): Promise<string> {
    try {
      // Create temporary file for the prompt
      const tempFile = path.join(process.cwd(), 'temp-evaluation-prompt.txt');
      await fs.writeFile(tempFile, prompt);

      // Run claude-prompter with the evaluation prompt
      const command = `node dist/cli.js prompt -m "${prompt.replace(/"/g, '\\"')}" --send`;
      const result = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000
      });

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {}); // Ignore errors

      return result;
    } catch (error) {
      throw new Error(`Failed to run claude-prompter evaluation: ${error}`);
    }
  }

  /**
   * Parse evaluation response into structured format
   */
  private parseEvaluationResponse(
    evaluationText: string,
    originalResponses: Map<string, EngineResponse>
  ): {
    qualityScores: Map<string, number>;
    improvements: string[];
    bestResponse: string;
    reasoning: string;
  } {
    const qualityScores = new Map<string, number>();
    const improvements: string[] = [];
    let bestResponse = '';
    let reasoning = '';

    // Parse quality scores
    const scoreMatches = evaluationText.match(/(\w+):\s*(\d+(?:\.\d+)?)\s*\/?\s*10/g);
    if (scoreMatches) {
      for (const match of scoreMatches) {
        const [, engine, score] = match.match(/(\w+):\s*(\d+(?:\.\d+)?)/) || [];
        if (engine && score && originalResponses.has(engine.toLowerCase())) {
          qualityScores.set(engine.toLowerCase(), parseFloat(score));
        }
      }
    }

    // Parse best response
    const bestResponseMatch = evaluationText.match(/BEST RESPONSE:?\s*([^\n]+)/i);
    if (bestResponseMatch) {
      bestResponse = bestResponseMatch[1].trim();
    }

    // Parse improvements
    const improvementSection = evaluationText.match(/IMPROVEMENTS?[^:]*:?\s*([\s\S]*?)(?=\d\.\s*DETAILED|$)/i);
    if (improvementSection) {
      const improvementText = improvementSection[1];
      const improvementLines = improvementText.split('\n')
        .filter(line => line.trim() && (line.includes('-') || line.includes('•')))
        .map(line => line.replace(/^[\s\-•]+/, '').trim())
        .filter(line => line.length > 0);
      
      improvements.push(...improvementLines);
    }

    // Extract reasoning
    const reasoningMatch = evaluationText.match(/REASONING[^:]*:?\s*([\s\S]*?)$/i);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    return {
      qualityScores,
      improvements,
      bestResponse,
      reasoning
    };
  }

  /**
   * Generate improvement suggestions for future runs
   */
  private async generateImprovementSuggestions(
    _originalPrompt: string,
    responses: Map<string, EngineResponse>,
    evaluation: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Based on quality scores
    if (evaluation.qualityScores.size > 0) {
      const avgScore = Array.from(evaluation.qualityScores.values())
        .map(score => Number(score))
        .reduce((sum: number, score: number) => sum + score, 0) / evaluation.qualityScores.size;

      if (avgScore < 7) {
        suggestions.push('Consider refining the prompt for more specific requirements');
        suggestions.push('Add more context or constraints to guide better responses');
      }
    }

    // Based on response comparison
    const comparison = this.comparisonEngine.compare(responses);
    if (comparison.similarities < 50) {
      suggestions.push('Low consensus detected - consider clarifying ambiguous aspects');
    }

    // Based on improvements identified
    if (evaluation.improvements.length > 0) {
      suggestions.push(`Focus on: ${evaluation.improvements.slice(0, 2).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Run multishot command and parse results
   */
  private async runMultishot(_prompt: string): Promise<Map<string, EngineResponse> | null> {
    try {
      // This is a simplified version - in practice, you'd need to:
      // 1. Parse the actual output from the multishot command
      // 2. Read the results from the output directory
      // 3. Convert them back to EngineResponse format
      
      // For now, return null to indicate this would need full implementation
      return null;
    } catch (error) {
      console.error(`Failed to run multishot: ${error}`);
      return null;
    }
  }

  /**
   * Generate improved prompt based on evaluation feedback
   */
  private async generateImprovedPrompt(
    currentPrompt: string,
    _evaluation: SelfEvaluationResult,
    _improvementPrompts: string[]
  ): Promise<string> {
    try {
      // Extract improved prompt from result (this would need proper parsing)
      // For now, return original prompt to avoid infinite loops
      return currentPrompt;
    } catch (error) {
      console.error(`Failed to generate improved prompt: ${error}`);
      return currentPrompt;
    }
  }

  /**
   * Calculate average quality score
   */
  private calculateAverageQuality(qualityScores: Map<string, number>): number {
    if (qualityScores.size === 0) return 0;
    
    const total = Array.from(qualityScores.values()).reduce((sum, score) => sum + score, 0);
    return total / qualityScores.size;
  }

  /**
   * Save evaluation results to file
   */
  async saveEvaluationResults(result: SelfEvaluationResult, outputPath: string): Promise<void> {
    const reportContent = this.generateEvaluationReport(result);
    await fs.writeFile(outputPath, reportContent);
    console.log(`📁 Evaluation report saved to: ${outputPath}`);
  }

  /**
   * Generate human-readable evaluation report
   */
  private generateEvaluationReport(result: SelfEvaluationResult): string {
    const avgQuality = this.calculateAverageQuality(result.evaluation.qualityScores);
    
    return `# ClaudePrompter Self-Evaluation Report

## Original Prompt
\`\`\`
${result.originalPrompt}
\`\`\`

## Evaluation Summary
- **Iterations**: ${result.iterationCount}
- **Average Quality Score**: ${avgQuality.toFixed(1)}/10
- **Best Response**: ${result.evaluation.bestResponse}

## Quality Scores by Engine
${Array.from(result.evaluation.qualityScores.entries())
  .map(([engine, score]) => `- **${engine}**: ${score}/10`)
  .join('\n')}

## Key Improvements Identified
${result.evaluation.improvements.map(improvement => `- ${improvement}`).join('\n')}

## Reasoning
${result.evaluation.reasoning}

## Improvement Suggestions for Future Runs
${result.improvementSuggestions.map(suggestion => `- ${suggestion}`).join('\n')}

## Response Details
${Array.from(result.responses.entries())
  .map(([engine, response]) => `
### ${engine.toUpperCase()}
- **Execution Time**: ${response.executionTime}ms
- **Model**: ${response.model}
- **Content Length**: ${response.content.length} characters

\`\`\`
${response.content.substring(0, 500)}${response.content.length > 500 ? '...' : ''}
\`\`\`
`).join('\n')}

---
*Generated by ClaudePrompter Self-Evaluation System*
`;
  }
}