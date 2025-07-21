import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { ExecutionPlan, Step, PlanProgress } from '../types/planning.types';

export class PlanManager {
  private plansDirectory: string;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.plansDirectory = path.join(homeDir, '.claude-prompter', 'plans');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.plansDirectory)) {
      fs.mkdirSync(this.plansDirectory, { recursive: true });
    }
  }

  async savePlan(plan: ExecutionPlan): Promise<void> {
    const planPath = path.join(this.plansDirectory, `${plan.id}.json`);
    await fsPromises.writeFile(planPath, JSON.stringify(plan, null, 2));
  }

  async loadPlan(planId: string): Promise<ExecutionPlan | null> {
    const planPath = path.join(this.plansDirectory, `${planId}.json`);
    
    try {
      const data = await fsPromises.readFile(planPath, 'utf-8');
      const plan = JSON.parse(data);
      
      // Convert date strings back to Date objects
      plan.createdAt = new Date(plan.createdAt);
      plan.updatedAt = new Date(plan.updatedAt);
      
      return plan;
    } catch (error) {
      return null;
    }
  }

  async listPlans(): Promise<{ id: string; title: string; status: string; created: Date }[]> {
    const files = await fsPromises.readdir(this.plansDirectory);
    const plans = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const planId = file.replace('.json', '');
        const plan = await this.loadPlan(planId);
        
        if (plan) {
          plans.push({
            id: plan.id,
            title: plan.title,
            status: plan.status,
            created: plan.createdAt
          });
        }
      }
    }

    return plans.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  async getActivePlan(): Promise<ExecutionPlan | null> {
    const plans = await this.listPlans();
    const activePlan = plans.find(p => p.status === 'active');
    
    if (activePlan) {
      return this.loadPlan(activePlan.id);
    }
    
    return null;
  }

  async updatePlanStatus(planId: string, status: ExecutionPlan['status']): Promise<void> {
    const plan = await this.loadPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    plan.status = status;
    plan.updatedAt = new Date();
    await this.savePlan(plan);
  }

  async updateStepStatus(
    planId: string, 
    stepId: string, 
    status: Step['status'],
    notes?: string
  ): Promise<void> {
    const plan = await this.loadPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    let stepFound = false;
    
    for (const phase of plan.phases) {
      const step = phase.steps.find(s => s.id === stepId);
      if (step) {
        step.status = status;
        
        if (status === 'in-progress' && !step.startedAt) {
          step.startedAt = new Date();
        } else if (status === 'completed' && !step.completedAt) {
          step.completedAt = new Date();
          if (notes) {
            step.completionNotes = notes;
          }
        }
        
        stepFound = true;
        break;
      }
    }

    if (!stepFound) {
      throw new Error(`Step ${stepId} not found in plan ${planId}`);
    }

    plan.updatedAt = new Date();
    await this.savePlan(plan);
  }

  async getProgress(planId: string): Promise<PlanProgress> {
    const plan = await this.loadPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    let totalSteps = 0;
    let completedSteps = 0;
    let currentFocus: string | undefined;
    let blockers: string[] = [];
    let timeSpent = 0;

    for (const phase of plan.phases) {
      for (const step of phase.steps) {
        totalSteps++;
        
        if (step.status === 'completed') {
          completedSteps++;
          if (step.startedAt && step.completedAt) {
            const duration = step.completedAt.getTime() - step.startedAt.getTime();
            timeSpent += duration / (1000 * 60 * 60); // Convert to hours
          }
        } else if (step.status === 'in-progress') {
          currentFocus = `${phase.name}: ${step.title}`;
        } else if (step.status === 'blocked' && step.blockedBy) {
          blockers.push(step.blockedBy);
        }
      }
    }

    const overallProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    const phasesCompleted = plan.phases.filter(phase => 
      phase.steps.every(step => step.status === 'completed')
    ).length;

    // Calculate remaining time estimate
    const remainingSteps = totalSteps - completedSteps;
    const avgTimePerStep = completedSteps > 0 ? timeSpent / completedSteps : plan.totalEstimate.expected / totalSteps;
    const estimatedRemaining = remainingSteps * avgTimePerStep;

    // Check if on track
    const expectedProgress = timeSpent / plan.totalEstimate.expected;
    const isOnTrack = overallProgress / 100 >= expectedProgress * 0.9; // Allow 10% variance

    return {
      planId: plan.id,
      overallProgress,
      phasesCompleted,
      stepsCompleted: completedSteps,
      totalSteps,
      timeSpent,
      estimatedRemaining,
      isOnTrack,
      currentFocus,
      blockers
    };
  }

  async getNextStep(planId: string): Promise<Step | null> {
    const plan = await this.loadPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    // Find the first pending step that has all dependencies completed
    for (const phase of plan.phases) {
      for (const step of phase.steps) {
        if (step.status === 'pending') {
          // Check if all dependencies are completed
          const dependenciesCompleted = step.dependsOn.every(depId => {
            // Find the dependency step
            for (const p of plan.phases) {
              const depStep = p.steps.find(s => s.id === depId);
              if (depStep) {
                return depStep.status === 'completed';
              }
            }
            return false;
          });

          if (dependenciesCompleted) {
            return step;
          }
        }
      }
    }

    return null;
  }

  async exportPlan(planId: string, format: 'markdown' | 'json' = 'markdown'): Promise<string> {
    const plan = await this.loadPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    if (format === 'json') {
      return JSON.stringify(plan, null, 2);
    }

    // Markdown export
    let markdown = `# 📋 ${plan.title}\n\n`;
    markdown += `**Status**: ${plan.status}\n`;
    markdown += `**Created**: ${plan.createdAt.toLocaleDateString()}\n`;
    markdown += `**Estimated Time**: ${plan.totalEstimate.minimum}-${plan.totalEstimate.maximum} hours\n\n`;
    
    markdown += `## Description\n${plan.description}\n\n`;
    
    const progress = await this.getProgress(planId);
    markdown += `## Progress\n`;
    markdown += `- Overall: ${progress.overallProgress.toFixed(1)}%\n`;
    markdown += `- Steps Completed: ${progress.stepsCompleted}/${progress.totalSteps}\n`;
    markdown += `- Time Spent: ${progress.timeSpent.toFixed(1)} hours\n`;
    markdown += `- On Track: ${progress.isOnTrack ? '✅' : '⚠️'}\n\n`;

    markdown += `## Phases\n\n`;
    
    for (const phase of plan.phases) {
      const phaseComplete = phase.steps.every(s => s.status === 'completed');
      const phaseIcon = phaseComplete ? '✅' : phase.steps.some(s => s.status === 'in-progress') ? '🔄' : '📦';
      
      markdown += `### ${phaseIcon} ${phase.name}\n`;
      markdown += `${phase.description}\n\n`;
      
      for (const step of phase.steps) {
        const statusIcon = {
          'completed': '✅',
          'in-progress': '🔄',
          'pending': '⏳',
          'blocked': '🚫',
          'skipped': '⏭️'
        }[step.status];
        
        markdown += `- ${statusIcon} **${step.title}**\n`;
        markdown += `  - Type: ${step.type}\n`;
        markdown += `  - Estimate: ${step.estimate.minimum}-${step.estimate.maximum} hours\n`;
        markdown += `  - Priority: ${step.priority}\n`;
        
        if (step.commands && step.commands.length > 0) {
          markdown += `  - Commands:\n`;
          step.commands.forEach(cmd => {
            markdown += `    \`\`\`bash\n    ${cmd}\n    \`\`\`\n`;
          });
        }
        
        if (step.completionNotes) {
          markdown += `  - Notes: ${step.completionNotes}\n`;
        }
        
        markdown += '\n';
      }
    }

    return markdown;
  }
}