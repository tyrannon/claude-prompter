/**
 * Argument Builder Utility
 * Builds claude-prompter commands with proper argument sanitization
 */

export interface MultishotCommandOptions {
  message: string;
  models?: string[];
  compare?: boolean;
  dryRun?: boolean;
  [key: string]: any;
}

export interface SuggestCommandOptions {
  topic: string;
  showGrowth?: boolean;
  complexity?: 'simple' | 'moderate' | 'complex';
  language?: string;
  taskType?: string;
  claudeAnalysis?: boolean;
  [key: string]: any;
}

export class ArgumentBuilder {
  /**
   * Build multishot command with proper message quotation and model handling
   */
  static buildMultishotCommand(options: MultishotCommandOptions): string[] {
    const args = ['multishot'];
    
    // Always quote the message properly - this is the key fix!
    if (options.message) {
      args.push('-m', options.message); // Don't add quotes here - they'll be handled by spawn
    }
    
    // Handle models array - only add if explicitly provided
    if (options.models && options.models.length > 0) {
      const modelsString = options.models.join(',');
      args.push('--models', modelsString);
    }
    
    // Add boolean flags
    if (options.compare) {
      args.push('--compare');
    }
    
    if (options.dryRun) {
      args.push('--dry-run');
    }
    
    return args;
  }

  /**
   * Build suggest command with proper parameter handling
   */
  static buildSuggestCommand(options: SuggestCommandOptions): string[] {
    const args = ['suggest'];
    
    if (options.topic) {
      args.push('-t', options.topic);
    }
    
    if (options.showGrowth) {
      args.push('--show-growth');
    }
    
    if (options.complexity) {
      args.push('--complexity', options.complexity);
    }
    
    if (options.language) {
      args.push('-l', options.language);
    }
    
    if (options.taskType) {
      args.push('--task-type', options.taskType);
    }
    
    if (options.claudeAnalysis) {
      args.push('--claude-analysis');
    }
    
    return args;
  }

  /**
   * Parse models from natural language input - much more restrictive to avoid corruption
   */
  static parseModels(input: string): string[] | undefined {
    // Only look for very explicit model specifications
    const knownModels = ['opus', 'sonnet', 'haiku', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'qwen3'];
    
    const explicitModelPatterns = [
      // Only match when explicitly using "models" keyword followed by known models
      /(?:models?|--models)\s+([a-z0-9,-:\s]+)/i,
      // Match "using opus and sonnet models" pattern
      new RegExp(`(?:using|with)\\s+((?:${knownModels.join('|')})(?:[,\\s]+(?:and\\s+)?(?:${knownModels.join('|')}))*)[,\\s]*models?`, 'i'),
      // Match "models opus sonnet" pattern  
      new RegExp(`models?\\s+((?:${knownModels.join('|')})(?:[,\\s]+(?:${knownModels.join('|')}))*)`,'i')
    ];
    
    for (const pattern of explicitModelPatterns) {
      const match = input.match(pattern);
      if (match) {
        const modelsString = match[1].trim();
        // Split and only keep known models
        const models = modelsString
          .split(/[,\s]+/)
          .map(m => m.trim().toLowerCase())
          .filter(m => knownModels.includes(m));
        
        return models.length > 0 ? models : undefined;
      }
    }
    
    // Don't parse any models unless explicitly specified
    return undefined;
  }

  /**
   * Sanitize message content to prevent argument injection
   */
  static sanitizeMessage(input: string): string {
    // Remove command prefixes that could cause confusion
    let message = input
      .replace(/^(?:claude-prompter|npx claude-prompter)\s+/i, '')
      .replace(/^(?:multishot|suggest|help)\s+/i, '')
      .replace(/^(?:compare|test|run)\s+(?:with|using|across)\s+(?:models?|ai)\s*/i, '')
      .trim();
    
    // Remove any potential flag injections from the message
    message = message.replace(/\s+--[a-z-]+(?:\s+[^\s-]+)?/gi, '');
    
    return message || input.trim();
  }

  /**
   * Extract clean message from natural language input for multishot
   */
  static extractCleanMessage(input: string, detectedModels?: string[]): string {
    let message = ArgumentBuilder.sanitizeMessage(input);
    
    // Remove model specifications from the message if they were detected separately
    if (detectedModels && detectedModels.length > 0) {
      const modelString = detectedModels.join('|');
      const modelPattern = new RegExp(`\\b(?:models?|using|with)\\s+(?:${modelString})(?:[,\\s]+(?:${modelString}))*\\s*(?:models?)?\\b`, 'gi');
      message = message.replace(modelPattern, '').trim();
      
      // Remove any remaining model references
      const remainingModelPattern = new RegExp(`\\b(?:${modelString})(?:[,\\s]+(?:${modelString}))*\\s*(?:models?)?\\b`, 'gi');
      message = message.replace(remainingModelPattern, '').trim();
    }
    
    // Remove common command artifacts
    message = message
      .replace(/^(?:help|how|what|explain|implement|create|build|show|tell)\s+(?:me\s+)?(?:with|about)?\s*/i, '')
      .replace(/\s+(?:with|using|across)\s+(?:different\s+)?(?:models?|ai)\s*$/i, '')
      .trim();
    
    return message || input.trim();
  }

  /**
   * Build command arguments from parsed intent - improved version
   */
  static buildCommandFromIntent(command: string, parameters: Record<string, any>): string[] {
    switch (command) {
      case 'multishot':
        return ArgumentBuilder.buildMultishotCommand({
          message: parameters.message || '',
          models: parameters.models ? (Array.isArray(parameters.models) ? parameters.models : parameters.models.split(',')) : undefined,
          compare: parameters.compare,
          dryRun: parameters.dryRun
        });
        
      case 'suggest':
        return ArgumentBuilder.buildSuggestCommand({
          topic: parameters.topic || '',
          showGrowth: parameters.showGrowth,
          complexity: parameters.complexity,
          language: parameters.language,
          taskType: parameters.taskType,
          claudeAnalysis: true // Always use claude-analysis for NL interface
        });
        
      case 'usage':
        const usageArgs = ['usage'];
        if (parameters.today) usageArgs.push('--today');
        if (parameters.month) usageArgs.push('--month');
        if (parameters.analyze) usageArgs.push('--analyze');
        return usageArgs;
        
      case 'stats':
        const statsArgs = ['stats'];
        if (parameters.detailed) statsArgs.push('--detailed');
        if (parameters.project) statsArgs.push('--project', parameters.project);
        return statsArgs;
        
      case 'patterns':
        const patternsArgs = ['patterns'];
        if (parameters.type) patternsArgs.push('--type', parameters.type);
        if (parameters.minFrequency) patternsArgs.push('--min-frequency', String(parameters.minFrequency));
        return patternsArgs;
        
      case 'prompt':
        const promptArgs = ['prompt'];
        if (parameters.message) promptArgs.push('-m', parameters.message);
        if (parameters.send) promptArgs.push('--send');
        return promptArgs;
        
      default:
        return [command];
    }
  }

  /**
   * Validate that arguments don't contain potential injection attacks
   */
  static validateArguments(args: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Check for suspicious patterns that might indicate injection
      if (typeof arg === 'string') {
        // Check for command injection patterns
        if (/[;&|`$(){}]/.test(arg) && !arg.startsWith('-')) {
          errors.push(`Argument ${i} contains potentially unsafe characters: ${arg}`);
        }
        
        // Check for flag injection in message content
        if (i > 0 && args[i-1] === '-m' && arg.includes('--')) {
          errors.push(`Message argument appears to contain flags: ${arg}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}