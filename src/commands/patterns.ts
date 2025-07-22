import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { SessionManager } from '../data/SessionManager';

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
    .action(async (options) => {
      const sessionManager = new SessionManager();
      const sessions = await sessionManager.getAllSessions();

      if (sessions.length === 0) {
        console.log(chalk.yellow('No sessions found. Start using claude-prompter to build pattern history!'));
        return;
      }

      const analysis = await analyzePatterns(sessions, options);

      if (options.output) {
        await exportPatternAnalysis(analysis, options);
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
        return;
      }

      displayPatternAnalysis(analysis, options);
    });

  return command;
}

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

function detectCodingPatterns(content: string): Array<{ name: string; example: string }> {
  const patterns = [];
  
  const codingPatternMap = {
    'async-await': { regex: /async|await|promise/gi, desc: 'asynchronous programming' },
    'error-handling': { regex: /try|catch|error|exception|throw/gi, desc: 'error management' },
    'testing': { regex: /test|jest|mocha|vitest|describe|it\(|expect/gi, desc: 'testing practices' },
    'api-integration': { regex: /api|endpoint|http|axios|fetch|rest|graphql/gi, desc: 'API development' },
    'authentication': { regex: /auth|jwt|token|login|session|oauth|passport/gi, desc: 'authentication systems' },
    'state-management': { regex: /state|redux|zustand|context|provider|store/gi, desc: 'state handling' },
    'component-patterns': { regex: /component|react|vue|angular|props|hook/gi, desc: 'UI components' },
    'database': { regex: /database|sql|mongo|postgres|query|orm|prisma/gi, desc: 'data persistence' },
    'deployment': { regex: /deploy|docker|kubernetes|aws|heroku|vercel|ci\/cd/gi, desc: 'deployment strategies' },
    'performance': { regex: /performance|optimize|cache|lazy|memoiz|debounce/gi, desc: 'optimization techniques' }
  };

  Object.entries(codingPatternMap).forEach(([patternName, { regex, desc }]) => {
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      patterns.push({
        name: patternName,
        example: desc
      });
    }
  });

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
  const languagePatterns = {
    'javascript': /\b(javascript|js|nodejs|npm|yarn)\b/gi,
    'typescript': /\b(typescript|ts)\b/gi,
    'python': /\b(python|py|pip|django|flask)\b/gi,
    'react': /\b(react|jsx|tsx)\b/gi,
    'css': /\b(css|scss|sass|styled)\b/gi,
    'sql': /\b(sql|mysql|postgres|sqlite)\b/gi,
    'go': /\b(golang|go)\b/gi,
    'rust': /\b(rust|cargo)\b/gi,
    'java': /\b(java|spring|maven)\b/gi,
    'php': /\b(php|laravel|composer)\b/gi
  };

  Object.entries(languagePatterns).forEach(([lang, pattern]) => {
    if (pattern.test(content)) {
      languages.push(lang);
    }
  });

  return languages;
}

function detectSequencePatterns(prompt: string): Array<{ name: string; description: string }> {
  const sequences = [];
  const lowerPrompt = prompt.toLowerCase();

  const sequencePatterns = {
    'create-implement-test': { 
      regex: /create.*implement.*test|build.*test|write.*test/gi,
      desc: 'Create → Implement → Test workflow'
    },
    'debug-analyze-fix': { 
      regex: /debug|fix|error|bug|issue/gi,
      desc: 'Debug → Analyze → Fix workflow'
    },
    'plan-design-code': { 
      regex: /plan|design|architect.*code|implement/gi,
      desc: 'Plan → Design → Code workflow'
    },
    'refactor-optimize': { 
      regex: /refactor|optimize|improve|clean.*code/gi,
      desc: 'Refactor → Optimize workflow'
    },
    'learn-practice-apply': { 
      regex: /learn|understand|practice|apply|example/gi,
      desc: 'Learn → Practice → Apply workflow'
    }
  };

  Object.entries(sequencePatterns).forEach(([seqName, { regex, desc }]) => {
    if (regex.test(lowerPrompt)) {
      sequences.push({
        name: seqName,
        description: desc
      });
    }
  });

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