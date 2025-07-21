import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { callOpenAI } from '../utils/openaiClient';
import { TokenCounter } from '../utils/tokenCounter';
import { UsageManager } from '../data/UsageManager';

interface BatchPrompt {
  id?: string;
  message: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

interface BatchResult {
  id: string;
  prompt: BatchPrompt;
  response?: string;
  success: boolean;
  error?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  duration: number;
  timestamp: string;
}

interface BatchSummary {
  batchId: string;
  totalPrompts: number;
  successful: number;
  failed: number;
  totalTokens: number;
  totalCost: number;
  averageDuration: number;
  startTime: string;
  endTime: string;
  results: BatchResult[];
}

export function createBatchCommand() {
  const batch = new Command('batch')
    .description('Process multiple prompts from a file with cost tracking')
    .option('-f, --file <file>', 'Input file with prompts (JSON or TXT)')
    .option('-o, --output <file>', 'Output file for results', 'batch-results.json')
    .option('--parallel <n>', 'Number of parallel requests (1-5)', '1')
    .option('--max-cost <amount>', 'Maximum cost limit in dollars', '10.00')
    .option('--dry-run', 'Estimate cost without running')
    .option('--resume <batchId>', 'Resume an interrupted batch')
    .option('--template <name>', 'Use a batch template (test, analysis)')
    .option('--delay <ms>', 'Delay between requests (ms)', '0')
    .action(async (options) => {
      try {
        const tokenCounter = new TokenCounter();
        const usageManager = new UsageManager();
        
        // Check for existing limits
        const limitCheck = await usageManager.checkLimits();
        if (limitCheck.exceeded) {
          console.log(chalk.red(`\n❌ ${limitCheck.message}`));
          console.log(chalk.yellow('Use: claude-prompter usage --limit <amount> to adjust limits'));
          return;
        }
        
        // Handle resume
        if (options.resume) {
          await resumeBatch(options.resume, options);
          return;
        }
        
        // Load prompts
        const prompts = await loadPrompts(options.file, options.template);
        if (!prompts.length) {
          console.log(chalk.red('No prompts found to process'));
          return;
        }
        
        // Generate batch ID
        const batchId = uuidv4();
        
        // Estimate cost
        const estimate = await estimateBatchCost(prompts, tokenCounter);
        
        console.log(chalk.cyan('\n📊 Batch Processing Analysis'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`${chalk.white('Batch ID:')} ${chalk.cyan(batchId.slice(0, 8))}`);
        console.log(`${chalk.white('Prompts:')} ${chalk.yellow(prompts.length)}`);
        console.log(`${chalk.white('Est. Tokens:')} ${chalk.yellow(estimate.tokens.toLocaleString())}`);
        console.log(`${chalk.white('Est. Cost:')} ${chalk.green('$' + estimate.cost.toFixed(4))}`);
        console.log(`${chalk.white('Parallel:')} ${chalk.magenta(options.parallel)}`);
        
        if (options.dryRun) {
          console.log(chalk.blue('\n✨ Dry run complete - no requests made'));
          return;
        }
        
        // Check cost limit
        const maxCost = parseFloat(options.maxCost);
        if (estimate.cost > maxCost) {
          console.log(chalk.red(`\n❌ Estimated cost ($${estimate.cost.toFixed(4)}) exceeds limit ($${maxCost.toFixed(2)})`));
          const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Proceed anyway?',
            default: false
          }]);
          if (!proceed) return;
        }
        
        // Confirm execution
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: `Process ${prompts.length} prompts?`,
          default: true
        }]);
        
        if (!confirmed) {
          console.log(chalk.yellow('Batch cancelled'));
          return;
        }
        
        // Process batch
        const summary = await processBatch(prompts, {
          batchId,
          parallel: parseInt(options.parallel),
          delay: parseInt(options.delay),
          outputFile: options.output
        });
        
        // Display results
        await displayBatchSummary(summary);
        
      } catch (error) {
        console.error(chalk.red('Batch processing failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
    
  return batch;
}

async function loadPrompts(filePath?: string, template?: string): Promise<BatchPrompt[]> {
  if (template) {
    return await loadTemplate(template);
  }
  
  if (!filePath) {
    throw new Error('Either --file or --template must be provided');
  }
  
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = await fs.readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  
  let prompts: BatchPrompt[];
  
  if (ext === '.json') {
    const parsed = JSON.parse(content);
    prompts = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    // Treat as text file with one prompt per line
    prompts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(message => ({ message }));
  }
  
  // Add IDs if missing
  prompts.forEach((prompt, index) => {
    if (!prompt.id) {
      prompt.id = `prompt-${index + 1}`;
    }
  });
  
  return prompts;
}

async function loadTemplate(templateName: string): Promise<BatchPrompt[]> {
  // For now, return sample templates - this would be expanded later
  const templates = {
    'test': [
      { message: 'What is 2+2?' },
      { message: 'Tell me a joke' },
      { message: 'Explain photosynthesis briefly' }
    ],
    'analysis': [
      { message: 'Analyze the sentiment of: "I love this product!"' },
      { message: 'Summarize: "The quick brown fox jumps over the lazy dog"' },
      { message: 'Extract keywords from: "Machine learning enables computers to learn"' }
    ]
  };
  
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template '${templateName}' not found. Available: ${Object.keys(templates).join(', ')}`);
  }
  
  return template;
}

async function estimateBatchCost(prompts: BatchPrompt[], tokenCounter: TokenCounter) {
  let totalTokens = 0;
  
  for (const prompt of prompts) {
    const messages = [
      { role: 'system', content: prompt.systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt.message }
    ];
    totalTokens += tokenCounter.countChatTokens(messages as any);
  }
  
  // Estimate output tokens (conservative: 50% of input)
  const estimatedOutputTokens = Math.ceil(totalTokens * 0.5);
  const totalEstimatedTokens = totalTokens + estimatedOutputTokens;
  
  const cost = tokenCounter.estimateCost(totalTokens, estimatedOutputTokens);
  
  return {
    tokens: totalEstimatedTokens,
    cost: cost.totalCost
  };
}

async function processBatch(
  prompts: BatchPrompt[], 
  options: {
    batchId: string;
    parallel: number;
    delay: number;
    outputFile: string;
  }
): Promise<BatchSummary> {
  const { batchId, parallel, delay, outputFile } = options;
  const startTime = new Date().toISOString();
  const results: BatchResult[] = [];
  
  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: `${chalk.cyan('Processing')} |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s | ${chalk.green('{success}')} ✓ ${chalk.red('{failed}')} ✗`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  }, cliProgress.Presets.shades_grey);
  
  progressBar.start(prompts.length, 0, {
    success: 0,
    failed: 0
  });
  
  // Process in batches
  const clampedParallel = Math.min(Math.max(1, parallel), 5); // Limit to 1-5 parallel
  
  for (let i = 0; i < prompts.length; i += clampedParallel) {
    const batchPrompts = prompts.slice(i, i + clampedParallel);
    
    const batchResults = await Promise.all(
      batchPrompts.map(prompt => processPrompt(prompt, batchId))
    );
    
    results.push(...batchResults);
    
    // Update progress
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    progressBar.update(results.length, {
      success: successful,
      failed: failed
    });
    
    // Add delay between batches
    if (delay > 0 && i + clampedParallel < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Save intermediate results
    const tempResults = {
      batchId,
      totalPrompts: prompts.length,
      successful,
      failed,
      totalTokens: results.reduce((sum, r) => sum + (r.tokens?.total || 0), 0),
      totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      startTime,
      endTime: new Date().toISOString(),
      results
    };
    
    await fs.writeJson(`${outputFile}.temp`, tempResults, { spaces: 2 });
  }
  
  progressBar.stop();
  
  // Final summary
  const summary: BatchSummary = {
    batchId,
    totalPrompts: prompts.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTokens: results.reduce((sum, r) => sum + (r.tokens?.total || 0), 0),
    totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    startTime,
    endTime: new Date().toISOString(),
    results
  };
  
  // Save final results
  await fs.writeJson(outputFile, summary, { spaces: 2 });
  
  // Clean up temp file
  await fs.remove(`${outputFile}.temp`).catch(() => {});
  
  return summary;
}

async function processPrompt(prompt: BatchPrompt, batchId: string): Promise<BatchResult> {
  const startTime = Date.now();
  const tokenCounter = new TokenCounter();
  
  try {
    const response = await callOpenAI(
      prompt.message,
      prompt.systemPrompt || 'You are a helpful assistant.',
      { 
        command: 'batch',
        batchId 
      }
    );
    
    // Calculate tokens and cost
    const inputTokens = tokenCounter.countChatTokens([
      { role: 'system', content: prompt.systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt.message }
    ] as any);
    const outputTokens = tokenCounter.count(response);
    const cost = tokenCounter.estimateCost(inputTokens, outputTokens);
    
    return {
      id: prompt.id || uuidv4(),
      prompt,
      response,
      success: true,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      cost: cost.totalCost,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      id: prompt.id || uuidv4(),
      prompt,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

async function resumeBatch(batchId: string, options: any): Promise<void> {
  const tempFile = `${options.output || 'batch-results.json'}.temp`;
  
  if (!await fs.pathExists(tempFile)) {
    console.log(chalk.red(`No resumable batch found for ID: ${batchId}`));
    return;
  }
  
  const tempResults = await fs.readJson(tempFile);
  console.log(chalk.blue(`\n🔄 Resuming batch ${batchId}`));
  console.log(`Progress: ${tempResults.successful + tempResults.failed}/${tempResults.totalPrompts}`);
  
  // Implementation would continue from where it left off
  console.log(chalk.yellow('Resume functionality not yet implemented'));
}

async function displayBatchSummary(summary: BatchSummary): Promise<void> {
  const { totalPrompts, successful, failed, totalTokens, totalCost, averageDuration } = summary;
  
  console.log(chalk.cyan('\n📊 Batch Complete!'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(`${chalk.white('Batch ID:')} ${chalk.cyan(summary.batchId.slice(0, 8))}`);
  console.log(`${chalk.white('Duration:')} ${chalk.yellow(((new Date(summary.endTime).getTime() - new Date(summary.startTime).getTime()) / 1000).toFixed(1))}s`);
  console.log(`${chalk.white('Results:')} ${chalk.green(successful + ' ✓')} ${chalk.red(failed + ' ✗')} ${chalk.gray('(' + totalPrompts + ' total)')}`);
  console.log(`${chalk.white('Tokens:')} ${chalk.yellow(totalTokens.toLocaleString())}`);
  console.log(`${chalk.white('Total Cost:')} ${chalk.green('$' + totalCost.toFixed(4))}`);
  console.log(`${chalk.white('Avg Duration:')} ${chalk.magenta(averageDuration.toFixed(0) + 'ms')}`);
  
  if (failed > 0) {
    console.log(chalk.red('\n❌ Failed requests:'));
    summary.results
      .filter(r => !r.success)
      .slice(0, 3)
      .forEach(r => {
        console.log(chalk.gray(`  • ${r.prompt.message.slice(0, 50)}...`));
        console.log(chalk.red(`    Error: ${r.error}`));
      });
    
    if (failed > 3) {
      console.log(chalk.gray(`  ... and ${failed - 3} more`));
    }
  }
  
  console.log(chalk.green(`\n✅ Results saved to: ${summary.batchId}.json`));
}