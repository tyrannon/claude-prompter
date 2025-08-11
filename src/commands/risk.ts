import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { RiskAssessmentEngine, RiskLevel } from '../services/RiskAssessmentEngine';
import { IncrementalModeEnforcer } from '../services/IncrementalModeEnforcer';

export function createRiskCommand(): Command {
  const riskEngine = new RiskAssessmentEngine();
  const incrementalEnforcer = new IncrementalModeEnforcer();
  
  const command = new Command('risk');
  
  command
    .description('Assess risk level before making changes')
    .argument('<operation>', 'The operation or change you plan to make')
    .option('-p, --platform <platform>', 'Specify platform (expo, nextjs, etc.)')
    .option('-i, --incremental', 'Check if incremental mode is needed')
    .option('-d, --detailed', 'Show detailed risk analysis')
    .option('--force-checkpoint', 'Force checkpoint requirement')
    .option('--allow-high-risk', 'Allow high-risk operations (use with caution)')
    .action(async (operation: string, options: any) => {
      const spinner = ora('Analyzing risk level...').start();
      
      try {
        // Detect platform if not specified
        const platform = options.platform || riskEngine.detectPlatform();
        if (platform && !options.platform) {
          spinner.text = `Detected platform: ${chalk.cyan(platform)}`;
        }
        
        // Perform risk assessment
        const assessment = riskEngine.assessRisk(operation, {
          platform,
          context: options.context
        });
        
        spinner.stop();
        
        // Display risk assessment
        console.log(riskEngine.formatRiskAssessment(assessment, operation));
        
        // Check incremental mode if requested
        if (options.incremental) {
          const plan = incrementalEnforcer.analyzeTask(operation, {
            platform,
            forceIncremental: false
          });
          
          if (plan.requiresIncrementalMode) {
            console.log(incrementalEnforcer.formatIncrementalPlan(plan));
          }
        }
        
        // Show detailed analysis if requested
        if (options.detailed) {
          console.log(chalk.bold('\n📊 Detailed Analysis:\n'));
          
          // Pattern matches
          if (assessment.patterns.length > 0) {
            console.log(chalk.cyan('Matched Patterns:'));
            assessment.patterns.forEach(pattern => {
              console.log(`  • ${pattern.category}: ${pattern.pattern}`);
            });
            console.log();
          }
          
          // Platform-specific info
          if (platform) {
            console.log(chalk.cyan(`Platform-Specific Rules (${platform}):`));
            if (platform === 'expo') {
              console.log('  • Babel config modifications are blocked');
              console.log('  • RegisterRootComponent changes are prevented');
              console.log('  • Metro config rarely needed');
            } else if (platform === 'nextjs') {
              console.log('  • Next.config.js changes are high risk');
              console.log('  • API routes need careful testing');
            }
            console.log();
          }
        }
        
        // Interactive confirmation for high-risk operations
        if (assessment.level === RiskLevel.CRITICAL || assessment.level === RiskLevel.HIGH) {
          if (!options.allowHighRisk) {
            console.log();
            const { proceed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'proceed',
                message: chalk.yellow('This is a high-risk operation. Do you want to proceed?'),
                default: false
              }
            ]);
            
            if (!proceed) {
              console.log(chalk.green('\n✅ Good choice! Operation cancelled.'));
              
              if (assessment.recommendations.length > 0) {
                console.log(chalk.cyan('\nConsider these safer alternatives:'));
                assessment.recommendations.forEach(rec => {
                  console.log(`  → ${rec}`);
                });
              }
              return;
            }
          }
          
          // Show checkpoint instructions
          if (assessment.requiresCheckpoint || options.forceCheckpoint) {
            const checkpointName = riskEngine.createCheckpoint();
            console.log(chalk.bold.yellow('\n📍 Checkpoint Instructions:'));
            console.log(chalk.gray('Run these commands before proceeding:\n'));
            console.log(chalk.cyan(`  git add -A`));
            console.log(chalk.cyan(`  git commit -m "${checkpointName}"`));
            console.log(chalk.cyan(`  git tag ${checkpointName}`));
            console.log(chalk.gray('\nThis allows easy rollback if something goes wrong.'));
          }
        }
        
        // Success message for low risk
        if (assessment.level === RiskLevel.LOW) {
          console.log(chalk.green('\n✅ Low risk operation - generally safe to proceed!'));
        }
        
      } catch (error) {
        spinner.fail('Risk assessment failed');
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });
  
  // Subcommand for checking platform
  command
    .command('detect-platform')
    .description('Detect the current project platform')
    .action(() => {
      const platform = riskEngine.detectPlatform();
      
      if (platform) {
        console.log(chalk.green(`✅ Detected platform: ${chalk.bold(platform)}`));
        
        // Show platform-specific warnings
        const platformWarnings: Record<string, string[]> = {
          expo: [
            'Babel config modifications are restricted',
            'App entry point changes are blocked',
            'Use Expo SDK for native features'
          ],
          nextjs: [
            'Next.config.js changes require careful testing',
            'API routes should be tested independently',
            'Use Next.js conventions for routing'
          ],
          'react-native': [
            'Metro config changes are high risk',
            'Native module linking requires rebuilds',
            'Test on both iOS and Android'
          ]
        };
        
        if (platformWarnings[platform]) {
          console.log(chalk.yellow('\n⚠️ Platform-specific considerations:'));
          platformWarnings[platform].forEach(warning => {
            console.log(`  • ${warning}`);
          });
        }
      } else {
        console.log(chalk.yellow('⚠️ Could not detect platform'));
        console.log(chalk.gray('Platform detection looks for:'));
        console.log(chalk.gray('  • app.json (Expo)'));
        console.log(chalk.gray('  • next.config.js (Next.js)'));
        console.log(chalk.gray('  • package.json dependencies'));
      }
    });
  
  // Subcommand for batch risk assessment
  command
    .command('batch')
    .description('Assess risk for multiple operations')
    .option('-f, --file <file>', 'Read operations from a file')
    .action(async (_options: any) => {
      const operations = [
        'modify babel.config.js',
        'add new component',
        'update package.json',
        'change navigation structure',
        'modify tsconfig.json',
        'add API endpoint',
        'update styles'
      ];
      
      console.log(chalk.bold('\n📊 Batch Risk Assessment\n'));
      
      const platform = riskEngine.detectPlatform();
      if (platform) {
        console.log(chalk.cyan(`Platform: ${platform}\n`));
      }
      
      // Create risk summary
      const summary: Record<RiskLevel, string[]> = {
        [RiskLevel.LOW]: [],
        [RiskLevel.MEDIUM]: [],
        [RiskLevel.HIGH]: [],
        [RiskLevel.CRITICAL]: []
      };
      
      operations.forEach(op => {
        const assessment = riskEngine.assessRisk(op, { platform });
        summary[assessment.level].push(op);
        
        const emoji = {
          [RiskLevel.LOW]: '✅',
          [RiskLevel.MEDIUM]: '⚠️',
          [RiskLevel.HIGH]: '🔴',
          [RiskLevel.CRITICAL]: '⛔'
        }[assessment.level];
        
        const color = {
          [RiskLevel.LOW]: chalk.green,
          [RiskLevel.MEDIUM]: chalk.yellow,
          [RiskLevel.HIGH]: chalk.rgb(255, 165, 0),
          [RiskLevel.CRITICAL]: chalk.red
        }[assessment.level];
        
        console.log(`${emoji} ${color(assessment.level.padEnd(8))} - ${op}`);
      });
      
      // Show summary
      console.log(chalk.bold('\n📈 Summary:'));
      console.log(chalk.green(`  Low Risk: ${summary[RiskLevel.LOW].length} operations`));
      console.log(chalk.yellow(`  Medium Risk: ${summary[RiskLevel.MEDIUM].length} operations`));
      console.log(chalk.rgb(255, 165, 0)(`  High Risk: ${summary[RiskLevel.HIGH].length} operations`));
      console.log(chalk.red(`  Critical Risk: ${summary[RiskLevel.CRITICAL].length} operations`));
      
      if (summary[RiskLevel.CRITICAL].length > 0) {
        console.log(chalk.red.bold('\n⚠️ Critical operations detected!'));
        console.log(chalk.gray('Create checkpoints before attempting these.'));
      }
    });
  
  return command;
}