#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import dotenv from 'dotenv';
import { callOpenAI, OpenAIError } from './utils/openaiClient';
import { generateClaudePrompt } from './utils/promptGenerator';
import { 
  generatePromptSuggestions, 
  generateClaudePromptSuggestions,
  generateLearningAwareSuggestions,
  formatSuggestionsForCLI,
  formatGrowthInfo,
  ConversationContext,
  LearningContext
} from './utils/promptSuggestions';
import { createSessionCommand } from './commands/session';
import { createTemplateCommand } from './commands/template';
import { createHistoryCommand } from './commands/history';
import { createBatchCommand } from './commands/batch';
import { createUsageCommand } from './commands/usage';
import { createChatCommand } from './commands/chat';
import { createLearnCommand } from './commands/learn';
import { createHandoffCommand } from './commands/handoff';
import { createContextCommand } from './commands/context';
import { createPlanCommand } from './commands/plan';
import { createGuiCommand } from './commands/gui';
import { SessionManager } from './data/SessionManager';
import { TemplateManager } from './data/TemplateManager';
import { CommunicationBridge } from './data/CommunicationBridge';

// Load environment variables
dotenv.config();

const program = new Command();
const sessionManager = new SessionManager();
const templateManager = new TemplateManager();
const bridge = new CommunicationBridge(sessionManager, templateManager);

// Global option for session usage
program
  .name('claude-prompter')
  .description('CLI tool for enhanced AI prompt management and communication')
  .version('2.0.0')
  .option('--use-session <id>', 'Use a specific session for context');

// Format response in a nice box
function formatResponse(response: string, title: string = 'Response'): string {
  return boxen(response, {
    title: title,
    titleAlignment: 'center',
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    backgroundColor: '#1e1e1e',
  });
}

// Format error in a red box
function formatError(error: string): string {
  return boxen(error, {
    title: '⚠️  Error',
    titleAlignment: 'center',
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'red',
  });
}

// Generate or send prompt
async function handlePrompt(options: any) {
  try {
    // Check for session usage
    let currentSession = null;
    if (program.opts().useSession) {
      currentSession = await sessionManager.loadSession(program.opts().useSession);
      if (currentSession) {
        await bridge.initializeSession(program.opts().useSession);
      }
    }
    
    // Generate the prompt based on user input
    const prompt = await generateClaudePrompt(options);
    
    if (options.send) {
      // Send to OpenAI
      const spinner = ora({
        text: 'Calling GPT-4o...',
        spinner: 'dots12',
        color: 'cyan',
      }).start();
      
      try {
        const response = await callOpenAI(
          prompt, 
          options.system || 'You are Claude, a helpful AI assistant.',
          { command: 'prompt' }
        );
        spinner.succeed(chalk.green('Response received!'));
        
        // Display the response
        console.log(formatResponse(response, '🤖 GPT-4o Response'));
        
        if (options.showPrompt) {
          console.log(formatResponse(prompt, '📝 Prompt Sent'));
        }
        
        // Save to session if we're using one
        if (currentSession) {
          await sessionManager.addConversationEntry(
            currentSession.metadata.sessionId,
            prompt,
            response,
            'gpt-4o'
          );
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to get response'));
        
        if (error instanceof OpenAIError) {
          console.error(formatError(`${error.message}\n\nDetails: ${JSON.stringify(error.details, null, 2)}`));
        } else {
          console.error(formatError(error instanceof Error ? error.message : 'Unknown error'));
        }
        process.exit(1);
      }
    } else {
      // Just print the prompt
      console.log(formatResponse(prompt, '📝 Generated Prompt'));
      console.log(chalk.gray('\nTip: Use --send flag to send this prompt to GPT-4o'));
    }
  } catch (error) {
    console.error(formatError(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}

// Main CLI program
program
  .name('claude-prompter')
  .description('CLI tool for generating and sending prompts to GPT-4o')
  .version('1.0.0');

program
  .command('prompt')
  .description('Generate or send a prompt')
  .option('-m, --message <message>', 'The main message or question')
  .option('-c, --context <context>', 'Additional context for the prompt')
  .option('-s, --system <system>', 'System prompt (default: "You are Claude, a helpful AI assistant.")')
  .option('--send', 'Send the prompt to GPT-4o instead of just printing it')
  .option('--show-prompt', 'Show the prompt that was sent (when using --send)')
  .option('-t, --temperature <temp>', 'Temperature for GPT-4o (0-2)', '0.7')
  .option('--max-tokens <tokens>', 'Max tokens for response', '4000')
  .action(handlePrompt);

program
  .command('suggest')
  .description('Generate prompt suggestions based on a topic or Claude output')
  .option('-t, --topic <topic>', 'The topic or task you\'re working on')
  .option('-c, --code', 'Generate suggestions for code-related tasks')
  .option('-l, --language <language>', 'Programming language (if code-related)')
  .option('--complexity <level>', 'Task complexity: simple, moderate, or complex')
  .option('--task-type <type>', 'Type of task: api-integration, ui-component, cli-tool, etc.')
  .option('--claude-analysis', 'Generate suggestions as if Claude analyzed the output')
  .option('--show-growth', 'Show learning progress and growth-based suggestions')
  .option('--sessions <number>', 'Number of recent sessions to analyze for learning', '10')
  .action(async (options) => {
    if (!options.topic) {
      console.error(formatError('Topic is required. Use -t or --topic to specify.'));
      process.exit(1);
    }
    
    try {
      let suggestions;
      let learningContext: LearningContext | undefined;
      
      // Generate learning context if requested
      if (options.showGrowth) {
        const spinner = ora('Analyzing your learning journey...').start();
        
        try {
          // Analyze recent sessions for learning patterns
          const sessions = await sessionManager.listSessions();
          const recentSessions = sessions.slice(0, parseInt(options.sessions));
          
          const previousTopics: string[] = [];
          const commonPatterns: Array<{ pattern: string; frequency: number; category: string }> = [];
          const languages = new Set<string>();
          let totalConversations = 0;
          
          // Extract learning patterns from recent sessions
          for (const sessionSummary of recentSessions) {
            const session = await sessionManager.loadSession(sessionSummary.sessionId);
            if (!session) continue;
            
            totalConversations += session.history.length;
            
            // Extract topics from prompts
            session.history.forEach(entry => {
              const words = entry.prompt.toLowerCase().split(/\s+/);
              words.forEach(word => {
                if (word.length > 5 && !['create', 'implement', 'build', 'write', 'develop'].includes(word)) {
                  previousTopics.push(word);
                }
              });
              
              // Extract programming languages mentioned
              const langMatches = entry.prompt.match(/\b(javascript|typescript|python|java|react|node|express|sql|css|html)\b/gi);
              if (langMatches) {
                langMatches.forEach(lang => languages.add(lang.toLowerCase()));
              }
              
              // Look for pattern usage (simplified)
              if (entry.response.includes('pattern') || entry.response.includes('approach')) {
                const existingPattern = commonPatterns.find(p => entry.response.toLowerCase().includes(p.pattern));
                if (existingPattern) {
                  existingPattern.frequency++;
                } else {
                  commonPatterns.push({
                    pattern: 'solution-pattern',
                    frequency: 1,
                    category: 'implementation'
                  });
                }
              }
            });
          }
          
          // Build learning context
          learningContext = {
            previousTopics: Array.from(new Set(previousTopics)).slice(0, 10),
            commonPatterns: commonPatterns.filter(p => p.frequency >= 2),
            userPreferences: {
              commonLanguages: Array.from(languages),
              preferredComplexity: options.complexity as any
            },
            sessionCount: recentSessions.length,
            growthAreas: ['testing', 'deployment', 'performance', 'security'].filter(area => 
              !previousTopics.some(topic => topic.includes(area))
            )
          };
          
          spinner.succeed('Learning analysis complete!');
        } catch (error) {
          spinner.warn('Could not analyze learning patterns, using standard suggestions');
          learningContext = undefined;
        }
      }
      
      // Generate suggestions based on analysis type and learning context
      if (options.showGrowth && learningContext) {
        suggestions = generateLearningAwareSuggestions(options.topic, {
          codeGenerated: options.code,
          language: options.language,
          complexity: options.complexity,
          taskType: options.taskType,
          features: []
        }, learningContext);
      } else if (options.claudeAnalysis) {
        suggestions = generateClaudePromptSuggestions(options.topic, {
          codeGenerated: options.code,
          language: options.language,
          complexity: options.complexity,
          taskType: options.taskType,
          features: []
        });
      } else {
        const context: ConversationContext = {
          topic: options.topic,
          techStack: options.language ? [options.language] : undefined,
          currentTask: options.topic
        };
        suggestions = generatePromptSuggestions(context);
      }
      
      // Display growth information if available
      let output = '';
      if (learningContext) {
        output += formatGrowthInfo(learningContext);
      }
      
      output += formatSuggestionsForCLI(suggestions);
      
      const title = options.showGrowth ? '🌱 Learning-Aware Prompt Suggestions' : '💡 Prompt Suggestions';
      console.log(formatResponse(output, title));
      
      console.log(chalk.cyan('\n✨ To use a suggestion:'));
      console.log(chalk.gray('Copy the prompt and use: claude-prompter prompt -m "prompt" --send\n'));
      
      if (options.showGrowth && learningContext?.sessionCount > 0) {
        console.log(chalk.yellow(`🎯 Growth tip: These suggestions are personalized based on your ${learningContext.sessionCount} previous sessions!`));
      }
      
    } catch (error) {
      console.error(formatError(error instanceof Error ? error.message : 'Failed to generate suggestions'));
      process.exit(1);
    }
  });

// Add new commands
program.addCommand(createSessionCommand());
program.addCommand(createTemplateCommand());
program.addCommand(createHistoryCommand());
program.addCommand(createBatchCommand());
program.addCommand(createUsageCommand());
program.addCommand(createChatCommand());
program.addCommand(createLearnCommand());
program.addCommand(createHandoffCommand());
program.addCommand(createContextCommand());
program.addCommand(createPlanCommand());
program.addCommand(createGuiCommand());

program
  .command('config')
  .description('Check configuration and API key status')
  .action(() => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    console.log(boxen(
      `API Key Status: ${hasApiKey ? chalk.green('✓ Found') : chalk.red('✗ Missing')}\n` +
      `Model: ${chalk.cyan('gpt-4o')}\n` +
      `Endpoint: ${chalk.gray('https://api.openai.com/v1/chat/completions')}\n\n` +
      chalk.bold('Features:\n') +
      `  Sessions: ${chalk.green('✓ Enabled')}\n` +
      `  Templates: ${chalk.green('✓ Enabled')}\n` +
      `  History: ${chalk.green('✓ Enabled')}\n` +
      `  Learning: ${chalk.green('✓ Enabled')}`,
      {
        title: '⚙️  Configuration',
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      }
    ));
    
    if (!hasApiKey) {
      console.log(chalk.yellow('\nPlease add OPENAI_API_KEY to your .env file'));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}