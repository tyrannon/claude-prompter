import { Command } from 'commander';
import { SessionManager } from '../data/SessionManager';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { SmartInclusionEngine } from '../services/SmartInclusionEngine';
import { ContextAnalyzer } from '../services/ContextAnalyzer';

export function createSessionCommand(): Command {
  const session = new Command('session');
  session.description('Manage conversation sessions with context persistence');

  const sessionManager = new SessionManager();

  // Start a new session
  session
    .command('start')
    .description('Start a new session')
    .requiredOption('-p, --project <name>', 'Project name')
    .option('-d, --description <desc>', 'Session description')
    .action(async (options) => {
      const spinner = ora('Creating new session...').start();
      
      try {
        const newSession = await sessionManager.createSession(
          options.project,
          options.description
        );
        
        spinner.succeed(chalk.green('✓ Session created successfully!'));
        
        console.log('\n' + chalk.bold('Session Details:'));
        console.log(chalk.cyan('ID:'), newSession.metadata.sessionId);
        console.log(chalk.cyan('Project:'), newSession.metadata.projectName);
        console.log(chalk.cyan('Created:'), newSession.metadata.createdDate.toLocaleString());
        
        console.log('\n' + chalk.yellow('💡 Tip: Use this session ID with --use-session flag in other commands'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to create session'));
        console.error(error);
        process.exit(1);
      }
    });

  // List all sessions
  session
    .command('list')
    .description('List all sessions')
    .option('-a, --all', 'Show all sessions including archived')
    .action(async (options) => {
      const spinner = ora('Loading sessions...').start();
      
      try {
        const sessions = await sessionManager.listSessions();
        spinner.stop();
        
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found. Create one with "session start"'));
          return;
        }
        
        const table = new Table({
          head: ['ID', 'Project', 'Created', 'Last Accessed', 'Messages', 'Status'],
          style: { head: ['cyan'] }
        });
        
        sessions.forEach(session => {
          if (!options.all && session.status === 'archived') return;
          
          table.push([
            session.sessionId.substring(0, 20) + '...',
            session.projectName,
            new Date(session.createdDate).toLocaleDateString(),
            new Date(session.lastAccessed).toLocaleString(),
            session.conversationCount.toString(),
            session.status === 'active' 
              ? chalk.green(session.status) 
              : chalk.gray(session.status)
          ]);
        });
        
        console.log(table.toString());
      } catch (error) {
        spinner.fail(chalk.red('Failed to list sessions'));
        console.error(error);
        process.exit(1);
      }
    });

  // Load a specific session
  session
    .command('load <sessionId>')
    .description('Load and display a session')
    .option('-e, --export <format>', 'Export session (json|markdown)', 'markdown')
    .action(async (sessionId, options) => {
      const spinner = ora('Loading session...').start();
      
      try {
        const loadedSession = await sessionManager.loadSession(sessionId);
        
        if (!loadedSession) {
          spinner.fail(chalk.red(`Session ${sessionId} not found`));
          process.exit(1);
        }
        
        spinner.succeed('Session loaded');
        
        if (options.export) {
          const exported = await sessionManager.exportSession(sessionId, options.export);
          console.log(exported);
        } else {
          console.log('\n' + chalk.bold('Session Details:'));
          console.log(chalk.cyan('Project:'), loadedSession.metadata.projectName);
          console.log(chalk.cyan('Created:'), loadedSession.metadata.createdDate.toLocaleString());
          console.log(chalk.cyan('Messages:'), loadedSession.history.length);
          
          if (loadedSession.metadata.description) {
            console.log(chalk.cyan('Description:'), loadedSession.metadata.description);
          }
          
          if (loadedSession.context.trackedIssues && loadedSession.context.trackedIssues.length > 0) {
            console.log('\n' + chalk.bold('Tracked Issues:'));
            loadedSession.context.trackedIssues.forEach(issue => {
              const statusColor = issue.status === 'completed' ? 'green' : 
                                issue.status === 'in-progress' ? 'yellow' : 'gray';
              console.log(`  - ${issue.title} [${chalk[statusColor](issue.status)}]`);
            });
          }
          
          if (loadedSession.context.decisions && loadedSession.context.decisions.length > 0) {
            console.log('\n' + chalk.bold('Decisions:'));
            loadedSession.context.decisions.forEach(decision => {
              console.log(`  - ${chalk.bold(decision.decision)}: ${decision.rationale}`);
            });
          }
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to load session'));
        console.error(error);
        process.exit(1);
      }
    });

  // Search sessions
  session
    .command('search <query>')
    .description('Search through all sessions')
    .action(async (query) => {
      const spinner = ora('Searching sessions...').start();
      
      try {
        const results = await sessionManager.searchSessions(query);
        spinner.stop();
        
        if (results.length === 0) {
          console.log(chalk.yellow(`No sessions found matching "${query}"`));
          return;
        }
        
        console.log(chalk.green(`Found ${results.length} sessions matching "${query}":\n`));
        
        results.forEach(session => {
          console.log(chalk.bold(`${session.sessionId}`));
          console.log(`  Project: ${session.projectName}`);
          console.log(`  Last accessed: ${new Date(session.lastAccessed).toLocaleString()}`);
          console.log('');
        });
      } catch (error) {
        spinner.fail(chalk.red('Search failed'));
        console.error(error);
        process.exit(1);
      }
    });

  // Add context to current session
  session
    .command('context')
    .description('Update session context')
    .requiredOption('-s, --session <id>', 'Session ID')
    .option('-t, --topic <topic>', 'Set current topic')
    .option('-v, --variable <key=value>', 'Add context variable (can be used multiple times)', (val, prev) => {
      prev = prev || {};
      const [key, value] = val.split('=');
      prev[key] = value;
      return prev;
    }, {} as Record<string, any>)
    .action(async (options) => {
      const spinner = ora('Updating context...').start();
      
      try {
        const context: any = {};
        
        if (options.topic) context.currentTopic = options.topic;
        if (Object.keys(options.variable).length > 0) context.variables = options.variable;
        
        await sessionManager.updateContext(options.session, context);
        spinner.succeed(chalk.green('Context updated successfully'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to update context'));
        console.error(error);
        process.exit(1);
      }
    });

  // Add decision to session
  session
    .command('decision')
    .description('Record an architectural decision')
    .requiredOption('-s, --session <id>', 'Session ID')
    .action(async (options) => {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'decision',
          message: 'What decision was made?',
          validate: (input) => input.length > 0 || 'Decision cannot be empty'
        },
        {
          type: 'input',
          name: 'rationale',
          message: 'Why was this decision made?',
          validate: (input) => input.length > 0 || 'Rationale cannot be empty'
        },
        {
          type: 'input',
          name: 'files',
          message: 'Related files (comma-separated, optional):',
          default: ''
        }
      ]);
      
      const spinner = ora('Recording decision...').start();
      
      try {
        const relatedFiles = answers.files 
          ? answers.files.split(',').map((f: string) => f.trim()).filter(Boolean)
          : undefined;
          
        await sessionManager.addDecision(
          options.session,
          answers.decision,
          answers.rationale,
          relatedFiles
        );
        
        spinner.succeed(chalk.green('Decision recorded successfully'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to record decision'));
        console.error(error);
        process.exit(1);
      }
    });

  // Auto-context commands
  session
    .command('auto-context')
    .description('Configure and preview auto-context inclusion')
    .option('-e, --enable', 'Enable auto-context for new sessions')
    .option('-d, --disable', 'Disable auto-context')
    .option('-p, --preview <prompt>', 'Preview what context would be included')
    .option('-t, --threshold <value>', 'Set relevance threshold (0-1)', '0.7')
    .option('--max-tokens <tokens>', 'Maximum tokens for auto-context', '15000')
    .option('--strategy <type>', 'Inclusion strategy: conservative, balanced, aggressive', 'balanced')
    .action(async (options) => {
      if (options.enable) {
        console.log(chalk.green('✓ Auto-context enabled'));
        console.log(chalk.gray('Context from relevant past sessions will be automatically included'));
        return;
      }

      if (options.disable) {
        console.log(chalk.yellow('Auto-context disabled'));
        return;
      }

      if (options.preview) {
        const spinner = ora('Analyzing context...').start();
        
        try {
          const engine = new SmartInclusionEngine();
          const autoContext = await engine.buildAutoContext(options.preview, {
            maxTokens: parseInt(options.maxTokens),
            relevanceThreshold: parseFloat(options.threshold),
            strategy: options.strategy as any
          });

          spinner.succeed('Context analysis complete');

          // Display preview
          let report = chalk.bold('🧠 Auto-Context Preview\n\n');
          
          if (autoContext.metadata.sourceSessions.length === 0) {
            report += chalk.yellow('No relevant context found from previous sessions.');
          } else {
            report += chalk.cyan('Summary:\n');
            report += chalk.gray(autoContext.summary) + '\n\n';
            
            report += chalk.cyan('Source Sessions:\n');
            autoContext.metadata.sourceSessions.forEach(id => {
              report += chalk.gray(`  • ${id}\n`);
            });
            
            report += chalk.cyan(`\nToken Usage: `);
            report += chalk.yellow(`${autoContext.metadata.totalTokens.toLocaleString()} tokens\n`);
            
            report += chalk.cyan('Relevance Score: ');
            const score = (autoContext.metadata.relevanceScore * 100).toFixed(1);
            report += chalk.green(`${score}%\n`);
            
            if (autoContext.primary.length > 0) {
              report += chalk.cyan('\nPrimary Context Segments:\n');
              autoContext.primary.slice(0, 3).forEach(segment => {
                report += chalk.gray(`  • ${segment.metadata.source} (${segment.tokens} tokens)\n`);
                report += chalk.dim(`    Reason: ${segment.metadata.reason}\n`);
              });
            }
          }

          console.log(boxen(report, {
            title: '🧠 Auto-Context Analysis',
            titleAlignment: 'center',
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
          }));

        } catch (error) {
          spinner.fail('Context analysis failed');
          console.error(error);
        }
      }
    });

  // Search across sessions
  session
    .command('search')
    .description('Search across all sessions')
    .requiredOption('-q, --query <text>', 'Search query')
    .option('-l, --limit <n>', 'Maximum results', '10')
    .action(async (options) => {
      const spinner = ora('Searching sessions...').start();
      
      try {
        const analyzer = new ContextAnalyzer();
        const analysis = await analyzer.analyzeCurrentContext(options.query);
        const results = await analyzer.findRelevantSessions(analysis, {
          maxResults: parseInt(options.limit)
        });

        spinner.succeed(`Found ${results.length} relevant sessions`);

        if (results.length === 0) {
          console.log(chalk.yellow('No matching sessions found'));
          return;
        }

        const table = new Table({
          head: ['Session ID', 'Relevance', 'Topics', 'Snippet'],
          colWidths: [15, 12, 25, 50],
          wordWrap: true
        });

        results.forEach(result => {
          table.push([
            chalk.cyan(result.sessionId.substring(0, 12) + '...'),
            chalk.green((result.relevanceScore * 100).toFixed(1) + '%'),
            result.matchedTopics.join(', ') || 'N/A',
            chalk.gray(result.snippet.substring(0, 80) + '...')
          ]);
        });

        console.log(table.toString());
        
      } catch (error) {
        spinner.fail('Search failed');
        console.error(error);
      }
    });

  return session;
}