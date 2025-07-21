import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

interface ServerProcess {
  api: ChildProcess | null;
  dashboard: ChildProcess | null;
}

const servers: ServerProcess = {
  api: null,
  dashboard: null
};

export function createGuiCommand(): Command {
  const gui = new Command('gui');
  
  gui
    .description('Launch the learning analytics GUI dashboard')
    .option('-p, --port <number>', 'Dashboard port (default: 3000)', '3000')
    .option('--api-port <number>', 'API server port (default: 3001)', '3001')
    .option('--no-browser', 'Don\'t automatically open browser')
    .option('--dev', 'Run in development mode with hot reload')
    .action(async (options) => {
      const dashboardPort = parseInt(options.port);
      const apiPort = parseInt(options.apiPort);
      
      console.log(boxen(
        `🚀 ${chalk.bold('Claude Prompter GUI Dashboard')}\n\n` +
        `${chalk.gray('Dashboard:')} http://localhost:${dashboardPort}\n` +
        `${chalk.gray('API Server:')} http://localhost:${apiPort}\n\n` +
        `${chalk.yellow('Starting servers...')}`,
        {
          title: '🎨 GUI Dashboard',
          titleAlignment: 'center',
          padding: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
        }
      ));

      try {
        await startServers(dashboardPort, apiPort, options);
        
        if (options.browser !== false) {
          await openBrowser(`http://localhost:${dashboardPort}`);
        }
        
        // Keep the process alive and handle shutdown gracefully
        setupGracefulShutdown();
        
        console.log(chalk.green('\n✅ GUI Dashboard is running!'));
        console.log(chalk.gray(`\n📊 View your learning analytics at: ${chalk.cyan(`http://localhost:${dashboardPort}`)}`));
        console.log(chalk.gray(`⚡ API endpoints available at: ${chalk.cyan(`http://localhost:${apiPort}/api`)}`));
        console.log(chalk.gray('\n💡 Use Ctrl+C to stop the servers'));
        
      } catch (error) {
        console.error(chalk.red('❌ Failed to start GUI dashboard:'), error);
        process.exit(1);
      }
    });

  gui
    .command('stop')
    .description('Stop running GUI servers')
    .action(() => {
      stopServers();
      console.log(chalk.green('✅ GUI servers stopped'));
    });

  gui
    .command('status')
    .description('Check GUI server status')
    .action(async () => {
      const apiRunning = await checkPortInUse(3001);
      const dashboardRunning = await checkPortInUse(3000);
      
      console.log(boxen(
        `${chalk.bold('GUI Dashboard Status')}\n\n` +
        `API Server (3001): ${apiRunning ? chalk.green('✓ Running') : chalk.red('✗ Stopped')}\n` +
        `Dashboard (3000): ${dashboardRunning ? chalk.green('✓ Running') : chalk.red('✗ Stopped')}\n\n` +
        `${apiRunning && dashboardRunning ? 
          chalk.green('🎉 Dashboard fully operational!') : 
          chalk.yellow('⚠️  Some services may be down')}`,
        {
          title: '📊 Status Check',
          titleAlignment: 'center',
          padding: 1,
          borderStyle: 'round',
          borderColor: apiRunning && dashboardRunning ? 'green' : 'yellow',
        }
      ));
    });

  return gui;
}

async function startServers(dashboardPort: number, apiPort: number, options: any): Promise<void> {
  const projectRoot = join(__dirname, '../..');
  const apiPath = join(projectRoot, 'api-server');
  const dashboardPath = join(projectRoot, 'dashboard', 'claude-prompter-dashboard');
  
  // Check if directories exist
  if (!existsSync(apiPath)) {
    throw new Error(`API server directory not found: ${apiPath}`);
  }
  if (!existsSync(dashboardPath)) {
    throw new Error(`Dashboard directory not found: ${dashboardPath}`);
  }

  const apiSpinner = ora('Starting API server...').start();
  
  try {
    // Start API server
    servers.api = spawn('npm', ['run', options.dev ? 'dev' : 'start'], {
      cwd: apiPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: apiPort.toString() }
    });

    // Wait for API server to be ready
    await waitForServer(`http://localhost:${apiPort}/health`, 30000);
    apiSpinner.succeed(chalk.green('✅ API server ready'));

    const dashboardSpinner = ora('Starting React dashboard...').start();
    
    // Start dashboard
    servers.dashboard = spawn('npm', ['start'], {
      cwd: dashboardPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PORT: dashboardPort.toString(),
        REACT_APP_API_URL: `http://localhost:${apiPort}`
      }
    });

    // Wait for dashboard to be ready
    await waitForServer(`http://localhost:${dashboardPort}`, 45000);
    dashboardSpinner.succeed(chalk.green('✅ React dashboard ready'));

  } catch (error) {
    apiSpinner.fail(chalk.red('❌ Failed to start servers'));
    stopServers();
    throw error;
  }
}

async function waitForServer(url: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Server at ${url} did not respond within ${timeout}ms`);
}

async function checkPortInUse(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(2000)
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import('open');
  try {
    await open(url);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not auto-open browser. Please visit: ${url}`));
  }
}

function stopServers(): void {
  if (servers.api) {
    servers.api.kill('SIGTERM');
    servers.api = null;
  }
  
  if (servers.dashboard) {
    servers.dashboard.kill('SIGTERM');
    servers.dashboard = null;
  }
}

function setupGracefulShutdown(): void {
  const handleShutdown = (signal: string) => {
    console.log(chalk.yellow(`\n⚠️  Received ${signal}, shutting down gracefully...`));
    stopServers();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}