import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { execSync } from 'child_process';
import { ProjectAnalyzer, ProjectContext } from '../services/ProjectAnalyzer';
import { SessionContextManager } from '../services/SessionContextManager';
import { callOpenAI } from '../utils/openaiClient';
import { RiskAssessmentEngine } from '../services/RiskAssessmentEngine';
import { SafetyWrapper } from '../services/SafetyWrapper';

interface ShortcutOptions {
  ai?: boolean;
  auto?: boolean;
  context?: boolean;
  suggest?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Smart shortcuts that provide intelligent, context-aware development assistance
 * Based on StyleMuse feedback for intuitive developer workflows
 */

/**
 * Create the review command - analyze recent commits/changes
 */
export function createReviewCommand(): Command {
  const command = new Command('review');
  
  command
    .description('🔍 Smart review of recent changes and commits')
    .option('--ai', 'Use AI for advanced code review analysis')
    .option('--auto', 'Automatically apply simple improvements')
    .option('-c, --context', 'Include conversation context from memory')
    .option('-s, --suggest', 'Generate improvement suggestions')
    .option('-v, --verbose', 'Show detailed analysis')
    .option('--json', 'Output results as JSON')
    .action(async (options: ShortcutOptions) => {
      await executeSmartReview(options);
    });
  
  return command;
}

/**
 * Create the debug command - targeted debugging assistance
 */
export function createDebugCommand(): Command {
  const command = new Command('debug');
  
  command
    .description('🐛 Smart debugging assistance with context awareness')
    .argument('[error]', 'Specific error message or issue to debug')
    .option('--ai', 'Use AI for advanced debugging analysis')
    .option('--auto', 'Attempt automatic fixes where possible')
    .option('-c, --context', 'Use session context for better debugging')
    .option('-v, --verbose', 'Show detailed debugging steps')
    .option('--json', 'Output results as JSON')
    .action(async (error: string | undefined, options: ShortcutOptions) => {
      await executeSmartDebug(error, options);
    });
  
  return command;
}

/**
 * Create the optimize command - performance analysis
 */
export function createOptimizeCommand(): Command {
  const command = new Command('optimize');
  
  command
    .description('⚡ Smart performance optimization analysis')
    .option('--ai', 'Use AI for advanced optimization recommendations')
    .option('--auto', 'Apply simple optimizations automatically')
    .option('-c, --context', 'Use project context for targeted optimizations')
    .option('-s, --suggest', 'Generate optimization suggestions')
    .option('-v, --verbose', 'Show detailed optimization analysis')
    .option('--json', 'Output results as JSON')
    .action(async (options: ShortcutOptions) => {
      await executeSmartOptimize(options);
    });
  
  return command;
}

/**
 * Create the status command - comprehensive project status
 */
export function createStatusCommand(): Command {
  const command = new Command('status');
  
  command
    .description('📊 Smart project status with AI insights')
    .option('--ai', 'Include AI-powered project insights')
    .option('-c, --context', 'Include session and memory context')
    .option('-s, --suggest', 'Generate next steps suggestions')
    .option('-v, --verbose', 'Show comprehensive status')
    .option('--json', 'Output results as JSON')
    .action(async (options: ShortcutOptions) => {
      await executeSmartStatus(options);
    });
  
  return command;
}

/**
 * Execute smart review functionality
 */
async function executeSmartReview(options: ShortcutOptions): Promise<void> {
  const spinner = ora('🔍 Analyzing recent changes for review...').start();
  
  try {
    const analyzer = new ProjectAnalyzer();
    const contextManager = new SessionContextManager();
    
    // Get project context
    const projectContext = await analyzer.analyzeProject();
    
    // Get recent changes
    const workingFiles = await analyzer.getCurrentWorkingFiles();
    const recentFiles = await analyzer.getRecentChangedFiles(10);
    
    // Analyze changed files
    const allChangedFiles = [...workingFiles.staged, ...workingFiles.modified, ...recentFiles];
    const fileAnalyses = await analyzer.analyzeFiles([...new Set(allChangedFiles)].slice(0, 10));
    
    spinner.succeed('Review analysis complete!');
    
    if (options.json) {
      console.log(JSON.stringify({ projectContext, workingFiles, fileAnalyses }, null, 2));
      return;
    }
    
    // Display review results
    displayReviewResults(projectContext, workingFiles, fileAnalyses, options.verbose);
    
    if (options.ai) {
      await generateAIReviewInsights(projectContext, fileAnalyses);
    }
    
    if (options.suggest) {
      await generateReviewSuggestions(projectContext, fileAnalyses);
    }
    
    // Add to session memory if context enabled
    if (options.context) {
      await contextManager.addConversation(
        `Code review of ${allChangedFiles.length} files`,
        `Reviewed recent changes with ${fileAnalyses.filter(f => f.complexity === 'complex').length} complex files identified`,
        'claude-review',
        { taskType: 'code-review', complexity: 'moderate', success: true }
      );
    }
    
    contextManager.destroy();
    
  } catch (error) {
    spinner.fail('Review analysis failed');
    console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
  }
}

/**
 * Execute smart debug functionality
 */
async function executeSmartDebug(errorMessage: string | undefined, options: ShortcutOptions): Promise<void> {
  const spinner = ora('🐛 Analyzing debugging context...').start();
  
  try {
    const analyzer = new ProjectAnalyzer();
    const contextManager = new SessionContextManager();
    
    // Get project context
    const projectContext = await analyzer.analyzeProject();
    
    // Analyze build/test errors automatically if no specific error provided
    if (!errorMessage) {
      errorMessage = await detectAutomaticErrors(projectContext);
    }
    
    spinner.succeed('Debugging analysis complete!');
    
    if (!errorMessage) {
      console.log(chalk.green('✨ No obvious errors detected in your project!'));
      console.log(chalk.gray('Try: claude-prompter debug "your error message" for specific issues'));
      return;
    }
    
    if (options.json) {
      console.log(JSON.stringify({ projectContext, errorMessage }, null, 2));
      return;
    }
    
    // Display debugging analysis
    displayDebuggingAnalysis(errorMessage, projectContext, options.verbose);
    
    if (options.ai) {
      await generateAIDebuggingHelp(errorMessage, projectContext);
    }
    
    // Add to session memory
    if (options.context) {
      await contextManager.addConversation(
        `Debug: ${errorMessage}`,
        'Analyzed debugging context and provided troubleshooting guidance',
        'claude-debug',
        { taskType: 'debugging', complexity: 'moderate', success: true }
      );
    }
    
    contextManager.destroy();
    
  } catch (error) {
    spinner.fail('Debugging analysis failed');
    console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
  }
}

/**
 * Execute smart optimize functionality
 */
async function executeSmartOptimize(options: ShortcutOptions): Promise<void> {
  const spinner = ora('⚡ Analyzing optimization opportunities...').start();
  
  try {
    const analyzer = new ProjectAnalyzer();
    const contextManager = new SessionContextManager();
    
    // Get project context
    const projectContext = await analyzer.analyzeProject();
    
    // Get recent files for analysis
    const recentFiles = await analyzer.getRecentChangedFiles(15);
    const fileAnalyses = await analyzer.analyzeFiles(recentFiles);
    
    // Analyze optimization opportunities
    const optimizations = analyzeOptimizationOpportunities(projectContext, fileAnalyses);
    
    spinner.succeed('Optimization analysis complete!');
    
    if (options.json) {
      console.log(JSON.stringify({ projectContext, optimizations }, null, 2));
      return;
    }
    
    // Display optimization results
    displayOptimizationResults(optimizations, options.verbose);
    
    if (options.ai) {
      await generateAIOptimizationInsights(projectContext, optimizations);
    }
    
    if (options.suggest) {
      await generateOptimizationSuggestions(projectContext, optimizations);
    }
    
    // Add to session memory
    if (options.context) {
      await contextManager.addConversation(
        `Performance optimization analysis`,
        `Identified ${optimizations.length} optimization opportunities`,
        'claude-optimize',
        { taskType: 'performance', complexity: 'moderate', success: true }
      );
    }
    
    contextManager.destroy();
    
  } catch (error) {
    spinner.fail('Optimization analysis failed');
    console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
  }
}

/**
 * Execute smart status functionality with safety features
 */
async function executeSmartStatus(options: ShortcutOptions): Promise<void> {
  const spinner = ora('📊 Gathering comprehensive project status...').start();
  
  try {
    const analyzer = new ProjectAnalyzer();
    const contextManager = new SessionContextManager();
    const riskEngine = new RiskAssessmentEngine();
    const safetyWrapper = new SafetyWrapper();
    
    // Get comprehensive project analysis
    const projectContext = await analyzer.analyzeProject();
    const workingFiles = await analyzer.getCurrentWorkingFiles();
    const recentFiles = await analyzer.getRecentChangedFiles(5);
    
    // Detect platform for safety checks
    const platform = riskEngine.detectPlatform();
    
    // Check for recent errors and failures
    let errorStatus = {
      recentErrors: 0,
      shouldRollback: false,
      rollbackReason: ''
    };
    
    // Analyze recent git commits for failures
    try {
      const recentCommits = execSync('git log --oneline -5 2>/dev/null', { encoding: 'utf-8' });
      const failureKeywords = ['fix', 'revert', 'rollback', 'broken', 'error', 'fail'];
      const commitLines = recentCommits.split('\n').filter(Boolean);
      const failureCommits = commitLines.filter(line => 
        failureKeywords.some(keyword => line.toLowerCase().includes(keyword))
      );
      
      if (failureCommits.length >= 3) {
        errorStatus.recentErrors = failureCommits.length;
        errorStatus.shouldRollback = true;
        errorStatus.rollbackReason = 'Multiple failure-related commits detected';
      }
    } catch (gitError) {
      // Git command failed, skip error analysis
    }
    
    // Check for uncommitted risky changes
    const riskyChanges: string[] = [];
    const allChangedFiles = [...workingFiles.staged, ...workingFiles.modified];
    for (const file of allChangedFiles) {
      const assessment = riskEngine.assessRisk(`modify ${file}`, { platform });
      if (assessment.level === 'CRITICAL' || assessment.level === 'HIGH') {
        riskyChanges.push(`${file} (${assessment.level})`);
      }
    }
    
    // Get session context if available
    let sessionSummary = null;
    if (options.context) {
      const session = contextManager.getCurrentSession();
      sessionSummary = session ? {
        conversations: session.conversationHistory.length,
        learningPatterns: session.persistentMemory.learningPatterns.length,
        lastActive: session.lastAccessed
      } : null;
    }
    
    spinner.succeed('Project status analysis complete!');
    
    if (options.json) {
      console.log(JSON.stringify({ 
        projectContext, 
        workingFiles, 
        recentFiles, 
        sessionSummary,
        safetyStatus: {
          platform,
          errorStatus,
          riskyChanges
        }
      }, null, 2));
      return;
    }
    
    // Display comprehensive status with safety info
    displayProjectStatusWithSafety(
      projectContext, 
      workingFiles, 
      recentFiles, 
      sessionSummary, 
      {
        platform,
        errorStatus,
        riskyChanges
      },
      options.verbose
    );
    
    // Display safety status
    console.log(safetyWrapper.getSessionStatus());
    
    // Show rollback recommendation if needed
    if (errorStatus.shouldRollback || riskEngine.shouldSuggestRollback()) {
      displayRollbackRecommendation(errorStatus.rollbackReason);
    }
    
    if (options.ai) {
      await generateAIProjectInsights(projectContext);
    }
    
    if (options.suggest) {
      await generateStatusSuggestions(projectContext, workingFiles);
    }
    
    contextManager.destroy();
    
  } catch (error) {
    spinner.fail('Status analysis failed');
    console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
  }
}

// Display functions
function displayReviewResults(
  projectContext: ProjectContext,
  workingFiles: any,
  fileAnalyses: any[],
  verbose: boolean = false
): void {
  const complexFiles = fileAnalyses.filter(f => f.complexity === 'complex');
  
  const content = [
    chalk.cyan.bold('🔍 Smart Code Review'),
    '',
    chalk.yellow('Change Summary:'),
    `  Staged Files: ${workingFiles.staged.length}`,
    `  Modified Files: ${workingFiles.modified.length}`,
    `  Untracked Files: ${workingFiles.untracked.length}`,
    '',
    chalk.yellow('Complexity Analysis:'),
    `  Complex Files: ${complexFiles.length} ${complexFiles.length > 0 ? '⚠️' : '✅'}`,
    `  Files Analyzed: ${fileAnalyses.length}`,
    '',
    chalk.yellow('Project Context:'),
    `  Type: ${projectContext.type}`,
    `  Languages: ${projectContext.languages.join(', ')}`
  ];
  
  if (verbose && complexFiles.length > 0) {
    content.push(
      '',
      chalk.red('Complex Files Requiring Review:'),
      ...complexFiles.map(f => `  • ${f.filePath} (${f.size} bytes)`)
    );
  }
  
  console.log(boxen(content.join('\n'), {
    title: '📋 Review Results',
    titleAlignment: 'center',
    padding: 1,
    borderColor: complexFiles.length > 0 ? 'yellow' : 'green',
    borderStyle: 'round'
  }));
}

function displayDebuggingAnalysis(
  errorMessage: string,
  projectContext: ProjectContext,
  verbose: boolean = false
): void {
  const errorType = classifyError(errorMessage);
  const suggestions = getBasicDebuggingSuggestions(errorMessage, projectContext);
  
  const content = [
    chalk.cyan.bold('🐛 Smart Debugging Analysis'),
    '',
    chalk.yellow('Error Classification:'),
    `  Type: ${errorType.type}`,
    `  Severity: ${errorType.severity}`,
    '',
    chalk.yellow('Error Message:'),
    `  ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`,
    '',
    chalk.yellow('Project Context:'),
    `  Type: ${projectContext.type}`,
    `  Languages: ${projectContext.languages.join(', ')}`,
    '',
    chalk.cyan('💡 Initial Suggestions:'),
    ...suggestions.map(s => `  • ${s}`)
  ];
  
  if (verbose) {
    content.push(
      '',
      chalk.gray('Debugging Steps:'),
      chalk.gray('  1. Check the full error stack trace'),
      chalk.gray('  2. Verify recent changes that might have caused this'),
      chalk.gray('  3. Check dependencies and imports'),
      chalk.gray('  4. Use --ai flag for advanced AI debugging assistance')
    );
  }
  
  console.log(boxen(content.join('\n'), {
    title: '🔧 Debug Analysis',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'red',
    borderStyle: 'round'
  }));
}

function displayOptimizationResults(optimizations: any[], verbose: boolean = false): void {
  const highPriority = optimizations.filter(o => o.priority === 'high');
  
  const content = [
    chalk.cyan.bold('⚡ Smart Optimization Analysis'),
    '',
    chalk.yellow('Optimization Summary:'),
    `  Total Opportunities: ${optimizations.length}`,
    `  High Priority: ${highPriority.length}`,
    `  Estimated Impact: ${calculateImpactScore(optimizations)}%`,
    '',
    chalk.yellow('Top Opportunities:'),
    ...optimizations.slice(0, 5).map(opt => 
      `  ${opt.priority === 'high' ? '🔴' : opt.priority === 'medium' ? '🟡' : '🟢'} ${opt.title}`
    )
  ];
  
  if (verbose) {
    content.push(
      '',
      chalk.cyan('Detailed Recommendations:'),
      ...optimizations.slice(0, 3).map(opt => 
        `  • ${opt.title}: ${opt.description}`
      )
    );
  }
  
  console.log(boxen(content.join('\n'), {
    title: '🚀 Optimization Results',
    titleAlignment: 'center',
    padding: 1,
    borderColor: highPriority.length > 0 ? 'red' : 'green',
    borderStyle: 'round'
  }));
}

// Old displayProjectStatus function removed - using displayProjectStatusWithSafety for safety-enhanced status

// AI-powered analysis functions
async function generateAIReviewInsights(projectContext: ProjectContext, fileAnalyses: any[]): Promise<void> {
  const spinner = ora('🤖 Generating AI code review insights...').start();
  
  try {
    const complexFiles = fileAnalyses.filter(f => f.complexity === 'complex');
    const prompt = `Analyze this code review context and provide specific insights:

Project: ${projectContext.type} (${projectContext.domain})
Languages: ${projectContext.languages.join(', ')}
Files analyzed: ${fileAnalyses.length}
Complex files: ${complexFiles.length}

Files requiring attention:
${complexFiles.map(f => `- ${f.filePath}: ${f.patterns.join(', ')}`).join('\n')}

Provide 3-5 specific code review insights focusing on:
1. Code quality concerns
2. Architectural improvements
3. Security considerations
4. Performance optimizations
5. Best practice violations

Be specific and actionable.`;

    const response = await callOpenAI(prompt, 'You are a senior code reviewer providing specific, actionable insights.');
    
    spinner.succeed('AI insights generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI Code Review Insights',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
    
  } catch (error) {
    spinner.fail('Failed to generate AI insights');
  }
}

async function generateAIDebuggingHelp(errorMessage: string, projectContext: ProjectContext): Promise<void> {
  const spinner = ora('🤖 Generating AI debugging assistance...').start();
  
  try {
    const prompt = `Help debug this specific error in a ${projectContext.type} project:

Error: ${errorMessage}

Project Context:
- Type: ${projectContext.type}
- Languages: ${projectContext.languages.join(', ')}
- Frameworks: ${projectContext.frameworks.join(', ')}

Provide:
1. Root cause analysis
2. Step-by-step debugging approach
3. Specific fix recommendations
4. Prevention strategies

Be practical and specific to this technology stack.`;

    const response = await callOpenAI(prompt, 'You are a senior developer helping debug a specific technical issue. Provide clear, actionable guidance.');
    
    spinner.succeed('AI debugging help generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI Debugging Assistant',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
    
  } catch (error) {
    spinner.fail('Failed to generate AI debugging help');
  }
}

async function generateAIOptimizationInsights(projectContext: ProjectContext, optimizations: any[]): Promise<void> {
  const spinner = ora('🤖 Generating AI optimization insights...').start();
  
  try {
    const prompt = `Analyze these optimization opportunities for a ${projectContext.type} project:

Project Context:
- Type: ${projectContext.type}
- Domain: ${projectContext.domain}
- Languages: ${projectContext.languages.join(', ')}
- Frameworks: ${projectContext.frameworks.join(', ')}

Optimization Opportunities:
${optimizations.map(opt => `- ${opt.title}: ${opt.description}`).join('\n')}

Provide:
1. Prioritization strategy for these optimizations
2. Implementation approach for top 3 items
3. Performance impact estimates
4. Potential risks and mitigation strategies

Focus on practical, measurable improvements.`;

    const response = await callOpenAI(prompt, 'You are a performance optimization expert providing specific guidance for measurable improvements.');
    
    spinner.succeed('AI optimization insights generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI Optimization Expert',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
    
  } catch (error) {
    spinner.fail('Failed to generate AI optimization insights');
  }
}

async function generateAIProjectInsights(projectContext: ProjectContext): Promise<void> {
  const spinner = ora('🤖 Generating AI project insights...').start();
  
  try {
    const prompt = `Analyze this project and provide strategic insights:

Project Analysis:
- Type: ${projectContext.type}
- Domain: ${projectContext.domain}
- Confidence: ${projectContext.confidence}%
- Languages: ${projectContext.languages.join(', ')}
- Frameworks: ${projectContext.frameworks.join(', ')}
- Build Tools: ${projectContext.buildTools.join(', ')}
- Test Frameworks: ${projectContext.testFrameworks.join(', ')}
- Patterns: ${projectContext.patterns.join(', ')}

Provide strategic insights on:
1. Project architecture assessment
2. Technology stack evaluation
3. Development workflow recommendations
4. Growth and scaling considerations
5. Risk assessment and mitigation

Be strategic and forward-looking.`;

    const response = await callOpenAI(prompt, 'You are a technical architect providing strategic project insights and recommendations.');
    
    spinner.succeed('AI project insights generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI Project Strategist',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
    
  } catch (error) {
    spinner.fail('Failed to generate AI project insights');
  }
}

// Helper functions
async function detectAutomaticErrors(projectContext: ProjectContext): Promise<string | null> {
  try {
    // Try to detect build errors
    const buildCommand = getBuildCommand(projectContext);
    if (buildCommand) {
      try {
        execSync(buildCommand, { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() + error.stderr?.toString();
        if (output && output.trim()) {
          return output.split('\n')[0]; // Return first error line
        }
      }
    }
    
    // Try to detect test errors
    const testCommand = getTestCommand(projectContext);
    if (testCommand) {
      try {
        execSync(testCommand, { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() + error.stderr?.toString();
        if (output && output.includes('FAIL')) {
          return 'Test failures detected';
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function classifyError(errorMessage: string): { type: string; severity: string } {
  if (errorMessage.includes('Error') || errorMessage.includes('Exception')) {
    return { type: 'Runtime Error', severity: 'High' };
  } else if (errorMessage.includes('Warning')) {
    return { type: 'Warning', severity: 'Medium' };
  } else if (errorMessage.includes('FAIL') || errorMessage.includes('failed')) {
    return { type: 'Test Failure', severity: 'High' };
  } else if (errorMessage.includes('Cannot find module')) {
    return { type: 'Dependency Issue', severity: 'High' };
  }
  return { type: 'General Issue', severity: 'Medium' };
}

function getBasicDebuggingSuggestions(errorMessage: string, projectContext: ProjectContext): string[] {
  const suggestions: string[] = [];
  
  if (errorMessage.includes('Cannot find module')) {
    suggestions.push(`Install missing dependencies: ${getPackageManager(projectContext)} install`);
  }
  
  if (errorMessage.includes('TypeScript') || errorMessage.includes('TS')) {
    suggestions.push('Check TypeScript configuration and type definitions');
  }
  
  if (errorMessage.includes('React') || errorMessage.includes('JSX')) {
    suggestions.push('Verify React imports and JSX syntax');
  }
  
  suggestions.push('Check recent code changes that might have introduced this error');
  suggestions.push('Review console logs and stack traces for more context');
  
  return suggestions;
}

function analyzeOptimizationOpportunities(projectContext: ProjectContext, fileAnalyses: any[]): any[] {
  const optimizations: any[] = [];
  
  // Complex file optimization
  const complexFiles = fileAnalyses.filter(f => f.complexity === 'complex');
  if (complexFiles.length > 0) {
    optimizations.push({
      title: 'Code Complexity Reduction',
      description: `${complexFiles.length} files are marked as complex and could benefit from refactoring`,
      priority: 'high',
      impact: 'maintainability'
    });
  }
  
  // Framework-specific optimizations
  if (projectContext.type === 'react-native') {
    optimizations.push({
      title: 'React Native Performance',
      description: 'Consider implementing FlatList for large datasets and Image optimization',
      priority: 'medium',
      impact: 'performance'
    });
  } else if (projectContext.type === 'web-react') {
    optimizations.push({
      title: 'React Web Optimizations',
      description: 'Implement code splitting and lazy loading for better performance',
      priority: 'medium',
      impact: 'performance'
    });
  }
  
  // Build tool optimizations
  if (!projectContext.buildTools.includes('typescript') && projectContext.languages.includes('javascript')) {
    optimizations.push({
      title: 'TypeScript Migration',
      description: 'Migrate to TypeScript for better type safety and developer experience',
      priority: 'low',
      impact: 'maintainability'
    });
  }
  
  // Testing optimizations
  if (projectContext.testFrameworks.length === 0) {
    optimizations.push({
      title: 'Testing Infrastructure',
      description: 'Add testing framework and write unit tests for better code quality',
      priority: 'high',
      impact: 'quality'
    });
  }
  
  return optimizations;
}

function calculateImpactScore(optimizations: any[]): number {
  const highPriority = optimizations.filter(o => o.priority === 'high').length;
  const totalOptimizations = optimizations.length;
  
  if (totalOptimizations === 0) return 100;
  
  return Math.round((totalOptimizations - highPriority) / totalOptimizations * 100);
}

function calculateProjectHealth(projectContext: ProjectContext, workingFiles: any): number {
  let score = 50; // Base score
  
  // Project type confidence
  score += Math.round(projectContext.confidence / 5);
  
  // Technology stack completeness
  if (projectContext.frameworks.length > 0) score += 10;
  if (projectContext.buildTools.length > 0) score += 10;
  if (projectContext.testFrameworks.length > 0) score += 15;
  
  // Git cleanliness
  if (workingFiles.staged.length === 0 && workingFiles.modified.length === 0) score += 10;
  
  // Deduct for issues
  if (workingFiles.untracked.length > 10) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}

function getHealthEmoji(score: number): string {
  if (score > 80) return '🟢';
  if (score > 60) return '🟡';
  return '🔴';
}

function getBuildCommand(projectContext: ProjectContext): string | null {
  if (projectContext.packageManager === 'npm' || projectContext.packageManager === 'yarn' || projectContext.packageManager === 'pnpm') {
    return `${projectContext.packageManager} run build`;
  }
  return null;
}

function getTestCommand(projectContext: ProjectContext): string | null {
  if (projectContext.packageManager === 'npm' || projectContext.packageManager === 'yarn' || projectContext.packageManager === 'pnpm') {
    return `${projectContext.packageManager} test`;
  }
  return null;
}

function getPackageManager(projectContext: ProjectContext): string {
  return projectContext.packageManager === 'unknown' ? 'npm' : projectContext.packageManager;
}

// Suggestion generators
async function generateReviewSuggestions(projectContext: ProjectContext, fileAnalyses: any[]): Promise<void> {
  const suggestions: string[] = [];
  
  const complexFiles = fileAnalyses.filter(f => f.complexity === 'complex');
  if (complexFiles.length > 0) {
    suggestions.push(`Consider refactoring ${complexFiles.length} complex files for better maintainability`);
  }
  
  if (projectContext.testFrameworks.length === 0) {
    suggestions.push('Add automated tests to improve code quality and catch regressions');
  }
  
  if (suggestions.length > 0) {
    console.log(boxen(suggestions.map(s => `• ${s}`).join('\n'), {
      title: '💡 Review Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'cyan',
      borderStyle: 'round'
    }));
  }
}

async function generateOptimizationSuggestions(_projectContext: ProjectContext, optimizations: any[]): Promise<void> {
  const suggestions = optimizations.slice(0, 3).map(opt => 
    `${opt.title}: ${opt.description}`
  );
  
  if (suggestions.length > 0) {
    console.log(boxen(suggestions.map(s => `• ${s}`).join('\n'), {
      title: '⚡ Optimization Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'yellow',
      borderStyle: 'round'
    }));
  }
}

async function generateStatusSuggestions(projectContext: ProjectContext, workingFiles: any): Promise<void> {
  const suggestions: string[] = [];
  
  if (workingFiles.staged.length > 0) {
    suggestions.push(`Commit ${workingFiles.staged.length} staged files to save your progress`);
  }
  
  if (workingFiles.modified.length > 0) {
    suggestions.push(`Review and stage ${workingFiles.modified.length} modified files`);
  }
  
  if (projectContext.confidence < 70) {
    suggestions.push('Project structure could be clearer - consider adding more configuration files');
  }
  
  if (suggestions.length > 0) {
    console.log(boxen(suggestions.map(s => `• ${s}`).join('\n'), {
      title: '🎯 Next Steps',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'green',
      borderStyle: 'round'
    }));
  }
}

// New safety-enhanced display functions
function displayProjectStatusWithSafety(
  projectContext: ProjectContext,
  workingFiles: any,
  recentFiles: string[],
  sessionSummary: any,
  safetyInfo: {
    platform?: string;
    errorStatus: {
      recentErrors: number;
      shouldRollback: boolean;
      rollbackReason: string;
    };
    riskyChanges: string[];
  },
  _verbose: boolean = false
): void {
  const healthScore = calculateProjectHealth(projectContext, workingFiles);
  
  const content = [
    chalk.cyan.bold('📊 Smart Project Status with Safety Analysis'),
    '',
    chalk.yellow('Project Health:'),
    `  Overall Score: ${healthScore}% ${getHealthEmoji(healthScore)}`,
    `  Type: ${projectContext.type}`,
    `  Confidence: ${projectContext.confidence}%`,
  ];
  
  if (safetyInfo.platform) {
    content.push(`  Platform: ${chalk.cyan(safetyInfo.platform)}`);
  }
  
  content.push(
    '',
    chalk.yellow('Activity Summary:'),
    `  Staged Changes: ${workingFiles.staged.length}`,
    `  Recent Files: ${recentFiles.length}`,
    `  Git Branch: ${projectContext.gitStatus?.branch || 'unknown'}`
  );
  
  // Add safety warnings
  if (safetyInfo.errorStatus.recentErrors > 0) {
    content.push(
      '',
      chalk.red('⚠️ Error Status:'),
      `  Recent Errors: ${safetyInfo.errorStatus.recentErrors}`,
      `  Rollback Recommended: ${safetyInfo.errorStatus.shouldRollback ? chalk.red('YES') : chalk.green('NO')}`
    );
  }
  
  if (safetyInfo.riskyChanges.length > 0) {
    content.push(
      '',
      chalk.yellow('🔴 Risky Changes Detected:')
    );
    safetyInfo.riskyChanges.slice(0, 5).forEach(change => {
      content.push(`  • ${change}`);
    });
    content.push(chalk.gray('  Run: claude-prompter risk <file> for detailed analysis'));
  }
  
  if (sessionSummary) {
    content.push(
      '',
      chalk.yellow('Session Context:'),
      `  Conversations: ${sessionSummary.conversations}`,
      `  Learning Patterns: ${sessionSummary.learningPatterns}`
    );
  }
  
  const borderColor = safetyInfo.errorStatus.shouldRollback ? 'red' : 
                     safetyInfo.riskyChanges.length > 0 ? 'yellow' : 
                     healthScore > 80 ? 'green' : 'cyan';
  
  console.log(boxen(content.join('\n'), {
    title: '📋 Project Status',
    titleAlignment: 'center',
    padding: 1,
    borderColor,
    borderStyle: 'round'
  }));
}

function displayRollbackRecommendation(reason: string): void {
  const content = [
    chalk.red.bold('🛑 ROLLBACK RECOMMENDED'),
    '',
    chalk.yellow('Reason:'),
    `  ${reason || 'Multiple failures detected'}`,
    '',
    chalk.cyan('Recommended Actions:'),
    '  1. Save any important uncommitted work',
    '  2. Create a checkpoint: git tag BEFORE-ROLLBACK',
    '  3. Rollback to last stable state:',
    chalk.gray('     git reset --hard HEAD~1'),
    chalk.gray('     # or to specific commit:'),
    chalk.gray('     git reset --hard <commit-hash>'),
    '  4. Clean install dependencies:',
    chalk.gray('     npm install'),
    '  5. Clear caches if needed:',
    chalk.gray('     npx expo start --clear'),
    '',
    chalk.yellow('Alternative Approach:'),
    '  • Consider a different implementation strategy',
    '  • Break down the task into smaller steps',
    '  • Use incremental mode: claude-prompter risk <operation> --incremental'
  ];
  
  console.log(boxen(content.join('\n'), {
    title: '⚠️ Rollback Advisor',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'red',
    borderStyle: 'double'
  }));
}