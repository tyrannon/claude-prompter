/**
 * A/B Testing management command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { abTesting } from '../models/ABTestingFramework';
import { modelRegistry } from '../models/ModelRegistry';

export function createABTestCommand(): Command {
  const cmd = new Command('abtest');
  
  cmd
    .description('Manage A/B tests for model comparison')
    .option('--create', 'Create a new A/B test')
    .option('--list', 'List all active A/B tests')
    .option('--analyze <testId>', 'Analyze results for a specific test')
    .option('--compare <models>', 'Quick comparison test (comma-separated models)')
    .option('--export <testId>', 'Export test results to JSON')
    .action(async (options) => {
      try {
        if (options.create) {
          await createNewTest();
        } else if (options.list) {
          await listTests();
        } else if (options.analyze) {
          await analyzeTest(options.analyze);
        } else if (options.compare) {
          await quickCompare(options.compare);
        } else if (options.export) {
          await exportTest(options.export);
        } else {
          // Interactive mode
          await interactiveMode();
        }
      } catch (error) {
        console.error(chalk.red('A/B test command failed:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Create a new A/B test
 */
async function createNewTest(): Promise<void> {
  console.log(chalk.bold.cyan('\n🧪 Create New A/B Test\n'));

  // Get available models
  const models = modelRegistry.getActiveModels();
  const modelChoices = models.map(m => ({
    name: `${m.name} (${m.family})`,
    value: m.id
  }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Test name:',
      validate: (input) => input.length > 0 || 'Name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Test description:',
      default: 'Model comparison test'
    },
    {
      type: 'checkbox',
      name: 'models',
      message: 'Select models to test:',
      choices: modelChoices,
      validate: (input) => input.length >= 2 || 'Select at least 2 models'
    },
    {
      type: 'list',
      name: 'distribution',
      message: 'Distribution strategy:',
      choices: [
        { name: 'Equal distribution', value: 'equal' },
        { name: 'Custom weights', value: 'custom' }
      ]
    },
    {
      type: 'list',
      name: 'primaryMetric',
      message: 'Primary metric to optimize:',
      choices: [
        { name: 'Quality', value: 'quality' },
        { name: 'Speed', value: 'speed' },
        { name: 'Cost', value: 'cost' },
        { name: 'User Preference', value: 'user_preference' }
      ]
    },
    {
      type: 'number',
      name: 'minSampleSize',
      message: 'Minimum sample size for significance:',
      default: 100
    }
  ]);

  // Set up distribution
  const distribution = new Map<string, number>();
  
  if (answers.distribution === 'equal') {
    const percentage = 100 / answers.models.length;
    answers.models.forEach((modelId: string) => {
      distribution.set(modelId, percentage);
    });
  } else {
    // Custom weights
    for (const modelId of answers.models) {
      const { weight } = await inquirer.prompt([{
        type: 'number',
        name: 'weight',
        message: `Weight for ${modelId} (percentage):`,
        validate: (input) => input >= 0 && input <= 100 || 'Must be between 0 and 100'
      }]);
      distribution.set(modelId, weight);
    }
  }

  // Create the test
  const test = abTesting.createTest({
    name: answers.name,
    description: answers.description,
    models: answers.models,
    distribution,
    startDate: new Date(),
    minSampleSize: answers.minSampleSize,
    active: true,
    criteria: {
      primaryMetric: answers.primaryMetric
    }
  });

  console.log(boxen(
    chalk.green('✓ A/B Test Created Successfully\n\n') +
    `${chalk.cyan('ID:')} ${test.id}\n` +
    `${chalk.cyan('Name:')} ${test.name}\n` +
    `${chalk.cyan('Models:')} ${test.models.join(', ')}\n` +
    `${chalk.cyan('Status:')} Active`,
    {
      title: '🧪 Test Created',
      titleAlignment: 'center',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green'
    }
  ));
}

/**
 * List all active tests
 */
async function listTests(): Promise<void> {
  console.log(chalk.bold.cyan('\n📋 Active A/B Tests\n'));
  
  // This would normally fetch from storage
  console.log(chalk.yellow('No active tests found.'));
  console.log(chalk.gray('Create a new test with: claude-prompter abtest --create'));
}

/**
 * Analyze test results
 */
async function analyzeTest(testId: string): Promise<void> {
  console.log(chalk.bold.cyan(`\n📊 Analyzing Test: ${testId}\n`));
  
  try {
    const analysis = abTesting.analyzeTest(testId);
    
    // Display analysis results
    console.log(chalk.cyan('Model Performance:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    for (const [modelId, stats] of analysis.modelStats) {
      const model = modelRegistry.getModel(modelId);
      console.log(`\n${chalk.yellow(model?.name || modelId)}:`);
      console.log(`  Sample Size: ${stats.sampleSize}`);
      console.log(`  Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
      console.log(`  Avg Cost: $${stats.avgCost.toFixed(4)}`);
      console.log(`  Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`  User Preference: ${stats.userPreference.toFixed(1)}%`);
    }
    
    if (analysis.winner) {
      console.log(chalk.green(`\n🏆 Winner: ${analysis.winner}`));
      console.log(chalk.gray(`  Confidence: ${analysis.confidence?.toFixed(1)}%`));
    }
    
    if (analysis.recommendations.length > 0) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      analysis.recommendations.forEach(rec => {
        console.log(chalk.gray(`  • ${rec}`));
      });
    }
  } catch (error) {
    console.error(chalk.red(`Failed to analyze test: ${error}`));
  }
}

/**
 * Quick comparison test
 */
async function quickCompare(modelsStr: string): Promise<void> {
  const modelIds = modelsStr.split(',').map(s => s.trim());
  
  console.log(chalk.bold.cyan('\n⚡ Quick Model Comparison\n'));
  console.log(chalk.gray(`Models: ${modelIds.join(' vs ')}`));
  
  // Create comparison test
  const test = abTesting.getOrCreateComparisonTest(modelIds);
  
  console.log(boxen(
    `Test created: ${test.id}\n\n` +
    'Run multishot with --ab-test flag to execute:\n' +
    chalk.cyan(`claude-prompter multishot -m "your prompt" --models ${modelsStr} --ab-test`),
    {
      title: '🧪 Quick Test',
      titleAlignment: 'center',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
}

/**
 * Export test results
 */
async function exportTest(testId: string): Promise<void> {
  console.log(chalk.cyan(`\n📤 Exporting test: ${testId}\n`));
  
  try {
    const data = abTesting.exportResults(testId);
    const filename = `abtest_${testId}_${Date.now()}.json`;
    
    // Write to file
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    
    console.log(chalk.green(`✓ Results exported to: ${filename}`));
  } catch (error) {
    console.error(chalk.red(`Failed to export: ${error}`));
  }
}

/**
 * Interactive mode
 */
async function interactiveMode(): Promise<void> {
  console.log(chalk.bold.cyan('\n🧪 A/B Testing Manager\n'));
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Create new A/B test', value: 'create' },
      { name: 'List active tests', value: 'list' },
      { name: 'Analyze test results', value: 'analyze' },
      { name: 'Quick model comparison', value: 'compare' },
      { name: 'Export test data', value: 'export' },
      { name: 'Exit', value: 'exit' }
    ]
  }]);
  
  switch (action) {
    case 'create':
      await createNewTest();
      break;
    case 'list':
      await listTests();
      break;
    case 'analyze':
      const { testId } = await inquirer.prompt([{
        type: 'input',
        name: 'testId',
        message: 'Enter test ID to analyze:'
      }]);
      await analyzeTest(testId);
      break;
    case 'compare':
      const { models } = await inquirer.prompt([{
        type: 'input',
        name: 'models',
        message: 'Enter models to compare (comma-separated):'
      }]);
      await quickCompare(models);
      break;
    case 'export':
      const { exportId } = await inquirer.prompt([{
        type: 'input',
        name: 'exportId',
        message: 'Enter test ID to export:'
      }]);
      await exportTest(exportId);
      break;
    case 'exit':
      console.log(chalk.gray('Goodbye!'));
      break;
  }
}