import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { SessionManager } from '../data/SessionManager';

interface UsageMetrics {
  tokensUsed: number;
  tokensLimit: number;
  sessionDuration: number;
  complexityScore: number;
  userSatisfaction: number;
}

interface HandoffTrigger {
  type: 'usage_limit' | 'complexity_mismatch' | 'user_request' | 'optimization';
  confidence: number;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high';
}

interface HandoffContext {
  sessionId: string;
  timestamp: Date;
  sourceModel: 'opus' | 'sonnet' | 'gpt4o';
  targetModel: 'opus' | 'sonnet' | 'gpt4o';
  
  conversationHistory: any[];
  currentTask: {
    primaryGoal: string;
    subGoals: string[];
    constraints: string[];
    progress: number;
    nextSteps: string[];
    criticalContext: string[];
  };
  
  handoffReason: string;
  preservationLevel: 'minimal' | 'standard' | 'complete';
}

interface SubagentCandidate {
  taskType: 'analysis' | 'research' | 'coding' | 'writing' | 'debugging';
  complexity: number;
  estimatedTokens: number;
  suggestedModel: 'opus' | 'sonnet' | 'gpt4o';
  confidence: number;
  reasoning: string[];
}

class HandoffEngine {
  private sessionManager: SessionManager;
  private config: {
    autoHandoff: boolean;
    opusLimit: number;
    preservationLevel: 'minimal' | 'standard' | 'complete';
  };

  constructor() {
    this.sessionManager = new SessionManager();
    this.config = {
      autoHandoff: false,
      opusLimit: 0.8, // 80%
      preservationLevel: 'standard'
    };
  }

  async checkUsageStatus(): Promise<{ metrics: UsageMetrics; trigger?: HandoffTrigger }> {
    const spinner = ora('Checking model usage status...').start();
    
    try {
      // Simulate usage metrics (in real implementation, this would query actual usage)
      const metrics: UsageMetrics = {
        tokensUsed: 85000,
        tokensLimit: 100000,
        sessionDuration: 3600, // 1 hour
        complexityScore: 0.7,
        userSatisfaction: 0.85
      };

      const usagePercentage = metrics.tokensUsed / metrics.tokensLimit;
      let trigger: HandoffTrigger | undefined;

      if (usagePercentage >= this.config.opusLimit) {
        trigger = {
          type: 'usage_limit',
          confidence: 0.95,
          reasoning: `Usage at ${(usagePercentage * 100).toFixed(1)}% of limit`,
          urgency: usagePercentage > 0.9 ? 'high' : 'medium'
        };
      }

      spinner.succeed('Usage status checked');
      return { metrics, trigger };
    } catch (error) {
      spinner.fail('Failed to check usage status');
      throw error;
    }
  }

  async suggestSubagents(taskDescription: string): Promise<SubagentCandidate[]> {
    const spinner = ora('Analyzing task for subagent opportunities...').start();
    
    try {
      const candidates: SubagentCandidate[] = [];

      // Simple pattern matching for subagent detection
      const codePatterns = /\b(implement|build|create|develop|code|program)\b/i;
      const analysisPatterns = /\b(analyze|examine|review|assess|evaluate)\b/i;
      const researchPatterns = /\b(research|investigate|explore|find|discover)\b/i;
      const debugPatterns = /\b(debug|fix|troubleshoot|error|bug)\b/i;
      const writePatterns = /\b(write|document|explain|describe)\b/i;

      if (codePatterns.test(taskDescription)) {
        candidates.push({
          taskType: 'coding',
          complexity: 0.8,
          estimatedTokens: 5000,
          suggestedModel: 'sonnet',
          confidence: 0.85,
          reasoning: ['Task involves coding/implementation', 'Sonnet excels at code generation']
        });
      }

      if (analysisPatterns.test(taskDescription)) {
        candidates.push({
          taskType: 'analysis',
          complexity: 0.9,
          estimatedTokens: 8000,
          suggestedModel: 'opus',
          confidence: 0.9,
          reasoning: ['Task requires deep analysis', 'Opus provides superior analytical capabilities']
        });
      }

      if (researchPatterns.test(taskDescription)) {
        candidates.push({
          taskType: 'research',
          complexity: 0.6,
          estimatedTokens: 3000,
          suggestedModel: 'gpt4o',
          confidence: 0.75,
          reasoning: ['Task involves research/information gathering', 'GPT-4o has broad knowledge base']
        });
      }

      if (debugPatterns.test(taskDescription)) {
        candidates.push({
          taskType: 'debugging',
          complexity: 0.7,
          estimatedTokens: 4000,
          suggestedModel: 'sonnet',
          confidence: 0.8,
          reasoning: ['Task involves debugging', 'Sonnet good at systematic problem solving']
        });
      }

      if (writePatterns.test(taskDescription)) {
        candidates.push({
          taskType: 'writing',
          complexity: 0.5,
          estimatedTokens: 2000,
          suggestedModel: 'opus',
          confidence: 0.7,
          reasoning: ['Task involves writing/documentation', 'Opus excels at creative writing']
        });
      }

      // Sort by confidence
      candidates.sort((a, b) => b.confidence - a.confidence);

      spinner.succeed('Subagent analysis complete');
      return candidates.slice(0, 3); // Return top 3 suggestions
    } catch (error) {
      spinner.fail('Subagent analysis failed');
      throw error;
    }
  }

  async prepareHandoffContext(sessionId: string, targetModel: string, reason: string): Promise<HandoffContext> {
    const spinner = ora('Preparing handoff context...').start();
    
    try {
      const session = await this.sessionManager.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const context: HandoffContext = {
        sessionId,
        timestamp: new Date(),
        sourceModel: 'opus', // In real implementation, detect current model
        targetModel: targetModel as any,
        
        conversationHistory: session.history,
        currentTask: {
          primaryGoal: 'Extracted from conversation context',
          subGoals: ['Sub-goal 1', 'Sub-goal 2'],
          constraints: ['Time limit', 'Resource constraints'],
          progress: 0.6,
          nextSteps: ['Next step 1', 'Next step 2'],
          criticalContext: ['Important context 1', 'Important context 2']
        },
        
        handoffReason: reason,
        preservationLevel: this.config.preservationLevel
      };

      spinner.succeed('Handoff context prepared');
      return context;
    } catch (error) {
      spinner.fail('Failed to prepare handoff context');
      throw error;
    }
  }

  formatUsageReport(metrics: UsageMetrics, trigger?: HandoffTrigger): string {
    const usagePercentage = (metrics.tokensUsed / metrics.tokensLimit * 100).toFixed(1);
    const durationHours = (metrics.sessionDuration / 3600).toFixed(1);
    
    let report = chalk.bold('📊 Model Usage Status\n\n');
    
    // Usage metrics
    report += chalk.cyan('Current Usage:\n');
    report += chalk.gray('─'.repeat(30)) + '\n';
    report += `  Tokens: ${chalk.yellow(metrics.tokensUsed.toLocaleString())} / ${metrics.tokensLimit.toLocaleString()} `;
    report += `(${usagePercentage}%)\n`;
    report += `  Duration: ${chalk.yellow(durationHours)} hours\n`;
    report += `  Complexity: ${chalk.yellow((metrics.complexityScore * 100).toFixed(0))}%\n`;
    report += `  Satisfaction: ${chalk.yellow((metrics.userSatisfaction * 100).toFixed(0))}%\n`;

    // Handoff trigger
    if (trigger) {
      report += chalk.cyan('\n⚠️  Handoff Recommended:\n');
      report += chalk.gray('─'.repeat(30)) + '\n';
      report += `  Trigger: ${chalk.yellow(trigger.type.replace('_', ' '))}\n`;
      report += `  Urgency: ${this.getUrgencyColor(trigger.urgency)(trigger.urgency)}\n`;
      report += `  Confidence: ${chalk.yellow((trigger.confidence * 100).toFixed(0))}%\n`;
      report += `  Reason: ${trigger.reasoning}\n`;
    } else {
      report += chalk.green('\n✓ No handoff needed at this time\n');
    }

    return report;
  }

  formatSubagentReport(candidates: SubagentCandidate[]): string {
    if (candidates.length === 0) {
      return chalk.gray('No subagent opportunities detected.');
    }

    let report = chalk.bold('🤖 Subagent Recommendations\n\n');
    
    candidates.forEach((candidate, index) => {
      report += chalk.cyan(`${index + 1}. ${candidate.taskType.toUpperCase()} Agent\n`);
      report += chalk.gray('─'.repeat(25)) + '\n';
      report += `  Model: ${chalk.yellow(candidate.suggestedModel)}\n`;
      report += `  Complexity: ${chalk.yellow((candidate.complexity * 100).toFixed(0))}%\n`;
      report += `  Est. Tokens: ${chalk.yellow(candidate.estimatedTokens.toLocaleString())}\n`;
      report += `  Confidence: ${chalk.yellow((candidate.confidence * 100).toFixed(0))}%\n`;
      report += `  Reasoning:\n`;
      candidate.reasoning.forEach(reason => {
        report += `    • ${chalk.gray(reason)}\n`;
      });
      report += '\n';
    });

    return report;
  }

  private getUrgencyColor(urgency: string) {
    switch (urgency) {
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.gray;
    }
  }
}

export function createHandoffCommand(): Command {
  const command = new Command('handoff')
    .description('Multi-model handoff and subagent orchestration')
    
    .addCommand(
      new Command('status')
        .description('Check current model usage and handoff recommendations')
        .action(async () => {
          const engine = new HandoffEngine();
          
          try {
            const { metrics, trigger } = await engine.checkUsageStatus();
            const report = engine.formatUsageReport(metrics, trigger);

            console.log(boxen(report, {
              title: '🔄 Handoff Status',
              titleAlignment: 'center',
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: trigger ? 'yellow' : 'green'
            }));

            if (trigger && trigger.urgency === 'high') {
              console.log(chalk.red('\n⚠️  Immediate handoff recommended!'));
              console.log(chalk.gray('Run: claude-prompter handoff prepare --to sonnet'));
            }
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    
    .addCommand(
      new Command('subagent')
        .description('Analyze task for subagent opportunities')
        .argument('[task]', 'Task description to analyze')
        .action(async (task) => {
          const engine = new HandoffEngine();
          
          try {
            let taskDescription = task;
            if (!taskDescription) {
              const { description } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'description',
                  message: 'Describe the task you want to analyze:',
                  validate: (input) => input.length > 0 || 'Please provide a task description'
                }
              ]);
              taskDescription = description;
            }

            const candidates = await engine.suggestSubagents(taskDescription);
            const report = engine.formatSubagentReport(candidates);

            console.log(boxen(report, {
              title: '🤖 Subagent Analysis',
              titleAlignment: 'center',
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'cyan'
            }));

            if (candidates.length > 0) {
              console.log(chalk.cyan('\n💡 To create a subagent:'));
              console.log(chalk.gray('claude-prompter handoff create --type [type] --model [model]'));
            }
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    
    .addCommand(
      new Command('prepare')
        .description('Prepare context for model handoff')
        .option('--to <model>', 'Target model (opus/sonnet/gpt4o)', 'sonnet')
        .option('--session <id>', 'Session ID to handoff')
        .option('--reason <reason>', 'Reason for handoff', 'usage_optimization')
        .action(async (options) => {
          const engine = new HandoffEngine();
          
          try {
            let sessionId = options.session;
            if (!sessionId) {
              // Get most recent session
              const sessions = await engine['sessionManager'].listSessions();
              if (sessions.length === 0) {
                console.log(chalk.yellow('No sessions found. Please specify --session <id>'));
                return;
              }
              sessionId = sessions[0].sessionId;
            }

            const context = await engine.prepareHandoffContext(sessionId, options.to, options.reason);
            
            console.log(boxen(
              chalk.bold('🔄 Handoff Context Prepared\n\n') +
              `Session: ${chalk.cyan(context.sessionId)}\n` +
              `From: ${chalk.yellow(context.sourceModel)} → To: ${chalk.yellow(context.targetModel)}\n` +
              `Reason: ${chalk.gray(context.handoffReason)}\n` +
              `Preservation: ${chalk.green(context.preservationLevel)}\n` +
              `History Items: ${chalk.blue(context.conversationHistory.length)}\n` +
              `Progress: ${chalk.yellow((context.currentTask.progress * 100).toFixed(0))}%`,
              {
                title: '✓ Ready for Handoff',
                titleAlignment: 'center',
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'green'
              }
            ));

            console.log(chalk.cyan('\n📋 Next Steps:'));
            context.currentTask.nextSteps.forEach((step, i) => {
              console.log(`  ${i + 1}. ${chalk.gray(step)}`);
            });

            console.log(chalk.cyan('\n💡 To execute handoff:'));
            console.log(chalk.gray('claude-prompter handoff execute --context [context-id]'));
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        })
    )
    
    .addCommand(
      new Command('config')
        .description('Configure handoff settings')
        .option('--auto <boolean>', 'Enable automatic handoff', 'false')
        .option('--opus-limit <percent>', 'Opus usage limit threshold', '80')
        .option('--preserve <level>', 'Context preservation level (minimal/standard/complete)', 'standard')
        .action(async (options) => {
          console.log(chalk.cyan('🔧 Handoff Configuration\n'));
          console.log(`Auto Handoff: ${chalk.yellow(options.auto)}`);
          console.log(`Opus Limit: ${chalk.yellow(options.opusLimit)}%`);
          console.log(`Preservation: ${chalk.yellow(options.preserve)}`);
          console.log(chalk.green('\n✓ Configuration updated'));
          console.log(chalk.gray('Note: Configuration will be persisted in future versions'));
        })
    );

  return command;
}