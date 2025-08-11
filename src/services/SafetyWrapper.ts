import chalk from 'chalk';
import boxen from 'boxen';
import { RiskAssessmentEngine, RiskLevel, RiskAssessment } from './RiskAssessmentEngine';
import { IncrementalModeEnforcer, IncrementalPlan } from './IncrementalModeEnforcer';

export interface SafetySuggestion {
  original: string;
  modified?: string;
  warnings: string[];
  riskAssessment: RiskAssessment;
  incrementalPlan?: IncrementalPlan;
  confidence: number;
  requiresCheckpoint: boolean;
  blocked?: boolean;
  blockReason?: string;
}

export interface SafetyOptions {
  safeMode?: boolean;
  platform?: string;
  allowHighRisk?: boolean;
  forceIncremental?: boolean;
  context?: string;
  previousErrors?: number;
}

export class SafetyWrapper {
  private riskEngine: RiskAssessmentEngine;
  private incrementalEnforcer: IncrementalModeEnforcer;
  private errorCount: number = 0;
  private recentSuggestions: SafetySuggestion[] = [];
  private safeMode: boolean = false;
  
  constructor() {
    this.riskEngine = new RiskAssessmentEngine();
    this.incrementalEnforcer = new IncrementalModeEnforcer();
  }
  
  wrapSuggestion(suggestion: string, options: SafetyOptions = {}): SafetySuggestion {
    // Detect platform if not provided
    const platform = options.platform || this.riskEngine.detectPlatform();
    
    // Assess risk
    const riskAssessment = this.riskEngine.assessRisk(suggestion, {
      platform,
      context: options.context,
      previousErrors: options.previousErrors || this.errorCount
    });
    
    // Check if should be blocked
    const blocked = this.shouldBlock(riskAssessment, options);
    if (blocked.blocked) {
      return {
        original: suggestion,
        warnings: [blocked.reason],
        riskAssessment,
        confidence: riskAssessment.confidence,
        requiresCheckpoint: false,
        blocked: true,
        blockReason: blocked.reason
      };
    }
    
    // Check if needs incremental mode
    const incrementalPlan = this.checkIncrementalMode(suggestion, {
      platform,
      forceIncremental: options.forceIncremental
    });
    
    // Build warnings
    const warnings = this.buildWarnings(riskAssessment, options);
    
    // Modify suggestion if in safe mode
    const modified = this.modifyForSafeMode(suggestion, riskAssessment, options);
    
    // Calculate confidence with safety adjustments
    const confidence = this.calculateSafetyConfidence(riskAssessment, options);
    
    const safetySuggestion: SafetySuggestion = {
      original: suggestion,
      modified,
      warnings,
      riskAssessment,
      incrementalPlan,
      confidence,
      requiresCheckpoint: riskAssessment.requiresCheckpoint
    };
    
    this.recentSuggestions.push(safetySuggestion);
    if (this.recentSuggestions.length > 10) {
      this.recentSuggestions.shift();
    }
    
    return safetySuggestion;
  }
  
  private shouldBlock(assessment: RiskAssessment, options: SafetyOptions): { blocked: boolean; reason: string } {
    // Block CRITICAL risks in safe mode unless explicitly allowed
    if (assessment.level === RiskLevel.CRITICAL && options.safeMode && !options.allowHighRisk) {
      return {
        blocked: true,
        reason: '⛔ BLOCKED: This operation has CRITICAL risk level and safe mode is enabled'
      };
    }
    
    // Block if pattern description starts with "BLOCKED"
    const blockedPattern = assessment.patterns.find(p => p.description.startsWith('BLOCKED'));
    if (blockedPattern) {
      return {
        blocked: true,
        reason: `⛔ ${blockedPattern.description}`
      };
    }
    
    // Block if too many recent errors
    if (this.errorCount >= 5 && assessment.level >= RiskLevel.HIGH) {
      return {
        blocked: true,
        reason: '⛔ BLOCKED: Too many recent errors. Please rollback before attempting high-risk operations'
      };
    }
    
    return { blocked: false, reason: '' };
  }
  
  private checkIncrementalMode(suggestion: string, options: { platform?: string; forceIncremental?: boolean }): IncrementalPlan | undefined {
    // Check if task requires incremental mode
    const plan = this.incrementalEnforcer.analyzeTask(suggestion, options);
    
    if (plan.requiresIncrementalMode) {
      return plan;
    }
    
    return undefined;
  }
  
  private buildWarnings(assessment: RiskAssessment, options: SafetyOptions): string[] {
    const warnings: string[] = [];
    
    // Add risk level warning
    if (assessment.level === RiskLevel.CRITICAL) {
      warnings.push(chalk.red('⛔ CRITICAL RISK: This operation could break your entire application'));
    } else if (assessment.level === RiskLevel.HIGH) {
      warnings.push(chalk.yellow('⚠️ HIGH RISK: This operation requires careful testing'));
    }
    
    // Add checkpoint warning
    if (assessment.requiresCheckpoint) {
      warnings.push(chalk.cyan('📍 CHECKPOINT REQUIRED: Create a git checkpoint before proceeding'));
    }
    
    // Add confidence warning
    if (assessment.confidence < 50) {
      warnings.push(chalk.yellow('⚠️ LOW CONFIDENCE: Consider alternative approaches'));
    }
    
    // Add rollback warning
    if (this.riskEngine.shouldSuggestRollback()) {
      warnings.push(chalk.red('🛑 ROLLBACK RECOMMENDED: Multiple failures detected'));
    }
    
    // Add platform-specific warnings
    if (options.platform === 'expo' && assessment.patterns.some(p => p.category === 'Expo')) {
      warnings.push(chalk.magenta('📱 EXPO WARNING: This may conflict with Expo managed configurations'));
    }
    
    // Add safe mode notice
    if (options.safeMode) {
      warnings.push(chalk.blue('🛡️ SAFE MODE: Conservative suggestions enabled'));
    }
    
    return warnings;
  }
  
  private modifyForSafeMode(suggestion: string, assessment: RiskAssessment, options: SafetyOptions): string | undefined {
    if (!options.safeMode) {
      return undefined;
    }
    
    let modified = suggestion;
    
    // Add safety prefixes
    if (assessment.level >= RiskLevel.HIGH) {
      modified = `[HIGH RISK - TEST CAREFULLY] ${modified}`;
    }
    
    // Add safer alternatives
    if (assessment.recommendations.length > 0) {
      modified += '\n\nSafer Alternative: ' + assessment.recommendations[0];
    }
    
    // Add test instructions
    if (assessment.requiresCheckpoint) {
      modified += '\n\n⚠️ Before proceeding:\n';
      modified += '1. Create checkpoint: git add -A && git commit -m "CHECKPOINT"\n';
      modified += '2. Make the change\n';
      modified += '3. Test for at least 5 minutes\n';
      modified += '4. Be ready to rollback: git reset --hard HEAD';
    }
    
    return modified;
  }
  
  private calculateSafetyConfidence(assessment: RiskAssessment, options: SafetyOptions): number {
    let confidence = assessment.confidence;
    
    // Reduce confidence for high risk operations
    if (assessment.level === RiskLevel.CRITICAL) {
      confidence = Math.min(confidence, 30);
    } else if (assessment.level === RiskLevel.HIGH) {
      confidence = Math.min(confidence, 50);
    }
    
    // Reduce confidence if many errors
    if (this.errorCount > 0) {
      confidence = Math.max(10, confidence - (this.errorCount * 10));
    }
    
    // Boost confidence in safe mode for low risk operations
    if (options.safeMode && assessment.level === RiskLevel.LOW) {
      confidence = Math.min(95, confidence + 10);
    }
    
    return confidence;
  }
  
  incrementErrorCount(): void {
    this.errorCount++;
    this.riskEngine.incrementErrorCount();
  }
  
  resetErrorCount(): void {
    this.errorCount = 0;
    this.riskEngine.resetErrorCount();
  }
  
  setSafeMode(enabled: boolean): void {
    this.safeMode = enabled;
  }
  
  formatSafetySuggestion(suggestion: SafetySuggestion): string {
    let content = '';
    
    // Show blocked message if blocked
    if (suggestion.blocked) {
      content += chalk.red.bold('❌ SUGGESTION BLOCKED\n\n');
      content += chalk.red(suggestion.blockReason) + '\n';
      
      if (suggestion.riskAssessment.recommendations.length > 0) {
        content += '\n' + chalk.cyan('Try instead:\n');
        suggestion.riskAssessment.recommendations.forEach(rec => {
          content += `  → ${rec}\n`;
        });
      }
      
      return boxen(content, {
        title: '🛡️ Safety Protection',
        titleAlignment: 'center',
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'red'
      });
    }
    
    // Show confidence indicator
    const confidenceIndicator = this.getConfidenceIndicator(suggestion.confidence);
    content += chalk.bold('Confidence: ') + confidenceIndicator + '\n';
    
    // Show risk level
    const riskIndicator = this.getRiskIndicator(suggestion.riskAssessment.level);
    content += chalk.bold('Risk Level: ') + riskIndicator + '\n\n';
    
    // Show warnings
    if (suggestion.warnings.length > 0) {
      content += chalk.bold('Warnings:\n');
      suggestion.warnings.forEach(warning => {
        content += `${warning}\n`;
      });
      content += '\n';
    }
    
    // Show suggestion (modified or original)
    content += chalk.bold('Suggestion:\n');
    content += chalk.cyan(suggestion.modified || suggestion.original) + '\n';
    
    // Show incremental plan if present
    if (suggestion.incrementalPlan && suggestion.incrementalPlan.requiresIncrementalMode) {
      content += '\n' + chalk.yellow.bold('📋 Requires Incremental Implementation\n');
      content += chalk.gray(`${suggestion.incrementalPlan.totalSteps} steps, ${suggestion.incrementalPlan.estimatedTotalTime}\n`);
      content += chalk.gray('Use incremental mode to implement safely\n');
    }
    
    // Show checkpoint requirement
    if (suggestion.requiresCheckpoint) {
      content += '\n' + chalk.bgYellow.black(' CHECKPOINT REQUIRED ') + '\n';
      content += chalk.gray('git add -A && git commit -m "CHECKPOINT"\n');
    }
    
    return boxen(content, {
      title: '💡 Safety-Enhanced Suggestion',
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: this.getBorderColor(suggestion.riskAssessment.level)
    });
  }
  
  private getConfidenceIndicator(confidence: number): string {
    if (confidence >= 80) {
      return chalk.green(`✅ High (${confidence}%)`);
    } else if (confidence >= 50) {
      return chalk.yellow(`⚠️ Medium (${confidence}%)`);
    } else {
      return chalk.red(`🔴 Low (${confidence}%) - Proceed carefully`);
    }
  }
  
  private getRiskIndicator(level: RiskLevel): string {
    const indicators = {
      [RiskLevel.LOW]: chalk.green('✅ LOW'),
      [RiskLevel.MEDIUM]: chalk.yellow('⚠️ MEDIUM'),
      [RiskLevel.HIGH]: chalk.yellow('🔴 HIGH'),
      [RiskLevel.CRITICAL]: chalk.red('⛔ CRITICAL')
    };
    return indicators[level];
  }
  
  private getBorderColor(level: RiskLevel): string {
    const colors = {
      [RiskLevel.LOW]: 'green',
      [RiskLevel.MEDIUM]: 'yellow',
      [RiskLevel.HIGH]: 'yellow',
      [RiskLevel.CRITICAL]: 'red'
    };
    return colors[level];
  }
  
  getSessionStatus(): string {
    let content = chalk.bold('Session Safety Status\n\n');
    
    content += chalk.bold('Error Count: ');
    if (this.errorCount === 0) {
      content += chalk.green(`${this.errorCount} ✅\n`);
    } else if (this.errorCount < 3) {
      content += chalk.yellow(`${this.errorCount} ⚠️\n`);
    } else {
      content += chalk.red(`${this.errorCount} 🔴\n`);
    }
    
    content += chalk.bold('Safe Mode: ') + (this.safeMode ? chalk.green('ON') : chalk.gray('OFF')) + '\n';
    content += chalk.bold('Recent Suggestions: ') + this.recentSuggestions.length + '\n';
    
    if (this.riskEngine.shouldSuggestRollback()) {
      content += '\n' + chalk.red.bold('⚠️ ROLLBACK RECOMMENDED\n');
      content += chalk.yellow('You have encountered multiple errors.\n');
      content += chalk.cyan('Consider: git reset --hard HEAD\n');
    }
    
    // Show risk distribution of recent suggestions
    if (this.recentSuggestions.length > 0) {
      const riskCounts = {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0
      };
      
      this.recentSuggestions.forEach(s => {
        riskCounts[s.riskAssessment.level]++;
      });
      
      content += '\n' + chalk.bold('Recent Risk Distribution:\n');
      content += chalk.green(`  Low: ${riskCounts[RiskLevel.LOW]}\n`);
      content += chalk.yellow(`  Medium: ${riskCounts[RiskLevel.MEDIUM]}\n`);
      content += chalk.yellow(`  High: ${riskCounts[RiskLevel.HIGH]}\n`);
      content += chalk.red(`  Critical: ${riskCounts[RiskLevel.CRITICAL]}\n`);
    }
    
    return boxen(content, {
      title: '🛡️ Safety Status',
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: this.errorCount >= 3 ? 'red' : 'cyan'
    });
  }
}