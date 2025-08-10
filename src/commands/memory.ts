import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { SessionContextManager, SessionContext } from '../services/SessionContextManager';

interface MemoryOptions {
  show?: boolean;
  context?: boolean;
  patterns?: boolean;
  topics?: boolean;
  preferences?: boolean;
  suggestions?: boolean;
  clear?: boolean;
  export?: string;
  import?: string;
  stats?: boolean;
  project?: string;
  limit?: string;
  json?: boolean;
}

/**
 * Create the memory command for session context and learning management
 */
export function createMemoryCommand(): Command {
  const command = new Command('memory');
  
  command
    .description('🧠 Manage session memory, context, and learning patterns')
    .option('-s, --show', 'Show current session memory and context')
    .option('-c, --context', 'Display conversation context for AI interactions')
    .option('-p, --patterns', 'Show learned patterns and their effectiveness')
    .option('-t, --topics', 'Show topic frequencies and expertise levels')
    .option('--preferences', 'Display user preferences and settings')
    .option('--suggestions', 'Get contextual suggestions based on learning patterns')
    .option('--clear', 'Clear current session memory (keeps learning patterns)')
    .option('--export <file>', 'Export session data to file')
    .option('--import <file>', 'Import session data from file')
    .option('--stats', 'Show comprehensive memory and learning statistics')
    .option('--project <path>', 'Work with specific project session')
    .option('-l, --limit <number>', 'Limit number of items shown', '10')
    .option('--json', 'Output results as JSON')
    .action(async (options: MemoryOptions) => {
      const contextManager = new SessionContextManager();
      
      try {
        // Initialize session for current or specified project
        const projectPath = options.project ? options.project : process.cwd();
        const session = await contextManager.initializeSession(projectPath);
        
        if (options.clear) {
          await clearSessionMemory(contextManager);
        } else if (options.export) {
          await exportSessionData(contextManager, options.export);
        } else if (options.import) {
          await importSessionData(contextManager, options.import);
        } else if (options.context) {
          displayConversationContext(contextManager);
        } else if (options.patterns) {
          displayLearningPatterns(session, parseInt(options.limit || '10'), options.json);
        } else if (options.topics) {
          displayTopicFrequencies(session, parseInt(options.limit || '10'), options.json);
        } else if (options.preferences) {
          displayUserPreferences(session, options.json);
        } else if (options.suggestions) {
          await displayContextualSuggestions(contextManager, parseInt(options.limit || '5'));
        } else if (options.stats) {
          displayMemoryStats(session, options.json);
        } else {
          // Default: show session overview
          displaySessionOverview(session, options.json);
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Memory operation failed: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      } finally {
        contextManager.destroy();
      }
    });
  
  return command;
}

/**
 * Display comprehensive session overview
 */
function displaySessionOverview(session: SessionContext, json: boolean = false): void {
  if (json) {
    console.log(JSON.stringify({
      sessionId: session.sessionId,
      created: session.created,
      lastAccessed: session.lastAccessed,
      projectPath: session.projectPath,
      conversationCount: session.conversationHistory.length,
      learningPatternsCount: session.persistentMemory.learningPatterns.length,
      topicsCount: session.persistentMemory.frequentTopics.length,
      codePatternsCounts: session.persistentMemory.codePatterns.length,
      totalTokensUsed: session.totalTokensUsed,
      totalCost: session.totalCost
    }, null, 2));
    return;
  }
  
  const content = [
    chalk.cyan.bold('🧠 Session Memory Overview'),
    '',
    chalk.yellow('Session Info:'),
    `  ID: ${session.sessionId.substring(0, 8)}...`,
    `  Created: ${session.created.toLocaleDateString()} ${session.created.toLocaleTimeString()}`,
    `  Last Active: ${session.lastAccessed.toLocaleDateString()} ${session.lastAccessed.toLocaleTimeString()}`,
    `  Project: ${session.projectPath}`,
    '',
    chalk.yellow('Learning Data:'),
    `  Conversations: ${session.conversationHistory.length}`,
    `  Learning Patterns: ${session.persistentMemory.learningPatterns.length}`,
    `  Topics Tracked: ${session.persistentMemory.frequentTopics.length}`,
    `  Code Patterns: ${session.persistentMemory.codePatterns.length}`,
    '',
    chalk.yellow('Usage Stats:'),
    `  Total Tokens: ${session.totalTokensUsed.toLocaleString()}`,
    `  Total Cost: $${session.totalCost.toFixed(4)}`,
    ''
  ];
  
  if (session.projectContext) {
    content.push(
      chalk.cyan('🚀 Project Context:'),
      `  Type: ${session.projectContext.type}`,
      `  Domain: ${session.projectContext.domain}`,
      `  Languages: ${session.projectContext.languages.join(', ')}`,
      `  Frameworks: ${session.projectContext.frameworks.join(', ')}`
    );
  }
  
  console.log(boxen(content.join('\n'), {
    title: '🧠 Memory Status',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'cyan',
    borderStyle: 'round'
  }));
}

/**
 * Display conversation context
 */
function displayConversationContext(contextManager: SessionContextManager): void {
  const context = contextManager.getConversationContext(5);
  
  if (!context) {
    console.log(chalk.gray('No conversation context available.'));
    return;
  }
  
  console.log(boxen(context, {
    title: '💬 Conversation Context',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'blue',
    borderStyle: 'round'
  }));
}

/**
 * Display learning patterns
 */
function displayLearningPatterns(session: SessionContext, limit: number, json: boolean = false): void {
  const patterns = session.persistentMemory.learningPatterns
    .sort((a, b) => (b.effectiveness * b.frequency) - (a.effectiveness * a.frequency))
    .slice(0, limit);
  
  if (json) {
    console.log(JSON.stringify(patterns, null, 2));
    return;
  }
  
  if (patterns.length === 0) {
    console.log(chalk.gray('No learning patterns found.'));
    return;
  }
  
  const content = [
    chalk.cyan.bold('📊 Learning Patterns'),
    ''
  ];
  
  patterns.forEach((pattern, index) => {
    const effectiveness = Math.round(pattern.effectiveness * 100);
    const effectivenessColor = effectiveness > 80 ? chalk.green : effectiveness > 60 ? chalk.yellow : chalk.red;
    
    content.push(
      chalk.blue(`${index + 1}. ${pattern.pattern}`),
      `   ${chalk.gray('Frequency:')} ${pattern.frequency} uses`,
      `   ${chalk.gray('Effectiveness:')} ${effectivenessColor(`${effectiveness}%`)}`,
      `   ${chalk.gray('Last Used:')} ${pattern.lastUsed.toLocaleDateString()}`,
      `   ${chalk.gray('Success Rate:')} ${Math.round(pattern.successRate * 100)}%`,
      ''
    );
  });
  
  console.log(boxen(content.join('\n'), {
    title: '📈 Learning Patterns',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'green',
    borderStyle: 'round'
  }));
}

/**
 * Display topic frequencies
 */
function displayTopicFrequencies(session: SessionContext, limit: number, json: boolean = false): void {
  const topics = session.persistentMemory.frequentTopics
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  if (json) {
    console.log(JSON.stringify(topics, null, 2));
    return;
  }
  
  if (topics.length === 0) {
    console.log(chalk.gray('No topics tracked yet.'));
    return;
  }
  
  const content = [
    chalk.cyan.bold('🎯 Topic Expertise'),
    ''
  ];
  
  topics.forEach((topic, index) => {
    const expertiseColor = topic.expertise === 'advanced' ? chalk.green : 
                          topic.expertise === 'intermediate' ? chalk.yellow : chalk.blue;
    
    content.push(
      chalk.blue(`${index + 1}. ${topic.topic}`),
      `   ${chalk.gray('Mentions:')} ${topic.count}`,
      `   ${chalk.gray('Expertise:')} ${expertiseColor(topic.expertise)}`,
      `   ${chalk.gray('Last Used:')} ${topic.lastMentioned.toLocaleDateString()}`,
      `   ${chalk.gray('Related:')} ${topic.relatedTopics.slice(0, 3).join(', ')}`,
      ''
    );
  });
  
  console.log(boxen(content.join('\n'), {
    title: '📚 Topic Knowledge',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'yellow',
    borderStyle: 'round'
  }));
}

/**
 * Display user preferences
 */
function displayUserPreferences(session: SessionContext, json: boolean = false): void {
  const prefs = session.persistentMemory.userPreferences;
  
  if (json) {
    console.log(JSON.stringify(prefs, null, 2));
    return;
  }
  
  const content = [
    chalk.cyan.bold('⚙️ User Preferences'),
    '',
    chalk.yellow('Learning Preferences:'),
    `  Preferred Complexity: ${chalk.blue(prefs.preferredComplexity)}`,
    `  Communication Style: ${chalk.blue(prefs.communicationStyle)}`,
    `  Auto-Suggest: ${prefs.autoSuggest ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled')}`,
    `  Remember Context: ${prefs.rememberContext ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled')}`,
    `  Max Context History: ${chalk.blue(prefs.maxContextHistory)}`,
    '',
    chalk.yellow('Technology Preferences:'),
    `  Languages: ${prefs.preferredLanguages.length > 0 ? prefs.preferredLanguages.join(', ') : chalk.gray('None learned yet')}`,
    `  Frameworks: ${prefs.preferredFrameworks.length > 0 ? prefs.preferredFrameworks.join(', ') : chalk.gray('None learned yet')}`
  ];
  
  console.log(boxen(content.join('\n'), {
    title: '🎛️ Preferences',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'magenta',
    borderStyle: 'round'
  }));
}

/**
 * Display contextual suggestions
 */
async function displayContextualSuggestions(contextManager: SessionContextManager, limit: number): Promise<void> {
  const spinner = ora('🤔 Generating contextual suggestions...').start();
  
  try {
    const suggestions = await contextManager.getContextualSuggestions(limit);
    spinner.succeed('Suggestions generated!');
    
    if (suggestions.length === 0) {
      console.log(chalk.gray('No contextual suggestions available yet. Start some conversations to build context!'));
      return;
    }
    
    const content = [
      chalk.cyan.bold('💡 Contextual Suggestions'),
      '',
      ...suggestions.map((suggestion, index) => 
        chalk.blue(`${index + 1}.`) + ` ${suggestion}`
      )
    ];
    
    console.log(boxen(content.join('\n'), {
      title: '🎯 Smart Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'cyan',
      borderStyle: 'round'
    }));
    
    console.log(chalk.gray('\n💡 Use these suggestions with:'));
    console.log(chalk.cyan('  claude-prompter ask "[suggestion text]"'));
    
  } catch (error) {
    spinner.fail('Failed to generate suggestions');
    throw error;
  }
}

/**
 * Display memory statistics
 */
function displayMemoryStats(session: SessionContext, json: boolean = false): void {
  const stats = {
    sessionAge: Math.round((Date.now() - session.created.getTime()) / (1000 * 60 * 60 * 24)),
    conversationsPerDay: session.conversationHistory.length / Math.max(1, Math.round((Date.now() - session.created.getTime()) / (1000 * 60 * 60 * 24))),
    topPattern: session.persistentMemory.learningPatterns.reduce((top, pattern) => 
      pattern.frequency > (top?.frequency || 0) ? pattern : top, session.persistentMemory.learningPatterns[0]),
    averageEffectiveness: session.persistentMemory.learningPatterns.reduce((sum, p) => sum + p.effectiveness, 0) / Math.max(1, session.persistentMemory.learningPatterns.length),
    languageDistribution: session.persistentMemory.codePatterns.reduce((dist: Record<string, number>, pattern) => {
      dist[pattern.language] = (dist[pattern.language] || 0) + pattern.frequency;
      return dist;
    }, {}),
    recentActivity: session.conversationHistory.filter(entry => 
      Date.now() - entry.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    ).length
  };
  
  if (json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  
  const content = [
    chalk.cyan.bold('📊 Memory Statistics'),
    '',
    chalk.yellow('Session Metrics:'),
    `  Session Age: ${stats.sessionAge} days`,
    `  Conversations Per Day: ${stats.conversationsPerDay.toFixed(1)}`,
    `  Recent Activity (7 days): ${stats.recentActivity} conversations`,
    '',
    chalk.yellow('Learning Metrics:'),
    `  Average Effectiveness: ${Math.round(stats.averageEffectiveness * 100)}%`,
    `  Top Pattern: ${stats.topPattern?.pattern || 'None yet'}`,
    `  Pattern Uses: ${stats.topPattern?.frequency || 0}`,
    '',
    chalk.yellow('Technology Usage:')
  ];
  
  Object.entries(stats.languageDistribution).forEach(([lang, count]) => {
    content.push(`  ${lang}: ${count} patterns`);
  });
  
  console.log(boxen(content.join('\n'), {
    title: '📈 Analytics',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'green',
    borderStyle: 'round'
  }));
}

/**
 * Clear session memory
 */
async function clearSessionMemory(contextManager: SessionContextManager): Promise<void> {
  const spinner = ora('🧹 Clearing session memory...').start();
  
  try {
    contextManager.clearCurrentSession();
    spinner.succeed('Session memory cleared!');
    
    console.log(chalk.green('✅ Session memory has been cleared.'));
    console.log(chalk.gray('Learning patterns and user preferences are preserved.'));
    console.log(chalk.gray('Start a new conversation to create a fresh session.'));
    
  } catch (error) {
    spinner.fail('Failed to clear session memory');
    throw error;
  }
}

/**
 * Export session data
 */
async function exportSessionData(contextManager: SessionContextManager, filename: string): Promise<void> {
  const spinner = ora('📤 Exporting session data...').start();
  
  try {
    const session = contextManager.getCurrentSession();
    if (!session) {
      spinner.fail('No active session to export');
      return;
    }
    
    const { promises: fs } = require('fs');
    await fs.writeFile(filename, JSON.stringify(session, null, 2), 'utf-8');
    
    spinner.succeed(`Session data exported to ${filename}`);
    
    console.log(chalk.green(`✅ Session exported successfully!`));
    console.log(chalk.gray(`File: ${filename}`));
    console.log(chalk.gray(`Size: ${JSON.stringify(session).length} bytes`));
    
  } catch (error) {
    spinner.fail('Failed to export session data');
    throw error;
  }
}

/**
 * Import session data
 */
async function importSessionData(_contextManager: SessionContextManager, filename: string): Promise<void> {
  const spinner = ora('📥 Importing session data...').start();
  
  try {
    const { promises: fs } = require('fs');
    const data = await fs.readFile(filename, 'utf-8');
    const sessionData = JSON.parse(data);
    
    // Validate session data structure
    if (!sessionData.sessionId || !sessionData.conversationHistory) {
      throw new Error('Invalid session data format');
    }
    
    spinner.succeed(`Session data imported from ${filename}`);
    
    console.log(chalk.green(`✅ Session imported successfully!`));
    console.log(chalk.gray(`Conversations: ${sessionData.conversationHistory.length}`));
    console.log(chalk.gray(`Learning Patterns: ${sessionData.persistentMemory?.learningPatterns?.length || 0}`));
    console.log(chalk.yellow('Note: Restart claude-prompter to activate imported session.'));
    
  } catch (error) {
    spinner.fail('Failed to import session data');
    throw error;
  }
}