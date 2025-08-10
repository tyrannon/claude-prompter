import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { ProjectAnalyzer, ProjectContext, FileAnalysis } from '../services/ProjectAnalyzer';
import { callOpenAI } from '../utils/openaiClient';

interface AnalyzeOptions {
  file?: string;
  files?: string;
  project?: boolean;
  suggest?: boolean;
  changes?: boolean;
  recent?: boolean;
  pattern?: string;
  complexity?: boolean;
  ai?: boolean;
  json?: boolean;
}

/**
 * Create the analyze command for intelligent project and file analysis
 */
export function createAnalyzeCommand(): Command {
  const command = new Command('analyze');
  
  command
    .description('🔍 Analyze project context, files, and provide smart suggestions')
    .option('-f, --file <file>', 'Analyze specific file')
    .option('--files <files>', 'Analyze multiple files (comma-separated)')
    .option('-p, --project', 'Analyze entire project context')
    .option('-s, --suggest', 'Generate context-aware suggestions')
    .option('-c, --changes', 'Analyze recent changes (git)')
    .option('-r, --recent', 'Analyze recently modified files')
    .option('--pattern <pattern>', 'Look for specific patterns')
    .option('--complexity', 'Assess code complexity')
    .option('--ai', 'Use AI for advanced analysis')
    .option('--json', 'Output results as JSON')
    .action(async (options: AnalyzeOptions) => {
      const analyzer = new ProjectAnalyzer();
      
      try {
        if (options.project || (!options.file && !options.files && !options.changes && !options.recent)) {
          await analyzeProject(analyzer, options);
        } else if (options.changes) {
          await analyzeChanges(analyzer, options);
        } else if (options.recent) {
          await analyzeRecentFiles(analyzer, options);
        } else if (options.file || options.files) {
          await analyzeSpecificFiles(analyzer, options);
        }
      } catch (error) {
        console.error(chalk.red(`❌ Analysis failed: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });
  
  return command;
}

/**
 * Analyze entire project context
 */
async function analyzeProject(analyzer: ProjectAnalyzer, options: AnalyzeOptions): Promise<void> {
  const spinner = ora('🔍 Analyzing project context...').start();
  
  try {
    const context = await analyzer.analyzeProject();
    spinner.succeed('Project analysis complete!');
    
    if (options.json) {
      console.log(JSON.stringify(context, null, 2));
      return;
    }
    
    displayProjectContext(context);
    
    if (options.suggest) {
      await generateProjectSuggestions(context, options.ai);
    }
  } catch (error) {
    spinner.fail('Project analysis failed');
    throw error;
  }
}

/**
 * Analyze recent changes from git
 */
async function analyzeChanges(analyzer: ProjectAnalyzer, options: AnalyzeOptions): Promise<void> {
  const spinner = ora('📊 Analyzing recent changes...').start();
  
  try {
    const workingFiles = await analyzer.getCurrentWorkingFiles();
    const recentFiles = await analyzer.getRecentChangedFiles();
    const allChangedFiles = [...workingFiles.staged, ...workingFiles.modified, ...recentFiles];
    
    if (allChangedFiles.length === 0) {
      spinner.succeed('No recent changes found');
      console.log(chalk.gray('✨ Your working directory is clean!'));
      return;
    }
    
    const analyses = await analyzer.analyzeFiles([...new Set(allChangedFiles)]);
    spinner.succeed(`Analyzed ${analyses.length} changed files`);
    
    if (options.json) {
      console.log(JSON.stringify({ workingFiles, recentFiles, analyses }, null, 2));
      return;
    }
    
    displayChangesAnalysis(workingFiles, analyses);
    
    if (options.suggest) {
      await generateChangesSuggestions(analyses, options.ai);
    }
  } catch (error) {
    spinner.fail('Changes analysis failed');
    throw error;
  }
}

/**
 * Analyze recently modified files
 */
async function analyzeRecentFiles(analyzer: ProjectAnalyzer, options: AnalyzeOptions): Promise<void> {
  const spinner = ora('⏰ Finding recently modified files...').start();
  
  try {
    const recentFiles = await analyzer.getRecentChangedFiles(20);
    
    if (recentFiles.length === 0) {
      spinner.succeed('No recent files found');
      return;
    }
    
    const analyses = await analyzer.analyzeFiles(recentFiles);
    spinner.succeed(`Analyzed ${analyses.length} recent files`);
    
    if (options.json) {
      console.log(JSON.stringify(analyses, null, 2));
      return;
    }
    
    displayFileAnalyses(analyses, 'Recent Files Analysis');
    
    if (options.suggest) {
      await generateFilesSuggestions(analyses, options.ai);
    }
  } catch (error) {
    spinner.fail('Recent files analysis failed');
    throw error;
  }
}

/**
 * Analyze specific files
 */
async function analyzeSpecificFiles(analyzer: ProjectAnalyzer, options: AnalyzeOptions): Promise<void> {
  const filePaths: string[] = [];
  
  if (options.file) {
    filePaths.push(options.file);
  }
  
  if (options.files) {
    filePaths.push(...options.files.split(',').map(f => f.trim()));
  }
  
  const spinner = ora(`📁 Analyzing ${filePaths.length} file(s)...`).start();
  
  try {
    const analyses = await analyzer.analyzeFiles(filePaths);
    spinner.succeed(`File analysis complete!`);
    
    if (options.json) {
      console.log(JSON.stringify(analyses, null, 2));
      return;
    }
    
    displayFileAnalyses(analyses, 'File Analysis');
    
    if (options.suggest) {
      await generateFilesSuggestions(analyses, options.ai);
    }
  } catch (error) {
    spinner.fail('File analysis failed');
    throw error;
  }
}

/**
 * Display project context in a beautiful format
 */
function displayProjectContext(context: ProjectContext): void {
  const content = [
    chalk.cyan.bold('🚀 Project Overview'),
    '',
    chalk.yellow('Project Type:') + ` ${formatProjectType(context.type)} ${getConfidenceIndicator(context.confidence)}`,
    chalk.yellow('Domain:') + ` ${formatDomain(context.domain)}`,
    chalk.yellow('Languages:') + ` ${context.languages.join(', ') || 'Unknown'}`,
    '',
    chalk.cyan.bold('🛠️ Technology Stack'),
    '',
    chalk.green('Frameworks:') + ` ${context.frameworks.join(', ') || 'None detected'}`,
    chalk.green('Build Tools:') + ` ${context.buildTools.join(', ') || 'None detected'}`,
    chalk.green('Testing:') + ` ${context.testFrameworks.join(', ') || 'None detected'}`,
    chalk.green('Styling:') + ` ${context.styling.join(', ') || 'None detected'}`,
    chalk.green('State Management:') + ` ${context.stateManagement.join(', ') || 'None detected'}`,
    '',
    chalk.cyan.bold('📊 Patterns & Architecture'),
    '',
    ...context.patterns.map(pattern => `${chalk.blue('•')} ${pattern}`),
    '',
    chalk.cyan.bold('📦 Project Info'),
    '',
    chalk.gray('Package Manager:') + ` ${context.packageManager}`,
    chalk.gray('Git Repository:') + ` ${context.hasGit ? '✓ Yes' : '✗ No'}`,
  ];
  
  if (context.gitStatus) {
    content.push(
      chalk.gray('Current Branch:') + ` ${context.gitStatus.branch}`,
      chalk.gray('Uncommitted Changes:') + ` ${context.gitStatus.hasUncommittedChanges ? '⚠️ Yes' : '✓ Clean'}`,
      chalk.gray('Recent Files:') + ` ${context.gitStatus.recentFiles.slice(0, 3).join(', ')}${context.gitStatus.recentFiles.length > 3 ? '...' : ''}`
    );
  }
  
  console.log(boxen(content.join('\n'), {
    title: '🔍 Project Analysis',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'cyan',
    borderStyle: 'round'
  }));
}

/**
 * Display changes analysis
 */
function displayChangesAnalysis(
  workingFiles: { staged: string[]; modified: string[]; untracked: string[] },
  analyses: FileAnalysis[]
): void {
  const content = [
    chalk.cyan.bold('🔄 Changes Overview'),
    '',
    chalk.green('Staged Files:') + ` ${workingFiles.staged.length}`,
    ...workingFiles.staged.slice(0, 5).map(file => `  ${chalk.blue('•')} ${file}`),
    workingFiles.staged.length > 5 ? `  ${chalk.gray(`... and ${workingFiles.staged.length - 5} more`)}` : '',
    '',
    chalk.yellow('Modified Files:') + ` ${workingFiles.modified.length}`,
    ...workingFiles.modified.slice(0, 5).map(file => `  ${chalk.blue('•')} ${file}`),
    workingFiles.modified.length > 5 ? `  ${chalk.gray(`... and ${workingFiles.modified.length - 5} more`)}` : '',
    '',
    chalk.red('Untracked Files:') + ` ${workingFiles.untracked.length}`,
    ...workingFiles.untracked.slice(0, 3).map(file => `  ${chalk.blue('•')} ${file}`),
    workingFiles.untracked.length > 3 ? `  ${chalk.gray(`... and ${workingFiles.untracked.length - 3} more`)}` : '',
    '',
    chalk.cyan.bold('📈 Complexity Analysis'),
    '',
    `Complex Files: ${analyses.filter(a => a.complexity === 'complex').length}`,
    `Moderate Files: ${analyses.filter(a => a.complexity === 'moderate').length}`,
    `Simple Files: ${analyses.filter(a => a.complexity === 'simple').length}`,
  ].filter(Boolean);
  
  console.log(boxen(content.join('\n'), {
    title: '📊 Changes Analysis',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'green',
    borderStyle: 'round'
  }));
}

/**
 * Display file analyses
 */
function displayFileAnalyses(analyses: FileAnalysis[], title: string): void {
  if (analyses.length === 0) {
    console.log(chalk.gray('No files to analyze'));
    return;
  }
  
  const content: string[] = [];
  
  analyses.forEach((analysis, index) => {
    if (index > 0) content.push('');
    
    content.push(
      chalk.cyan.bold(`📄 ${analysis.filePath}`),
      `${chalk.yellow('Language:')} ${analysis.language}`,
      `${chalk.yellow('Type:')} ${analysis.type}`,
      `${chalk.yellow('Complexity:')} ${getComplexityIndicator(analysis.complexity)}`,
      `${chalk.yellow('Size:')} ${formatFileSize(analysis.size)}`,
      `${chalk.yellow('Modified:')} ${analysis.lastModified.toLocaleDateString()}`
    );
    
    if (analysis.framework) {
      content.push(`${chalk.yellow('Framework:')} ${analysis.framework}`);
    }
    
    if (analysis.patterns.length > 0) {
      content.push(`${chalk.yellow('Patterns:')} ${analysis.patterns.join(', ')}`);
    }
  });
  
  console.log(boxen(content.join('\n'), {
    title,
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'blue',
    borderStyle: 'round'
  }));
}

/**
 * Generate AI-powered project suggestions
 */
async function generateProjectSuggestions(context: ProjectContext, useAI: boolean = false): Promise<void> {
  if (!useAI) {
    generateBasicProjectSuggestions(context);
    return;
  }
  
  const spinner = ora('🤖 Generating AI-powered suggestions...').start();
  
  try {
    const prompt = `Based on this project analysis, provide 5 specific, actionable suggestions for improvement:

Project Type: ${context.type}
Domain: ${context.domain}  
Frameworks: ${context.frameworks.join(', ')}
Languages: ${context.languages.join(', ')}
Patterns: ${context.patterns.join(', ')}
Build Tools: ${context.buildTools.join(', ')}
Test Frameworks: ${context.testFrameworks.join(', ')}

Focus on:
1. Architecture improvements
2. Performance optimizations  
3. Best practice implementations
4. Tool additions
5. Code quality enhancements

Make suggestions specific to the detected technology stack and domain.`;

    const response = await callOpenAI(prompt, 'You are a senior software architect providing specific, actionable development suggestions.');
    
    spinner.succeed('AI suggestions generated!');
    
    console.log(boxen(response, {
      title: '🤖 AI-Powered Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'round'
    }));
  } catch (error) {
    spinner.fail('Failed to generate AI suggestions');
    generateBasicProjectSuggestions(context);
  }
}

/**
 * Generate basic project suggestions without AI
 */
function generateBasicProjectSuggestions(context: ProjectContext): void {
  const suggestions: string[] = [];
  
  // Framework-specific suggestions
  if (context.type === 'react-native') {
    suggestions.push('• Add React Native performance monitoring (Flipper)');
    suggestions.push('• Implement proper error boundaries');
    suggestions.push('• Consider adding React Query for state management');
  } else if (context.type === 'web-react') {
    suggestions.push('• Add bundle analysis with webpack-bundle-analyzer');
    suggestions.push('• Implement code splitting with React.lazy()');
    suggestions.push('• Consider adding Storybook for component documentation');
  } else if (context.type === 'nodejs') {
    suggestions.push('• Add API documentation with Swagger/OpenAPI');
    suggestions.push('• Implement proper logging with Winston or Pino');
    suggestions.push('• Add health check endpoints');
  }
  
  // Domain-specific suggestions
  if (context.domain === 'ecommerce') {
    suggestions.push('• Add cart persistence and session management');
    suggestions.push('• Implement payment processing security measures');
  } else if (context.domain === 'fashion') {
    suggestions.push('• Optimize image loading and CDN usage');
    suggestions.push('• Add AR/VR try-on functionality');
  }
  
  // General improvements based on missing tools
  if (!context.testFrameworks.length) {
    suggestions.push('• Add testing framework (Jest recommended)');
  }
  
  if (!context.styling.length && (context.type === 'react-native' || context.type === 'web-react')) {
    suggestions.push('• Consider adding styled-components or Tailwind CSS');
  }
  
  if (!context.buildTools.includes('typescript') && context.languages.includes('javascript')) {
    suggestions.push('• Consider migrating to TypeScript for better type safety');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('• Your project looks well-configured!');
    suggestions.push('• Consider adding performance monitoring');
    suggestions.push('• Review and update dependencies regularly');
  }
  
  console.log(boxen(suggestions.join('\n'), {
    title: '💡 Smart Suggestions',
    titleAlignment: 'center',
    padding: 1,
    borderColor: 'yellow',
    borderStyle: 'round'
  }));
}

/**
 * Generate suggestions for changed files
 */
async function generateChangesSuggestions(analyses: FileAnalysis[], _useAI: boolean = false): Promise<void> {
  const suggestions: string[] = [];
  
  const complexFiles = analyses.filter(a => a.complexity === 'complex');
  if (complexFiles.length > 0) {
    suggestions.push(`• Consider refactoring complex files: ${complexFiles.map(f => f.filePath).join(', ')}`);
  }
  
  const testFiles = analyses.filter(a => a.type === 'test');
  const sourceFiles = analyses.filter(a => a.type === 'source');
  
  if (sourceFiles.length > 0 && testFiles.length === 0) {
    suggestions.push('• Add tests for your recent changes');
  }
  
  const reactFiles = analyses.filter(a => a.framework === 'react');
  if (reactFiles.length > 0) {
    suggestions.push('• Ensure React components are properly typed');
    suggestions.push('• Consider adding PropTypes or TypeScript interfaces');
  }
  
  if (suggestions.length > 0) {
    console.log(boxen(suggestions.join('\n'), {
      title: '🔄 Changes Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'green',
      borderStyle: 'round'
    }));
  }
}

/**
 * Generate suggestions for specific files
 */
async function generateFilesSuggestions(analyses: FileAnalysis[], _useAI: boolean = false): Promise<void> {
  const suggestions: string[] = [];
  
  analyses.forEach(analysis => {
    if (analysis.complexity === 'complex') {
      suggestions.push(`• ${analysis.filePath}: Consider breaking into smaller modules`);
    }
    
    if (analysis.patterns.includes('async-await') && !analysis.patterns.includes('error-handling')) {
      suggestions.push(`• ${analysis.filePath}: Add proper error handling for async operations`);
    }
    
    if (analysis.framework === 'react' && !analysis.patterns.includes('react-hooks')) {
      suggestions.push(`• ${analysis.filePath}: Consider using React hooks for modern patterns`);
    }
  });
  
  if (suggestions.length > 0) {
    console.log(boxen(suggestions.join('\n'), {
      title: '📁 File Suggestions',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'blue',
      borderStyle: 'round'
    }));
  }
}

// Helper functions
function formatProjectType(type: string): string {
  const icons = {
    'react-native': '📱 React Native',
    'web-react': '🌐 React Web',
    'nodejs': '🟢 Node.js',
    'python': '🐍 Python',
    'go': '🐹 Go',
    'rust': '🦀 Rust',
    'unknown': '❓ Unknown'
  };
  return icons[type as keyof typeof icons] || type;
}

function formatDomain(domain: string): string {
  const icons = {
    'ecommerce': '🛒 E-commerce',
    'fashion': '👗 Fashion',
    'fintech': '💰 FinTech',
    'gaming': '🎮 Gaming',
    'healthcare': '🏥 Healthcare',
    'education': '📚 Education',
    'general': '🔧 General'
  };
  return icons[domain as keyof typeof icons] || domain;
}

function getConfidenceIndicator(confidence: number): string {
  if (confidence >= 80) return chalk.green('(High Confidence)');
  if (confidence >= 60) return chalk.yellow('(Medium Confidence)');
  return chalk.red('(Low Confidence)');
}

function getComplexityIndicator(complexity: string): string {
  const indicators = {
    'simple': chalk.green('Simple ✓'),
    'moderate': chalk.yellow('Moderate ⚡'),
    'complex': chalk.red('Complex ⚠️')
  };
  return indicators[complexity as keyof typeof indicators] || complexity;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}