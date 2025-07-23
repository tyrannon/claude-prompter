/**
 * Migration command for transitioning from JSON files to SQLite database
 * Handles large session datasets (500+) with performance optimizations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { SQLiteSessionManager, MigrationProgress } from '../data/SQLiteSessionManager';
import ora from 'ora';
import { format } from 'date-fns';

export function createMigrateCommand(): Command {
  const command = new Command('migrate')
    .description('Migrate session data from JSON files to SQLite database for improved performance')
    .option('--to-sqlite', 'Migrate JSON sessions to SQLite database')
    .option('--batch-size <number>', 'Number of sessions to process per batch (default: 50)', '50')
    .option('--no-parallel', 'Disable parallel processing during migration')
    .option('--concurrency <number>', 'Number of concurrent operations (default: 5)', '5')
    .option('--no-backup', 'Skip creating backup of original files')
    .option('--cleanup', 'Delete JSON files after successful migration (use with caution!)')
    .option('--force', 'Force migration even if one has already been completed')
    .option('--dry-run', 'Show migration plan without executing')
    .option('--verbose', 'Enable detailed logging during migration')
    .option('--stats', 'Show current database statistics')
    .action(async (options) => {
      try {
        if (options.stats) {
          await showDatabaseStats();
          return;
        }

        if (!options.toSqlite && !options.dryRun) {
          console.log(boxen(
            chalk.yellow.bold('🚨 Migration Command Help\n\n') +
            chalk.white('Available migration options:\n') +
            chalk.cyan('  --to-sqlite   ') + chalk.gray('Migrate JSON sessions to SQLite\n') +
            chalk.cyan('  --stats       ') + chalk.gray('Show current database statistics\n') +
            chalk.cyan('  --dry-run     ') + chalk.gray('Preview migration without executing\n\n') +
            chalk.white('Example:\n') +
            chalk.yellow('  claude-prompter migrate --to-sqlite --verbose\n') +
            chalk.yellow('  claude-prompter migrate --stats'),
            {
              padding: 1,
              borderStyle: 'round',
              borderColor: 'yellow',
              align: 'left'
            }
          ));
          return;
        }

        if (options.toSqlite || options.dryRun) {
          await migrateSessions(options);
        }
      } catch (error) {
        console.error(boxen(
          chalk.red.bold('Migration Failed\n\n') +
          chalk.white(error instanceof Error ? error.message : String(error)),
          {
            padding: 1,
            borderStyle: 'double',
            borderColor: 'red'
          }
        ));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handles the main migration process from JSON to SQLite
 */
async function migrateSessions(options: any): Promise<void> {
  const migrationConfig = {
    batchSize: parseInt(options.batchSize),
    enableParallel: !options.noParallel,
    concurrencyLimit: parseInt(options.concurrency),
    createBackup: !options.noBackup,
    cleanupAfterMigration: options.cleanup,
    verbose: options.verbose
  };

  const sqliteManager = new SQLiteSessionManager(undefined, migrationConfig);

  if (options.dryRun) {
    await performDryRun(sqliteManager);
    return;
  }

  // Check for existing migration
  if (!options.force) {
    try {
      await sqliteManager.initialize();
      const existing = await (sqliteManager as any).getLastMigration();
      if (existing && existing.status === 'completed') {
        console.log(boxen(
          chalk.yellow.bold('⚠️  Migration Already Completed\n\n') +
          chalk.white(`Previous migration completed on: ${format(new Date(existing.end_time), 'PPpp')}\n`) +
          chalk.white(`Sessions migrated: ${existing.migrated_sessions}\n`) +
          chalk.white(`Failed: ${existing.failed_sessions}\n\n`) +
          chalk.gray('Use --force to re-run migration'),
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
          }
        ));
        return;
      }
    } catch (error) {
      // Database might not exist yet, continue with migration
    }
  }

  console.log(boxen(
    chalk.green.bold('🔄 SQLite Migration Starting\n\n') +
    chalk.white('Configuration:\n') +
    chalk.cyan(`  Batch Size: `) + chalk.white(migrationConfig.batchSize) + '\n' +
    chalk.cyan(`  Parallel Processing: `) + chalk.white(migrationConfig.enableParallel ? 'Enabled' : 'Disabled') + '\n' +
    chalk.cyan(`  Concurrency: `) + chalk.white(migrationConfig.concurrencyLimit) + '\n' +
    chalk.cyan(`  Create Backup: `) + chalk.white(migrationConfig.createBackup ? 'Yes' : 'No') + '\n' +
    chalk.cyan(`  Cleanup JSON: `) + chalk.white(migrationConfig.cleanupAfterMigration ? 'Yes' : 'No'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      align: 'left'
    }
  ));

  // Start migration with progress tracking
  let lastProgressUpdate = Date.now();
  const progressCallback = (progress: MigrationProgress) => {
    const now = Date.now();
    
    // Update progress every 2 seconds to avoid spam
    if (now - lastProgressUpdate > 2000) {
      const percentage = ((progress.migratedSessions + progress.failedSessions) / progress.totalSessions * 100).toFixed(1);
      const rate = progress.processingRate.toFixed(1);
      const eta = progress.estimatedTimeRemaining > 0 ? `${Math.round(progress.estimatedTimeRemaining)}s` : 'N/A';
      
      console.log(chalk.cyan(
        `Progress: ${percentage}% | ` +
        `Migrated: ${progress.migratedSessions}/${progress.totalSessions} | ` +
        `Rate: ${rate}/s | ` +
        `ETA: ${eta} | ` +
        `Batch: ${progress.currentBatch}/${progress.totalBatches}`
      ));
      
      if (progress.failedSessions > 0) {
        console.log(chalk.yellow(`Failed: ${progress.failedSessions} sessions`));
      }
      
      lastProgressUpdate = now;
    }
  };

  try {
    const result = await sqliteManager.migrateFromJSON(progressCallback);
    
    // Display final results
    console.log('\n' + boxen(
      chalk.green.bold('✅ Migration Completed Successfully\n\n') +
      chalk.white('Results:\n') +
      chalk.cyan(`  Total Sessions: `) + chalk.white.bold(result.totalSessions) + '\n' +
      chalk.cyan(`  Successfully Migrated: `) + chalk.green.bold(result.migratedSessions) + '\n' +
      chalk.cyan(`  Failed: `) + (result.failedSessions > 0 ? chalk.red.bold(result.failedSessions) : chalk.gray('0')) + '\n' +
      chalk.cyan(`  Processing Rate: `) + chalk.white(`${result.processingRate.toFixed(1)} sessions/second`) + '\n' +
      chalk.cyan(`  Total Time: `) + chalk.white(formatDuration(Date.now() - result.startTime.getTime())),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
        align: 'left'
      }
    ));

    // Show error summary if any
    if (result.errors.length > 0) {
      console.log('\n' + chalk.yellow.bold('⚠️  Migration Errors:'));
      result.errors.slice(0, 5).forEach(error => {
        console.log(chalk.gray(`  • ${error.sessionId}: ${error.error}`));
      });
      
      if (result.errors.length > 5) {
        console.log(chalk.gray(`  ... and ${result.errors.length - 5} more errors`));
      }
    }

    // Show next steps
    console.log('\n' + chalk.bold('🎯 Next Steps:'));
    console.log(chalk.cyan('  • ') + chalk.white('Test the new SQLite backend: ') + chalk.yellow('claude-prompter migrate --stats'));
    console.log(chalk.cyan('  • ') + chalk.white('View session analytics: ') + chalk.yellow('claude-prompter stats --detailed'));
    console.log(chalk.cyan('  • ') + chalk.white('Analyze patterns: ') + chalk.yellow('claude-prompter patterns --type all'));

  } catch (error) {
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await sqliteManager.close();
  }
}

/**
 * Performs a dry run to show migration plan without executing
 */
async function performDryRun(sqliteManager: SQLiteSessionManager): Promise<void> {
  console.log(boxen(
    chalk.blue.bold('🔍 Migration Dry Run\n\n') +
    chalk.white('Analyzing current session data...'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    }
  ));

  const spinner = ora('Scanning JSON sessions...').start();

  try {
    // Get session count without initializing SQLite
    const sessionManager = new (await import('../data/SessionManager')).SessionManager();
    const sessions = await sessionManager.getAllSessions();
    
    spinner.succeed('Session analysis completed');

    if (!sessions || sessions.length === 0) {
      console.log(boxen(
        chalk.yellow.bold('📭 No Sessions Found\n\n') +
        chalk.white('No JSON session files were found to migrate.\n') +
        chalk.gray('Start using claude-prompter to create sessions first.'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      ));
      return;
    }

    // Analyze session data
    const totalSize = sessions.reduce((sum, s) => sum + (s.metadata?.fileSize || 0), 0);
    const projects = [...new Set(sessions.map(s => s.metadata?.projectName).filter(Boolean))];
    const languages = [...new Set(sessions.flatMap(s => s.languages || []))];
    const conversationCount = sessions.reduce((sum, s) => sum + (s.history?.length || 0), 0);

    const config = sqliteManager.getConfig();
    const estimatedBatches = Math.ceil(sessions.length / config.batchSize);
    const estimatedTime = sessions.length / 10; // Rough estimate: 10 sessions per second

    console.log('\n' + boxen(
      chalk.blue.bold('📊 Migration Plan\n\n') +
      chalk.white('Current Data:\n') +
      chalk.cyan(`  Sessions: `) + chalk.white.bold(sessions.length) + '\n' +
      chalk.cyan(`  Total Conversations: `) + chalk.white(conversationCount) + '\n' +
      chalk.cyan(`  Projects: `) + chalk.white(projects.length) + ' (' + projects.slice(0, 3).join(', ') + (projects.length > 3 ? '...' : '') + ')\n' +
      chalk.cyan(`  Languages: `) + chalk.white(languages.join(', ')) + '\n' +
      chalk.cyan(`  Total Size: `) + chalk.white(formatBytes(totalSize)) + '\n\n' +
      chalk.white('Migration Strategy:\n') +
      chalk.cyan(`  Batch Size: `) + chalk.white(config.batchSize) + ' sessions\n' +
      chalk.cyan(`  Total Batches: `) + chalk.white(estimatedBatches) + '\n' +
      chalk.cyan(`  Estimated Time: `) + chalk.white(formatDuration(estimatedTime * 1000)) + '\n' +
      chalk.cyan(`  Parallel Processing: `) + chalk.white(config.enableParallel ? 'Enabled' : 'Disabled') + '\n' +
      chalk.cyan(`  Backup Creation: `) + chalk.white(config.createBackup ? 'Yes' : 'No'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        align: 'left'
      }
    ));

    console.log('\n' + chalk.bold('🚀 Ready to migrate!'));
    console.log(chalk.gray('Run: ') + chalk.yellow('claude-prompter migrate --to-sqlite') + chalk.gray(' to start migration'));

  } catch (error) {
    spinner.fail('Failed to analyze sessions');
    throw error;
  }
}

/**
 * Shows current database statistics
 */
async function showDatabaseStats(): Promise<void> {
  const sqliteManager = new SQLiteSessionManager();
  
  try {
    await sqliteManager.initialize();
    const stats = await sqliteManager.getStatistics();
    
    console.log(boxen(
      chalk.green.bold('📊 SQLite Database Statistics\n\n') +
      chalk.white('Overview:\n') +
      chalk.cyan(`  Total Sessions: `) + chalk.white.bold(stats.totalSessions) + '\n' +
      chalk.cyan(`  Total Conversations: `) + chalk.white.bold(stats.totalConversations) + '\n' +
      chalk.cyan(`  Average Conversations per Session: `) + 
        chalk.white((stats.totalSessions > 0 ? (stats.totalConversations / stats.totalSessions).toFixed(1) : '0')) + '\n\n' +
      chalk.white('Projects:\n') +
      Object.entries(stats.projectCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([project, count]) => chalk.cyan(`  ${project}: `) + chalk.white(count))
        .join('\n') +
      (Object.keys(stats.projectCounts).length > 5 ? '\n' + chalk.gray(`  ... and ${Object.keys(stats.projectCounts).length - 5} more`) : '') + '\n\n' +
      chalk.white('Session Status:\n') +
      Object.entries(stats.statusCounts)
        .map(([status, count]) => chalk.cyan(`  ${status}: `) + chalk.white(count))
        .join('\n'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
        align: 'left'
      }
    ));

  } catch (error) {
    console.log(boxen(
      chalk.yellow.bold('⚠️  Database Not Found\n\n') +
      chalk.white('SQLite database has not been created yet.\n') +
      chalk.gray('Run migration first: ') + chalk.yellow('claude-prompter migrate --to-sqlite'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    ));
  } finally {
    await sqliteManager.close();
  }
}

/**
 * Utility functions
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}