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
import {
  generateSubagentWorkflowSuggestions,
  generateContextualWorkflowSuggestions,
  analyzeTopicForWorkflows
} from './utils/subagentWorkflows';
import { setPersonality, PersonalityMode } from './utils/personalitySystem';
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
import { createStatsCommand } from './commands/stats';
import { createPatternsCommand } from './commands/patterns';
import { createMigrateCommand } from './commands/migrate';
import { createMultishotCommand } from './commands/multishot';
import { createAnalyticsCommand } from './commands/analytics';
import { createABTestCommand } from './commands/abtest';
import { createNaturalCommand } from './commands/natural';
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

// Show natural language alternative after traditional commands
function showNaturalLanguageHint(commandName: string, _context?: string): void {
  const suggestions = {
    suggest: 'claude-prompter ask "suggest ideas for [your topic]"',
    prompt: 'claude-prompter ask "help me with [your question]"',
    stats: 'claude-prompter ask "show my learning progress"',
    usage: 'claude-prompter ask "show my API usage today"',
    patterns: 'claude-prompter ask "analyze my coding patterns"',
    multishot: 'claude-prompter ask "compare [your question] across models"'
  };

  const suggestion = suggestions[commandName as keyof typeof suggestions];
  if (suggestion) {
    console.log(chalk.cyan('\n✨ Natural Language Alternative:'));
    console.log(chalk.gray(`  ${suggestion}`));
    console.log(chalk.gray('  (Includes multishot intelligence by default!)'));
  }
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
      showNaturalLanguageHint('prompt');
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
  .option('--subagent-chains', 'Generate Claude Code subagent workflow chain suggestions')
  .option('--personality <mode>', 'Personality mode: default, allmight, formal, casual', 'default')
  .action(async (options) => {
    if (!options.topic) {
      console.error(formatError('Topic is required. Use -t or --topic to specify.'));
      process.exit(1);
    }
    
    // Set personality mode
    setPersonality(options.personality as PersonalityMode);
    
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
      if (options.subagentChains) {
        // Generate subagent workflow chain suggestions
        const workflowSuggestions = generateSubagentWorkflowSuggestions(options.topic, {
          codeGenerated: options.code,
          language: options.language,
          complexity: options.complexity,
          taskType: options.taskType
        });
        
        // Add contextual workflow suggestions if learning context is available
        const contextualSuggestions = learningContext 
          ? generateContextualWorkflowSuggestions(
              options.topic,
              [], // Session history would be extracted from learningContext
              learningContext.commonPatterns
            )
          : [];
        
        suggestions = [...workflowSuggestions, ...contextualSuggestions];
        
        // Also analyze topic for workflow recommendations
        const workflowAnalysis = analyzeTopicForWorkflows(options.topic);
        if (workflowAnalysis.confidence > 50) {
          console.log(chalk.blue('\n🎯 Workflow Analysis:'));
          console.log(chalk.gray(`   ${workflowAnalysis.reasoning}`));
          console.log(chalk.yellow(`   Confidence: ${workflowAnalysis.confidence}%\n`));
        }
        
      } else if (options.showGrowth && learningContext) {
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
      
      // Personality-aware title
      let title;
      if (options.personality === 'allmight') {
        title = options.subagentChains ? '🦸 HEROIC SUBAGENT WORKFLOWS - PLUS ULTRA!' :
                options.showGrowth ? '🦸 HERO TRAINING SUGGESTIONS - PLUS ULTRA!' : '💪 MIGHTY PROMPT SUGGESTIONS';
      } else {
        title = options.subagentChains ? '🔗 Subagent Workflow Chain Suggestions' :
                options.showGrowth ? '🌱 Learning-Aware Prompt Suggestions' : '💡 Prompt Suggestions';
      }
      
      console.log(formatResponse(output, title));
      
      // Personality-aware usage instructions
      if (options.personality === 'allmight') {
        if (options.subagentChains) {
          console.log(chalk.bold.yellow('\n⚡ TO UNLEASH HEROIC SUBAGENT POWER:'));
          console.log(chalk.bold.cyan('1. COPY THE WORKFLOW PROMPT'));
          console.log(chalk.bold.cyan('2. USE: echo "[WORKFLOW PROMPT]" | claude-code'));
          console.log(chalk.bold.yellow('3. WATCH THE SUBAGENT HEROES WORK TOGETHER! PLUS ULTRA!\n'));
        } else {
          console.log(chalk.bold.yellow('\n⚡ TO USE A HERO SUGGESTION:'));
          console.log(chalk.bold.cyan('COPY THE PROMPT AND UNLEASH: claude-prompter prompt -m "prompt" --send --personality allmight\n'));
        }
      } else {
        if (options.subagentChains) {
          console.log(chalk.cyan('\n🔗 To execute a subagent workflow:'));
          console.log(chalk.gray('1. Copy the workflow prompt'));
          console.log(chalk.gray('2. Use: echo "[workflow prompt]" | claude-code'));
          console.log(chalk.gray('3. The subagents will execute in sequence automatically\n'));
        } else {
          console.log(chalk.cyan('\n✨ To use a suggestion:'));
          console.log(chalk.gray('Copy the prompt and use: claude-prompter prompt -m "prompt" --send\n'));
        }
      }
      
      if (options.subagentChains) {
        if (options.personality === 'allmight') {
          console.log(chalk.bold.yellow('🔥 HERO FACT: SUBAGENT WORKFLOWS CREATE UNSTOPPABLE TEAM POWER! COMBINE MULTIPLE HEROES FOR MAXIMUM IMPACT!'));
        } else {
          console.log(chalk.yellow('🎯 Workflow tip: Subagent chains combine specialized expertise for comprehensive solutions!'));
        }
      } else if (options.showGrowth && learningContext?.sessionCount > 0) {
        if (options.personality === 'allmight') {
          console.log(chalk.bold.yellow(`🔥 HERO FACT: THESE MIGHTY SUGGESTIONS ARE FORGED FROM YOUR ${learningContext.sessionCount} TRAINING SESSIONS! GO BEYOND!`));
        } else {
          console.log(chalk.yellow(`🎯 Growth tip: These suggestions are personalized based on your ${learningContext.sessionCount} previous sessions!`));
        }
      }
      
      // Command completed successfully - show natural language hint
      showNaturalLanguageHint('suggest', options.topic);
      
    } catch (error) {
      // Command failed
      
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
program.addCommand(createStatsCommand());
program.addCommand(createPatternsCommand());
program.addCommand(createMigrateCommand());
program.addCommand(createMultishotCommand());
program.addCommand(createAnalyticsCommand());
program.addCommand(createABTestCommand());
program.addCommand(createNaturalCommand());

program
  .command('capabilities')
  .alias('help-features')
  .description('Show all claude-prompter capabilities with examples')
  .action(() => {
    console.log(boxen(
      chalk.cyan.bold('🚀 Claude-Prompter Capabilities') + '\n\n' +
      
      chalk.yellow.bold('🗣️  NATURAL LANGUAGE INTERFACE (Primary Method!)') + '\n' +
      chalk.gray('🎯 97% Intent Recognition • ⚡ Zero Learning Curve • 🧠 Multishot Intelligence by Default') + '\n\n' +
      
      chalk.green('Common Examples:') + '\n' +
      chalk.cyan('  claude-prompter ask "suggest React authentication ideas"') + '\n' +
      chalk.cyan('  claude-prompter ask "run multishot analysis on API design patterns"') + '\n' +
      chalk.cyan('  claude-prompter ask "show me today\'s usage and costs"') + '\n' +
      chalk.cyan('  claude-prompter ask "analyze my TypeScript learning patterns"') + '\n' +
      chalk.cyan('  claude-prompter ask "help me debug this performance issue"') + '\n' +
      chalk.cyan('  claude-prompter ask "compare authentication approaches across models"') + '\n\n' +
      
      chalk.yellow('🎛️  Natural Language Options:') + '\n' +
      chalk.cyan('  --dry-run') + chalk.gray('           # See what command will execute') + '\n' +
      chalk.cyan('  --disable-multishot') + chalk.gray('  # Use single model instead of multishot') + '\n' +
      chalk.cyan('  --force-multishot') + chalk.gray('    # Force multishot even for "quick" requests') + '\n\n' +
      
      chalk.yellow.bold('🤖  MULTISHOT ANALYSIS') + '\n' +
      chalk.gray('Compare insights across multiple AI models (GPT-5, GPT-5-mini, GPT-5-nano, qwen3)') + '\n' +
      chalk.green('Natural: ') + chalk.cyan('claude-prompter ask "compare authentication approaches"') + '\n' +
      chalk.gray('Traditional: ') + chalk.gray('claude-prompter multishot -m "your question"') + '\n\n' +
      
      chalk.yellow.bold('💡  INTELLIGENT SUGGESTIONS') + '\n' +
      chalk.gray('Get contextual follow-up prompts based on your work') + '\n' +
      chalk.green('Natural: ') + chalk.cyan('claude-prompter ask "suggest next steps for React project"') + '\n' +
      chalk.gray('Traditional: ') + chalk.gray('claude-prompter suggest -t "topic" --claude-analysis') + '\n\n' +
      
      chalk.yellow.bold('💰  USAGE & COST TRACKING') + '\n' +
      chalk.gray('Monitor API usage and spending') + '\n' +
      chalk.green('Natural: ') + chalk.cyan('claude-prompter ask "show me today\'s usage"') + '\n' +
      chalk.gray('Traditional: ') + chalk.gray('claude-prompter usage --today') + '\n\n' +
      
      chalk.yellow.bold('📊  LEARNING ANALYTICS') + '\n' +
      chalk.gray('Track your progress and discover patterns') + '\n' +
      chalk.green('Natural: ') + chalk.cyan('claude-prompter ask "show my learning progress"') + '\n' +
      chalk.gray('Traditional: ') + chalk.gray('claude-prompter stats --detailed') + '\n\n' +
      
      chalk.yellow.bold('🏠  LOCAL AI MODELS (60-80% Cost Savings!)') + '\n' +
      chalk.gray('Use qwen3, qwen2.5-coder for free analysis (requires Ollama)') + '\n' +
      chalk.green('Setup: ') + chalk.cyan('ollama pull qwen3:latest && ollama serve') + '\n' +
      chalk.green('Usage: ') + chalk.cyan('Models auto-included in multishot by default') + '\n\n' +
      
      chalk.yellow.bold('🔍  DEBUGGING TIPS') + '\n' +
      chalk.cyan('  --dry-run') + chalk.gray('     See what command will execute') + '\n' +
      chalk.cyan('  --help') + chalk.gray('        Get help for any command') + '\n' +
      chalk.cyan('  capabilities') + chalk.gray('   Show this help (alias: help-features)') + '\n\n' +
      
      chalk.green.bold('💡 Pro Tip: ') + chalk.white('Start with "claude-prompter ask" and describe what you want naturally!')
      ,
      { 
        padding: 1, 
        borderColor: 'cyan', 
        borderStyle: 'round',
        margin: { top: 1, bottom: 1 }
      }
    ));
  });

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

// Show enhanced help with natural language first if no command provided
if (!process.argv.slice(2).length) {
  console.log(boxen(
    chalk.cyan.bold('🗣️  Welcome to claude-prompter!') + '\n\n' +
    
    chalk.yellow.bold('✨ NATURAL LANGUAGE INTERFACE (Recommended!)') + '\n' +
    chalk.gray('Talk to claude-prompter like a human - no complex syntax needed!') + '\n\n' +
    
    chalk.green.bold('Quick Start Examples:') + '\n' +
    chalk.cyan('  claude-prompter ask "suggest React authentication ideas"') + '\n' +
    chalk.cyan('  claude-prompter ask "run multishot analysis on API design"') + '\n' +
    chalk.cyan('  claude-prompter ask "show me today\'s usage and costs"') + '\n' +
    chalk.cyan('  claude-prompter ask "analyze my learning patterns"') + '\n\n' +
    
    chalk.yellow.bold('🤖 Multishot Intelligence by Default') + '\n' +
    chalk.gray('Compares insights across multiple AI models (GPT-5, GPT-5-mini, qwen3)') + '\n' +
    chalk.gray('Add "quick" or "single" to your request for single-model analysis') + '\n\n' +
    
    chalk.green.bold('📚 Learn More:') + '\n' +
    chalk.cyan('  claude-prompter capabilities') + chalk.gray('  # See all features with examples') + '\n' +
    chalk.cyan('  claude-prompter config') + chalk.gray('        # Check your setup') + '\n' +
    chalk.cyan('  claude-prompter --help') + chalk.gray('       # Traditional CLI commands') + '\n\n' +
    
    chalk.green.bold('💡 Pro Tip: ') + chalk.white('Start with "claude-prompter ask" and describe what you want naturally!')
    ,
    { 
      padding: 1, 
      borderColor: 'cyan', 
      borderStyle: 'round',
      margin: { top: 1, bottom: 1 }
    }
  ));
} else {
  // Parse command line arguments only if there are arguments
  program.parse(process.argv);
}