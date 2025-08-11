import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface RiskPattern {
  pattern: RegExp | string;
  level: RiskLevel;
  category: string;
  description: string;
  saferAlternative?: string;
  requiresCheckpoint: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  patterns: RiskPattern[];
  warnings: string[];
  recommendations: string[];
  requiresCheckpoint: boolean;
  estimatedRecoveryTime?: string;
  confidence: number;
}

export class RiskAssessmentEngine {
  private patterns: RiskPattern[] = [
    // Critical risk patterns - Build system and entry points
    {
      pattern: /babel\.config/i,
      level: RiskLevel.CRITICAL,
      category: 'Build System',
      description: 'Babel configuration changes can break entire build system',
      saferAlternative: 'Use TypeScript configuration only or framework defaults',
      requiresCheckpoint: true
    },
    {
      pattern: /metro\.config/i,
      level: RiskLevel.CRITICAL,
      category: 'Build System',
      description: 'Metro bundler configuration affects React Native build',
      saferAlternative: 'Use Expo defaults or minimal modifications',
      requiresCheckpoint: true
    },
    {
      pattern: /webpack\.config/i,
      level: RiskLevel.CRITICAL,
      category: 'Build System',
      description: 'Webpack configuration can break bundling',
      saferAlternative: 'Use framework defaults or ejected configurations carefully',
      requiresCheckpoint: true
    },
    {
      pattern: /registerRootComponent|AppRegistry/i,
      level: RiskLevel.CRITICAL,
      category: 'App Entry',
      description: 'App entry point modifications can prevent app from starting',
      saferAlternative: 'Never modify in Expo apps, use framework conventions',
      requiresCheckpoint: true
    },
    {
      pattern: /index\.[jt]sx?$/i,
      level: RiskLevel.HIGH,
      category: 'App Entry',
      description: 'Entry file modifications are risky',
      saferAlternative: 'Modify component files instead of entry points',
      requiresCheckpoint: true
    },
    
    // High risk patterns - Configuration files
    {
      pattern: /tsconfig\.json/i,
      level: RiskLevel.HIGH,
      category: 'Configuration',
      description: 'TypeScript configuration affects type checking and compilation',
      saferAlternative: 'Use extends and only override specific options',
      requiresCheckpoint: true
    },
    {
      pattern: /package\.json/i,
      level: RiskLevel.HIGH,
      category: 'Dependencies',
      description: 'Package.json changes can affect dependencies and scripts',
      saferAlternative: 'Use npm/yarn commands for dependency management',
      requiresCheckpoint: true
    },
    {
      pattern: /\.env|\.env\./i,
      level: RiskLevel.HIGH,
      category: 'Security',
      description: 'Environment variables may contain sensitive data',
      saferAlternative: 'Use secret management tools, never commit .env files',
      requiresCheckpoint: false
    },
    
    // Medium risk patterns
    {
      pattern: /navigation|router/i,
      level: RiskLevel.MEDIUM,
      category: 'Navigation',
      description: 'Navigation changes can affect app flow',
      saferAlternative: 'Test navigation changes thoroughly',
      requiresCheckpoint: false
    },
    {
      pattern: /api|endpoint|fetch/i,
      level: RiskLevel.MEDIUM,
      category: 'API',
      description: 'API changes can affect data flow',
      saferAlternative: 'Use API versioning and test endpoints',
      requiresCheckpoint: false
    },
    
    // Low risk patterns
    {
      pattern: /component|view|screen/i,
      level: RiskLevel.LOW,
      category: 'UI',
      description: 'UI component changes are generally safe',
      requiresCheckpoint: false
    },
    {
      pattern: /style|css|scss/i,
      level: RiskLevel.LOW,
      category: 'Styling',
      description: 'Style changes are low risk',
      requiresCheckpoint: false
    }
  ];
  
  private platformPatterns: Map<string, RiskPattern[]> = new Map([
    ['expo', [
      {
        pattern: /babel\.config/i,
        level: RiskLevel.CRITICAL,
        category: 'Expo',
        description: 'BLOCKED: Expo manages Babel automatically',
        saferAlternative: 'Do not modify babel.config.js in Expo apps',
        requiresCheckpoint: true
      },
      {
        pattern: /registerRootComponent/i,
        level: RiskLevel.CRITICAL,
        category: 'Expo',
        description: 'BLOCKED: Never modify registerRootComponent in Expo',
        saferAlternative: 'Expo handles app registration automatically',
        requiresCheckpoint: true
      }
    ]],
    ['nextjs', [
      {
        pattern: /next\.config/i,
        level: RiskLevel.HIGH,
        category: 'Next.js',
        description: 'Next.js configuration is sensitive',
        saferAlternative: 'Test configuration changes in development first',
        requiresCheckpoint: true
      }
    ]]
  ]);
  
  private errorCount: number = 0;
  private recentErrors: string[] = [];
  private checkpointHistory: string[] = [];
  
  constructor() {}
  
  assessRisk(query: string, options?: {
    platform?: string;
    context?: string;
    previousErrors?: number;
  }): RiskAssessment {
    const matchedPatterns: RiskPattern[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let maxLevel = RiskLevel.LOW;
    let requiresCheckpoint = false;
    
    // Check base patterns
    for (const pattern of this.patterns) {
      const regex = typeof pattern.pattern === 'string' 
        ? new RegExp(pattern.pattern, 'i')
        : pattern.pattern;
        
      if (regex.test(query)) {
        matchedPatterns.push(pattern);
        if (this.getRiskScore(pattern.level) > this.getRiskScore(maxLevel)) {
          maxLevel = pattern.level;
        }
        if (pattern.requiresCheckpoint) {
          requiresCheckpoint = true;
        }
        if (pattern.saferAlternative) {
          recommendations.push(pattern.saferAlternative);
        }
      }
    }
    
    // Check platform-specific patterns
    if (options?.platform) {
      const platformPatterns = this.platformPatterns.get(options.platform);
      if (platformPatterns) {
        for (const pattern of platformPatterns) {
          const regex = typeof pattern.pattern === 'string'
            ? new RegExp(pattern.pattern, 'i')
            : pattern.pattern;
            
          if (regex.test(query)) {
            matchedPatterns.push(pattern);
            if (pattern.description.startsWith('BLOCKED')) {
              warnings.push(chalk.red(`⛔ ${pattern.description}`));
              maxLevel = RiskLevel.CRITICAL;
            }
            if (pattern.saferAlternative) {
              recommendations.push(pattern.saferAlternative);
            }
          }
        }
      }
    }
    
    // Add warnings based on error count
    if (options?.previousErrors && options.previousErrors >= 3) {
      warnings.push(chalk.yellow('⚠️ Multiple failures detected - consider rolling back'));
      recommendations.push('git reset --hard HEAD && npm install');
    }
    
    // Calculate confidence based on pattern matches
    const confidence = this.calculateConfidence(matchedPatterns, query);
    
    // Estimate recovery time
    const estimatedRecoveryTime = this.estimateRecoveryTime(maxLevel);
    
    return {
      level: maxLevel,
      score: this.getRiskScore(maxLevel),
      patterns: matchedPatterns,
      warnings,
      recommendations,
      requiresCheckpoint,
      estimatedRecoveryTime,
      confidence
    };
  }
  
  detectPlatform(projectPath: string = process.cwd()): string | undefined {
    try {
      // Check for Expo
      if (fs.existsSync(path.join(projectPath, 'app.json'))) {
        const appJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'app.json'), 'utf-8'));
        if (appJson.expo) {
          return 'expo';
        }
      }
      
      // Check for Next.js
      if (fs.existsSync(path.join(projectPath, 'next.config.js')) ||
          fs.existsSync(path.join(projectPath, 'next.config.mjs'))) {
        return 'nextjs';
      }
      
      // Check package.json for framework indicators
      if (fs.existsSync(path.join(projectPath, 'package.json'))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        if (packageJson.dependencies?.expo) return 'expo';
        if (packageJson.dependencies?.next) return 'nextjs';
        if (packageJson.dependencies?.['react-native']) return 'react-native';
        if (packageJson.dependencies?.vue) return 'vue';
        if (packageJson.dependencies?.angular) return 'angular';
      }
    } catch (error) {
      // Silent fail - platform detection is optional
    }
    
    return undefined;
  }
  
  incrementErrorCount(): number {
    this.errorCount++;
    return this.errorCount;
  }
  
  resetErrorCount(): void {
    this.errorCount = 0;
    this.recentErrors = [];
  }
  
  addError(error: string): void {
    this.recentErrors.push(error);
    if (this.recentErrors.length > 10) {
      this.recentErrors.shift();
    }
    this.incrementErrorCount();
  }
  
  shouldSuggestRollback(): boolean {
    return this.errorCount >= 3;
  }
  
  createCheckpoint(): string {
    const timestamp = Date.now();
    const checkpointName = `SAFE-${timestamp}`;
    this.checkpointHistory.push(checkpointName);
    return checkpointName;
  }
  
  formatRiskAssessment(assessment: RiskAssessment, operation: string): string {
    const levelColors = {
      [RiskLevel.LOW]: chalk.green,
      [RiskLevel.MEDIUM]: chalk.yellow,
      [RiskLevel.HIGH]: chalk.yellow, // Using yellow instead of rgb for compatibility
      [RiskLevel.CRITICAL]: chalk.red
    };
    
    const levelEmojis = {
      [RiskLevel.LOW]: '✅',
      [RiskLevel.MEDIUM]: '⚠️',
      [RiskLevel.HIGH]: '🔴',
      [RiskLevel.CRITICAL]: '⛔'
    };
    
    const color = levelColors[assessment.level];
    const emoji = levelEmojis[assessment.level];
    
    let content = '';
    content += chalk.bold('Operation: ') + operation + '\n';
    content += chalk.bold('Risk Level: ') + color(`${emoji} ${assessment.level}`) + '\n';
    content += chalk.bold('Confidence: ') + this.formatConfidence(assessment.confidence) + '\n';
    
    if (assessment.estimatedRecoveryTime) {
      content += chalk.bold('Recovery Time: ') + assessment.estimatedRecoveryTime + '\n';
    }
    
    if (assessment.patterns.length > 0) {
      content += '\n' + chalk.bold('Detected Risks:') + '\n';
      assessment.patterns.forEach(pattern => {
        content += `  • ${pattern.category}: ${pattern.description}\n`;
      });
    }
    
    if (assessment.warnings.length > 0) {
      content += '\n' + chalk.bold('Warnings:') + '\n';
      assessment.warnings.forEach(warning => {
        content += `  ${warning}\n`;
      });
    }
    
    if (assessment.recommendations.length > 0) {
      content += '\n' + chalk.bold('Safer Alternatives:') + '\n';
      assessment.recommendations.forEach(rec => {
        content += `  → ${rec}\n`;
      });
    }
    
    if (assessment.requiresCheckpoint) {
      content += '\n' + chalk.bgRed.white(' CHECKPOINT REQUIRED ') + '\n';
      content += chalk.cyan('Run this command first:\n');
      content += chalk.gray(`git add -A && git commit -m "CHECKPOINT before ${operation}"\n`);
    }
    
    return boxen(content, {
      title: '🛡️ Risk Assessment',
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: assessment.level === RiskLevel.CRITICAL ? 'red' : 
                   assessment.level === RiskLevel.HIGH ? 'yellow' : 'cyan'
    });
  }
  
  private getRiskScore(level: RiskLevel): number {
    const scores = {
      [RiskLevel.LOW]: 1,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.CRITICAL]: 4
    };
    return scores[level];
  }
  
  private calculateConfidence(patterns: RiskPattern[], query: string): number {
    if (patterns.length === 0) {
      return 50; // Medium confidence when no patterns match
    }
    
    // Higher confidence with more specific pattern matches
    const baseConfidence = Math.min(95, 60 + (patterns.length * 10));
    
    // Adjust based on query specificity
    const queryWords = query.split(/\s+/).length;
    const specificityBonus = Math.min(20, queryWords * 2);
    
    return Math.min(100, baseConfidence + specificityBonus);
  }
  
  private formatConfidence(confidence: number): string {
    if (confidence >= 80) {
      return chalk.green(`${confidence}% - High Confidence`);
    } else if (confidence >= 50) {
      return chalk.yellow(`${confidence}% - Medium Confidence`);
    } else {
      return chalk.red(`${confidence}% - Low Confidence`);
    }
  }
  
  private estimateRecoveryTime(level: RiskLevel): string {
    const times = {
      [RiskLevel.LOW]: '1-2 minutes',
      [RiskLevel.MEDIUM]: '5-10 minutes',
      [RiskLevel.HIGH]: '15-30 minutes',
      [RiskLevel.CRITICAL]: '30-60 minutes'
    };
    return times[level];
  }
}