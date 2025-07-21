import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import { PlanGenerator } from '../services/PlanGenerator';
import { PlanManager } from '../services/PlanManager';

export function createPlanCommand(): Command {
  const command = new Command('plan');
  command.description('Create and manage execution plans for complex tasks');

  const planGenerator = new PlanGenerator();
  const planManager = new PlanManager();

  // Create a new plan
  command
    .command('create <description>')
    .description('Create a new execution plan')
    .option('-s, --session <id>', 'Link to a specific session')
    .option('-p, --project <name>', 'Project name')
    .option('--activate', 'Immediately activate the plan')
    .action(async (description, options) => {
      const spinner = ora('Analyzing task complexity...').start();
      
      try {
        // Generate the plan
        const plan = await planGenerator.generatePlan(description, {
          sessionId: options.session,
          projectName: options.project
        });
        
        spinner.text = 'Generating execution plan...';
        
        // Save the plan
        await planManager.savePlan(plan);
        
        if (options.activate) {
          await planManager.updatePlanStatus(plan.id, 'active');
          plan.status = 'active';
        }
        
        spinner.succeed('Execution plan created!');
        
        // Display the plan
        displayPlanSummary(plan);
        
        // Show next steps
        console.log(chalk.cyan('\n💡 Next steps:'));
        console.log(chalk.gray(`  View full plan: claude-prompter plan view ${plan.id}`));
        console.log(chalk.gray(`  Start working: claude-prompter plan start ${plan.id}`));
        console.log(chalk.gray(`  Get next step: claude-prompter plan next`));
        
      } catch (error) {
        spinner.fail('Failed to create plan');
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      }
    });

  // View current or specific plan
  command
    .command('view [planId]')
    .description('View current or specific plan')
    .option('-f, --full', 'Show full details')
    .action(async (planId, options) => {
      try {
        const plan = planId 
          ? await planManager.loadPlan(planId)
          : await planManager.getActivePlan();
          
        if (!plan) {
          console.log(chalk.yellow('No plan found. Create one with: claude-prompter plan create "task description"'));
          return;
        }
        
        if (options.full) {
          displayFullPlan(plan);
        } else {
          displayPlanSummary(plan);
        }
        
        // Show progress
        const progress = await planManager.getProgress(plan.id);
        displayProgress(progress);
        
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to load plan'));
      }
    });

  // List all plans
  command
    .command('list')
    .description('List all plans')
    .action(async () => {
      const spinner = ora('Loading plans...').start();
      
      try {
        const plans = await planManager.listPlans();
        spinner.stop();
        
        if (plans.length === 0) {
          console.log(chalk.yellow('No plans found. Create one with: claude-prompter plan create "task description"'));
          return;
        }
        
        const table = new Table({
          head: ['ID', 'Title', 'Status', 'Created'],
          colWidths: [20, 40, 12, 20]
        });
        
        plans.forEach(plan => {
          const statusColor = {
            'draft': chalk.gray,
            'active': chalk.green,
            'completed': chalk.blue,
            'archived': chalk.dim
          }[plan.status] || chalk.white;
          
          table.push([
            chalk.cyan(plan.id.substring(0, 18) + '...'),
            plan.title.substring(0, 38),
            statusColor(plan.status),
            plan.created.toLocaleDateString()
          ]);
        });
        
        console.log(table.toString());
        
      } catch (error) {
        spinner.fail('Failed to list plans');
        console.error(error);
      }
    });

  // Start working on a plan
  command
    .command('start <planId>')
    .description('Activate a plan and start working')
    .action(async (planId) => {
      const spinner = ora('Activating plan...').start();
      
      try {
        await planManager.updatePlanStatus(planId, 'active');
        const plan = await planManager.loadPlan(planId);
        
        if (!plan) {
          throw new Error('Plan not found');
        }
        
        spinner.succeed('Plan activated!');
        
        // Get next step
        const nextStep = await planManager.getNextStep(planId);
        if (nextStep) {
          console.log(chalk.cyan('\n🎯 Next step to work on:'));
          displayStep(nextStep);
        }
        
      } catch (error) {
        spinner.fail('Failed to start plan');
        console.error(error);
      }
    });

  // Mark step as complete
  command
    .command('complete <stepId>')
    .description('Mark a step as completed')
    .option('-n, --notes <notes>', 'Add completion notes')
    .action(async (stepId, options) => {
      const spinner = ora('Updating step...').start();
      
      try {
        // Find the plan containing this step
        const activePlan = await planManager.getActivePlan();
        if (!activePlan) {
          throw new Error('No active plan found');
        }
        
        await planManager.updateStepStatus(
          activePlan.id, 
          stepId, 
          'completed',
          options.notes
        );
        
        spinner.succeed('Step marked as completed!');
        
        // Get next step
        const nextStep = await planManager.getNextStep(activePlan.id);
        if (nextStep) {
          console.log(chalk.cyan('\n🎯 Next step:'));
          displayStep(nextStep);
        } else {
          // Check if plan is complete
          const progress = await planManager.getProgress(activePlan.id);
          if (progress.overallProgress === 100) {
            console.log(chalk.green('\n🎉 Congratulations! Plan completed!'));
          }
        }
        
      } catch (error) {
        spinner.fail('Failed to update step');
        console.error(error);
      }
    });

  // Get next step suggestion
  command
    .command('next')
    .description('Get the next recommended step')
    .action(async () => {
      try {
        const activePlan = await planManager.getActivePlan();
        if (!activePlan) {
          console.log(chalk.yellow('No active plan. Start one with: claude-prompter plan start <planId>'));
          return;
        }
        
        const nextStep = await planManager.getNextStep(activePlan.id);
        if (nextStep) {
          console.log(chalk.cyan('🎯 Next recommended step:'));
          displayStep(nextStep);
          
          // Show how to mark complete
          console.log(chalk.gray(`\nWhen done, mark complete with: claude-prompter plan complete ${nextStep.id}`));
        } else {
          console.log(chalk.green('✅ All available steps are completed or blocked!'));
        }
        
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to get next step'));
      }
    });

  // Show progress
  command
    .command('progress')
    .description('Show current progress')
    .action(async () => {
      try {
        const activePlan = await planManager.getActivePlan();
        if (!activePlan) {
          console.log(chalk.yellow('No active plan found'));
          return;
        }
        
        const progress = await planManager.getProgress(activePlan.id);
        displayDetailedProgress(activePlan, progress);
        
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to get progress'));
      }
    });

  // Export plan
  command
    .command('export <planId>')
    .description('Export a plan')
    .option('-f, --format <format>', 'Export format (markdown/json)', 'markdown')
    .action(async (planId, options) => {
      const spinner = ora('Exporting plan...').start();
      
      try {
        const exported = await planManager.exportPlan(planId, options.format);
        spinner.stop();
        
        console.log(exported);
        
      } catch (error) {
        spinner.fail('Failed to export plan');
        console.error(error);
      }
    });

  return command;
}

// Display functions
function displayPlanSummary(plan: any): void {
  const summary = `
${chalk.bold('📋 EXECUTION PLAN: ' + plan.title)}
${'═'.repeat(50)}

${chalk.cyan('Complexity')}: ${getComplexityDisplay(plan)}
${chalk.cyan('Estimated Time')}: ${plan.totalEstimate.minimum}-${plan.totalEstimate.maximum} hours
${chalk.cyan('Phases')}: ${plan.phases.length}
${chalk.cyan('Status')}: ${plan.status}
`;

  console.log(boxen(summary.trim(), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  }));

  // Show phase overview
  plan.phases.forEach((phase: any, index: number) => {
    const icon = index === 0 ? '📦' : index === plan.phases.length - 1 ? '🎯' : '🔧';
    console.log(`\n${icon} ${chalk.bold(`Phase ${phase.order}: ${phase.name}`)} (${phase.steps.length} steps)`);
    
    phase.steps.slice(0, 3).forEach((step: any) => {
      console.log(chalk.gray(`  └─ ${step.title}`));
    });
    
    if (phase.steps.length > 3) {
      console.log(chalk.gray(`  └─ ... and ${phase.steps.length - 3} more steps`));
    }
  });
}

function displayFullPlan(plan: any): void {
  displayPlanSummary(plan);
  
  console.log(chalk.bold('\n📝 Detailed Steps:\n'));
  
  plan.phases.forEach((phase: any) => {
    console.log(chalk.cyan(`\n${phase.name}`));
    console.log(chalk.gray('─'.repeat(40)));
    
    phase.steps.forEach((step: any, index: number) => {
      console.log(`\n${index + 1}. ${chalk.bold(step.title)}`);
      console.log(`   ${chalk.gray(step.description)}`);
      console.log(`   Type: ${step.type} | Priority: ${step.priority} | Est: ${step.estimate.expected}h`);
      
      if (step.commands && step.commands.length > 0) {
        console.log(`   Commands:`);
        step.commands.forEach((cmd: string) => {
          console.log(chalk.gray(`     $ ${cmd}`));
        });
      }
    });
  });
}

function displayStep(step: any): void {
  console.log(boxen(
    `${chalk.bold(step.title)}\n\n` +
    `${step.description}\n\n` +
    `${chalk.cyan('Type')}: ${step.type}\n` +
    `${chalk.cyan('Priority')}: ${step.priority}\n` +
    `${chalk.cyan('Estimate')}: ${step.estimate.minimum}-${step.estimate.maximum} hours\n` +
    `${chalk.cyan('ID')}: ${step.id}` +
    (step.commands && step.commands.length > 0 
      ? `\n\n${chalk.cyan('Commands')}:\n${step.commands.map((c: string) => `  $ ${c}`).join('\n')}`
      : ''),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    }
  ));
}

function displayProgress(progress: any): void {
  const progressBar = generateProgressBar(progress.overallProgress);
  
  console.log(chalk.cyan('\n📊 Progress:'));
  console.log(`Overall: ${progressBar} ${progress.overallProgress.toFixed(1)}%`);
  console.log(`Time: ${progress.timeSpent.toFixed(1)}h spent / ${progress.estimatedRemaining.toFixed(1)}h remaining`);
  console.log(`Status: ${progress.isOnTrack ? chalk.green('✅ On track') : chalk.yellow('⚠️ Behind schedule')}`);
  
  if (progress.currentFocus) {
    console.log(`Current: ${chalk.yellow(progress.currentFocus)}`);
  }
}

function displayDetailedProgress(plan: any, progress: any): void {
  console.log(chalk.bold(`\n📊 Progress Report: ${plan.title}`));
  console.log('━'.repeat(50));
  
  displayProgress(progress);
  
  console.log(chalk.cyan('\n📋 Phase Breakdown:'));
  
  plan.phases.forEach((phase: any) => {
    const phaseSteps = phase.steps.length;
    const phaseCompleted = phase.steps.filter((s: any) => s.status === 'completed').length;
    const phaseProgress = (phaseCompleted / phaseSteps) * 100;
    const phaseBar = generateProgressBar(phaseProgress);
    
    const icon = phaseProgress === 100 ? '✅' : phaseProgress > 0 ? '🔄' : '📦';
    console.log(`\n${icon} ${phase.name}`);
    console.log(`   ${phaseBar} ${phaseProgress.toFixed(0)}% (${phaseCompleted}/${phaseSteps} steps)`);
  });
  
  if (progress.blockers.length > 0) {
    console.log(chalk.red('\n⚠️ Blockers:'));
    progress.blockers.forEach((blocker: string) => {
      console.log(chalk.red(`  • ${blocker}`));
    });
  }
}

function generateProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function getComplexityDisplay(plan: any): string {
  // Infer complexity from total estimate
  const hours = plan.totalEstimate.expected;
  if (hours <= 4) return chalk.green('Simple (1/5)');
  if (hours <= 16) return chalk.yellow('Moderate (2/5)');
  if (hours <= 40) return chalk.yellow('Complex (3/5)');
  if (hours <= 80) return chalk.red('Complex (4/5)');
  return chalk.red('Very Complex (5/5)');
}