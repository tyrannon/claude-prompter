/**
 * Natural Language Interface for claude-prompter
 * Allows users to interact using natural language instead of complex CLI flags
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';

export interface ParsedIntent {
  command: string;
  confidence: number;
  parameters: Record<string, any>;
  originalText: string;
}

export interface NLIConfig {
  enabledCommands: string[];
  confidenceThreshold: number;
  maxRetries: number;
  defaultToMultishot: boolean;
  multishotOptOutKeywords: string[];
}

export class NaturalLanguageParser {
  private config: NLIConfig = {
    enabledCommands: ['suggest', 'multishot', 'usage', 'stats', 'patterns', 'prompt'],
    confidenceThreshold: 0.7,
    maxRetries: 2,
    defaultToMultishot: true, // REVOLUTIONARY: Multishot intelligence by default!
    multishotOptOutKeywords: ['quick', 'single', 'fast', 'simple', 'one model', 'just one', 'basic']
  };

  constructor(customConfig?: Partial<NLIConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  /**
   * Parse natural language input into structured command
   */
  async parseIntent(input: string): Promise<ParsedIntent> {
    
    // Intent patterns for different commands - now multishot-first!
    const intentPatterns = [
      // Explicit single-model requests (opt-out patterns)
      {
        command: 'suggest',
        patterns: [
          new RegExp(`(?:${this.config.multishotOptOutKeywords.join('|')}).*?(?:suggest|recommendation|ideas?)`, 'i'),
          new RegExp(`(?:suggest|recommendation|ideas?).*?(?:${this.config.multishotOptOutKeywords.join('|')})`, 'i'),
          /single\s+(?:model|engine)\s+(?:suggest|recommendation|help)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          topic: this.extractTopic(_match, input),
          showGrowth: /(?:learning|growth|progress|advanced|experienced)/i.test(input),
          complexity: this.extractComplexity(input),
          language: this.extractLanguage(input),
          taskType: this.extractTaskType(input)
        })
      },
      
      // Multishot command (now default for most queries)
      {
        command: 'multishot',
        patterns: [
          /(?:compare|test|run)\s+(?:across|with|using)\s+(?:multiple\s+)?(?:models?|ai|engines?)/i,
          /(?:multishot|multi[- ]?shot|multiple models?)\s*(?:with|for|on)?\s*(.+)/i,
          /(?:analyze|compare)\s+(?:this|the)?\s*(.+?)\s*(?:with|using|across)\s+(?:different\s+)?(?:models?|ai)/i,
          // Default multishot patterns - broader matches for general queries (only when multishot enabled)
          this.config.defaultToMultishot ? /^(?!.*(?:quick|single|fast|simple)).*(?:help|how|what|explain|implement|create|build|show|tell).*$/i : /never_match_this_pattern_xyz123/
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          message: this.extractMessage(_match, input) || input.trim(),
          models: this.extractModels(input),
          compare: true
        })
      },
      
      // Usage/cost command
      {
        command: 'usage',
        patterns: [
          /(?:usage|cost|spending|tokens?|bills?|money)\s*(?:today|this month|monthly|daily)?/i,
          /(?:how much|what.*cost|show me.*usage|check.*spending)/i,
          /(?:api|openai)\s+(?:usage|cost|bill)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          today: /today|daily/i.test(input),
          month: /month|monthly/i.test(input),
          analyze: /analyz|detail|trend|breakdown/i.test(input)
        })
      },
      
      // Stats command
      {
        command: 'stats',
        patterns: [
          /(?:stats|statistics|analytics|progress|learning|growth)/i,
          /(?:show me|display)\s+(?:my\s+)?(?:progress|learning|stats|analytics)/i,
          /(?:how am I|what.*progress|learning journey)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          detailed: /detail|comprehensive|full|complete/i.test(input),
          project: this.extractProject(input)
        })
      },

      // Patterns command
      {
        command: 'patterns',
        patterns: [
          /(?:patterns?|trends?|frequency|usage patterns?)/i,
          /(?:show me|find|analyze)\s+(?:my\s+)?(?:patterns?|trends?|habits?)/i,
          /(?:what.*patterns?|coding patterns?|language patterns?)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          type: this.extractPatternType(input),
          minFrequency: this.extractMinFrequency(input)
        })
      },

      // Direct prompt
      {
        command: 'prompt',
        patterns: [
          /(?:send|execute|run)\s+(?:this\s+)?(?:prompt|message|question)/i,
          /(?:ask|tell|prompt)\s+(?:gpt|ai|claude|the model)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          message: this.extractDirectPrompt(input),
          send: true
        })
      }
    ];

    // Try to match against patterns
    for (const intent of intentPatterns) {
      for (const pattern of intent.patterns) {
        const match = input.match(pattern);
        if (match) {
          const confidence = this.calculateConfidence(match, intent.command, input);
          if (confidence >= this.config.confidenceThreshold) {
            return {
              command: intent.command,
              confidence,
              parameters: intent.extractParams(match, input),
              originalText: input
            };
          }
        }
      }
    }

    // Fallback: try to infer from keywords
    return this.fallbackParsing(input);
  }

  private extractTopic(match: RegExpMatchArray, input: string): string {
    // Extract the main topic from various match groups
    const potentialTopics = match.slice(1).filter(Boolean);
    let topic = potentialTopics[potentialTopics.length - 1] || '';
    
    // If no topic from match groups, extract from the full input
    if (!topic) {
      topic = input
        .replace(/^(?:quick|single|fast|simple|basic|easy)\s+/i, '')
        .replace(/^(?:suggest|suggestion|recommendations?|ideas?)\s+(?:for|about|on)?\s*/i, '')
        .replace(/^(?:help|how|what|explain|implement|create|build|show|tell)\s+(?:me\s+)?(?:with|about)?\s*/i, '')
        .trim();
    }
    
    return topic.trim().replace(/^(?:for|about|with|on)\s+/, '');
  }

  private extractMessage(match: RegExpMatchArray, input: string): string {
    const messageMatch = match[1] || match[0];
    if (messageMatch && messageMatch.trim()) {
      return messageMatch.trim();
    }
    // Clean up command-specific keywords but preserve the core message
    return input
      .replace(/(?:compare|test|run|multishot|multi-shot).*?(?:with|using|across)\s+(?:models?|ai)/i, '')
      .replace(/^(?:help|how|what|explain|implement|create|build|show|tell)\s+(?:me\s+)?/i, '')
      .trim() || input.trim();
  }

  private extractModels(input: string): string | undefined {
    const modelMatch = input.match(/(?:models?|using|with)\s+([a-z0-9,-:\s]+)/i);
    if (modelMatch) {
      return modelMatch[1].trim();
    }
    
    // Default to our optimal set if not specified
    return undefined; // Let multishot use defaults
  }

  private extractComplexity(input: string): 'simple' | 'moderate' | 'complex' | undefined {
    if (/simple|basic|easy|quick/i.test(input)) return 'simple';
    if (/complex|advanced|difficult|enterprise/i.test(input)) return 'complex';
    if (/moderate|medium|standard/i.test(input)) return 'moderate';
    return undefined;
  }

  private extractLanguage(input: string): string | undefined {
    const languages = ['typescript', 'javascript', 'python', 'react', 'nodejs', 'go', 'rust', 'java'];
    const found = languages.find(lang => new RegExp(`\\b${lang}\\b`, 'i').test(input));
    return found;
  }

  private extractTaskType(input: string): string | undefined {
    const taskTypes = {
      'api': /api|endpoint|service|server/i,
      'ui-component': /ui|component|interface|frontend/i,
      'authentication': /auth|login|security|token/i,
      'database': /database|db|sql|query/i,
      'testing': /test|spec|unit test/i,
      'performance': /performance|optimize|speed/i
    };

    for (const [type, pattern] of Object.entries(taskTypes)) {
      if (pattern.test(input)) return type;
    }
    return undefined;
  }

  private extractProject(input: string): string | undefined {
    const projectMatch = input.match(/(?:project|for)\s+([a-z0-9-_]+)/i);
    return projectMatch ? projectMatch[1] : undefined;
  }

  private extractPatternType(input: string): string | undefined {
    if (/coding|code/i.test(input)) return 'coding';
    if (/topic|subject/i.test(input)) return 'topics';
    if (/language|lang/i.test(input)) return 'languages';
    if (/time|when|hour/i.test(input)) return 'time';
    return undefined;
  }

  private extractMinFrequency(input: string): number | undefined {
    const freqMatch = input.match(/(?:at least|minimum|min)\s+(\d+)/i);
    return freqMatch ? parseInt(freqMatch[1]) : undefined;
  }

  private extractDirectPrompt(input: string): string {
    return input.replace(/^(?:send|execute|run|ask|tell|prompt)\s+(?:this\s+)?(?:prompt|message|question|gpt|ai|claude|the model):?\s*/i, '');
  }

  private calculateConfidence(_match: RegExpMatchArray, command: string, input: string): number {
    let confidence = 0.8; // Base confidence
    
    // Boost confidence for exact command matches
    if (new RegExp(`\\b${command}\\b`, 'i').test(input)) {
      confidence += 0.15;
    }
    
    // Boost confidence for multishot as it's now our preferred intelligent default
    if (command === 'multishot' && this.config.defaultToMultishot) {
      const optOutPattern = new RegExp(`\\b(?:${this.config.multishotOptOutKeywords.join('|')})\\b`, 'i');
      if (!optOutPattern.test(input)) {
        confidence += 0.15; // Strong boost for multishot intelligence
      }
    }

    // Boost for multiple matching keywords
    const commandKeywords = {
      suggest: ['suggest', 'recommendation', 'ideas', 'next', 'help'],
      multishot: ['compare', 'models', 'multishot', 'test', 'analyze', 'help', 'how', 'what', 'explain', 'implement', 'create', 'build'],
      usage: ['usage', 'cost', 'spending', 'tokens', 'bill'],
      stats: ['stats', 'progress', 'learning', 'analytics'],
      patterns: ['patterns', 'trends', 'frequency', 'habits']
    };

    const keywords = commandKeywords[command as keyof typeof commandKeywords] || [];
    const matchingKeywords = keywords.filter(keyword => 
      new RegExp(`\\b${keyword}`, 'i').test(input)
    );

    confidence += (matchingKeywords.length / keywords.length) * 0.1;

    return Math.min(confidence, 1.0);
  }

  private fallbackParsing(input: string): ParsedIntent {
    // Check if multishot is disabled in config or user explicitly wants single model
    const hasOptOutKeywords = this.config.multishotOptOutKeywords.length > 0;
    const optOutPattern = hasOptOutKeywords ? new RegExp(`\\b(?:${this.config.multishotOptOutKeywords.join('|')})\\b`, 'i') : null;
    const shouldOptOut = !this.config.defaultToMultishot || (optOutPattern && optOutPattern.test(input));
    
    if (shouldOptOut) {
      return {
        command: 'suggest',
        confidence: 0.75, // Higher confidence for explicit opt-out requests
        parameters: {
          topic: optOutPattern ? input.replace(optOutPattern, '').trim() : input.trim(),
          showGrowth: false
        },
        originalText: input
      };
    }
    
    // Default to multishot for superior intelligence across multiple AI models!
    return {
      command: 'multishot', 
      confidence: 0.8, // High confidence for our intelligent default
      parameters: {
        message: input.trim(),
        models: undefined, // Use optimal model selection for best results
        compare: true
      },
      originalText: input
    };
  }

  /**
   * Generate clarification questions when confidence is low
   */
  generateClarification(intent: ParsedIntent): string[] {
    const questions: string[] = [];
    
    if (intent.confidence < this.config.confidenceThreshold) {
      questions.push(`I think you want to ${intent.command}, but I'm not completely sure.`);
      
      switch (intent.command) {
        case 'suggest':
          questions.push('Are you looking for suggestions about a specific topic?');
          if (!intent.parameters.topic) {
            questions.push('What topic would you like suggestions for?');
          }
          break;
        case 'multishot':
          questions.push('Do you want to compare results across multiple AI models?');
          if (!intent.parameters.message) {
            questions.push('What would you like to analyze?');
          }
          break;
        case 'usage':
          questions.push('Are you asking about API usage and costs?');
          questions.push('Do you want today\'s usage or monthly summary?');
          break;
      }
    }
    
    return questions;
  }
}

export function createNaturalCommand(): Command {
  const cmd = new Command('natural');
  
  cmd
    .alias('ask')
    .description('Interact with claude-prompter using natural language')
    .argument('<input>', 'Natural language input describing what you want to do')
    .option('--dry-run', 'Show what command would be executed without running it')
    .option('--confidence-threshold <threshold>', 'Minimum confidence required (0-1)', '0.7')
    .option('--disable-multishot', 'Disable multishot by default (use single model unless explicitly requested)')
    .option('--force-multishot', 'Force multishot analysis for all queries (override opt-out keywords)')
    .action(async (input: string, options) => {
      try {
        // Create parser with custom config based on CLI options
        const parserConfig: Partial<NLIConfig> = {
          confidenceThreshold: parseFloat(options.confidenceThreshold)
        };
        
        if (options.disableMultishot) {
          parserConfig.defaultToMultishot = false;
        }
        if (options.forceMultishot) {
          parserConfig.defaultToMultishot = true;
          parserConfig.multishotOptOutKeywords = []; // Ignore opt-out keywords
        }
        
        const parser = new NaturalLanguageParser(parserConfig);
        
        const multishotStatus = parserConfig.defaultToMultishot !== false ? 
          (options.forceMultishot ? '🚀 FORCE MULTISHOT' : '🧠 MULTISHOT ENABLED') : 
          '⚡ SINGLE MODEL';
        
        console.log(boxen(
          chalk.cyan('🧠 Natural Language Interface') + '\n' +
          chalk.gray('Processing: ') + chalk.white(input) + '\n' +
          chalk.gray('Mode: ') + chalk.yellow(multishotStatus),
          { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
        ));

        // Parse the natural language input
        const intent = await parser.parseIntent(input);
        
        console.log(chalk.gray('\n🔍 Intent Analysis:'));
        console.log(chalk.gray('  Command: ') + chalk.yellow(intent.command));
        console.log(chalk.gray('  Confidence: ') + chalk.green(`${Math.round(intent.confidence * 100)}%`));
        
        if (Object.keys(intent.parameters).length > 0) {
          console.log(chalk.gray('  Parameters:'));
          for (const [key, value] of Object.entries(intent.parameters)) {
            if (value !== undefined) {
              console.log(chalk.gray(`    ${key}: `) + chalk.cyan(String(value)));
            }
          }
        }

        // Check confidence threshold  
        const threshold = parseFloat(options.confidenceThreshold);
        if (intent.confidence < threshold) {
          const clarifications = parser.generateClarification(intent);
          
          console.log(chalk.yellow('\n❓ Low Confidence - Need Clarification:'));
          clarifications.forEach(q => console.log(chalk.yellow(`  • ${q}`)));
          
          console.log(chalk.gray('\nYou can:'));
          console.log(chalk.gray('  • Rephrase your request more specifically'));
          console.log(chalk.gray('  • Use --confidence-threshold 0.5 to lower the threshold'));
          console.log(chalk.gray('  • Run with --dry-run to see the proposed command'));
          if (intent.command === 'multishot' && !options.forceMultishot) {
            console.log(chalk.gray('  • Add "quick" or "single" to your request for single-model analysis'));
            console.log(chalk.gray('  • Use --disable-multishot to default to single model mode'));
          }
          return;
        }

        // Build the actual command
        const actualCommand = buildCommand(intent);
        
        if (options.dryRun) {
          console.log(chalk.yellow('\n🔍 Dry Run - Would execute:'));
          console.log(chalk.cyan(`  claude-prompter ${actualCommand}`));
          return;
        }

        console.log(chalk.green('\n✨ Executing:'));
        console.log(chalk.cyan(`  claude-prompter ${actualCommand}\n`));

        // Execute the actual command
        await executeCommand(intent);
        
      } catch (error) {
        console.error(chalk.red('❌ Natural Language Interface Error:'));
        console.error(error instanceof Error ? error.message : String(error));
        console.log(chalk.gray('\n💡 Try being more specific or use traditional CLI syntax.'));
      }
    });

  return cmd;
}

function buildCommand(intent: ParsedIntent): string {
  const parts = [intent.command];
  
  switch (intent.command) {
    case 'suggest':
      if (intent.parameters.topic) {
        parts.push('-t', `"${intent.parameters.topic}"`);
      }
      if (intent.parameters.showGrowth) {
        parts.push('--show-growth');
      }
      if (intent.parameters.complexity) {
        parts.push('--complexity', intent.parameters.complexity);
      }
      if (intent.parameters.language) {
        parts.push('-l', intent.parameters.language);
      }
      if (intent.parameters.taskType) {
        parts.push('--task-type', intent.parameters.taskType);
      }
      parts.push('--claude-analysis');
      break;
      
    case 'multishot':
      if (intent.parameters.message) {
        parts.push('-m', `"${intent.parameters.message}"`);
      }
      if (intent.parameters.models) {
        parts.push('--models', intent.parameters.models);
      }
      if (intent.parameters.compare) {
        parts.push('--compare');
      }
      break;
      
    case 'usage':
      if (intent.parameters.today) {
        parts.push('--today');
      } else if (intent.parameters.month) {
        parts.push('--month');
      }
      if (intent.parameters.analyze) {
        parts.push('--analyze');
      }
      break;
      
    case 'stats':
      if (intent.parameters.detailed) {
        parts.push('--detailed');
      }
      if (intent.parameters.project) {
        parts.push('--project', intent.parameters.project);
      }
      break;
      
    case 'patterns':
      if (intent.parameters.type) {
        parts.push('--type', intent.parameters.type);
      }
      if (intent.parameters.minFrequency) {
        parts.push('--min-frequency', String(intent.parameters.minFrequency));
      }
      break;
      
    case 'prompt':
      if (intent.parameters.message) {
        parts.push('-m', `"${intent.parameters.message}"`);
      }
      if (intent.parameters.send) {
        parts.push('--send');
      }
      break;
  }
  
  return parts.join(' ');
}

async function executeCommand(intent: ParsedIntent): Promise<void> {
  // Import and execute the appropriate command
  const { spawn } = await import('child_process');
  const path = await import('path');
  
  return new Promise((resolve, reject) => {
    const command = buildCommand(intent);
    const args = command.split(' ').slice(1); // Remove the command name
    
    // Try to find the correct path to cli.js
    const possiblePaths = [
      'dist/cli.js',  // Local execution
      path.join(__dirname, '../../cli.js'), // Relative from build
      path.join(__dirname, '../../../dist/cli.js'), // From global install
      '/Users/kaiyakramer/claude-prompter-standalone/dist/cli.js' // Absolute fallback
    ];
    
    let cliPath = possiblePaths[0];
    
    const child = spawn('node', [cliPath, intent.command, ...args], {
      stdio: 'inherit',
      shell: false // More secure than shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Provide helpful error message with fallback suggestions
        const error = new Error(`Command failed with exit code ${code}`);
        console.error(chalk.yellow('\n💡 Troubleshooting Tips:'));
        console.error(chalk.gray('  • Try the traditional syntax:'));
        console.error(chalk.cyan(`    claude-prompter ${command}`));
        console.error(chalk.gray('  • Use --dry-run to see what command would execute'));
        console.error(chalk.gray('  • Check that claude-prompter is properly installed'));
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      console.error(chalk.red('\n❌ Command Execution Error:'));
      console.error(chalk.gray('  This might be a path or installation issue.'));
      console.error(chalk.yellow('\n💡 Try these alternatives:'));
      console.error(chalk.cyan(`  claude-prompter ${command}`));
      console.error(chalk.gray('  or use the wrapper script:'));
      console.error(chalk.cyan(`  ~/.local/bin/claude-prompter-global ${command}`));
      reject(error);
    });
  });
}