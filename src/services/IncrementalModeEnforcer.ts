import chalk from 'chalk';
import boxen from 'boxen';
import { RiskAssessmentEngine, RiskLevel } from './RiskAssessmentEngine';

export interface Step {
  number: number;
  description: string;
  command?: string;
  checkpoint: string;
  testInstructions: string;
  riskLevel: RiskLevel;
  estimatedTime: string;
  dependencies?: number[];
}

export interface IncrementalPlan {
  mode: 'incremental' | 'standard';
  totalSteps: number;
  currentStep: number;
  steps: Step[];
  requiresIncrementalMode: boolean;
  reason?: string;
  estimatedTotalTime: string;
}

export class IncrementalModeEnforcer {
  private riskAssessment: RiskAssessmentEngine;
  private currentPlan: IncrementalPlan | null = null;
  private completedSteps: Set<number> = new Set();
  private failedSteps: Map<number, string> = new Map();
  
  constructor() {
    this.riskAssessment = new RiskAssessmentEngine();
  }
  
  analyzeTask(task: string, options?: {
    forceIncremental?: boolean;
    platform?: string;
  }): IncrementalPlan {
    // Ensure task is a string
    const taskString = typeof task === 'string' ? task : String(task);
    const steps = this.identifySteps(taskString, options?.platform);
    const requiresIncremental = this.shouldEnforceIncremental(steps, options?.forceIncremental);
    
    if (requiresIncremental) {
      const plan: IncrementalPlan = {
        mode: 'incremental',
        totalSteps: steps.length,
        currentStep: 1,
        steps: steps.map((step, index) => this.enrichStep(step, index + 1, taskString, options?.platform)),
        requiresIncrementalMode: true,
        reason: this.getIncrementalReason(steps),
        estimatedTotalTime: this.calculateTotalTime(steps)
      };
      
      this.currentPlan = plan;
      return plan;
    }
    
    return {
      mode: 'standard',
      totalSteps: steps.length,
      currentStep: 1,
      steps: steps.map((step, index) => this.enrichStep(step, index + 1, task, options?.platform)),
      requiresIncrementalMode: false,
      estimatedTotalTime: this.calculateTotalTime(steps)
    };
  }
  
  private identifySteps(task: string, platform?: string): string[] {
    const steps: string[] = [];
    const taskLower = task.toLowerCase();
    
    // Common multi-step patterns
    if (taskLower.includes('authentication') || taskLower.includes('auth')) {
      steps.push(
        'Install authentication packages',
        'Create authentication context/store',
        'Implement login UI components',
        'Add authentication service/API integration',
        'Set up protected routes/navigation',
        'Add logout functionality',
        'Test authentication flow'
      );
    } else if (taskLower.includes('subscription') || taskLower.includes('payment')) {
      steps.push(
        'Install payment processing packages',
        'Create subscription UI components',
        'Set up payment service integration',
        'Implement subscription management',
        'Add billing history',
        'Test payment flow'
      );
    } else if (taskLower.includes('typescript')) {
      steps.push(
        'Install TypeScript dependencies',
        'Create tsconfig.json',
        'Rename .js files to .ts/.tsx',
        'Fix type errors',
        'Update build scripts',
        'Test TypeScript compilation'
      );
    } else if (taskLower.includes('database') || taskLower.includes('migration')) {
      steps.push(
        'Set up database connection',
        'Create migration files',
        'Define data models/schemas',
        'Run migrations',
        'Create seed data',
        'Test database operations'
      );
    } else if (taskLower.includes('deploy') || taskLower.includes('production')) {
      steps.push(
        'Configure environment variables',
        'Set up build process',
        'Configure deployment platform',
        'Run production build',
        'Deploy to staging',
        'Test staging environment',
        'Deploy to production'
      );
    } else {
      // Generic task breakdown based on keywords
      const keywords = [
        'create', 'implement', 'add', 'set up', 'configure',
        'integrate', 'build', 'develop', 'install', 'update'
      ];
      
      keywords.forEach(keyword => {
        const regex = new RegExp(`${keyword}\\s+([\\w\\s]+)`, 'gi');
        const matches = task.matchAll(regex);
        for (const match of matches) {
          steps.push(`${keyword.charAt(0).toUpperCase() + keyword.slice(1)} ${match[1].trim()}`);
        }
      });
      
      // If no specific steps identified, create generic ones
      if (steps.length === 0) {
        steps.push(
          'Analyze requirements',
          'Implement core functionality',
          'Add error handling',
          'Test implementation'
        );
      }
    }
    
    // Add platform-specific steps
    if (platform === 'expo' && taskLower.includes('native')) {
      steps.unshift('Check Expo SDK compatibility');
      steps.push('Test on Expo Go app');
    }
    
    return steps;
  }
  
  private shouldEnforceIncremental(steps: string[], forceIncremental?: boolean): boolean {
    if (forceIncremental) return true;
    
    // Enforce incremental mode for:
    // 1. More than 3 steps
    if (steps.length > 3) return true;
    
    // 2. Any step contains high-risk keywords
    const highRiskKeywords = [
      'babel', 'webpack', 'metro', 'config', 'migration',
      'deploy', 'production', 'database', 'authentication'
    ];
    
    const hasHighRiskStep = steps.some(step => 
      highRiskKeywords.some(keyword => 
        step.toLowerCase().includes(keyword)
      )
    );
    
    if (hasHighRiskStep) return true;
    
    return false;
  }
  
  private enrichStep(stepDescription: string, stepNumber: number, _fullTask: string, platform?: string): Step {
    const assessment = this.riskAssessment.assessRisk(stepDescription, { platform });
    
    return {
      number: stepNumber,
      description: stepDescription,
      checkpoint: `CHECKPOINT-${stepNumber}-${Date.now()}`,
      testInstructions: this.generateTestInstructions(stepDescription, assessment.level),
      riskLevel: assessment.level,
      estimatedTime: this.estimateStepTime(assessment.level),
      dependencies: stepNumber > 1 ? [stepNumber - 1] : undefined
    };
  }
  
  private generateTestInstructions(_step: string, riskLevel: RiskLevel): string {
    const baseInstructions = [
      'Run the application/service',
      'Check for console errors',
      'Verify expected behavior'
    ];
    
    if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
      baseInstructions.push(
        'Test for at least 5 minutes',
        'Check all related functionality',
        'Be prepared to rollback if issues arise'
      );
    } else {
      baseInstructions.push('Test for 2-3 minutes');
    }
    
    return baseInstructions.join(', ');
  }
  
  private estimateStepTime(riskLevel: RiskLevel): string {
    const times = {
      [RiskLevel.LOW]: '2-5 minutes',
      [RiskLevel.MEDIUM]: '5-10 minutes',
      [RiskLevel.HIGH]: '10-20 minutes',
      [RiskLevel.CRITICAL]: '20-30 minutes'
    };
    return times[riskLevel];
  }
  
  private calculateTotalTime(steps: string[]): string {
    // Rough estimate based on step count
    const minutes = steps.length * 10;
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  
  private getIncrementalReason(steps: string[]): string {
    if (steps.length > 5) {
      return `This task requires ${steps.length} steps. Incremental mode ensures each step is tested before proceeding.`;
    }
    
    const hasHighRisk = steps.some(step => {
      const assessment = this.riskAssessment.assessRisk(step);
      return assessment.level === RiskLevel.HIGH || assessment.level === RiskLevel.CRITICAL;
    });
    
    if (hasHighRisk) {
      return 'This task contains high-risk operations. Incremental mode prevents cascade failures.';
    }
    
    return 'Incremental mode recommended for safer implementation.';
  }
  
  markStepComplete(stepNumber: number): void {
    if (this.currentPlan) {
      this.completedSteps.add(stepNumber);
      if (stepNumber < this.currentPlan.totalSteps) {
        this.currentPlan.currentStep = stepNumber + 1;
      }
    }
  }
  
  markStepFailed(stepNumber: number, error: string): void {
    this.failedSteps.set(stepNumber, error);
  }
  
  getCurrentStep(): Step | null {
    if (!this.currentPlan || this.currentPlan.mode !== 'incremental') {
      return null;
    }
    
    return this.currentPlan.steps[this.currentPlan.currentStep - 1] || null;
  }
  
  formatIncrementalPlan(plan: IncrementalPlan): string {
    if (plan.mode !== 'incremental') {
      return this.formatStandardPlan(plan);
    }
    
    let content = chalk.bold.yellow('📋 INCREMENTAL MODE ACTIVATED\n\n');
    
    if (plan.reason) {
      content += chalk.cyan(plan.reason) + '\n\n';
    }
    
    content += chalk.bold(`Total Steps: ${plan.totalSteps}\n`);
    content += chalk.bold(`Estimated Time: ${plan.estimatedTotalTime}\n\n`);
    
    content += chalk.bold.underline('Implementation Plan:\n\n');
    
    plan.steps.forEach(step => {
      const isComplete = this.completedSteps.has(step.number);
      const isFailed = this.failedSteps.has(step.number);
      const isCurrent = step.number === plan.currentStep;
      
      let stepIcon = '⭕';
      let stepColor = chalk.gray;
      
      if (isComplete) {
        stepIcon = '✅';
        stepColor = chalk.green;
      } else if (isFailed) {
        stepIcon = '❌';
        stepColor = chalk.red;
      } else if (isCurrent) {
        stepIcon = '👉';
        stepColor = chalk.cyan;
      }
      
      content += stepColor(`${stepIcon} Step ${step.number}: ${step.description}\n`);
      
      if (isCurrent) {
        const riskColors = {
          [RiskLevel.LOW]: chalk.green,
          [RiskLevel.MEDIUM]: chalk.yellow,
          [RiskLevel.HIGH]: chalk.yellow,
          [RiskLevel.CRITICAL]: chalk.red
        };
        
        content += chalk.gray(`   Risk: ${riskColors[step.riskLevel](step.riskLevel)}\n`);
        content += chalk.gray(`   Time: ${step.estimatedTime}\n`);
        content += chalk.gray(`   Test: ${step.testInstructions}\n`);
        
        if (step.riskLevel === RiskLevel.HIGH || step.riskLevel === RiskLevel.CRITICAL) {
          content += chalk.yellow(`   ⚠️ Checkpoint: ${step.checkpoint}\n`);
          content += chalk.gray(`   Run: git add -A && git commit -m "${step.checkpoint}"\n`);
        }
      }
      
      if (isFailed) {
        content += chalk.red(`   Error: ${this.failedSteps.get(step.number)}\n`);
      }
      
      content += '\n';
    });
    
    if (plan.currentStep <= plan.totalSteps) {
      content += chalk.bold.green('\n✨ Next Action:\n');
      content += chalk.cyan(`Complete Step ${plan.currentStep} and test thoroughly.\n`);
      content += chalk.gray('After testing, mark complete and proceed to next step.\n');
    } else {
      content += chalk.bold.green('\n🎉 All steps completed!\n');
    }
    
    return boxen(content, {
      title: '🚀 Incremental Implementation Plan',
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    });
  }
  
  private formatStandardPlan(plan: IncrementalPlan): string {
    let content = chalk.bold('Standard Implementation\n\n');
    content += `Steps: ${plan.totalSteps}\n`;
    content += `Estimated Time: ${plan.estimatedTotalTime}\n\n`;
    
    plan.steps.forEach(step => {
      content += `${step.number}. ${step.description}\n`;
    });
    
    return boxen(content, {
      title: '📋 Implementation Plan',
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    });
  }
  
  shouldSuggestRollback(): boolean {
    if (!this.currentPlan) return false;
    
    const failedCount = this.failedSteps.size;
    const completedCount = this.completedSteps.size;
    
    // Suggest rollback if more than 2 steps failed or failure rate > 50%
    return failedCount >= 2 || (completedCount > 0 && failedCount / completedCount > 0.5);
  }
  
  getRollbackSuggestion(): string {
    const failedSteps = Array.from(this.failedSteps.entries())
      .map(([num, error]) => `Step ${num}: ${error}`)
      .join('\n');
    
    return chalk.red.bold('🛑 ROLLBACK RECOMMENDED\n\n') +
           chalk.yellow(`Failed Steps:\n${failedSteps}\n\n`) +
           chalk.cyan('Recommended Actions:\n') +
           '1. git reset --hard HEAD\n' +
           '2. npm install\n' +
           '3. Reconsider approach\n' +
           '4. Try simpler implementation';
  }
}