import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { SessionManager } from '../data/SessionManager';
import { format } from 'date-fns';

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
    .action(async (options) => {
      const sessionManager = new SessionManager();
      const sessions = await sessionManager.getAllSessions();

      if (sessions.length === 0) {
        console.log(chalk.yellow('No sessions found. Start using claude-prompter to build your learning history!'));
        return;
      }

      const stats = calculateStats(sessions, options.project);

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      if (options.detailed) {
        displayDetailedStats(stats);
      } else {
        displayOverviewStats(stats);
      }
    });

  return command;
}

function calculateStats(sessions: any[], projectFilter?: string): LearningStats {
  let filteredSessions = sessions;
  if (projectFilter) {
    filteredSessions = sessions.filter(s => s.metadata?.projectName?.toLowerCase() === projectFilter.toLowerCase());
  }

  const languages = new Map<string, number>();
  const patterns = new Map<string, number>();
  const projects = new Map<string, number>();
  const recentDays = new Map<string, { project: string; count: number; success: number }>();

  filteredSessions.forEach(session => {
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

function extractPatterns(session: any): string[] {
  const patterns: string[] = [];
  
  // Extract from conversation history
  if (session.history && session.history.length > 0) {
    const content = session.history.map((entry: any) => 
      `${entry.prompt || ''} ${entry.response || ''}`
    ).join(' ').toLowerCase();
    
    // Common patterns to look for
    const patternMap = {
      'async-await': /async|await|promise/g,
      'error-handling': /try|catch|error|exception/g,
      'testing': /test|jest|mocha|vitest|describe|it\(/g,
      'api-integration': /api|endpoint|http|axios|fetch/g,
      'authentication': /auth|jwt|token|login|session/g,
      'state-management': /state|redux|zustand|context/g,
      'component-patterns': /component|react|vue|angular/g,
      'database': /database|sql|mongo|postgres|query/g
    };

    Object.entries(patternMap).forEach(([pattern, regex]) => {
      if (content.match(regex)) {
        patterns.push(pattern);
      }
    });
  }

  return patterns;
}

function getExperienceLevel(sessionCount: number): string {
  if (sessionCount < 10) return 'Beginner';
  if (sessionCount < 25) return 'Intermediate';
  if (sessionCount < 50) return 'Experienced';
  if (sessionCount < 100) return 'Advanced';
  return 'Expert';
}

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

function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 6.25);
  const empty = 16 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}