import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
// import { DatabaseManager } from '../data/DatabaseManager'; // Will be used in future features
import { SessionManager } from '../data/SessionManager';

interface LearningPattern {
  id: string;
  pattern: string;
  category: 'command' | 'solution' | 'error' | 'technique';
  frequency: number;
  effectiveness: number;
  examples: string[];
  firstSeen: Date;
  lastSeen: Date;
}

interface LearningInsight {
  id: string;
  insight: string;
  confidence: number;
  basedOn: string[]; // Pattern IDs
  timestamp: Date;
}

class LearningEngine {
  // private db: DatabaseManager; // Will be used in future features
  private sessionManager: SessionManager;

  constructor() {
    // this.db = new DatabaseManager(); // Will be used in future features
    this.sessionManager = new SessionManager();
  }

  async analyzePatterns(options: {
    sessions?: number;
    minFrequency?: number;
    category?: string;
  }): Promise<LearningPattern[]> {
    const spinner = ora('Analyzing conversation patterns...').start();
    
    try {
      // Get recent sessions
      const sessions = await this.sessionManager.listSessions();

      const patterns: Map<string, LearningPattern> = new Map();
      
      // Analyze each session
      for (const sessionSummary of sessions) {
        const session = await this.sessionManager.loadSession(sessionSummary.sessionId);
        if (!session) continue;

        // Extract patterns from conversation history
        for (const entry of session.history) {
          // Look for command patterns (e.g., /help, /suggest)
          const commandMatches = entry.prompt.match(/\/\w+/g);
          if (commandMatches) {
            commandMatches.forEach(cmd => {
              this.updatePattern(patterns, {
                pattern: cmd,
                category: 'command',
                example: entry.prompt
              });
            });
          }

          // Look for error patterns
          if (entry.response.toLowerCase().includes('error') || 
              entry.prompt.toLowerCase().includes('error')) {
            const errorContext = this.extractErrorContext(entry.prompt + ' ' + entry.response);
            if (errorContext) {
              this.updatePattern(patterns, {
                pattern: errorContext,
                category: 'error',
                example: entry.prompt
              });
            }
          }

          // Look for solution patterns
          if (entry.response.includes('```') || 
              entry.response.toLowerCase().includes('solution')) {
            const solutionType = this.extractSolutionType(entry.response);
            if (solutionType) {
              this.updatePattern(patterns, {
                pattern: solutionType,
                category: 'solution',
                example: entry.response.substring(0, 200)
              });
            }
          }
        }
      }

      spinner.succeed('Pattern analysis complete!');
      
      // Filter by minimum frequency
      const minFreq = options.minFrequency || 2;
      return Array.from(patterns.values())
        .filter(p => p.frequency >= minFreq)
        .sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      spinner.fail('Pattern analysis failed');
      throw error;
    }
  }

  private updatePattern(patterns: Map<string, LearningPattern>, data: {
    pattern: string;
    category: LearningPattern['category'];
    example: string;
  }) {
    const existing = patterns.get(data.pattern);
    
    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date();
      if (!existing.examples.includes(data.example)) {
        existing.examples.push(data.example);
      }
    } else {
      patterns.set(data.pattern, {
        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: data.pattern,
        category: data.category,
        frequency: 1,
        effectiveness: 0.5, // Default, will be updated based on feedback
        examples: [data.example],
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }
  }

  private extractErrorContext(text: string): string | null {
    // Simple error pattern extraction
    const errorPatterns = [
      /TypeError: (.+)/i,
      /ReferenceError: (.+)/i,
      /SyntaxError: (.+)/i,
      /Error: (.+)/i,
      /failed to (.+)/i,
      /cannot (.+)/i
    ];

    for (const pattern of errorPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].substring(0, 50); // Truncate for pattern matching
      }
    }
    return null;
  }

  private extractSolutionType(text: string): string | null {
    // Extract solution patterns
    const solutionIndicators = [
      { pattern: /```(\w+)/, type: 'code' },
      { pattern: /npm install (.+)/, type: 'package-install' },
      { pattern: /git (.+)/, type: 'git-command' },
      { pattern: /function\s+\w+/, type: 'function-definition' },
      { pattern: /class\s+\w+/, type: 'class-definition' },
      { pattern: /import\s+.+\s+from/, type: 'import-statement' }
    ];

    for (const { pattern, type } of solutionIndicators) {
      if (pattern.test(text)) {
        return type;
      }
    }
    return null;
  }

  async generateInsights(patterns: LearningPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    // Insight 1: Most common patterns
    const topPatterns = patterns.slice(0, 5);
    if (topPatterns.length > 0) {
      insights.push({
        id: `insight-${Date.now()}-1`,
        insight: `Most frequent patterns: ${topPatterns.map(p => p.pattern).join(', ')}`,
        confidence: 0.9,
        basedOn: topPatterns.map(p => p.id),
        timestamp: new Date()
      });
    }

    // Insight 2: Error patterns
    const errorPatterns = patterns.filter(p => p.category === 'error');
    if (errorPatterns.length > 3) {
      insights.push({
        id: `insight-${Date.now()}-2`,
        insight: `Common errors encountered: ${errorPatterns.slice(0, 3).map(p => p.pattern).join(', ')}. Consider adding specific handling for these.`,
        confidence: 0.8,
        basedOn: errorPatterns.map(p => p.id),
        timestamp: new Date()
      });
    }

    // Insight 3: Solution preferences
    const solutionPatterns = patterns.filter(p => p.category === 'solution');
    const codePatterns = solutionPatterns.filter(p => p.pattern.includes('code'));
    if (codePatterns.length > 0) {
      insights.push({
        id: `insight-${Date.now()}-3`,
        insight: `Code solutions are frequently used (${codePatterns.length} instances). Users prefer practical examples.`,
        confidence: 0.85,
        basedOn: codePatterns.map(p => p.id),
        timestamp: new Date()
      });
    }

    return insights;
  }

  formatPatternReport(patterns: LearningPattern[], insights: LearningInsight[]): string {
    let report = chalk.bold('📊 Pattern Analysis Report\n\n');

    // Group patterns by category
    const byCategory = patterns.reduce((acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    }, {} as Record<string, LearningPattern[]>);

    // Display each category
    Object.entries(byCategory).forEach(([category, catPatterns]) => {
      report += chalk.cyan(`\n${category.toUpperCase()} Patterns:\n`);
      report += chalk.gray('─'.repeat(40)) + '\n';
      
      catPatterns.slice(0, 5).forEach(p => {
        report += `  ${chalk.yellow(p.pattern)} `;
        report += chalk.gray(`(used ${p.frequency} times)\n`);
        if (p.examples[0]) {
          report += chalk.dim(`    Example: ${p.examples[0].substring(0, 60)}...\n`);
        }
      });
    });

    // Display insights
    if (insights.length > 0) {
      report += chalk.cyan('\n\n💡 INSIGHTS:\n');
      report += chalk.gray('─'.repeat(40)) + '\n';
      
      insights.forEach(insight => {
        report += `  • ${insight.insight}\n`;
        report += chalk.gray(`    Confidence: ${(insight.confidence * 100).toFixed(0)}%\n\n`);
      });
    }

    return report;
  }
}

export function createLearnCommand(): Command {
  const command = new Command('learn')
    .description('Ultra-learning features for continuous improvement')
    .addCommand(
      new Command('analyze')
        .description('Analyze patterns in conversation history')
        .option('--sessions <number>', 'Number of sessions to analyze', '50')
        .option('--min-frequency <number>', 'Minimum pattern frequency', '2')
        .option('--category <type>', 'Filter by category (command/solution/error/technique)')
        .action(async (options) => {
          const engine = new LearningEngine();
          
          try {
            const patterns = await engine.analyzePatterns({
              sessions: parseInt(options.sessions),
              minFrequency: parseInt(options.minFrequency),
              category: options.category
            });

            const insights = await engine.generateInsights(patterns);
            const report = engine.formatPatternReport(patterns, insights);

            console.log(boxen(report, {
              title: '🧠 Learning Analysis',
              titleAlignment: 'center',
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'magenta'
            }));

            if (patterns.length === 0) {
              console.log(chalk.yellow('\nNo patterns found. Try analyzing more sessions or lowering the frequency threshold.'));
            }
          } catch (error) {
            console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    .addCommand(
      new Command('insights')
        .description('Generate insights from learned patterns')
        .option('--export', 'Export insights to file')
        .action(async (_options) => {
          console.log(chalk.cyan('🔮 Generating insights from learned patterns...'));
          // TODO: Implement insight generation
          console.log(chalk.yellow('This feature is coming soon!'));
        })
    )
    .addCommand(
      new Command('apply')
        .description('Apply learned patterns to current context')
        .argument('<pattern>', 'Pattern name or ID to apply')
        .action(async (pattern) => {
          console.log(chalk.cyan(`🎯 Applying pattern: ${pattern}`));
          // TODO: Implement pattern application
          console.log(chalk.yellow('This feature is coming soon!'));
        })
    );

  return command;
}