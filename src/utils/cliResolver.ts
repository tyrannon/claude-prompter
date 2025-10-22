/**
 * CLI Resolution Utility
 * Resolves the correct path to claude-prompter CLI with fallback logic
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';

export interface CLIResolutionResult {
  path: string;
  method: 'local' | 'npx' | 'global' | 'env';
  success: boolean;
}

export class CLIResolver {
  private static cachedResult: CLIResolutionResult | null = null;

  /**
   * Resolve the correct claude-prompter CLI path with intelligent fallbacks
   */
  static async resolvePrompter(): Promise<CLIResolutionResult> {
    // Return cached result if available
    if (CLIResolver.cachedResult) {
      return CLIResolver.cachedResult;
    }

    console.log(chalk.gray('🔍 Resolving claude-prompter CLI...'));

    // Strategy 0: Check if we're already running within claude-prompter
    // This prevents recursive resolution when NL interface calls executeCommand
    if (process.argv[1]?.includes('claude-prompter') || process.argv[1]?.includes('cli.js')) {
      const currentCliPath = process.argv[1];
      try {
        await fs.access(currentCliPath);
        const result: CLIResolutionResult = { 
          path: currentCliPath.endsWith('.js') ? `node ${currentCliPath}` : currentCliPath, 
          method: 'local', 
          success: true 
        };
        console.log(chalk.green(`✅ Using current CLI: ${currentCliPath}`));
        CLIResolver.cachedResult = result;
        return result;
      } catch {
        // Continue to other strategies if current CLI path is not accessible
      }
    }

    // Strategy 1: Check for local node_modules binary
    try {
      const localBinPath = path.join(process.cwd(), 'node_modules', '.bin', 'claude-prompter');
      await fs.access(localBinPath);
      const result: CLIResolutionResult = { 
        path: localBinPath, 
        method: 'local', 
        success: true 
      };
      console.log(chalk.green(`✅ Found local binary: ${localBinPath}`));
      CLIResolver.cachedResult = result;
      return result;
    } catch {
      // Continue to next strategy
    }

    // Strategy 2: Check for local dist/cli.js (development mode)
    try {
      const localDistPath = path.join(process.cwd(), 'dist', 'cli.js');
      await fs.access(localDistPath);
      const result: CLIResolutionResult = { 
        path: `node ${localDistPath}`, 
        method: 'local', 
        success: true 
      };
      console.log(chalk.green(`✅ Found local dist/cli.js: ${localDistPath}`));
      CLIResolver.cachedResult = result;
      return result;
    } catch {
      // Continue to next strategy
    }

    // Strategy 3: Use environment variable if set
    const envPath = process.env.CLAUDE_PROMPTER_BIN;
    if (envPath) {
      try {
        await fs.access(envPath);
        const result: CLIResolutionResult = { 
          path: envPath, 
          method: 'env', 
          success: true 
        };
        console.log(chalk.green(`✅ Found via CLAUDE_PROMPTER_BIN: ${envPath}`));
        CLIResolver.cachedResult = result;
        return result;
      } catch {
        console.log(chalk.yellow(`⚠️ CLAUDE_PROMPTER_BIN path not accessible: ${envPath}`));
      }
    }

    // Strategy 4: Test npx claude-prompter availability
    const npxWorking = await CLIResolver.testNpxAvailability();
    if (npxWorking) {
      const result: CLIResolutionResult = { 
        path: 'npx -y claude-prompter', 
        method: 'npx', 
        success: true 
      };
      console.log(chalk.green('✅ Found via npx'));
      CLIResolver.cachedResult = result;
      return result;
    }

    // Strategy 5: Check common global paths
    const globalPaths = [
      '~/.local/bin/claude-prompter-global',
      '/usr/local/bin/claude-prompter',
      path.join(process.env.HOME || '', '.local', 'bin', 'claude-prompter-global'),
      '/Users/kaiyakramer/claude-prompter-standalone/dist/cli.js' // Absolute fallback for development
    ];

    for (const globalPath of globalPaths) {
      try {
        const expandedPath = globalPath.startsWith('~') 
          ? path.join(process.env.HOME || '', globalPath.slice(1))
          : globalPath;
        
        await fs.access(expandedPath);
        const pathToUse = expandedPath.endsWith('.js') ? `node ${expandedPath}` : expandedPath;
        const result: CLIResolutionResult = { 
          path: pathToUse, 
          method: 'global', 
          success: true 
        };
        console.log(chalk.green(`✅ Found global binary: ${expandedPath}`));
        CLIResolver.cachedResult = result;
        return result;
      } catch {
        // Continue to next path
      }
    }

    // All strategies failed
    console.log(chalk.red('❌ Failed to resolve claude-prompter CLI'));
    const result: CLIResolutionResult = { 
      path: 'claude-prompter', 
      method: 'npx', 
      success: false 
    };
    CLIResolver.cachedResult = result;
    return result;
  }

  /**
   * Test if npx can successfully locate and run claude-prompter
   */
  private static async testNpxAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('npx', ['-y', 'claude-prompter', '--version'], {
        stdio: 'pipe',
        shell: false
      });

      const timeout = setTimeout(() => {
        child.kill();
        resolve(false);
      }, 5000); // 5 second timeout

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code === 0);
      });

      child.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Clear the cached resolution result (useful for testing or when installation changes)
   */
  static clearCache(): void {
    CLIResolver.cachedResult = null;
  }

  /**
   * Execute a claude-prompter command with the resolved CLI
   */
  static async executeCommand(args: string[]): Promise<number> {
    const resolution = await CLIResolver.resolvePrompter();
    
    if (!resolution.success) {
      console.error(chalk.red('❌ Cannot execute command - claude-prompter CLI not found'));
      console.error(chalk.yellow('💡 Try installing claude-prompter:'));
      console.error(chalk.cyan('  npm install -g claude-prompter'));
      console.error(chalk.gray('  or'));
      console.error(chalk.cyan('  npm install -D claude-prompter'));
      console.error(chalk.gray('  or set CLAUDE_PROMPTER_BIN environment variable'));
      return 1;
    }

    return new Promise((resolve, reject) => {
      let command: string;
      let commandArgs: string[];

      if (resolution.path.startsWith('node ')) {
        command = 'node';
        commandArgs = [resolution.path.slice(5), ...args]; // Remove 'node ' prefix
      } else if (resolution.path.startsWith('npx ')) {
        command = 'npx';
        commandArgs = resolution.path.slice(4).split(' ').concat(args); // Remove 'npx ' prefix and split
      } else {
        command = resolution.path;
        commandArgs = args;
      }

      console.log(chalk.gray(`🚀 Executing via ${resolution.method}: ${command} ${commandArgs.join(' ')}`));

      const child = spawn(command, commandArgs, {
        stdio: 'inherit',
        shell: false
      });

      child.on('close', (code) => {
        resolve(code || 0);
      });

      child.on('error', (error) => {
        console.error(chalk.red('\n❌ Command Execution Error:'));
        console.error(chalk.gray(`  Method: ${resolution.method}`));
        console.error(chalk.gray(`  Path: ${resolution.path}`));
        console.error(chalk.gray(`  Error: ${error.message}`));
        console.error(chalk.yellow('\n💡 Try these alternatives:'));
        console.error(chalk.cyan('  npm install -g claude-prompter'));
        console.error(chalk.cyan('  export CLAUDE_PROMPTER_BIN=/path/to/claude-prompter'));
        reject(error);
      });
    });
  }
}