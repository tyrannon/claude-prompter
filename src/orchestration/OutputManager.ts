/**
 * Output Manager for multi-shot results
 * Handles Git branches and timestamped folders
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EngineResponse } from '../engines/BaseEngine';
import { TopicExtractor } from '../utils/topicExtractor';

export interface OutputConfig {
  strategy: 'git' | 'folders' | 'both';
  baseDir?: string;
  branchPrefix?: string;
  cleanupOld?: boolean;
  maxAge?: number; // Days to keep old results
}

export interface OutputResult {
  runId: string;
  timestamp: Date;
  results: Map<string, EngineResponse>;
  metadata: {
    prompt: string;
    engines: string[];
    config: OutputConfig;
  };
}

export class OutputManager {
  private config: OutputConfig;
  private runId: string;
  private isGitRepo: boolean = false;

  constructor(config: OutputConfig) {
    this.config = {
      strategy: 'both',
      baseDir: './multi-shot-results',
      branchPrefix: 'multishot',
      cleanupOld: false,
      maxAge: 7,
      ...config
    };
    this.runId = this.generateRunId();
  }

  /**
   * Initialize output management system
   */
  async initialize(): Promise<void> {
    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      this.isGitRepo = true;
    } catch {
      this.isGitRepo = false;
    }

    // Create base directory if using folders
    if (this.config.strategy === 'folders' || this.config.strategy === 'both') {
      await fs.mkdir(this.config.baseDir!, { recursive: true });
    }

    // Clean up old results if configured
    if (this.config.cleanupOld) {
      await this.cleanupOldResults();
    }
  }

  /**
   * Save results for a multi-shot run
   */
  async saveResults(
    prompt: string, 
    engines: string[], 
    results: Map<string, EngineResponse>
  ): Promise<OutputResult> {
    const outputResult: OutputResult = {
      runId: this.runId,
      timestamp: new Date(),
      results,
      metadata: {
        prompt,
        engines,
        config: this.config
      }
    };

    if (this.config.strategy === 'git' || this.config.strategy === 'both') {
      await this.saveToGitBranches(outputResult);
    }

    if (this.config.strategy === 'folders' || this.config.strategy === 'both') {
      await this.saveToFolders(outputResult);
    }

    return outputResult;
  }

  /**
   * Save results to Git branches
   */
  private async saveToGitBranches(result: OutputResult): Promise<void> {
    if (!this.isGitRepo) {
      console.warn('Not in a git repository, skipping git branch creation');
      return;
    }

    // Get current branch name to restore later
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

    for (const [engineName, response] of result.results) {
      const branchName = `${this.config.branchPrefix}-${result.runId}-${engineName}`;
      
      try {
        // Create and checkout new branch
        execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' });

        // Create result file
        const resultFile = `multishot-result-${engineName}.md`;
        const content = this.formatResultForFile(engineName, response, result);
        
        await fs.writeFile(resultFile, content);
        
        // Commit the result
        execSync(`git add ${resultFile}`);
        execSync(`git commit -m "Multi-shot result: ${engineName} for run ${result.runId}"`);
        
        console.log(`✓ Created branch: ${branchName}`);
      } catch (error) {
        console.warn(`Failed to create branch ${branchName}:`, error);
      }
    }

    // Return to original branch
    try {
      execSync(`git checkout ${currentBranch}`, { stdio: 'ignore' });
    } catch (error) {
      console.warn('Failed to return to original branch:', error);
    }
  }

  /**
   * Save results to timestamped folders with human-readable names
   */
  private async saveToFolders(result: OutputResult): Promise<void> {
    // Generate human-readable folder name with topic extraction
    const humanReadableName = TopicExtractor.generateFolderName(
      result.metadata.prompt, 
      result.timestamp
    );
    
    const runDir = path.join(
      this.config.baseDir!,
      humanReadableName
    );

    await fs.mkdir(runDir, { recursive: true });

    // Save individual engine results
    for (const [engineName, response] of result.results) {
      const filename = `${engineName}-result.md`;
      const filepath = path.join(runDir, filename);
      const content = this.formatResultForFile(engineName, response, result);
      
      await fs.writeFile(filepath, content);
    }

    // Save run metadata
    const metadataFile = path.join(runDir, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify({
      runId: result.runId,
      timestamp: result.timestamp,
      prompt: result.metadata.prompt,
      engines: result.metadata.engines,
      config: result.metadata.config,
      summary: {
        totalEngines: result.results.size,
        successCount: Array.from(result.results.values()).filter(r => !r.error).length,
        errorCount: Array.from(result.results.values()).filter(r => r.error).length,
        totalExecutionTime: Array.from(result.results.values()).reduce((sum, r) => sum + r.executionTime, 0)
      }
    }, null, 2));

    // Save comparison file
    const comparisonFile = path.join(runDir, 'comparison.md');
    const comparisonContent = this.generateComparisonMarkdown(result);
    await fs.writeFile(comparisonFile, comparisonContent);

    console.log(`✓ Results saved to: ${runDir}`);
  }

  /**
   * Format a single engine result for file output
   */
  private formatResultForFile(
    engineName: string,
    response: EngineResponse,
    result: OutputResult
  ): string {
    return `# Multi-Shot Result: ${engineName}

## Run Information
- **Run ID**: ${result.runId}
- **Timestamp**: ${result.timestamp.toISOString()}
- **Engine**: ${response.engine} (${response.model})
- **Execution Time**: ${response.executionTime}ms

## Original Prompt
\`\`\`
${result.metadata.prompt}
\`\`\`

## Response
${response.error ? `**Error**: ${response.error}` : response.content}

${response.tokenUsage ? `
## Token Usage
- **Prompt Tokens**: ${response.tokenUsage.prompt}
- **Completion Tokens**: ${response.tokenUsage.completion}
- **Total Tokens**: ${response.tokenUsage.total}
` : ''}

## Metadata
\`\`\`json
${JSON.stringify(response.metadata || {}, null, 2)}
\`\`\`
`;
  }

  /**
   * Generate comparison markdown for all results
   */
  private generateComparisonMarkdown(result: OutputResult): string {
    const successful = Array.from(result.results.entries()).filter(([_, r]) => !r.error);
    const failed = Array.from(result.results.entries()).filter(([_, r]) => r.error);

    let markdown = `# Multi-Shot Comparison\n\n`;
    markdown += `**Run ID**: ${result.runId}\\n`;
    markdown += `**Timestamp**: ${result.timestamp.toISOString()}\\n`;
    markdown += `**Total Engines**: ${result.results.size}\\n`;
    markdown += `**Successful**: ${successful.length}\\n`;
    markdown += `**Failed**: ${failed.length}\\n\\n`;

    markdown += `## Original Prompt\n\`\`\`\n${result.metadata.prompt}\n\`\`\`\n\n`;

    if (successful.length > 0) {
      markdown += `## Successful Results\n\n`;
      
      for (const [engineName, response] of successful) {
        markdown += `### ${engineName} (${response.model})\n`;
        markdown += `**Execution Time**: ${response.executionTime}ms\\n\\n`;
        markdown += `${response.content}\n\n`;
        markdown += `---\n\n`;
      }
    }

    if (failed.length > 0) {
      markdown += `## Failed Results\n\n`;
      
      for (const [engineName, response] of failed) {
        markdown += `### ${engineName} - ERROR\n`;
        markdown += `**Error**: ${response.error}\\n`;
        markdown += `**Execution Time**: ${response.executionTime}ms\\n\\n`;
      }
    }

    return markdown;
  }

  /**
   * List all saved results
   */
  async listResults(): Promise<{ folders: string[]; branches: string[] }> {
    const results = { folders: [] as string[], branches: [] as string[] };

    // List folder results
    try {
      if (await this.directoryExists(this.config.baseDir!)) {
        const entries = await fs.readdir(this.config.baseDir!, { withFileTypes: true });
        results.folders = entries
          .filter(entry => entry.isDirectory() && entry.name.startsWith('run-'))
          .map(entry => entry.name)
          .sort();
      }
    } catch (error) {
      console.warn('Failed to list folder results:', error);
    }

    // List git branches
    try {
      if (this.isGitRepo) {
        const branchOutput = execSync('git branch -a', { encoding: 'utf8' });
        results.branches = branchOutput
          .split('\\n')
          .filter(line => line.includes(this.config.branchPrefix!))
          .map(line => line.trim().replace(/^\\*\\s+/, ''))
          .sort();
      }
    } catch (error) {
      console.warn('Failed to list git branches:', error);
    }

    return results;
  }

  /**
   * Clean up old results based on maxAge
   */
  private async cleanupOldResults(): Promise<void> {
    if (!this.config.maxAge || this.config.maxAge <= 0) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAge);

    // Clean up old folders
    if (this.config.strategy === 'folders' || this.config.strategy === 'both') {
      try {
        if (await this.directoryExists(this.config.baseDir!)) {
          const entries = await fs.readdir(this.config.baseDir!, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory()) {
              // Check if it's a legacy folder (run-*) or new format (YYYY-MM-DD_*)
              const isLegacyFolder = entry.name.startsWith('run-');
              const isNewFolder = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_/.test(entry.name);
              
              if (isLegacyFolder || isNewFolder) {
                const dirPath = path.join(this.config.baseDir!, entry.name);
                
                // Try to parse timestamp from folder name for better accuracy
                const folderTimestamp = TopicExtractor.parseTimestamp(entry.name);
                let shouldDelete = false;
                
                if (folderTimestamp) {
                  shouldDelete = folderTimestamp < cutoffDate;
                } else {
                  // Fallback to file modification time
                  const stats = await fs.stat(dirPath);
                  shouldDelete = stats.mtime < cutoffDate;
                }
                
                if (shouldDelete) {
                  await fs.rm(dirPath, { recursive: true, force: true });
                  console.log(`Cleaned up old result folder: ${entry.name}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to cleanup old folders:', error);
      }
    }

    // Note: We don't automatically delete git branches as they might be important
    // Users can manually delete them if needed
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }

  /**
   * Get current run ID
   */
  getRunId(): string {
    return this.runId;
  }
}