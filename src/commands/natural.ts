/**
 * Natural Language Interface for claude-prompter
 * Allows users to interact using natural language instead of complex CLI flags
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { CLIResolver } from '../utils/cliResolver.js';
import { ArgumentBuilder } from '../utils/argumentBuilder.js';

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
    enabledCommands: ['suggest', 'multishot', 'usage', 'stats', 'patterns', 'prompt', 'analyze', 'fix', 'memory'],
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
    
    // Intent patterns for different commands - prioritized by specificity!
    const intentPatterns = [
      // Explicit single-model requests (opt-out patterns) - HIGHEST PRIORITY
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
      
      // Usage/cost command - HIGH PRIORITY (specific patterns)
      {
        command: 'usage',
        patterns: [
          /^(?:show\s+(?:me\s+)?(?:my\s+)?)?(?:usage|cost|spending|tokens?|bills?|money)(?:\s+(?:today|this\s+month|monthly|daily))?$/i,
          /^(?:how\s+much|what.*cost|check.*spending)(?:\s+(?:today|this\s+month|monthly|daily))?$/i,
          /^(?:api|openai)\s+(?:usage|cost|bill)$/i,
          /^(?:show\s+me\s+(?:my\s+)?usage)(?:\s+(?:today|this\s+month|monthly))?$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          today: /today|daily/i.test(input),
          month: /month|monthly/i.test(input),
          analyze: /analyz|detail|trend|breakdown/i.test(input)
        })
      },

      // Stats command - HIGH PRIORITY (specific patterns)
      {
        command: 'stats',
        patterns: [
          /^(?:stats|statistics|analytics|progress|learning|growth)$/i,
          /^(?:show\s+me|display)\s+(?:my\s+)?(?:progress|learning|stats|analytics)$/i,
          /^(?:how\s+am\s+I|what.*progress|learning\s+journey)$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          detailed: /detail|comprehensive|full|complete/i.test(input),
          project: this.extractProject(input)
        })
      },

      // Patterns command - HIGH PRIORITY (specific patterns)
      {
        command: 'patterns',
        patterns: [
          /^(?:patterns?|trends?|frequency|usage\s+patterns?)$/i,
          /^(?:show\s+me|find|analyze)\s+(?:my\s+)?(?:patterns?|trends?|habits?)$/i,
          /^(?:what.*patterns?|coding\s+patterns?|language\s+patterns?)$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          type: this.extractPatternType(input),
          minFrequency: this.extractMinFrequency(input)
        })
      },

      // Analyze command - HIGH PRIORITY (specific patterns)
      {
        command: 'analyze',
        patterns: [
          /^(?:analyze|review|examine|inspect)\s+(?:this\s+)?(?:project|file|code|changes)$/i,
          /^(?:what.*analysis|show\s+me.*analysis|check.*structure)$/i,
          /^(?:analyze|review)\s+(?:recent|current|my)\s+(?:changes|files|work)$/i,
          /^(?:project\s+context|file\s+analysis|code\s+analysis)$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          project: /project|context|structure|overview/i.test(input),
          file: this.extractFileName(input),
          changes: /changes?|recent|modified|diff/i.test(input),
          suggest: /suggest|recommend|improve/i.test(input),
          ai: /ai|smart|intelligent|advanced/i.test(input)
        })
      },

      // Fix command - HIGH PRIORITY (specific patterns)
      {
        command: 'fix',
        patterns: [
          /^(?:fix|repair|resolve|debug|troubleshoot)$/i,
          /^(?:what.*wrong|error|issue|problem|bug)$/i,
          /^(?:build.*fail|test.*fail|lint.*error|compilation.*error)$/i,
          /^(?:help\s+me\s+debug|solve\s+this|fix\s+this)$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          build: /build|compilation|compile/i.test(input),
          lint: /lint|format|style|prettier|eslint/i.test(input),
          test: /test|testing|spec/i.test(input),
          git: /git|commit|merge|branch/i.test(input),
          all: /all|everything|everything/i.test(input),
          error: this.extractErrorMessage(input),
          ai: /ai|smart|intelligent|help|suggest/i.test(input),
          auto: /auto|automatic|automatically/i.test(input)
        })
      },

      // Memory command - HIGH PRIORITY (specific patterns)
      {
        command: 'memory',
        patterns: [
          /^(?:show|display|what)\s+(?:me\s+)?(?:my\s+)?(?:session\s+)?(?:memory|context|session|history|learning)$/i,
          /^(?:my|show)\s+(?:learning\s+)?(?:patterns?|preferences|topics)$/i,
          /^(?:what.*learned|show.*patterns|my.*context|session.*memory)$/i,
          /^(?:memory|remember|context|history|session)(?:\s+(?:show|display|status))?$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          show: /show|display|what/i.test(input),
          context: /context|conversation|history/i.test(input),
          patterns: /patterns?|learned|learning/i.test(input),
          topics: /topics?|subjects?/i.test(input),
          preferences: /preferences|settings|config/i.test(input),
          suggestions: /suggest|recommend|ideas/i.test(input),
          stats: /stats|statistics|analytics/i.test(input),
          clear: /clear|reset|delete/i.test(input)
        })
      },

      // Direct prompt command - HIGH PRIORITY (specific patterns)
      {
        command: 'prompt',
        patterns: [
          /^(?:send|execute|run)\s+(?:this\s+)?(?:prompt|message|question)$/i,
          /^(?:ask|tell|prompt)\s+(?:gpt|ai|claude|the\s+model)$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          message: this.extractDirectPrompt(input),
          send: true
        })
      },
      
      // Explicit multishot requests - MEDIUM PRIORITY
      {
        command: 'multishot',
        patterns: [
          /(?:compare|test|run)\s+(?:across|with|using)\s+(?:multiple\s+)?(?:models?|ai|engines?)/i,
          /(?:multishot|multi[- ]?shot|multiple\s+models?)\s*(?:with|for|on)?\s*(.+)/i,
          /(?:analyze|compare)\s+(?:this|the)?\s*(.+?)\s*(?:with|using|across)\s+(?:different\s+)?(?:models?|ai)/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          message: this.extractMessage(_match, input) || input.trim(),
          models: this.extractModels(input),
          compare: true
        })
      },
      
      // Fallback multishot for general queries - LOWEST PRIORITY (only if enabled)
      ...(this.config.defaultToMultishot ? [{
        command: 'multishot',
        patterns: [
          /^(?!.*(?:quick|single|fast|simple)).*(?:help|how|what|explain|implement|create|build|show|tell).*$/i
        ],
        extractParams: (_match: RegExpMatchArray, input: string) => ({
          message: this.extractMessage(_match, input) || input.trim(),
          models: this.extractModels(input),
          compare: true
        })
      }] : [])
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

  private extractMessage(_match: RegExpMatchArray, input: string): string {
    // Use the new ArgumentBuilder to extract clean message
    const detectedModels = ArgumentBuilder.parseModels(input);
    return ArgumentBuilder.extractCleanMessage(input, detectedModels);
  }

  private extractModels(input: string): string[] | undefined {
    return ArgumentBuilder.parseModels(input);
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

  private extractFileName(input: string): string | undefined {
    // Look for file references like "analyze file.ts" or "check src/components/App.tsx"
    const fileMatch = input.match(/(?:file|this|the)\s+([a-zA-Z0-9._\/-]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) return fileMatch[1];
    
    // Look for bare file paths
    const pathMatch = input.match(/\b([a-zA-Z0-9._\/-]+\.[a-zA-Z0-9]{2,5})\b/);
    return pathMatch ? pathMatch[1] : undefined;
  }

  private extractErrorMessage(input: string): string | undefined {
    // Look for quoted error messages
    const quotedMatch = input.match(/["'](.*?)["']/);
    if (quotedMatch) return quotedMatch[1];
    
    // Look for error patterns after keywords
    const errorMatch = input.match(/(?:error|issue|problem|fail)(?:ed)?:?\s*(.+)/i);
    return errorMatch ? errorMatch[1].trim() : undefined;
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
  const args = ArgumentBuilder.buildCommandFromIntent(intent.command, intent.parameters);
  return args.join(' ');
}

async function executeCommand(intent: ParsedIntent): Promise<void> {
  try {
    // Build command arguments using the new ArgumentBuilder
    const args = ArgumentBuilder.buildCommandFromIntent(intent.command, intent.parameters);
    
    // Validate arguments for security
    const validation = ArgumentBuilder.validateArguments(args);
    if (!validation.valid) {
      console.error(chalk.red('❌ Invalid command arguments:'));
      validation.errors.forEach(error => console.error(chalk.gray(`  • ${error}`)));
      throw new Error('Command validation failed');
    }
    
    // Enhanced CLI resolution specifically for StyleMuse usage
    console.log(chalk.gray('🔍 Resolving CLI for cross-directory usage...'));
    
    // Force use of current CLI path when called via wrapper
    const isCalledViaWrapper = process.argv[1]?.includes('cli.js');
    if (isCalledViaWrapper) {
      const currentCli = process.argv[1];
      console.log(chalk.green(`✅ Using current CLI: ${currentCli}`));
      
      // Use current CLI directly with spawn
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const child = spawn('node', [currentCli, ...args], {
          stdio: 'inherit',
          shell: false
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with exit code ${code}`));
          }
        });
        
        child.on('error', (error) => {
          reject(error);
        });
      });
    }
    
    // Fallback to CLIResolver for other cases
    const exitCode = await CLIResolver.executeCommand(args);
    
    if (exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}`);
    }
  } catch (error) {
    // Enhanced error handling with helpful suggestions
    console.error(chalk.red('\n❌ Command execution failed:'));
    console.error(chalk.gray(`  ${error instanceof Error ? error.message : String(error)}`));
    
    console.error(chalk.yellow('\n💡 Fallback options:'));
    console.error(chalk.cyan('  Try traditional CLI syntax:'));
    const command = buildCommand(intent);
    console.error(chalk.cyan(`  claude-prompter ${command}`));
    
    throw error;
  }
}