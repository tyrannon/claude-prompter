/**
 * Multi-shot command for running prompts across multiple AI models
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { EngineFactory, EngineDefinition, EngineType } from '../engines/EngineFactory';
import { PromptRunner, RunConfig } from '../orchestration/PromptRunner';
import { OutputConfig } from '../orchestration/OutputManager';
import { PromptRequest } from '../engines/BaseEngine';
import { IntelligentRouter, UserPreferences } from '../routing/IntelligentRouter';

export function createMultishotCommand(): Command {
  const cmd = new Command('multishot');
  
  cmd
    .description('Run a prompt across multiple AI models and compare results')
    .option('-m, --message <message>', 'The prompt message to run')
    .option('-s, --system <system>', 'System prompt for all models')
    .option('--models <models>', 'Comma-separated list of models to use', 'gpt-4o,claude-sonnet')
    .option('--runs <number>', 'Number of times to run each model', '1')
    .option('--concurrent', 'Run models in parallel (default)', true)
    .option('--sequential', 'Run models sequentially')
    .option('--max-concurrency <number>', 'Max number of concurrent requests', '5')
    .option('--timeout <ms>', 'Timeout for each request in milliseconds', '60000')
    .option('--retries <number>', 'Number of retries for failed requests', '1')
    .option('--output <strategy>', 'Output strategy: git, folders, or both', 'both')
    .option('--output-dir <dir>', 'Directory for folder outputs', './multi-shot-results')
    .option('--branch-prefix <prefix>', 'Prefix for git branches', 'multishot')
    .option('--cleanup-old', 'Clean up old results')
    .option('--max-age <days>', 'Max age for results in days', '7')
    .option('--continue-on-error', 'Continue even if some engines fail', true)
    .option('--compare', 'Show interactive comparison after run')
    .option('--select-winner', 'Interactively select the best result')
    .option('--auto-score', 'Automatically score results using Claude')
    .option('--dry-run', 'Show configuration without executing')
    .option('--list-models', 'List available model configurations')
    .option('--config-file <file>', 'Load engine configurations from file')
    .option('--smart', 'Use intelligent router to automatically select optimal models')
    .option('--cost-sensitivity <level>', 'Cost sensitivity: low, medium, high', 'medium')
    .option('--speed-sensitivity <level>', 'Speed sensitivity: low, medium, high', 'medium')
    .option('--quality-sensitivity <level>', 'Quality sensitivity: low, medium, high', 'medium')
    .option('--max-models <number>', 'Maximum number of models to auto-select', '3')
    .action(async (options) => {
      try {
        if (options.listModels) {
          return await listAvailableModels();
        }

        if (options.dryRun) {
          return await showDryRun(options);
        }

        if (!options.message) {
          console.error(chalk.red('Error: Message is required. Use -m or --message.'));
          process.exit(1);
        }

        await executeMultishot(options);
      } catch (error) {
        console.error(chalk.red('Multi-shot execution failed:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * List available model configurations
 */
async function listAvailableModels(): Promise<void> {
  const defaultConfigs = EngineFactory.getDefaultConfigs();
  
  console.log(boxen(
    chalk.bold('Available Model Configurations\n\n') +
    defaultConfigs.map(config => 
      `${chalk.cyan(config.name)} (${config.type})\n` +
      `  Model: ${config.config.model}\n` +
      `  Max Tokens: ${config.config.maxTokens}\n`
    ).join('\n'),
    {
      title: '🤖 Models',
      titleAlignment: 'center',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));

  // Test availability
  console.log(chalk.yellow('\n🔍 Testing model availability...\n'));
  
  const engines = EngineFactory.createEngines(defaultConfigs);
  const status = await EngineFactory.testEngines(engines);
  
  status.forEach((available, name) => {
    const icon = available ? chalk.green('✓') : chalk.red('✗');
    const statusText = available ? chalk.green('Available') : chalk.red('Not configured');
    console.log(`${icon} ${chalk.cyan(name)}: ${statusText}`);
  });
}

/**
 * Show dry run configuration
 */
async function showDryRun(options: any): Promise<void> {
  const config = await buildRunConfig(options);
  
  console.log(boxen(
    chalk.bold('Multi-Shot Configuration (Dry Run)\n\n') +
    `${chalk.cyan('Strategy:')} ${options.sequential ? 'Sequential' : 'Parallel'}\n` +
    `${chalk.cyan('Models:')} ${options.models}\n` +
    `${chalk.cyan('Runs per model:')} ${options.runs}\n` +
    `${chalk.cyan('Max concurrency:')} ${options.maxConcurrency}\n` +
    `${chalk.cyan('Timeout:')} ${options.timeout}ms\n` +
    `${chalk.cyan('Retries:')} ${options.retries}\n` +
    `${chalk.cyan('Output strategy:')} ${options.output}\n` +
    `${chalk.cyan('Output directory:')} ${options.outputDir}\n` +
    `${chalk.cyan('Continue on error:')} ${options.continueOnError}\n\n` +
    chalk.bold('Engines:\n') +
    Array.from(config.engines.entries())
      .map(([name, engine]) => `  • ${name} (${engine.getConfig().model})`)
      .join('\n'),
    {
      title: '🚀 Configuration',
      titleAlignment: 'center',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    }
  ));
}

/**
 * Execute multi-shot run
 */
async function executeMultishot(options: any): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 ClaudePrompter Multi-Shot Orchestrator\n'));
  
  // Build configuration
  const config = await buildRunConfig(options);
  
  // Show configuration summary
  console.log(chalk.gray('Configuration:'));
  console.log(chalk.gray(`  Strategy: ${options.sequential ? 'Sequential' : 'Parallel'}`));
  console.log(chalk.gray(`  Engines: ${Array.from(config.engines.keys()).join(', ')}`));
  console.log(chalk.gray(`  Runs: ${options.runs} per engine`));
  
  // Create runner
  const runner = new PromptRunner(config);
  
  // Check engine availability
  console.log(chalk.yellow('\n🔍 Checking engine availability...'));
  const status = await runner.getEngineStatus();
  
  const available = Array.from(status.entries()).filter(([_, isAvailable]) => isAvailable);
  const unavailable = Array.from(status.entries()).filter(([_, isAvailable]) => !isAvailable);
  
  if (unavailable.length > 0) {
    console.log(chalk.red(`❌ Unavailable engines: ${unavailable.map(([name]) => name).join(', ')}`));
    
    if (available.length === 0) {
      console.error(chalk.red('No engines are available. Please check your configuration.'));
      process.exit(1);
    }
    
    // Ask user if they want to continue with available engines only
    const { continueWithAvailable } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueWithAvailable',
      message: `Continue with ${available.length} available engines?`,
      default: true
    }]);
    
    if (!continueWithAvailable) {
      console.log(chalk.yellow('Cancelled by user.'));
      process.exit(0);
    }
    
    // Remove unavailable engines from config
    unavailable.forEach(([name]) => config.engines.delete(name));
  }
  
  console.log(chalk.green(`✓ ${available.length} engines ready`));
  
  // Create prompt request
  const request: PromptRequest = {
    prompt: options.message,
    systemPrompt: options.system,
    metadata: {
      multishot: true,
      runs: parseInt(options.runs),
      timestamp: new Date().toISOString()
    }
  };
  
  // Execute runs
  const runs = parseInt(options.runs);
  const allResults = new Map<string, any[]>();
  
  for (let run = 1; run <= runs; run++) {
    if (runs > 1) {
      console.log(chalk.cyan(`\n🔄 Run ${run}/${runs}`));
    }
    
    const result = await runner.run(request);
    
    if (!result.success && result.errors.length > 0) {
      console.log(chalk.red('\n❌ Some engines failed:'));
      result.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
    }
    
    // Collect results for comparison
    for (const [engineName, response] of result.results) {
      if (!allResults.has(engineName)) {
        allResults.set(engineName, []);
      }
      allResults.get(engineName)!.push(response);
    }
  }
  
  // Show results summary
  console.log(chalk.bold.green('\n📊 Multi-Shot Results Summary'));
  console.log(chalk.gray('─'.repeat(50)));
  
  for (const [engineName, responses] of allResults) {
    const successCount = responses.filter(r => !r.error).length;
    const avgTime = responses.reduce((sum, r) => sum + r.executionTime, 0) / responses.length;
    
    console.log(`${chalk.cyan(engineName)}: ${successCount}/${responses.length} success, avg ${Math.round(avgTime)}ms`);
  }
  
  // Interactive comparison and selection
  if (options.compare || options.selectWinner) {
    await showInteractiveComparison(allResults, options);
  }
  
  if (options.autoScore) {
    await performAutoScoring(allResults, request);
  }
}

/**
 * Build run configuration from CLI options
 */
async function buildRunConfig(options: any): Promise<RunConfig> {
  let modelNames: string[];
  
  // Use intelligent router if --smart flag is provided
  if (options.smart) {
    console.log(chalk.cyan('\n🧠 Using Intelligent Router for model selection...\n'));
    
    const router = new IntelligentRouter();
    
    // Register all available engines
    const defaultConfigs = EngineFactory.getDefaultConfigs();
    for (const config of defaultConfigs) {
      router.registerEngine(config.name, config.config);
    }
    
    // Analyze the prompt
    const analysis = await router.analyzePrompt(options.message);
    console.log(chalk.gray(`📊 Prompt Analysis:`));
    console.log(chalk.gray(`  Task Type: ${analysis.taskType}`));
    console.log(chalk.gray(`  Complexity: ${analysis.complexity}/10`));
    console.log(chalk.gray(`  Technical Depth: ${analysis.technicalDepth}/10`));
    console.log(chalk.gray(`  Estimated Tokens: ${analysis.estimatedTokens}`));
    
    // Build user preferences from CLI options
    const preferences: UserPreferences = {
      costSensitivity: options.costSensitivity as 'low' | 'medium' | 'high',
      speedSensitivity: options.speedSensitivity as 'low' | 'medium' | 'high',
      qualitySensitivity: options.qualitySensitivity as 'low' | 'medium' | 'high'
    };
    
    // Get routing decision
    const maxModels = parseInt(options.maxModels) || 3;
    const decision = await router.selectOptimalModels(analysis, preferences, maxModels);
    
    console.log(chalk.cyan(`\n🎯 Router Recommendations:`));
    console.log(chalk.gray(`  Primary: ${decision.primaryModel.model} (confidence: ${(decision.primaryModel.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.gray(`  Est. Cost: $${decision.totalEstimatedCost.toFixed(4)}`));
    console.log(chalk.gray(`  Est. Time: ${(decision.totalEstimatedTime / 1000).toFixed(1)}s`));
    
    if (decision.backupModels.length > 0) {
      console.log(chalk.gray(`  Backups: ${decision.backupModels.map(m => m.model).join(', ')}`));
    }
    
    console.log(chalk.gray(`\n💡 Reasoning:`));
    decision.explanation.forEach(reason => {
      console.log(chalk.gray(`  • ${reason}`));
    });
    
    // Apply hybrid strategy if recommended
    if (decision.hybridStrategy) {
      console.log(chalk.cyan(`\n🔄 Hybrid Strategy Applied:`));
      if (decision.hybridStrategy.tryLocalFirst) {
        console.log(chalk.gray(`  • Try local models first for cost efficiency`));
      }
      if (decision.hybridStrategy.parallelExecution) {
        console.log(chalk.gray(`  • Parallel execution for faster results`));
        options.concurrent = true;
        options.sequential = false;
      }
    }
    
    // Use selected models
    modelNames = [decision.primaryModel.engineName];
    decision.backupModels.forEach(model => {
      modelNames.push(model.engineName);
    });
    
    console.log(chalk.green(`\n✨ Selected Models: ${modelNames.join(', ')}\n`));
    
  } else {
    // Parse model list from CLI option
    modelNames = options.models.split(',').map((s: string) => s.trim());
  }
  
  // Create engine definitions
  const engineDefinitions: EngineDefinition[] = [];
  const defaultConfigs = EngineFactory.getDefaultConfigs();
  
  for (const modelName of modelNames) {
    const defaultConfig = defaultConfigs.find(c => c.name === modelName);
    if (defaultConfig) {
      engineDefinitions.push(defaultConfig);
    } else {
      // Try to infer engine type from name
      const engineType = inferEngineType(modelName);
      
      if (engineType === 'local') {
        engineDefinitions.push({
          type: engineType,
          name: modelName,
          config: {
            name: modelName,
            model: modelName,
            endpoint: 'http://localhost:11434',
            format: 'ollama',
            temperature: 0.7,
            maxTokens: 2048
          } as any
        });
      } else {
        engineDefinitions.push({
          type: engineType,
          name: modelName,
          config: {
            name: modelName,
            model: modelName,
            temperature: 0.7,
            maxTokens: 4000
          }
        });
      }
    }
  }
  
  // Create engines
  const engines = EngineFactory.createEngines(engineDefinitions);
  
  // Output configuration
  const outputConfig: OutputConfig = {
    strategy: options.output as 'git' | 'folders' | 'both',
    baseDir: options.outputDir,
    branchPrefix: options.branchPrefix,
    cleanupOld: options.cleanupOld,
    maxAge: parseInt(options.maxAge)
  };
  
  // Run configuration
  const runConfig: RunConfig = {
    engines,
    concurrent: !options.sequential,
    maxConcurrency: parseInt(options.maxConcurrency),
    timeout: parseInt(options.timeout),
    retries: parseInt(options.retries),
    outputConfig,
    continueOnError: options.continueOnError
  };
  
  return runConfig;
}

/**
 * Infer engine type from model name
 */
function inferEngineType(modelName: string): EngineType {
  if (modelName.includes('gpt') || modelName.includes('openai')) {
    return 'gpt';
  } else if (modelName.includes('claude') || modelName.includes('anthropic')) {
    return 'claude';
  } else if (modelName.includes('local') || modelName.includes('ollama') || 
             modelName.includes(':') || modelName.includes('qwen') || 
             modelName.includes('llama') || modelName.includes('tinyllama')) {
    return 'local';
  } else {
    return 'custom';
  }
}

/**
 * Show interactive comparison of results
 */
async function showInteractiveComparison(
  allResults: Map<string, any[]>, 
  options: any
): Promise<void> {
  console.log(chalk.bold.yellow('\n🔍 Interactive Comparison'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Show side-by-side comparison
  const engines = Array.from(allResults.keys());
  
  for (let runIndex = 0; runIndex < (allResults.get(engines[0])?.length || 0); runIndex++) {
    if (allResults.get(engines[0])!.length > 1) {
      console.log(chalk.bold.cyan(`\nRun ${runIndex + 1}:`));
    }
    
    console.log('\n' + '═'.repeat(80));
    
    for (const engine of engines) {
      const response = allResults.get(engine)![runIndex];
      console.log(chalk.bold.cyan(`\n${engine.toUpperCase()}:`));
      console.log(chalk.gray('─'.repeat(40)));
      
      if (response.error) {
        console.log(chalk.red(`Error: ${response.error}`));
      } else {
        // Truncate long responses for comparison view
        const content = response.content.length > 200 
          ? response.content.substring(0, 200) + '...'
          : response.content;
        console.log(content);
      }
      
      console.log(chalk.gray(`\nTime: ${response.executionTime}ms | Model: ${response.model}`));
    }
  }
  
  // Winner selection
  if (options.selectWinner) {
    const { winner } = await inquirer.prompt([{
      type: 'list',
      name: 'winner',
      message: 'Select the best result:',
      choices: engines.map(engine => ({
        name: engine,
        value: engine
      }))
    }]);
    
    console.log(chalk.bold.green(`\n🏆 Winner selected: ${winner}`));
    
    // Optionally merge winner to main branch or copy to special location
    const { mergeWinner } = await inquirer.prompt([{
      type: 'confirm',
      name: 'mergeWinner',
      message: 'Save winner result to main workspace?',
      default: false
    }]);
    
    if (mergeWinner) {
      // Implementation would depend on output strategy
      console.log(chalk.green(`✓ Winner result saved to main workspace`));
    }
  }
}

/**
 * Perform automatic scoring using Claude
 */
async function performAutoScoring(
  allResults: Map<string, any[]>,
  originalRequest: PromptRequest
): Promise<void> {
  console.log(chalk.bold.magenta('\n🤖 Auto-Scoring with Claude'));
  console.log(chalk.gray('─'.repeat(50)));
  
  try {
    // Create Claude engine for scoring
    const claudeEngine = EngineFactory.createEngine('claude', {
      name: 'scorer',
      model: 'claude-3-sonnet-20240229'
    });
    
    // Build scoring prompt
    const resultsText = Array.from(allResults.entries())
      .map(([engine, responses]) => {
        return `${engine.toUpperCase()}:\n${responses[0].content}\n`;
      })
      .join('\n---\n\n');
    
    const scoringPrompt = `Please analyze and score these AI responses to the prompt: "${originalRequest.prompt}"

${resultsText}

Please evaluate each response on:
1. Accuracy and relevance (1-10)
2. Clarity and helpfulness (1-10)  
3. Completeness (1-10)
4. Overall quality (1-10)

Provide scores in this format:
ENGINE_NAME: Accuracy=X, Clarity=Y, Completeness=Z, Overall=W
Brief explanation...

Finally, rank them from best to worst.`;
    
    const scoringRequest: PromptRequest = {
      prompt: scoringPrompt,
      systemPrompt: 'You are an expert AI evaluator. Provide objective, detailed scoring.'
    };
    
    const scoringResult = await claudeEngine.execute(scoringRequest);
    
    if (scoringResult.error) {
      console.log(chalk.red(`Auto-scoring failed: ${scoringResult.error}`));
      return;
    }
    
    console.log(boxen(
      scoringResult.content,
      {
        title: '🤖 Claude\'s Scoring Analysis',
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'round',
        borderColor: 'magenta'
      }
    ));
    
  } catch (error) {
    console.log(chalk.red(`Auto-scoring failed: ${error instanceof Error ? error.message : String(error)}`));
  }
}