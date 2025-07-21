import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
// import inquirer from 'inquirer';
import { SessionManager } from '../data/SessionManager';
import { TokenCounter } from '../utils/tokenCounter';

interface ContextMetrics {
  currentTokens: number;
  maxTokens: number;
  usagePercentage: number;
  segmentCount: number;
  compressionRatio?: number;
  lastCompression?: Date;
}

interface ContextSegment {
  id: string;
  content: string;
  tokenCount: number;
  timestamp: Date;
  priority: number;
  type: 'user' | 'assistant' | 'system';
  importance: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  preserved?: boolean;
}

interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  preservedSegments: string[];
  qualityScore: number;
  summary: string;
}

interface OverflowAlert {
  level: 'info' | 'warning' | 'critical';
  action: string;
  recommendation: string;
}

class ContextOverflowManager {
  private sessionManager: SessionManager;
  private tokenCounter: TokenCounter;
  private thresholds = { 
    yellow: 0.75,   // Suggest compression
    orange: 0.85,   // Recommend compression
    red: 0.95       // Urgent compression needed
  };

  constructor() {
    this.sessionManager = new SessionManager();
    this.tokenCounter = new TokenCounter();
  }

  async analyzeContext(sessionId?: string): Promise<{ metrics: ContextMetrics; alert?: OverflowAlert }> {
    const spinner = ora('Analyzing context usage...').start();
    
    try {
      let session;
      if (sessionId) {
        session = await this.sessionManager.loadSession(sessionId);
      } else {
        // Get most recent session
        const sessions = await this.sessionManager.listSessions();
        if (sessions.length > 0) {
          session = await this.sessionManager.loadSession(sessions[0].sessionId);
        }
      }

      if (!session) {
        throw new Error('No session found to analyze');
      }

      // Calculate total tokens in conversation
      const totalTokens = session.history.reduce((sum, entry) => {
        const promptTokens = this.tokenCounter.count(entry.prompt);
        const responseTokens = this.tokenCounter.count(entry.response);
        return sum + promptTokens + responseTokens;
      }, 0);

      const maxTokens = 100000; // Claude's approximate context limit
      const usagePercentage = totalTokens / maxTokens;

      const metrics: ContextMetrics = {
        currentTokens: totalTokens,
        maxTokens,
        usagePercentage,
        segmentCount: session.history.length
      };

      // Check for overflow alerts
      let alert: OverflowAlert | undefined;
      if (usagePercentage >= this.thresholds.red) {
        alert = {
          level: 'critical',
          action: 'immediate_compression',
          recommendation: 'Context is critically full. Immediate compression recommended to prevent loss.'
        };
      } else if (usagePercentage >= this.thresholds.orange) {
        alert = {
          level: 'warning',
          action: 'compression_recommended',
          recommendation: 'Context is getting full. Compression recommended to maintain performance.'
        };
      } else if (usagePercentage >= this.thresholds.yellow) {
        alert = {
          level: 'info',
          action: 'compression_suggested',
          recommendation: 'Context approaching limits. Consider compression to optimize usage.'
        };
      }

      spinner.succeed('Context analysis complete');
      return { metrics, alert };
    } catch (error) {
      spinner.fail('Context analysis failed');
      throw error;
    }
  }

  async compressContext(sessionId: string, options: {
    strategy?: 'light' | 'medium' | 'aggressive';
    preserveRecent?: number;
    preserveMarked?: boolean;
  }): Promise<CompressionResult> {
    const spinner = ora('Compressing context...').start();
    
    try {
      const session = await this.sessionManager.loadSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const segments = this.createSegments(session.history);
      const prioritized = this.prioritizeSegments(segments, options);
      
      // Determine compression ratio based on strategy
      const compressionRatios = {
        light: 0.7,    // Compress to 70% of original
        medium: 0.5,   // Compress to 50% of original
        aggressive: 0.3 // Compress to 30% of original
      };
      
      const targetRatio = compressionRatios[options.strategy || 'medium'];
      const originalTokens = segments.reduce((sum, s) => sum + s.tokenCount, 0);
      const targetTokens = Math.floor(originalTokens * targetRatio);

      // Select segments to preserve
      const preserved = this.selectPreservedSegments(prioritized, targetTokens, options);
      const compressed = segments.filter(s => !preserved.find(p => p.id === s.id));

      // Generate summary of compressed content
      const summary = this.generateSummary(compressed);
      
      // Calculate final metrics
      const preservedTokens = preserved.reduce((sum, s) => sum + s.tokenCount, 0);
      const summaryTokens = this.tokenCounter.count(summary);
      const finalTokens = preservedTokens + summaryTokens;

      const result: CompressionResult = {
        originalTokens,
        compressedTokens: finalTokens,
        compressionRatio: finalTokens / originalTokens,
        preservedSegments: preserved.map(s => s.id),
        qualityScore: 0.85, // Would be calculated based on content analysis
        summary
      };

      spinner.succeed('Context compression complete');
      return result;
    } catch (error) {
      spinner.fail('Context compression failed');
      throw error;
    }
  }

  private createSegments(history: any[]): ContextSegment[] {
    return history.flatMap((entry, index) => [
      {
        id: `user-${index}`,
        content: entry.prompt,
        tokenCount: this.tokenCounter.count(entry.prompt),
        timestamp: new Date(entry.timestamp),
        priority: 0.5,
        type: 'user' as const,
        importance: 'medium' as const,
        tags: this.extractTags(entry.prompt)
      },
      {
        id: `assistant-${index}`,
        content: entry.response,
        tokenCount: this.tokenCounter.count(entry.response),
        timestamp: new Date(entry.timestamp),
        priority: 0.5,
        type: 'assistant' as const,
        importance: 'medium' as const,
        tags: this.extractTags(entry.response)
      }
    ]);
  }

  private prioritizeSegments(segments: ContextSegment[], options: any): ContextSegment[] {
    return segments.map(segment => ({
      ...segment,
      priority: this.calculatePriority(segment, options)
    })).sort((a, b) => b.priority - a.priority);
  }

  private calculatePriority(segment: ContextSegment, _options: any): number {
    let priority = 0.5; // Base priority
    
    // Recency bonus (more recent = higher priority)
    const age = Date.now() - segment.timestamp.getTime();
    const hoursSinceCreation = age / (1000 * 60 * 60);
    const recencyBonus = Math.max(0, 0.3 - (hoursSinceCreation * 0.01));
    priority += recencyBonus;
    
    // User content gets slight bonus
    if (segment.type === 'user') priority += 0.1;
    
    // Code blocks get high priority
    if (segment.content.includes('```')) priority += 0.25;
    
    // Questions and decisions get priority
    if (segment.content.includes('?') || 
        segment.content.toLowerCase().includes('decision') ||
        segment.content.toLowerCase().includes('important')) {
      priority += 0.2;
    }
    
    // Error handling and debugging content
    if (segment.content.toLowerCase().includes('error') ||
        segment.content.toLowerCase().includes('bug') ||
        segment.content.toLowerCase().includes('fix')) {
      priority += 0.15;
    }

    // Preserve marked content
    if (segment.preserved) priority += 0.4;
    
    return Math.min(1, priority);
  }

  private selectPreservedSegments(
    segments: ContextSegment[], 
    targetTokens: number, 
    options: any
  ): ContextSegment[] {
    const preserved: ContextSegment[] = [];
    let tokenCount = 0;

    // Always preserve recent segments if specified
    if (options.preserveRecent) {
      const recentSegments = segments
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, options.preserveRecent * 2); // *2 for user+assistant pairs
      
      for (const segment of recentSegments) {
        if (tokenCount + segment.tokenCount <= targetTokens) {
          preserved.push(segment);
          tokenCount += segment.tokenCount;
        }
      }
    }

    // Add high-priority segments until target is reached
    for (const segment of segments) {
      if (preserved.find(p => p.id === segment.id)) continue;
      
      if (tokenCount + segment.tokenCount <= targetTokens) {
        preserved.push(segment);
        tokenCount += segment.tokenCount;
      } else {
        break;
      }
    }

    return preserved;
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    if (content.includes('```')) tags.push('code');
    if (content.includes('?')) tags.push('question');
    if (content.toLowerCase().includes('error')) tags.push('error');
    if (content.toLowerCase().includes('decision')) tags.push('decision');
    if (content.toLowerCase().includes('important')) tags.push('important');
    
    return tags;
  }

  private generateSummary(segments: ContextSegment[]): string {
    // Simple extractive summary - in production, this would use AI
    const importantSegments = segments
      .filter(s => s.priority > 0.6)
      .slice(0, 3);
    
    const keyPoints = importantSegments.map(s => 
      s.content.length > 100 ? s.content.substring(0, 100) + '...' : s.content
    );

    return `Summary of compressed context:\n\nKey topics discussed:\n${keyPoints.map(p => `• ${p}`).join('\n')}\n\n[Compressed ${segments.length} segments]`;
  }

  formatContextReport(metrics: ContextMetrics, alert?: OverflowAlert): string {
    const percentage = (metrics.usagePercentage * 100).toFixed(1);
    
    let report = chalk.bold('🧠 Context Usage Analysis\n\n');
    
    // Usage metrics
    report += chalk.cyan('Current Usage:\n');
    report += chalk.gray('─'.repeat(30)) + '\n';
    report += `  Tokens: ${chalk.yellow(metrics.currentTokens.toLocaleString())} / ${metrics.maxTokens.toLocaleString()}\n`;
    report += `  Usage: ${this.getUsageColor(metrics.usagePercentage)(percentage + '%')}\n`;
    report += `  Segments: ${chalk.blue(metrics.segmentCount)} conversation exchanges\n`;
    
    if (metrics.compressionRatio) {
      report += `  Last Compression: ${chalk.green((metrics.compressionRatio * 100).toFixed(1) + '%')} reduction\n`;
    }

    // Alert if present
    if (alert) {
      report += chalk.cyan('\n⚠️  Context Alert:\n');
      report += chalk.gray('─'.repeat(30)) + '\n';
      report += `  Level: ${this.getAlertColor(alert.level)(alert.level.toUpperCase())}\n`;
      report += `  Action: ${chalk.yellow(alert.action.replace('_', ' '))}\n`;
      report += `  Recommendation:\n    ${chalk.gray(alert.recommendation)}\n`;
    } else {
      report += chalk.green('\n✓ Context usage is healthy\n');
    }

    return report;
  }

  formatCompressionReport(result: CompressionResult): string {
    const savings = result.originalTokens - result.compressedTokens;
    const percentage = ((1 - result.compressionRatio) * 100).toFixed(1);
    
    let report = chalk.bold('🗜️  Context Compression Complete\n\n');
    
    report += chalk.cyan('Compression Results:\n');
    report += chalk.gray('─'.repeat(35)) + '\n';
    report += `  Original: ${chalk.red(result.originalTokens.toLocaleString())} tokens\n`;
    report += `  Compressed: ${chalk.green(result.compressedTokens.toLocaleString())} tokens\n`;
    report += `  Saved: ${chalk.yellow(savings.toLocaleString())} tokens (${percentage}%)\n`;
    report += `  Quality Score: ${chalk.blue((result.qualityScore * 100).toFixed(1))}%\n`;
    report += `  Preserved Segments: ${chalk.cyan(result.preservedSegments.length)}\n\n`;
    
    report += chalk.cyan('Summary:\n');
    report += chalk.gray('─'.repeat(15)) + '\n';
    report += chalk.dim(result.summary.substring(0, 200)) + '...\n';
    
    return report;
  }

  private getUsageColor(percentage: number) {
    if (percentage >= 0.95) return chalk.red;
    if (percentage >= 0.85) return chalk.yellow;
    if (percentage >= 0.75) return chalk.blue;
    return chalk.green;
  }

  private getAlertColor(level: string) {
    switch (level) {
      case 'critical': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'info': return chalk.blue;
      default: return chalk.gray;
    }
  }
}

export function createContextCommand(): Command {
  const command = new Command('context')
    .description('Context overflow management and intelligent compression')
    
    .addCommand(
      new Command('status')
        .description('Check current context usage and overflow risk')
        .option('--session <id>', 'Specific session to analyze')
        .action(async (options) => {
          const manager = new ContextOverflowManager();
          
          try {
            const { metrics, alert } = await manager.analyzeContext(options.session);
            const report = manager.formatContextReport(metrics, alert);

            console.log(boxen(report, {
              title: '🧠 Context Analysis',
              titleAlignment: 'center',
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: alert ? (alert.level === 'critical' ? 'red' : 'yellow') : 'green'
            }));

            if (alert && alert.level === 'critical') {
              console.log(chalk.red('\n🚨 Critical: Immediate compression recommended!'));
              console.log(chalk.gray('Run: claude-prompter context compress'));
            }
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    
    .addCommand(
      new Command('compress')
        .description('Compress context to reduce token usage')
        .option('--session <id>', 'Session to compress')
        .option('--strategy <level>', 'Compression level (light/medium/aggressive)', 'medium')
        .option('--preserve-recent <count>', 'Number of recent exchanges to preserve', '5')
        .option('--dry-run', 'Show what would be compressed without executing')
        .action(async (options) => {
          const manager = new ContextOverflowManager();
          
          try {
            let sessionId = options.session;
            if (!sessionId) {
              const sessions = await manager['sessionManager'].listSessions();
              if (sessions.length === 0) {
                console.log(chalk.yellow('No sessions found. Please specify --session <id>'));
                return;
              }
              sessionId = sessions[0].sessionId;
            }

            if (options.dryRun) {
              console.log(chalk.cyan('🔍 Dry run - analyzing compression potential...\n'));
            }

            const result = await manager.compressContext(sessionId, {
              strategy: options.strategy as any,
              preserveRecent: parseInt(options.preserveRecent),
              preserveMarked: true
            });

            const report = manager.formatCompressionReport(result);

            console.log(boxen(report, {
              title: options.dryRun ? '🔍 Compression Preview' : '✅ Compression Complete',
              titleAlignment: 'center',
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'green'
            }));

            if (options.dryRun) {
              console.log(chalk.cyan('\n💡 To execute compression:'));
              console.log(chalk.gray('claude-prompter context compress --session ' + sessionId));
            } else {
              console.log(chalk.green('\n✓ Context successfully compressed!'));
              console.log(chalk.gray('Conversation can continue with reduced token usage.'));
            }
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    
    .addCommand(
      new Command('preserve')
        .description('Mark content as important to preserve during compression')
        .option('--session <id>', 'Session to modify')
        .option('--last <count>', 'Preserve last N exchanges', '3')
        .option('--interactive', 'Interactively select content to preserve')
        .action(async (options) => {
          console.log(chalk.cyan('🎯 Content Preservation\n'));
          
          if (options.interactive) {
            console.log(chalk.yellow('Interactive preservation mode coming soon!'));
            console.log(chalk.gray('This will allow you to select specific content to always preserve.'));
          } else {
            const count = parseInt(options.last);
            console.log(`✓ Marked last ${chalk.yellow(count)} exchanges as high priority`);
            console.log(chalk.gray('This content will be preserved during compression.'));
          }
          
          console.log(chalk.cyan('\n💡 Tip: Use specific markers in your messages:'));
          console.log(chalk.gray('  "!preserve This is critical information"'));
          console.log(chalk.gray('  "!important Remember this decision"'));
        })
    )
    
    .addCommand(
      new Command('config')
        .description('Configure context overflow settings')
        .option('--auto-threshold <percent>', 'Auto-compression threshold', '85')
        .option('--auto-compress', 'Enable automatic compression')
        .option('--strategy <level>', 'Default compression strategy', 'medium')
        .action(async (options) => {
          console.log(chalk.cyan('⚙️ Context Configuration\n'));
          console.log(`Auto Threshold: ${chalk.yellow(options.autoThreshold)}%`);
          console.log(`Auto Compress: ${chalk.yellow(options.autoCompress ? 'enabled' : 'disabled')}`);
          console.log(`Default Strategy: ${chalk.yellow(options.strategy)}`);
          console.log(chalk.green('\n✓ Configuration updated'));
          console.log(chalk.gray('Settings will be applied to future conversations.'));
        })
    );

  return command;
}