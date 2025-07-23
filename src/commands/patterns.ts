import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { SessionManager } from '../data/SessionManager';
import { globalRegexCache } from '../utils/RegexCache';
import { StreamProcessor } from '../utils/StreamProcessor';
import { PaginatedDisplay } from '../utils/PaginatedDisplay';

interface PatternAnalysis {
  codingPatterns: Array<{ pattern: string; frequency: number; examples: string[] }>;
  topicPatterns: Array<{ topic: string; frequency: number; sessions: string[] }>;
  languagePatterns: Array<{ language: string; frequency: number; contexts: string[] }>;
  timePatterns: Array<{ hour: number; activity: number; dayOfWeek?: string }>;
  sequencePatterns: Array<{ sequence: string; frequency: number; description: string }>;
  totalSessions: number;
  analyzedPeriod: { start: Date; end: Date };
}

export function createPatternsCommand(): Command {
  const command = new Command('patterns')
    .description('Analyze pattern frequency and usage trends in your learning history')
    .option('-t, --type <type>', 'Pattern type: coding, topics, languages, time, sequences, or all', 'all')
    .option('-p, --project <name>', 'Filter by project name')
    .option('-d, --days <number>', 'Analyze last N days (default: 30)', '30')
    .option('-l, --limit <number>', 'Limit results per category (default: 10)', '10')
    .option('-j, --json', 'Output as JSON')
    .option('-o, --output <file>', 'Export to file (supports .json, .csv, .md)')
    .option('--min-frequency <number>', 'Minimum frequency to show (default: 2)', '2')
    .option('--page <number>', 'Page number for pagination (default: 1)', '1')
    .option('--page-size <number>', 'Items per page (default: 20)', '20')
    .option('--stream', 'Use streaming mode for large datasets')
    .option('--no-pagination', 'Disable pagination and show all results')
    .action(async (options) => {
      try {
        const sessionManager = new SessionManager();
        
        // Ensure cache is initialized before proceeding
        if (sessionManager.isLazyLoadingEnabled()) {
          try {
            await sessionManager.rebuildMetadataCache();
          } catch (error) {
            console.warn('Cache initialization failed, using legacy mode');
          }
        }
        
        let sessions;
        try {
          sessions = await sessionManager.getAllSessions();
        } catch (error) {
          console.error(chalk.red('Failed to load sessions from storage:'));
          console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
          process.exit(1);
        }

        if (!sessions || sessions.length === 0) {
          console.log(chalk.yellow('No sessions found. Start using claude-prompter to build pattern history!'));
          console.log(chalk.gray('Try running: claude-prompter session start --project "my-project"'));
          return;
        }

        // Validate options
        if (options.days && (isNaN(options.days) || parseInt(options.days) < 1)) {
          console.error(chalk.red('Invalid days value. Must be a positive number.'));
          process.exit(1);
        }

        if (options.limit && (isNaN(options.limit) || parseInt(options.limit) < 1)) {
          console.error(chalk.red('Invalid limit value. Must be a positive number.'));
          process.exit(1);
        }

        if (options.minFrequency && (isNaN(options.minFrequency) || parseInt(options.minFrequency) < 1)) {
          console.error(chalk.red('Invalid min-frequency value. Must be a positive number.'));
          process.exit(1);
        }

        const validTypes = ['coding', 'topics', 'languages', 'time', 'sequences', 'all'];
        if (options.type && !validTypes.includes(options.type)) {
          console.error(chalk.red(`Invalid type "${options.type}". Valid types: ${validTypes.join(', ')}`));
          process.exit(1);
        }

        let analysis;
        try {
          analysis = await analyzePatterns(sessions, options);
        } catch (error) {
          console.error(chalk.red('Failed to analyze patterns:'));
          console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
          process.exit(1);
        }

        try {
          if (options.output) {
            await exportPatternAnalysis(analysis, options);
          } else if (options.json) {
            console.log(JSON.stringify(analysis, null, 2));
          } else {
            // Use streaming/pagination based on options and data size
            const shouldPaginate = !options.noPagination && !options.stream;
            const totalPatterns = analysis.codingPatterns.length + 
                                 analysis.topicPatterns.length + 
                                 analysis.languagePatterns.length + 
                                 analysis.timePatterns.length + 
                                 analysis.sequencePatterns.length;
            
            if (shouldPaginate && totalPatterns > 50) {
              await displayPaginatedPatternAnalysis(analysis, options);
            } else if (options.stream || totalPatterns > 200) {
              await displayStreamedPatternAnalysis(analysis, options);
            } else {
              displayPatternAnalysis(analysis, options);
            }
          }
        } catch (error) {
          console.error(chalk.red('Failed to display/export pattern analysis:'));
          console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Unexpected error in patterns command:'));
        console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Analyzes pattern frequency and usage trends across session data
 * @param sessions - Array of session objects to analyze
 * @param options - Analysis options including filters, limits, and time ranges
 * @returns PatternAnalysis object with coding, topic, language, time, and sequence patterns
 * @throws Error if analysis fails or data is invalid
 */
async function analyzePatterns(sessions: any[], options: any): Promise<PatternAnalysis> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(options.days));
  
  let filteredSessions = sessions.filter(session => {
    const sessionDate = new Date(session.metadata?.lastAccessed || session.metadata?.createdDate);
    const matchesProject = !options.project || session.metadata?.projectName?.toLowerCase().includes(options.project.toLowerCase());
    const withinTimeframe = sessionDate >= cutoffDate;
    return matchesProject && withinTimeframe;
  });

  const minFreq = parseInt(options.minFrequency);
  const limit = parseInt(options.limit);
  
  // Initialize analysis structure
  const analysis: PatternAnalysis = {
    codingPatterns: [],
    topicPatterns: [],
    languagePatterns: [],
    timePatterns: [],
    sequencePatterns: [],
    totalSessions: filteredSessions.length,
    analyzedPeriod: {
      start: cutoffDate,
      end: new Date()
    }
  };

  // Pattern tracking maps
  const codingPatternMap = new Map<string, { count: number; examples: Set<string> }>();
  const topicMap = new Map<string, { count: number; sessions: Set<string> }>();
  const languageMap = new Map<string, { count: number; contexts: Set<string> }>();
  const hourlyActivity = new Array(24).fill(0);
  const sequenceMap = new Map<string, { count: number; description: string }>();

  // Analyze each session
  for (const session of filteredSessions) {
    if (!session.history || session.history.length === 0) continue;

    const sessionId = session.metadata?.sessionId || 'unknown';
    const projectName = session.metadata?.projectName || 'unknown';

    // Analyze conversation history
    for (const entry of session.history) {
      const timestamp = new Date(entry.timestamp);
      const content = (entry.prompt + ' ' + (entry.response || '')).toLowerCase();
      
      // Time patterns
      hourlyActivity[timestamp.getHours()]++;
      
      // Detect coding patterns
      const codingPatterns = detectCodingPatterns(content);
      codingPatterns.forEach(pattern => {
        if (!codingPatternMap.has(pattern.name)) {
          codingPatternMap.set(pattern.name, { count: 0, examples: new Set() });
        }
        const existing = codingPatternMap.get(pattern.name)!;
        existing.count++;
        existing.examples.add(pattern.example);
      });

      // Detect topic patterns
      const topics = extractTopics(content);
      topics.forEach(topic => {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { count: 0, sessions: new Set() });
        }
        const existing = topicMap.get(topic)!;
        existing.count++;
        existing.sessions.add(sessionId);
      });

      // Detect language patterns
      const languages = detectLanguages(content);
      languages.forEach(lang => {
        if (!languageMap.has(lang)) {
          languageMap.set(lang, { count: 0, contexts: new Set() });
        }
        const existing = languageMap.get(lang)!;
        existing.count++;
        existing.contexts.add(projectName);
      });

      // Detect sequence patterns (common workflows)
      const sequences = detectSequencePatterns(entry.prompt);
      sequences.forEach(seq => {
        if (!sequenceMap.has(seq.name)) {
          sequenceMap.set(seq.name, { count: 0, description: seq.description });
        }
        sequenceMap.get(seq.name)!.count++;
      });
    }
  }

  // Convert maps to sorted arrays
  analysis.codingPatterns = Array.from(codingPatternMap.entries())
    .filter(([, data]) => data.count >= minFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([pattern, data]) => ({
      pattern,
      frequency: data.count,
      examples: Array.from(data.examples).slice(0, 3)
    }));

  analysis.topicPatterns = Array.from(topicMap.entries())
    .filter(([, data]) => data.count >= minFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([topic, data]) => ({
      topic,
      frequency: data.count,
      sessions: Array.from(data.sessions)
    }));

  analysis.languagePatterns = Array.from(languageMap.entries())
    .filter(([, data]) => data.count >= minFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([language, data]) => ({
      language,
      frequency: data.count,
      contexts: Array.from(data.contexts)
    }));

  analysis.timePatterns = hourlyActivity
    .map((activity, hour) => ({ hour, activity }))
    .filter(item => item.activity > 0)
    .sort((a, b) => b.activity - a.activity);

  analysis.sequencePatterns = Array.from(sequenceMap.entries())
    .filter(([, data]) => data.count >= minFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([sequence, data]) => ({
      sequence,
      frequency: data.count,
      description: data.description
    }));

  return analysis;
}

/**
 * Detects coding patterns from conversation content using cached regex matching
 * @param content - Text content from conversation history
 * @returns Array of detected patterns with names and descriptions
 */
function detectCodingPatterns(content: string): Array<{ name: string; example: string }> {
  const patterns = [];
  
  const codingPatternMap = new Map([
    ['async-await', { pattern: 'async|await|promise', desc: 'asynchronous programming' }],
    ['error-handling', { pattern: 'try|catch|error|exception|throw', desc: 'error management' }],
    ['testing', { pattern: 'test|jest|mocha|vitest|describe|it\\(|expect', desc: 'testing practices' }],
    ['api-integration', { pattern: 'api|endpoint|http|axios|fetch|rest|graphql', desc: 'API development' }],
    ['authentication', { pattern: 'auth|jwt|token|login|session|oauth|passport', desc: 'authentication systems' }],
    ['state-management', { pattern: 'state|redux|zustand|context|provider|store', desc: 'state handling' }],
    ['component-patterns', { pattern: 'component|react|vue|angular|props|hook', desc: 'UI components' }],
    ['database', { pattern: 'database|sql|mongo|postgres|query|orm|prisma', desc: 'data persistence' }],
    ['deployment', { pattern: 'deploy|docker|kubernetes|aws|heroku|vercel|ci\\/cd', desc: 'deployment strategies' }],
    ['performance', { pattern: 'performance|optimize|cache|lazy|memoiz|debounce', desc: 'optimization techniques' }]
  ]);

  // Convert to patterns map for batch testing
  const patternsMap = new Map<string, string>();
  for (const [name, { pattern }] of codingPatternMap.entries()) {
    patternsMap.set(name, pattern);
  }

  // Use batch testing for optimal performance
  const batchResult = globalRegexCache.batchTest(patternsMap, content);
  
  for (const [patternName, result] of batchResult.results.entries()) {
    if (result.matched) {
      const patternInfo = codingPatternMap.get(patternName);
      if (patternInfo) {
        patterns.push({
          name: patternName,
          example: patternInfo.desc
        });
      }
    }
  }

  return patterns;
}

function extractTopics(content: string): string[] {
  const topics = [];
  const words = content.toLowerCase().split(/\s+/);
  
  // Common development topics
  const topicKeywords = {
    'react': ['react', 'jsx', 'component', 'hook'],
    'node.js': ['node', 'nodejs', 'express', 'npm'],
    'typescript': ['typescript', 'type', 'interface', 'generic'],
    'python': ['python', 'django', 'flask', 'pandas'],
    'database': ['database', 'sql', 'query', 'table', 'schema'],
    'security': ['security', 'auth', 'token', 'encrypt', 'hash'],
    'architecture': ['architecture', 'pattern', 'design', 'microservice'],
    'testing': ['test', 'testing', 'unit', 'integration', 'e2e'],
    'devops': ['deploy', 'docker', 'ci', 'cd', 'pipeline'],
    'ui/ux': ['ui', 'ux', 'design', 'css', 'responsive']
  };

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => words.includes(keyword))) {
      topics.push(topic);
    }
  });

  return topics;
}

function detectLanguages(content: string): string[] {
  const languages = [];
  const languagePatterns = new Map([
    ['javascript', '\\b(javascript|js|nodejs|npm|yarn)\\b'],
    ['typescript', '\\b(typescript|ts)\\b'],
    ['python', '\\b(python|py|pip|django|flask)\\b'],
    ['react', '\\b(react|jsx|tsx)\\b'],
    ['css', '\\b(css|scss|sass|styled)\\b'],
    ['sql', '\\b(sql|mysql|postgres|sqlite)\\b'],
    ['go', '\\b(golang|go)\\b'],
    ['rust', '\\b(rust|cargo)\\b'],
    ['java', '\\b(java|spring|maven)\\b'],
    ['php', '\\b(php|laravel|composer)\\b']
  ]);

  // Use batch testing for optimal performance
  const batchResult = globalRegexCache.batchTest(languagePatterns, content);
  
  for (const [lang, result] of batchResult.results.entries()) {
    if (result.matched) {
      languages.push(lang);
    }
  }

  return languages;
}

function detectSequencePatterns(prompt: string): Array<{ name: string; description: string }> {
  const sequences = [];
  const lowerPrompt = prompt.toLowerCase();

  const sequencePatterns = new Map([
    ['create-implement-test', { 
      pattern: 'create.*implement.*test|build.*test|write.*test',
      desc: 'Create → Implement → Test workflow'
    }],
    ['debug-analyze-fix', { 
      pattern: 'debug|fix|error|bug|issue',
      desc: 'Debug → Analyze → Fix workflow'
    }],
    ['plan-design-code', { 
      pattern: 'plan|design|architect.*code|implement',
      desc: 'Plan → Design → Code workflow'
    }],
    ['refactor-optimize', { 
      pattern: 'refactor|optimize|improve|clean.*code',
      desc: 'Refactor → Optimize workflow'
    }],
    ['learn-practice-apply', { 
      pattern: 'learn|understand|practice|apply|example',
      desc: 'Learn → Practice → Apply workflow'
    }]
  ]);

  // Convert to patterns map for batch testing
  const patternsMap = new Map<string, string>();
  for (const [name, { pattern }] of sequencePatterns.entries()) {
    patternsMap.set(name, pattern);
  }

  // Use batch testing for optimal performance
  const batchResult = globalRegexCache.batchTest(patternsMap, lowerPrompt);
  
  for (const [seqName, result] of batchResult.results.entries()) {
    if (result.matched) {
      const seqInfo = sequencePatterns.get(seqName);
      if (seqInfo) {
        sequences.push({
          name: seqName,
          description: seqInfo.desc
        });
      }
    }
  }

  return sequences;
}

function displayPatternAnalysis(analysis: PatternAnalysis, options: any): void {
  // Header
  console.log('\n' + boxen(
    chalk.green.bold('🔍 Pattern Analysis Results'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      align: 'center'
    }
  ));

  // Overview
  console.log(chalk.bold('\n📊 Analysis Overview'));
  console.log(chalk.gray('├── ') + chalk.cyan('Sessions Analyzed: ') + chalk.white.bold(analysis.totalSessions));
  console.log(chalk.gray('├── ') + chalk.cyan('Time Period: ') + chalk.white(`${analysis.analyzedPeriod.start.toLocaleDateString()} - ${analysis.analyzedPeriod.end.toLocaleDateString()}`));
  console.log(chalk.gray('└── ') + chalk.cyan('Filter: ') + chalk.white(options.project || 'All projects'));

  // Show patterns based on type filter
  if (options.type === 'all' || options.type === 'coding') {
    displayCodingPatterns(analysis.codingPatterns);
  }
  
  if (options.type === 'all' || options.type === 'topics') {
    displayTopicPatterns(analysis.topicPatterns);
  }
  
  if (options.type === 'all' || options.type === 'languages') {
    displayLanguagePatterns(analysis.languagePatterns);
  }
  
  if (options.type === 'all' || options.type === 'time') {
    displayTimePatterns(analysis.timePatterns);
  }
  
  if (options.type === 'all' || options.type === 'sequences') {
    displaySequencePatterns(analysis.sequencePatterns);
  }
}

function displayCodingPatterns(patterns: any[]): void {
  if (patterns.length === 0) return;
  
  console.log(chalk.bold('\n💻 Coding Patterns'));
  
  const table = new Table({
    head: ['Pattern', 'Frequency', 'Usage Context'],
    colWidths: [20, 12, 40],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  patterns.forEach(pattern => {
    table.push([
      pattern.pattern,
      pattern.frequency.toString(),
      pattern.examples.join(', ')
    ]);
  });

  console.log(table.toString());
}

function displayTopicPatterns(patterns: any[]): void {
  if (patterns.length === 0) return;
  
  console.log(chalk.bold('\n📚 Topic Patterns'));
  
  const table = new Table({
    head: ['Topic', 'Frequency', 'Sessions'],
    colWidths: [20, 12, 25],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  patterns.forEach(pattern => {
    table.push([
      pattern.topic,
      pattern.frequency.toString(),
      pattern.sessions.length.toString() + ' sessions'
    ]);
  });

  console.log(table.toString());
}

function displayLanguagePatterns(patterns: any[]): void {
  if (patterns.length === 0) return;
  
  console.log(chalk.bold('\n🔤 Language Patterns'));
  
  const table = new Table({
    head: ['Language', 'Frequency', 'Project Contexts'],
    colWidths: [15, 12, 30],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  patterns.forEach(pattern => {
    table.push([
      pattern.language,
      pattern.frequency.toString(),
      pattern.contexts.slice(0, 3).join(', ')
    ]);
  });

  console.log(table.toString());
}

function displayTimePatterns(patterns: any[]): void {
  if (patterns.length === 0) return;
  
  console.log(chalk.bold('\n⏰ Time Patterns'));
  
  // Show top active hours
  const topHours = patterns.slice(0, 8);
  const table = new Table({
    head: ['Hour', 'Activity', 'Usage Bar'],
    colWidths: [8, 12, 30],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  const maxActivity = Math.max(...patterns.map(p => p.activity));
  
  topHours.forEach(pattern => {
    const barLength = Math.round((pattern.activity / maxActivity) * 20);
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    table.push([
      `${pattern.hour}:00`,
      pattern.activity.toString(),
      bar
    ]);
  });

  console.log(table.toString());
}

function displaySequencePatterns(patterns: any[]): void {
  if (patterns.length === 0) return;
  
  console.log(chalk.bold('\n🔄 Workflow Patterns'));
  
  const table = new Table({
    head: ['Workflow', 'Frequency', 'Description'],
    colWidths: [25, 12, 40],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  patterns.forEach(pattern => {
    table.push([
      pattern.sequence,
      pattern.frequency.toString(),
      pattern.description
    ]);
  });

  console.log(table.toString());
}

/**
 * Exports pattern analysis to various file formats
 * @param analysis - PatternAnalysis object to export
 * @param options - Export options including output file path
 * @throws Error if file writing fails or format is unsupported
 */
async function exportPatternAnalysis(analysis: PatternAnalysis, options: any): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  const outputPath = options.output;
  const ext = path.extname(outputPath).toLowerCase();
  
  let content = '';
  
  switch (ext) {
    case '.json':
      content = JSON.stringify(analysis, null, 2);
      break;
    case '.csv':
      content = convertAnalysisToCSV(analysis);
      break;
    case '.md':
      content = convertAnalysisToMarkdown(analysis);
      break;
    default:
      console.error(chalk.red(`Unsupported file format: ${ext}. Supported formats: .json, .csv, .md`));
      return;
  }
  
  try {
    fs.writeFileSync(outputPath, content);
    console.log(chalk.green(`✓ Pattern analysis exported to ${outputPath}`));
  } catch (error) {
    console.error(chalk.red(`Failed to write to ${outputPath}: ${error}`));
  }
}

function convertAnalysisToCSV(analysis: PatternAnalysis): string {
  let csv = 'Category,Pattern,Frequency,Details\n';
  
  analysis.codingPatterns.forEach(p => {
    csv += `"Coding","${p.pattern}","${p.frequency}","${p.examples.join('; ')}"\n`;
  });
  
  analysis.topicPatterns.forEach(p => {
    csv += `"Topic","${p.topic}","${p.frequency}","${p.sessions.length} sessions"\n`;
  });
  
  analysis.languagePatterns.forEach(p => {
    csv += `"Language","${p.language}","${p.frequency}","${p.contexts.join('; ')}"\n`;
  });
  
  analysis.timePatterns.forEach(p => {
    csv += `"Time","${p.hour}:00","${p.activity}","Hour of day"\n`;
  });
  
  analysis.sequencePatterns.forEach(p => {
    csv += `"Workflow","${p.sequence}","${p.frequency}","${p.description}"\n`;
  });
  
  return csv;
}

function convertAnalysisToMarkdown(analysis: PatternAnalysis): string {
  let md = '# Pattern Analysis Report\n\n';
  
  md += `## Overview\n\n`;
  md += `- **Sessions Analyzed**: ${analysis.totalSessions}\n`;
  md += `- **Time Period**: ${analysis.analyzedPeriod.start.toLocaleDateString()} - ${analysis.analyzedPeriod.end.toLocaleDateString()}\n\n`;
  
  if (analysis.codingPatterns.length > 0) {
    md += `## Coding Patterns\n\n`;
    md += `| Pattern | Frequency | Context |\n`;
    md += `|---------|-----------|----------|\n`;
    analysis.codingPatterns.forEach(p => {
      md += `| ${p.pattern} | ${p.frequency} | ${p.examples.join(', ')} |\n`;
    });
    md += '\n';
  }
  
  if (analysis.topicPatterns.length > 0) {
    md += `## Topic Patterns\n\n`;
    md += `| Topic | Frequency | Sessions |\n`;
    md += `|-------|-----------|----------|\n`;
    analysis.topicPatterns.forEach(p => {
      md += `| ${p.topic} | ${p.frequency} | ${p.sessions.length} |\n`;
    });
    md += '\n';
  }
  
  if (analysis.languagePatterns.length > 0) {
    md += `## Language Patterns\n\n`;
    md += `| Language | Frequency | Contexts |\n`;
    md += `|----------|-----------|----------|\n`;
    analysis.languagePatterns.forEach(p => {
      md += `| ${p.language} | ${p.frequency} | ${p.contexts.join(', ')} |\n`;
    });
    md += '\n';
  }
  
  if (analysis.timePatterns.length > 0) {
    md += `## Time Patterns\n\n`;
    md += `| Hour | Activity Level |\n`;
    md += `|------|----------------|\n`;
    analysis.timePatterns.slice(0, 10).forEach(p => {
      md += `| ${p.hour}:00 | ${p.activity} |\n`;
    });
    md += '\n';
  }
  
  if (analysis.sequencePatterns.length > 0) {
    md += `## Workflow Patterns\n\n`;
    md += `| Workflow | Frequency | Description |\n`;
    md += `|----------|-----------|-------------|\n`;
    analysis.sequencePatterns.forEach(p => {
      md += `| ${p.sequence} | ${p.frequency} | ${p.description} |\n`;
    });
    md += '\n';
  }
  
  return md;
}

/**
 * Displays pattern analysis with pagination support
 * @param analysis - PatternAnalysis object to display
 * @param options - Command options including pagination settings
 */
async function displayPaginatedPatternAnalysis(analysis: PatternAnalysis, options: any): Promise<void> {
  const display = new PaginatedDisplay({
    showControls: true,
    showMetrics: true,
    showProgress: false,
    theme: 'default'
  });

  // Convert analysis to flat array for pagination
  const allPatterns = [
    ...analysis.codingPatterns.map(p => ({ type: 'coding', ...p })),
    ...analysis.topicPatterns.map(p => ({ type: 'topic', ...p })),
    ...analysis.languagePatterns.map(p => ({ type: 'language', ...p })),
    ...analysis.timePatterns.map(p => ({ type: 'time', ...p })),
    ...analysis.sequencePatterns.map(p => ({ type: 'sequence', ...p }))
  ];

  const pageSize = parseInt(options.pageSize);
  const currentPage = Math.max(0, parseInt(options.page) - 1); // Convert to 0-based

  // Create stream processor for pagination
  const processor = new StreamProcessor<any, any>(
    async (items: any[]) => items, // Identity function for patterns
    { chunkSize: pageSize }
  );

  const result = await processor.processPaginated(allPatterns, {
    pageSize,
    currentPage,
    useCursor: false
  });

  // Custom formatter for pattern display
  const formatter = (items: any[]) => {
    let output = '';
    
    // Group items by type for display
    const groupedItems = items.reduce((groups, item) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
      return groups;
    }, {} as Record<string, any[]>);

    Object.entries(groupedItems).forEach(([type, patterns]) => {
      if (Array.isArray(patterns)) {
        output += displayPatternGroup(type, patterns);
      }
    });

    return output;
  };

  const navigation = {
    nextCommand: result.pagination.hasNextPage ? 
      `claude-prompter patterns --page ${currentPage + 2} --page-size ${pageSize}` : undefined,
    prevCommand: result.pagination.hasPreviousPage ? 
      `claude-prompter patterns --page ${currentPage} --page-size ${pageSize}` : undefined,
    jumpCommand: `claude-prompter patterns --page <page> --page-size ${pageSize}`,
    helpText: 'Use --stream for large datasets or --no-pagination to show all results'
  };

  display.displayPaginated(result, formatter, navigation);
}

/**
 * Displays pattern analysis with streaming support
 * @param analysis - PatternAnalysis object to display
 * @param options - Command options including streaming settings
 */
async function displayStreamedPatternAnalysis(analysis: PatternAnalysis, _options: any): Promise<void> {
  const display = new PaginatedDisplay({
    showControls: false,
    showMetrics: true,
    showProgress: true,
    theme: 'default'
  });

  // Convert analysis to flat array for streaming
  const allPatterns = [
    ...analysis.codingPatterns.map(p => ({ type: 'coding', ...p })),
    ...analysis.topicPatterns.map(p => ({ type: 'topic', ...p })),
    ...analysis.languagePatterns.map(p => ({ type: 'language', ...p })),
    ...analysis.timePatterns.map(p => ({ type: 'time', ...p })),
    ...analysis.sequencePatterns.map(p => ({ type: 'sequence', ...p }))
  ];

  // Create progress indicator
  const progressUpdate = display.createProgressIndicator(allPatterns.length);

  // Create stream processor
  const processor = new StreamProcessor<any, any>(
    async (items: any[]) => {
      // Simulate processing with progress updates
      items.forEach((_, index) => {
        progressUpdate(index + 1);
      });
      return items;
    },
    { 
      chunkSize: 25,
      concurrencyLimit: 2,
      enableStreaming: true
    }
  );

  const result = await processor.processStream(allPatterns);

  // Custom formatter for stream display
  const formatter = (items: any[]) => {
    let output = '';
    
    // Group items by type for display
    const groupedItems = items.reduce((groups, item) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
      return groups;
    }, {} as Record<string, any[]>);

    Object.entries(groupedItems).forEach(([type, patterns]) => {
      if (Array.isArray(patterns)) {
        output += displayPatternGroup(type, patterns);
      }
    });

    return output;
  };

  display.displayStream(result, formatter);
}

/**
 * Displays a group of patterns by type
 * @param type - Pattern type
 * @param patterns - Array of patterns
 * @returns Formatted output string
 */
function displayPatternGroup(type: string, patterns: any[]): string {
  if (patterns.length === 0) return '';

  let output = '\n';
  
  // Type-specific headers and formatting
  switch (type) {
    case 'coding':
      output += chalk.bold('💻 Coding Patterns\n');
      break;
    case 'topic':
      output += chalk.bold('📚 Topic Patterns\n');
      break;
    case 'language':
      output += chalk.bold('🔤 Language Patterns\n');
      break;
    case 'time':
      output += chalk.bold('⏰ Time Patterns\n');
      break;
    case 'sequence':
      output += chalk.bold('🔄 Workflow Patterns\n');
      break;
  }

  patterns.forEach((pattern, index) => {
    const prefix = index === patterns.length - 1 ? '└──' : '├──';
    
    if (type === 'coding') {
      output += chalk.gray(prefix) + chalk.cyan(` ${pattern.pattern}`) + 
                chalk.gray(` (${pattern.frequency}×) - `) + 
                chalk.white(pattern.examples?.join(', ') || 'No examples') + '\n';
    } else if (type === 'topic') {
      output += chalk.gray(prefix) + chalk.cyan(` ${pattern.topic}`) + 
                chalk.gray(` (${pattern.frequency}×) - `) + 
                chalk.white(`${pattern.sessions?.length || 0} sessions`) + '\n';
    } else if (type === 'language') {
      output += chalk.gray(prefix) + chalk.cyan(` ${pattern.language}`) + 
                chalk.gray(` (${pattern.frequency}×) - `) + 
                chalk.white(pattern.contexts?.join(', ') || 'No contexts') + '\n';
    } else if (type === 'time') {
      output += chalk.gray(prefix) + chalk.cyan(` ${pattern.hour}:00`) + 
                chalk.gray(' - ') + 
                chalk.white(`${pattern.activity} activities`) + '\n';
    } else if (type === 'sequence') {
      output += chalk.gray(prefix) + chalk.cyan(` ${pattern.sequence}`) + 
                chalk.gray(` (${pattern.frequency}×) - `) + 
                chalk.white(pattern.description) + '\n';
    }
  });

  return output;
}