import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { SessionManager } from '../data/SessionManager';
import { format } from 'date-fns';
import { globalRegexCache } from '../utils/RegexCache';
import { PaginatedDisplay } from '../utils/PaginatedDisplay';

interface LearningStats {
  totalSessions: number;
  experienceLevel: string;
  languages: Map<string, number>;
  patterns: Map<string, number>;
  projects: Map<string, number>;
  recentActivity: { date: string; project: string; count: number; successRate: number }[];
  successRate: number;
  streak: number;
}

export function createStatsCommand(): Command {
  const command = new Command('stats')
    .description('Display learning statistics and progress in terminal')
    .option('-d, --detailed', 'Show comprehensive session statistics')
    .option('-p, --project <name>', 'Filter stats by project')
    .option('-j, --json', 'Output stats as JSON')
    .option('--sessions-table', 'Show sessions in paginated table format')
    .option('--page <number>', 'Page number for table view (default: 1)', '1')
    .option('--page-size <number>', 'Items per page for table view (default: 10)', '10')
    .action(async (options) => {
      try {
        const sessionManager = new SessionManager();
        
        // Ensure cache is initialized before proceeding
        if (sessionManager.isLazyLoadingEnabled()) {
          try {
            await sessionManager.rebuildMetadataCache();
          } catch (error) {
            console.warn(chalk.yellow('Cache initialization failed, using legacy mode'));
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
          console.log(chalk.yellow('No sessions found. Start using claude-prompter to build your learning history!'));
          console.log(chalk.gray('Try running: claude-prompter session start --project "my-project"'));
          return;
        }

        let stats;
        try {
          stats = calculateStats(sessions, options.project);
        } catch (error) {
          console.error(chalk.red('Failed to calculate statistics:'));
          console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
          process.exit(1);
        }

        if (stats.totalSessions === 0 && options.project) {
          console.log(chalk.yellow(`No sessions found for project "${options.project}".`));
          console.log(chalk.gray('Available projects:'));
          const availableProjects = [...new Set(sessions.map(s => s.metadata?.projectName).filter(Boolean))];
          availableProjects.forEach(project => console.log(chalk.gray(`  - ${project}`)));
          return;
        }

        try {
          if (options.json) {
            console.log(JSON.stringify(stats, null, 2));
          } else if (options.sessionsTable) {
            await displaySessionsTable(sessions, options);
          } else if (options.detailed) {
            displayDetailedStats(stats);
          } else {
            displayOverviewStats(stats);
          }
        } catch (error) {
          console.error(chalk.red('Failed to display statistics:'));
          console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Unexpected error in stats command:'));
        console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Calculates comprehensive learning statistics from session data
 * @param sessions - Array of session objects containing learning history
 * @param projectFilter - Optional project name to filter sessions by
 * @returns LearningStats object with patterns, languages, projects, and growth metrics
 * @throws Error if sessions data is invalid or filtering fails
 */
function calculateStats(sessions: any[], projectFilter?: string): LearningStats {
  if (!Array.isArray(sessions)) {
    throw new Error('Sessions data is invalid or corrupted');
  }

  let filteredSessions = sessions;
  if (projectFilter) {
    try {
      filteredSessions = sessions.filter(s => s?.metadata?.projectName?.toLowerCase() === projectFilter.toLowerCase());
    } catch (error) {
      throw new Error(`Failed to filter sessions by project "${projectFilter}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const languages = new Map<string, number>();
  const patterns = new Map<string, number>();
  const projects = new Map<string, number>();
  const recentDays = new Map<string, { project: string; count: number; success: number }>();

  filteredSessions.forEach((session, index) => {
    try {
      if (!session) {
        console.warn(chalk.yellow(`Warning: Session at index ${index} is null or undefined, skipping`));
        return;
      }

      // Count languages
    const lang = session.language || session.metadata?.language;
    if (lang) {
      languages.set(lang, (languages.get(lang) || 0) + 1);
    }

    // Count patterns
    const sessionPatterns = extractPatterns(session);
    sessionPatterns.forEach(pattern => {
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    // Count projects
    if (session.metadata?.projectName) {
      projects.set(session.metadata.projectName, (projects.get(session.metadata.projectName) || 0) + 1);
    }

    // Track recent activity
    const date = format(new Date(session.metadata?.createdDate || session.metadata?.lastAccessed), 'yyyy-MM-dd');
    const dayData = recentDays.get(date) || { project: session.metadata?.projectName || 'unknown', count: 0, success: 0 };
    dayData.count++;
    if (session.metadata?.status === 'completed' || session.metadata?.status === 'active') {
      dayData.success++;
    }
    recentDays.set(date, dayData);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error processing session at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Calculate success rate
  const completedSessions = filteredSessions.filter(s => s.metadata?.status === 'completed' || s.metadata?.status === 'active').length;
  const successRate = filteredSessions.length > 0 ? (completedSessions / filteredSessions.length) * 100 : 0;

  // Calculate streak
  const streak = calculateStreak(filteredSessions);

  // Get recent activity
  const recentActivity = Array.from(recentDays.entries())
    .slice(-7)
    .map(([date, data]) => ({
      date,
      project: data.project,
      count: data.count,
      successRate: (data.success / data.count) * 100
    }));

  // Determine experience level
  const experienceLevel = getExperienceLevel(filteredSessions.length);

  return {
    totalSessions: filteredSessions.length,
    experienceLevel,
    languages,
    patterns,
    projects,
    recentActivity,
    successRate,
    streak
  };
}

/**
 * Extracts coding patterns from session conversation history
 * @param session - Session object with conversation history
 * @returns Array of pattern names found in the session content
 */
function extractPatterns(session: any): string[] {
  const patterns: string[] = [];
  
  // Extract from conversation history
  if (session.history && session.history.length > 0) {
    const content = session.history.map((entry: any) => 
      `${entry.prompt || ''} ${entry.response || ''}`
    ).join(' ').toLowerCase();
    
    // Common patterns to look for using cached regex
    const patternMap = new Map([
      ['async-await', 'async|await|promise'],
      ['error-handling', 'try|catch|error|exception'],
      ['testing', 'test|jest|mocha|vitest|describe|it\\('],
      ['api-integration', 'api|endpoint|http|axios|fetch'],
      ['authentication', 'auth|jwt|token|login|session'],
      ['state-management', 'state|redux|zustand|context'],
      ['component-patterns', 'component|react|vue|angular'],
      ['database', 'database|sql|mongo|postgres|query']
    ]);

    // Use batch testing for optimal performance
    const batchResult = globalRegexCache.batchTest(patternMap, content);
    
    for (const [pattern, result] of batchResult.results.entries()) {
      if (result.matched) {
        patterns.push(pattern);
      }
    }
  }

  return patterns;
}

/**
 * Determines experience level based on session count
 * @param sessionCount - Total number of completed sessions
 * @returns Experience level string (Beginner, Intermediate, Experienced, Advanced, Expert)
 */
function getExperienceLevel(sessionCount: number): string {
  if (sessionCount < 10) return 'Beginner';
  if (sessionCount < 25) return 'Intermediate';
  if (sessionCount < 50) return 'Experienced';
  if (sessionCount < 100) return 'Advanced';
  return 'Expert';
}

/**
 * Calculates consecutive days streak of active sessions
 * @param sessions - Array of session objects with timestamps
 * @returns Number of consecutive days with session activity
 */
function calculateStreak(sessions: any[]): number {
  const sortedSessions = sessions.sort((a, b) => 
    new Date(b.metadata?.lastAccessed || b.metadata?.createdDate).getTime() - 
    new Date(a.metadata?.lastAccessed || a.metadata?.createdDate).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let streak = 0;
  let currentDate = new Date(today);

  while (true) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const hasSession = sortedSessions.some(s => {
      const sessionDate = format(new Date(s.metadata?.lastAccessed || s.metadata?.createdDate), 'yyyy-MM-dd');
      return sessionDate === dateStr;
    });

    if (!hasSession && streak > 0) {
      break;
    }

    if (hasSession) {
      streak++;
    }

    currentDate.setDate(currentDate.getDate() - 1);
    
    // Don't go back more than 30 days
    if (streak === 0 && (today.getTime() - currentDate.getTime()) > 30 * 24 * 60 * 60 * 1000) {
      break;
    }
  }

  return streak;
}

/**
 * Displays overview learning statistics in formatted terminal output
 * @param stats - LearningStats object containing calculated metrics
 */
function displayOverviewStats(stats: LearningStats): void {
  // Header
  console.log('\n' + boxen(
    chalk.green.bold('🌱 Claude Prompter Learning Overview'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      align: 'center'
    }
  ));

  // Progress section
  console.log(chalk.bold('\n📊 Your Progress'));
  console.log(chalk.gray('├── ') + chalk.cyan('Sessions: ') + chalk.white.bold(stats.totalSessions) + chalk.gray(` (${stats.experienceLevel} Level)`));
  
  const topLanguages = Array.from(stats.languages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang);
  console.log(chalk.gray('├── ') + chalk.cyan('Languages: ') + chalk.white(topLanguages.join(', ')));
  
  const topPatterns = Array.from(stats.patterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([pattern, count]) => `${pattern} (${count}×)`);
  console.log(chalk.gray('├── ') + chalk.cyan('Top Patterns: ') + chalk.white(topPatterns.join(', ')));
  
  console.log(chalk.gray('└── ') + chalk.cyan('Success Rate: ') + chalk.white.bold(`${stats.successRate.toFixed(1)}%`));

  // Recent activity table
  if (stats.recentActivity.length > 0) {
    console.log(chalk.bold('\n📈 Recent Activity (Last 7 Days)'));
    
    const table = new Table({
      head: ['Day', 'Project', 'Count', 'Success'],
      colWidths: [8, 20, 10, 12],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    stats.recentActivity.forEach(activity => {
      const dayName = format(new Date(activity.date), 'EEE');
      table.push([
        dayName,
        activity.project.substring(0, 18),
        activity.count.toString(),
        `${activity.successRate.toFixed(0)}%`
      ]);
    });

    console.log(table.toString());
  }

  // Growth trends
  console.log(chalk.bold('\n🎯 Growth Trends'));
  
  const patternMastery = Math.min((stats.patterns.size / 10) * 100, 100);
  const projectCoverage = Math.min((stats.projects.size / 5) * 100, 100);
  
  console.log('Patterns: ' + createProgressBar(patternMastery) + ` ${patternMastery.toFixed(0)}% mastery`);
  console.log('Projects: ' + createProgressBar(projectCoverage) + ` ${projectCoverage.toFixed(0)}% coverage`);
  console.log('Streak:   ' + createProgressBar(Math.min(stats.streak * 20, 100)) + ` ${stats.streak} days active`);

  // Footer
  console.log(chalk.gray('\n✨ Try: ') + chalk.yellow('claude-prompter suggest -t "next steps" --show-growth'));
}

function displayDetailedStats(stats: LearningStats): void {
  displayOverviewStats(stats);

  // Additional detailed sections
  console.log(chalk.bold('\n📚 Language Breakdown'));
  const langTable = new Table({
    head: ['Language', 'Sessions', 'Percentage'],
    colWidths: [20, 15, 15],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  Array.from(stats.languages.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([lang, count]) => {
      const percentage = ((count / stats.totalSessions) * 100).toFixed(1);
      langTable.push([lang, count.toString(), `${percentage}%`]);
    });

  console.log(langTable.toString());

  console.log(chalk.bold('\n🔧 Pattern Frequency'));
  const patternTable = new Table({
    head: ['Pattern', 'Count', 'Projects Used'],
    colWidths: [25, 10, 30],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  Array.from(stats.patterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([pattern, count]) => {
      patternTable.push([
        pattern,
        count.toString(),
        'Multiple projects'
      ]);
    });

  console.log(patternTable.toString());

  console.log(chalk.bold('\n📁 Project Distribution'));
  const projectTable = new Table({
    head: ['Project', 'Sessions', 'Last Active'],
    colWidths: [25, 15, 20],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  Array.from(stats.projects.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([project, count]) => {
      projectTable.push([
        project,
        count.toString(),
        'Recently'
      ]);
    });

  console.log(projectTable.toString());
}

/**
 * Creates an ASCII progress bar for terminal display
 * @param percentage - Progress percentage (0-100)
 * @returns Colored ASCII progress bar string
 */
function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 6.25);
  const empty = 16 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

/**
 * Displays sessions in a paginated table format
 * @param sessions - Array of session objects
 * @param options - Command options including pagination settings
 */
async function displaySessionsTable(sessions: any[], options: any): Promise<void> {
  const display = new PaginatedDisplay({
    showControls: true,
    showMetrics: false,
    showProgress: false,
    theme: 'default'
  });

  // Prepare session data for table display
  const tableData = sessions.map(session => ({
    id: session.metadata?.sessionId?.substring(0, 12) || 'unknown',
    project: session.metadata?.projectName || 'unknown',
    created: session.metadata?.createdDate ? 
      format(new Date(session.metadata.createdDate), 'MMM dd, yyyy') : 'unknown',
    status: session.metadata?.status || 'unknown',
    conversations: session.history?.length || 0,
    patterns: session.patterns?.length || 0,
    languages: session.languages?.join(', ') || 'none'
  }));

  const columns = [
    { 
      key: 'id' as keyof typeof tableData[0], 
      header: 'Session ID', 
      width: 15,
      formatter: (value: string) => chalk.gray(value)
    },
    { 
      key: 'project' as keyof typeof tableData[0], 
      header: 'Project', 
      width: 20,
      formatter: (value: string) => chalk.cyan(value)
    },
    { 
      key: 'created' as keyof typeof tableData[0], 
      header: 'Created', 
      width: 12,
      formatter: (value: string) => chalk.white(value)
    },
    { 
      key: 'status' as keyof typeof tableData[0], 
      header: 'Status', 
      width: 10,
      formatter: (value: string) => {
        switch (value) {
          case 'active': return chalk.green(value);
          case 'completed': return chalk.blue(value);
          case 'archived': return chalk.gray(value);
          default: return chalk.yellow(value);
        }
      }
    },
    { 
      key: 'conversations' as keyof typeof tableData[0], 
      header: 'Conv.', 
      width: 8,
      formatter: (value: number) => chalk.white(value.toString())
    },
    { 
      key: 'patterns' as keyof typeof tableData[0], 
      header: 'Patterns', 
      width: 10,
      formatter: (value: number) => chalk.yellow(value.toString())
    },
    { 
      key: 'languages' as keyof typeof tableData[0], 
      header: 'Languages', 
      width: 25,
      formatter: (value: string) => chalk.magenta(value)
    }
  ];

  const pageSize = parseInt(options.pageSize);
  const currentPage = Math.max(0, parseInt(options.page) - 1); // Convert to 0-based

  // Display table header
  console.log('\n' + boxen(
    chalk.green.bold('📊 Sessions Overview') + '\n' + 
    chalk.gray(`${tableData.length} total sessions${options.project ? ` (filtered by: ${options.project})` : ''}`),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      align: 'center'
    }
  ));

  // Display paginated table
  display.displayTable(tableData, columns, {
    pageSize,
    currentPage
  });

  // Display navigation commands
  const totalPages = Math.ceil(tableData.length / pageSize);
  
  if (totalPages > 1) {
    console.log('\n' + chalk.bold('📋 Navigation'));
    
    if (currentPage < totalPages - 1) {
      console.log(chalk.gray('├── ') + chalk.green('Next: ') + 
        chalk.yellow(`claude-prompter stats --sessions-table --page ${currentPage + 2} --page-size ${pageSize}`));
    }
    
    if (currentPage > 0) {
      console.log(chalk.gray('├── ') + chalk.green('Previous: ') + 
        chalk.yellow(`claude-prompter stats --sessions-table --page ${currentPage} --page-size ${pageSize}`));
    }
    
    console.log(chalk.gray('└── ') + chalk.blue('Regular view: ') + 
      chalk.yellow('claude-prompter stats'));
  }
}