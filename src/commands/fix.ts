import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { execSync } from 'child_process';
import { ProjectAnalyzer } from '../services/ProjectAnalyzer';
import { callOpenAI } from '../utils/openaiClient';

interface FixOptions {
  build?: boolean;
  lint?: boolean;
  test?: boolean;
  git?: boolean;
  all?: boolean;
  error?: string;
  file?: string;
  ai?: boolean;
  json?: boolean;
  auto?: boolean;
}

interface FixAnalysis {
  category: 'build' | 'lint' | 'test' | 'git' | 'syntax' | 'runtime';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  files: string[];
  suggestions: string[];
  autoFixAvailable: boolean;
  command?: string;
}

/**
 * Create the fix command for intelligent error analysis and solutions
 */
export function createFixCommand(): Command {
  const command = new Command('fix');
  
  command
    .description('🔧 Intelligent error analysis and automated fixes')
    .option('-b, --build', 'Analyze and fix build errors')
    .option('-l, --lint', 'Analyze and fix linting errors')
    .option('-t, --test', 'Analyze and fix test failures')
    .option('-g, --git', 'Analyze and fix git issues')
    .option('-a, --all', 'Analyze all types of issues')
    .option('-e, --error <error>', 'Analyze specific error message')
    .option('-f, --file <file>', 'Focus on specific file')
    .option('--ai', 'Use AI for advanced error analysis')
    .option('--auto', 'Automatically apply simple fixes')
    .option('--json', 'Output results as JSON')
    .action(async (options: FixOptions) => {
      const analyzer = new ProjectAnalyzer();
      
      try {
        await runFixAnalysis(analyzer, options);
      } catch (error) {
        console.error(chalk.red(`❌ Fix analysis failed: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });
  
  return command;
}

/**
 * Run comprehensive fix analysis
 */
async function runFixAnalysis(analyzer: ProjectAnalyzer, options: FixOptions): Promise<void> {
  const spinner = ora('🔍 Analyzing project issues...').start();
  
  try {
    const context = await analyzer.analyzeProject();
    const issues: FixAnalysis[] = [];
    
    if (options.error) {
      // Analyze specific error message
      const errorAnalysis = await analyzeSpecificError(options.error, context, options.file);
      issues.push(...errorAnalysis);
    } else {
      // Comprehensive analysis
      if (options.all || options.build) {
        issues.push(...await analyzeBuildIssues(context));
      }
      
      if (options.all || options.lint) {
        issues.push(...await analyzeLintIssues(context));
      }
      
      if (options.all || options.test) {
        issues.push(...await analyzeTestIssues(context));
      }
      
      if (options.all || options.git) {
        issues.push(...await analyzeGitIssues(context));
      }
      
      if (!options.build && !options.lint && !options.test && !options.git && !options.all) {
        // Default: analyze all if no specific type is requested
        issues.push(...await analyzeBuildIssues(context));
        issues.push(...await analyzeLintIssues(context));
        issues.push(...await analyzeGitIssues(context));
      }
    }
    
    spinner.succeed(`Found ${issues.length} issue(s) to analyze`);
    
    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }
    
    if (issues.length === 0) {
      displayNoIssuesFound();
      return;
    }
    
    displayIssuesAnalysis(issues);
    
    if (options.ai && issues.length > 0) {
      await generateAISuggestions(issues, context);
    }
    
    if (options.auto) {
      await attemptAutoFixes(issues);
    }
    
  } catch (error) {
    spinner.fail('Issue analysis failed');
    throw error;
  }
}

/**
 * Analyze specific error message
 */
async function analyzeSpecificError(errorMessage: string, context: any, filePath?: string): Promise<FixAnalysis[]> {
  const issues: FixAnalysis[] = [];
  
  // TypeScript errors
  if (errorMessage.includes('TS') || errorMessage.includes('TypeScript')) {
    issues.push({
      category: 'build',
      severity: 'error',
      title: 'TypeScript Error',
      description: errorMessage,
      files: filePath ? [filePath] : [],
      suggestions: [
        'Check type definitions and imports',
        'Verify TypeScript configuration',
        'Consider adding missing type declarations'
      ],
      autoFixAvailable: false
    });
  }
  
  // React errors
  if (errorMessage.includes('React') || errorMessage.includes('JSX')) {
    issues.push({
      category: 'build',
      severity: 'error',
      title: 'React/JSX Error',
      description: errorMessage,
      files: filePath ? [filePath] : [],
      suggestions: [
        'Check JSX syntax and React imports',
        'Verify component props and state usage',
        'Ensure proper React hooks usage'
      ],
      autoFixAvailable: false
    });
  }
  
  // Module/Import errors
  if (errorMessage.includes('Cannot find module') || errorMessage.includes('Module not found')) {
    const moduleName = extractModuleName(errorMessage);
    issues.push({
      category: 'build',
      severity: 'error',
      title: 'Missing Module',
      description: errorMessage,
      files: filePath ? [filePath] : [],
      suggestions: [
        `Install missing module: ${getInstallCommand(context.packageManager, moduleName)}`,
        'Check import paths and module names',
        'Verify package.json dependencies'
      ],
      autoFixAvailable: true,
      command: getInstallCommand(context.packageManager, moduleName)
    });
  }
  
  return issues;
}

/**
 * Analyze build issues
 */
async function analyzeBuildIssues(context: any): Promise<FixAnalysis[]> {
  const issues: FixAnalysis[] = [];
  
  try {
    // Try to run build command based on project type
    const buildCommand = getBuildCommand(context);
    if (!buildCommand) return issues;
    
    try {
      execSync(buildCommand, { stdio: 'pipe', cwd: context.workingDirectory });
      // Build successful, no issues
    } catch (error: any) {
      const output = error.stdout?.toString() + error.stderr?.toString();
      
      if (output.includes('TypeScript')) {
        issues.push({
          category: 'build',
          severity: 'error',
          title: 'TypeScript Build Errors',
          description: 'TypeScript compilation failed',
          files: extractFilesFromOutput(output),
          suggestions: [
            'Run: npx tsc --noEmit to see all type errors',
            'Fix type errors one by one',
            'Check tsconfig.json configuration'
          ],
          autoFixAvailable: false
        });
      }
      
      if (output.includes('Module not found') || output.includes('Cannot resolve')) {
        const missingModules = extractMissingModules(output);
        issues.push({
          category: 'build',
          severity: 'error',
          title: 'Missing Dependencies',
          description: `Missing modules: ${missingModules.join(', ')}`,
          files: [],
          suggestions: missingModules.map(mod => 
            `Install: ${getInstallCommand(context.packageManager, mod)}`
          ),
          autoFixAvailable: true,
          command: missingModules.map(mod => 
            getInstallCommand(context.packageManager, mod)
          ).join(' && ')
        });
      }
    }
  } catch (error) {
    // Build command not available or failed to execute
  }
  
  return issues;
}

/**
 * Analyze linting issues
 */
async function analyzeLintIssues(context: any): Promise<FixAnalysis[]> {
  const issues: FixAnalysis[] = [];
  
  try {
    // Check for ESLint
    const hasEslint = context.buildTools?.includes('eslint') || 
                     await hasFile(context.workingDirectory, '.eslintrc') ||
                     await hasFile(context.workingDirectory, 'eslint.config.js');
    
    if (hasEslint) {
      try {
        execSync('npx eslint . --format json', { 
          stdio: 'pipe', 
          cwd: context.workingDirectory 
        });
      } catch (error: any) {
        const output = error.stdout?.toString();
        if (output) {
          try {
            const eslintResults = JSON.parse(output);
            const errorCount = eslintResults.reduce((sum: number, file: any) => 
              sum + file.errorCount, 0);
            const warningCount = eslintResults.reduce((sum: number, file: any) => 
              sum + file.warningCount, 0);
            
            if (errorCount > 0 || warningCount > 0) {
              issues.push({
                category: 'lint',
                severity: errorCount > 0 ? 'error' : 'warning',
                title: 'ESLint Issues',
                description: `${errorCount} errors, ${warningCount} warnings`,
                files: eslintResults.filter((f: any) => f.errorCount > 0 || f.warningCount > 0)
                                 .map((f: any) => f.filePath),
                suggestions: [
                  'Run: npx eslint . --fix to auto-fix simple issues',
                  'Review and address remaining ESLint errors',
                  'Consider updating ESLint rules if too strict'
                ],
                autoFixAvailable: true,
                command: 'npx eslint . --fix'
              });
            }
          } catch {
            // Failed to parse ESLint output
          }
        }
      }
    }
    
    // Check for Prettier
    const hasPrettier = await hasFile(context.workingDirectory, '.prettierrc') ||
                       await hasFile(context.workingDirectory, 'prettier.config.js');
    
    if (hasPrettier) {
      try {
        execSync('npx prettier . --check', { 
          stdio: 'pipe', 
          cwd: context.workingDirectory 
        });
      } catch (error: any) {
        const output = error.stdout?.toString();
        if (output && output.includes('Code style issues found')) {
          issues.push({
            category: 'lint',
            severity: 'warning',
            title: 'Code Formatting Issues',
            description: 'Code style inconsistencies found',
            files: extractFilesFromOutput(output),
            suggestions: [
              'Run: npx prettier . --write to fix formatting',
              'Configure your editor to format on save'
            ],
            autoFixAvailable: true,
            command: 'npx prettier . --write'
          });
        }
      }
    }
  } catch (error) {
    // Linting analysis failed
  }
  
  return issues;
}

/**
 * Analyze test issues
 */
async function analyzeTestIssues(context: any): Promise<FixAnalysis[]> {
  const issues: FixAnalysis[] = [];
  
  try {
    const testCommand = getTestCommand(context);
    if (!testCommand) return issues;
    
    try {
      execSync(testCommand, { stdio: 'pipe', cwd: context.workingDirectory });
      // Tests pass
    } catch (error: any) {
      const output = error.stdout?.toString() + error.stderr?.toString();
      
      if (output.includes('FAIL') || output.includes('failed')) {
        issues.push({
          category: 'test',
          severity: 'error',
          title: 'Test Failures',
          description: 'Some tests are failing',
          files: extractFilesFromOutput(output),
          suggestions: [
            'Review failing test output for details',
            'Update tests to match code changes',
            'Fix code issues causing test failures',
            'Run tests in watch mode for faster debugging'
          ],
          autoFixAvailable: false
        });
      }
      
      if (output.includes('No tests found') || output.includes('0 passed')) {
        issues.push({
          category: 'test',
          severity: 'warning',
          title: 'Missing Tests',
          description: 'No tests found or all tests skipped',
          files: [],
          suggestions: [
            'Add test files to your project',
            'Ensure test files follow naming conventions',
            'Check test configuration and setup'
          ],
          autoFixAvailable: false
        });
      }
    }
  } catch (error) {
    // Test analysis failed
  }
  
  return issues;
}

/**
 * Analyze git issues
 */
async function analyzeGitIssues(context: any): Promise<FixAnalysis[]> {
  const issues: FixAnalysis[] = [];
  
  if (!context.hasGit) {
    issues.push({
      category: 'git',
      severity: 'info',
      title: 'No Git Repository',
      description: 'Project is not under version control',
      files: [],
      suggestions: [
        'Initialize git repository: git init',
        'Add initial commit: git add . && git commit -m "Initial commit"',
        'Consider adding .gitignore file'
      ],
      autoFixAvailable: true,
      command: 'git init'
    });
    return issues;
  }
  
  try {
    // Check for uncommitted changes
    if (context.gitStatus?.hasUncommittedChanges) {
      issues.push({
        category: 'git',
        severity: 'warning',
        title: 'Uncommitted Changes',
        description: 'You have uncommitted changes in your working directory',
        files: [],
        suggestions: [
          'Review changes: git status',
          'Stage changes: git add .',
          'Commit changes: git commit -m "your message"',
          'Or stash changes: git stash'
        ],
        autoFixAvailable: false
      });
    }
    
    // Check for untracked files
    const output = execSync('git status --porcelain', { 
      encoding: 'utf-8', 
      cwd: context.workingDirectory 
    });
    
    const untrackedFiles = output.split('\n')
      .filter(line => line.startsWith('??'))
      .map(line => line.substring(3));
    
    if (untrackedFiles.length > 0) {
      issues.push({
        category: 'git',
        severity: 'info',
        title: 'Untracked Files',
        description: `${untrackedFiles.length} untracked files found`,
        files: untrackedFiles,
        suggestions: [
          'Review untracked files: git status',
          'Add files to git: git add .',
          'Add files to .gitignore if they should not be tracked'
        ],
        autoFixAvailable: false
      });
    }
    
  } catch (error) {
    // Git analysis failed
  }
  
  return issues;
}

/**
 * Display when no issues are found
 */
function displayNoIssuesFound(): void {
  console.log(boxen(
    chalk.green('✨ No issues found!\n\n') +
    chalk.gray('Your project appears to be in good shape.\n') +
    chalk.gray('Consider running with --all to check all categories.'),
    {
      title: '🎉 All Good!',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'green',
      borderStyle: 'round'
    }
  ));
}

/**
 * Display issues analysis
 */
function displayIssuesAnalysis(issues: FixAnalysis[]): void {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  const content = [
    chalk.red.bold(`❌ Errors: ${errorCount}`),
    chalk.yellow.bold(`⚠️  Warnings: ${warningCount}`),
    chalk.blue.bold(`ℹ️  Info: ${infoCount}`),
    ''
  ];
  
  issues.forEach((issue, index) => {
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    const color = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;
    
    content.push(
      color.bold(`${icon} ${issue.title} (${issue.category})`),
      `   ${issue.description}`
    );
    
    if (issue.files.length > 0) {
      content.push(`   ${chalk.gray('Files:')} ${issue.files.slice(0, 3).join(', ')}${issue.files.length > 3 ? '...' : ''}`);
    }
    
    content.push('');
    content.push(chalk.cyan('   💡 Suggestions:'));
    issue.suggestions.forEach(suggestion => {
      content.push(`   • ${suggestion}`);
    });
    
    if (issue.autoFixAvailable && issue.command) {
      content.push(chalk.green(`   🔧 Auto-fix: ${issue.command}`));
    }
    
    if (index < issues.length - 1) {
      content.push('');
    }
  });
  
  console.log(boxen(content.join('\n'), {
    title: '🔧 Issues Analysis',
    titleAlignment: 'center',
    padding: 1,
    borderColor: errorCount > 0 ? 'red' : warningCount > 0 ? 'yellow' : 'blue',
    borderStyle: 'round'
  }));
}

/**
 * Generate AI-powered suggestions
 */
async function generateAISuggestions(issues: FixAnalysis[], context: any): Promise<void> {
  const spinner = ora('🤖 Generating AI-powered fix recommendations...').start();
  
  try {
    const prompt = `Based on these project issues, provide specific fix recommendations:

Project Context:
- Type: ${context.type}
- Languages: ${context.languages?.join(', ')}
- Frameworks: ${context.frameworks?.join(', ')}

Issues Found:
${issues.map(issue => `
- ${issue.title} (${issue.severity})
  Description: ${issue.description}
  Category: ${issue.category}
  Files: ${issue.files.join(', ')}
`).join('')}

Provide:
1. Step-by-step fix instructions for each issue
2. Root cause analysis where possible
3. Prevention strategies for the future
4. Specific commands to run

Focus on practical, actionable solutions.`;

    const response = await callOpenAI(prompt, 'You are a senior developer helping to fix code issues. Provide clear, specific instructions.');
    
    spinner.succeed('AI recommendations generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI Fix Recommendations',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
  } catch (error) {
    spinner.fail('Failed to generate AI recommendations');
  }
}

/**
 * Attempt automatic fixes
 */
async function attemptAutoFixes(issues: FixAnalysis[]): Promise<void> {
  const autoFixableIssues = issues.filter(issue => issue.autoFixAvailable && issue.command);
  
  if (autoFixableIssues.length === 0) {
    console.log(chalk.gray('No automatic fixes available.'));
    return;
  }
  
  console.log(chalk.yellow(`\n🔧 Attempting to auto-fix ${autoFixableIssues.length} issue(s)...\n`));
  
  for (const issue of autoFixableIssues) {
    const spinner = ora(`Fixing: ${issue.title}`).start();
    
    try {
      execSync(issue.command!, { stdio: 'pipe', cwd: process.cwd() });
      spinner.succeed(`Fixed: ${issue.title}`);
    } catch (error) {
      spinner.fail(`Failed to fix: ${issue.title}`);
      console.log(chalk.red(`   Error: ${error}`));
    }
  }
}

// Helper functions
function getBuildCommand(context: any): string | null {
  if (context.packageManager === 'npm' || context.packageManager === 'yarn' || context.packageManager === 'pnpm') {
    return `${context.packageManager} run build`;
  }
  
  if (context.type === 'go') return 'go build';
  if (context.type === 'rust') return 'cargo build';
  if (context.type === 'python') return 'python -m py_compile .';
  
  return null;
}

function getTestCommand(context: any): string | null {
  if (context.packageManager === 'npm' || context.packageManager === 'yarn' || context.packageManager === 'pnpm') {
    return `${context.packageManager} test`;
  }
  
  if (context.type === 'go') return 'go test ./...';
  if (context.type === 'rust') return 'cargo test';
  if (context.type === 'python') return 'python -m pytest';
  
  return null;
}

function getInstallCommand(packageManager: string, moduleName: string): string {
  switch (packageManager) {
    case 'yarn': return `yarn add ${moduleName}`;
    case 'pnpm': return `pnpm add ${moduleName}`;
    default: return `npm install ${moduleName}`;
  }
}

function extractModuleName(errorMessage: string): string {
  const match = errorMessage.match(/Cannot find module ['"]([^'"]+)['"]/);
  return match ? match[1] : 'unknown-module';
}

function extractMissingModules(output: string): string[] {
  const matches = output.match(/Cannot find module ['"]([^'"]+)['"]/g) || [];
  return [...new Set(matches.map(match => match.match(/['"]([^'"]+)['"]/)?.[1] || ''))];
}

function extractFilesFromOutput(output: string): string[] {
  // Extract file paths from various error formats
  const patterns = [
    /at (.+\.(?:ts|js|tsx|jsx|py|go|rs)):\d+:\d+/g,
    /(.+\.(?:ts|js|tsx|jsx|py|go|rs))\(\d+,\d+\)/g,
    /(.+\.(?:ts|js|tsx|jsx|py|go|rs)):\d+/g
  ];
  
  const files: string[] = [];
  
  patterns.forEach(pattern => {
    const matches = [...output.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) files.push(match[1]);
    });
  });
  
  return [...new Set(files)];
}

async function hasFile(directory: string, filename: string): Promise<boolean> {
  try {
    const { promises: fs } = require('fs');
    await fs.access(`${directory}/${filename}`);
    return true;
  } catch {
    return false;
  }
}