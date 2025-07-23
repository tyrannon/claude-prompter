/**
 * SQLite-based session manager for high-performance handling of large session datasets
 * Provides migration from JSON files to SQLite for 500+ sessions
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { SessionManager } from './SessionManager';

/**
 * Session data structure for SQLite storage
 */
export interface SQLiteSession {
  id: string;
  sessionId: string;
  projectName: string;
  createdDate: string;
  lastAccessed: string;
  status: string;
  description: string;
  conversationCount: number;
  languages: string; // JSON string
  patterns: string; // JSON string
  fileSize: number;
  tags: string; // JSON string
  sessionData: string; // Full session JSON data
}

/**
 * Migration configuration and progress tracking
 */
export interface MigrationConfig {
  /** Maximum sessions to migrate in one batch */
  batchSize: number;
  /** Enable parallel processing during migration */
  enableParallel: boolean;
  /** Number of concurrent operations */
  concurrencyLimit: number;
  /** Backup original files before migration */
  createBackup: boolean;
  /** Delete JSON files after successful migration */
  cleanupAfterMigration: boolean;
  /** Enable verbose logging during migration */
  verbose: boolean;
}

/**
 * Migration progress and statistics
 */
export interface MigrationProgress {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedTimeRemaining: number;
  processingRate: number; // sessions per second
  errors: Array<{ sessionId: string; error: string }>;
}

/**
 * High-performance SQLite session manager with migration capabilities
 */
export class SQLiteSessionManager {
  private db: Database | null = null;
  private dbPath: string;
  private sessionManager: SessionManager;
  private migrationConfig: MigrationConfig;

  constructor(
    dataDirectory: string = path.join(process.env.HOME || '~', '.claude-prompter'),
    config?: Partial<MigrationConfig>
  ) {
    this.dbPath = path.join(dataDirectory, 'sessions.db');
    this.sessionManager = new SessionManager();
    this.migrationConfig = {
      batchSize: 50,
      enableParallel: true,
      concurrencyLimit: 5,
      createBackup: true,
      cleanupAfterMigration: false, // Conservative default
      verbose: false,
      ...config
    };
  }

  /**
   * Initializes SQLite database with optimized schema
   */
  async initialize(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Create optimized schema with indexes
    await this.createTables();
    await this.createIndexes();
    await this.configureDatabase();
  }

  /**
   * Creates database tables with optimized schema
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        project_name TEXT,
        created_date TEXT NOT NULL,
        last_accessed TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        description TEXT,
        conversation_count INTEGER DEFAULT 0,
        languages TEXT, -- JSON array
        patterns TEXT, -- JSON array
        file_size INTEGER DEFAULT 0,
        tags TEXT, -- JSON array
        session_data TEXT NOT NULL, -- Full JSON data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        conversation_index INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
      );

      CREATE TABLE IF NOT EXISTS migration_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_sessions INTEGER,
        migrated_sessions INTEGER,
        failed_sessions INTEGER,
        status TEXT DEFAULT 'in_progress',
        error_log TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  /**
   * Creates database indexes for optimal query performance
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions (session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_name);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_date ON sessions (created_date);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed ON sessions (last_accessed);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations (session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations (timestamp);
      CREATE INDEX IF NOT EXISTS idx_migration_log_type ON migration_log (migration_type);
    `);
  }

  /**
   * Configures database for optimal performance
   */
  private async configureDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Optimize SQLite for performance
    await this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 10000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456; -- 256MB
    `);
  }

  /**
   * Migrates sessions from JSON files to SQLite database
   */
  async migrateFromJSON(
    progressCallback?: (progress: MigrationProgress) => void
  ): Promise<MigrationProgress> {
    const startTime = new Date();
    let spinner: Ora | null = null;

    if (!progressCallback) {
      spinner = ora('Initializing migration...').start();
    }

    try {
      await this.initialize();

      // Check if migration has already been completed
      const existingMigration = await this.getLastMigration();
      if (existingMigration && existingMigration.status === 'completed') {
        const message = 'Migration already completed. Use --force to re-migrate.';
        spinner?.succeed(message);
        throw new Error(message);
      }

      // Get all JSON sessions
      const jsonSessions = await this.sessionManager.getAllSessions();
      
      if (!jsonSessions || jsonSessions.length === 0) {
        const message = 'No JSON sessions found to migrate.';
        spinner?.succeed(message);
        return this.createEmptyProgress(startTime);
      }

      const totalBatches = Math.ceil(jsonSessions.length / this.migrationConfig.batchSize);
      
      // Log migration start
      const migrationId = await this.logMigrationStart(jsonSessions.length);

      const progress: MigrationProgress = {
        totalSessions: jsonSessions.length,
        migratedSessions: 0,
        failedSessions: 0,
        currentBatch: 0,
        totalBatches,
        startTime,
        estimatedTimeRemaining: 0,
        processingRate: 0,
        errors: []
      };

      spinner?.succeed('Migration initialized');
      spinner = progressCallback ? null : ora(`Migrating ${jsonSessions.length} sessions...`).start();

      // Create backup if requested
      if (this.migrationConfig.createBackup) {
        if (spinner) spinner.text = 'Creating backup...';
        await this.createBackup();
      }

      // Process sessions in batches
      for (let i = 0; i < jsonSessions.length; i += this.migrationConfig.batchSize) {
        const batch = jsonSessions.slice(i, i + this.migrationConfig.batchSize);
        progress.currentBatch = Math.floor(i / this.migrationConfig.batchSize) + 1;
        
        if (spinner) spinner.text = `Processing batch ${progress.currentBatch}/${totalBatches} (${batch.length} sessions)`;
        
        try {
          const batchResults = await this.migrateBatch(batch);
          progress.migratedSessions += batchResults.successful;
          progress.failedSessions += batchResults.failed;
          progress.errors.push(...batchResults.errors);
          
          // Update progress metrics
          const elapsed = Date.now() - startTime.getTime();
          progress.processingRate = progress.migratedSessions / (elapsed / 1000);
          const remaining = progress.totalSessions - progress.migratedSessions - progress.failedSessions;
          progress.estimatedTimeRemaining = remaining / Math.max(progress.processingRate, 0.1);
          
          progressCallback?.(progress);
          
        } catch (error) {
          progress.failedSessions += batch.length;
          progress.errors.push({
            sessionId: `batch-${progress.currentBatch}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Log migration completion
      await this.logMigrationComplete(migrationId, progress);

      // Cleanup if requested and migration was successful
      if (this.migrationConfig.cleanupAfterMigration && progress.failedSessions === 0) {
        if (spinner) spinner.text = 'Cleaning up JSON files...';
        await this.cleanupJSONFiles(jsonSessions);
      }

      const successMessage = `Migration completed: ${progress.migratedSessions}/${progress.totalSessions} sessions migrated`;
      spinner?.succeed(successMessage);

      return progress;

    } catch (error) {
      const errorMessage = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
      spinner?.fail(errorMessage);
      throw error;
    }
  }

  /**
   * Migrates a batch of sessions with error handling
   */
  private async migrateBatch(sessions: any[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ sessionId: string; error: string }>;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let successful = 0;
    let failed = 0;
    const errors: Array<{ sessionId: string; error: string }> = [];

    // Begin transaction for batch
    await this.db.run('BEGIN TRANSACTION');

    try {
      for (const session of sessions) {
        try {
          await this.insertSession(session);
          successful++;
        } catch (error) {
          failed++;
          errors.push({
            sessionId: session.metadata?.sessionId || 'unknown',
            error: error instanceof Error ? error.message : String(error)
          });
          
          if (this.migrationConfig.verbose) {
            console.warn(chalk.yellow(`Failed to migrate session ${session.metadata?.sessionId}: ${error}`));
          }
        }
      }

      await this.db.run('COMMIT');

    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }

    return { successful, failed, errors };
  }

  /**
   * Inserts a single session into SQLite database
   */
  private async insertSession(session: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const metadata = session.metadata || {};
    const history = session.history || [];

    // Insert main session record
    await this.db.run(`
      INSERT OR REPLACE INTO sessions (
        session_id, project_name, created_date, last_accessed, status,
        description, conversation_count, languages, patterns, file_size,
        tags, session_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      metadata.sessionId || 'unknown',
      metadata.projectName || null,
      metadata.createdDate || new Date().toISOString(),
      metadata.lastAccessed || new Date().toISOString(),
      metadata.status || 'active',
      metadata.description || null,
      history.length,
      JSON.stringify(session.languages || []),
      JSON.stringify(session.patterns || []),
      metadata.fileSize || 0,
      JSON.stringify(metadata.tags || []),
      JSON.stringify(session)
    ]);

    // Insert conversation history
    for (let i = 0; i < history.length; i++) {
      const conversation = history[i];
      await this.db.run(`
        INSERT INTO conversations (
          session_id, conversation_index, timestamp, prompt, response, model
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        metadata.sessionId,
        i,
        conversation.timestamp || new Date().toISOString(),
        conversation.prompt || '',
        conversation.response || null,
        conversation.model || null
      ]);
    }
  }

  /**
   * Creates backup of JSON session files
   */
  private async createBackup(): Promise<void> {
    const backupDir = path.join(path.dirname(this.dbPath), 'backup-sessions');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `sessions-${timestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    const sessionsDir = path.join(path.dirname(this.dbPath), 'sessions');
    
    try {
      const files = await fs.readdir(sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sourcePath = path.join(sessionsDir, file);
          const destPath = path.join(backupPath, file);
          await fs.copyFile(sourcePath, destPath);
        }
      }
    } catch (error) {
      // Sessions directory might not exist
      console.warn(chalk.yellow('No sessions directory found for backup'));
    }
  }

  /**
   * Cleans up JSON files after successful migration
   */
  private async cleanupJSONFiles(sessions: any[]): Promise<void> {
    const sessionsDir = path.join(path.dirname(this.dbPath), 'sessions');
    
    for (const session of sessions) {
      const sessionId = session.metadata?.sessionId;
      if (sessionId) {
        const filePath = path.join(sessionsDir, `${sessionId}.json`);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist or be inaccessible
          if (this.migrationConfig.verbose) {
            console.warn(chalk.yellow(`Failed to delete ${filePath}: ${error}`));
          }
        }
      }
    }
  }

  /**
   * Retrieves sessions from SQLite with advanced querying capabilities
   */
  async getSessions(options: {
    projectName?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
    orderBy?: 'created_date' | 'last_accessed' | 'conversation_count';
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<any[]> {
    if (!this.db) await this.initialize();

    const {
      projectName,
      status,
      dateRange,
      limit = 100,
      offset = 0,
      orderBy = 'last_accessed',
      orderDirection = 'DESC'
    } = options;

    let query = 'SELECT session_data FROM sessions WHERE 1=1';
    const params: any[] = [];

    if (projectName) {
      query += ' AND project_name = ?';
      params.push(projectName);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (dateRange) {
      query += ' AND created_date BETWEEN ? AND ?';
      params.push(dateRange.start.toISOString(), dateRange.end.toISOString());
    }

    query += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await this.db!.all(query, params);
    return rows.map(row => JSON.parse(row.session_data));
  }

  /**
   * Gets session statistics from SQLite
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    totalConversations: number;
    projectCounts: Record<string, number>;
    languageCounts: Record<string, number>;
    patternCounts: Record<string, number>;
    statusCounts: Record<string, number>;
  }> {
    if (!this.db) await this.initialize();

    const stats = await this.db!.get(`
      SELECT 
        COUNT(*) as totalSessions,
        SUM(conversation_count) as totalConversations
      FROM sessions
    `);

    const projects = await this.db!.all(`
      SELECT project_name, COUNT(*) as count 
      FROM sessions 
      WHERE project_name IS NOT NULL 
      GROUP BY project_name
    `);

    const statuses = await this.db!.all(`
      SELECT status, COUNT(*) as count 
      FROM sessions 
      GROUP BY status
    `);

    return {
      totalSessions: stats.totalSessions || 0,
      totalConversations: stats.totalConversations || 0,
      projectCounts: Object.fromEntries(projects.map(p => [p.project_name, p.count])),
      languageCounts: {}, // TODO: Parse JSON fields
      patternCounts: {}, // TODO: Parse JSON fields
      statusCounts: Object.fromEntries(statuses.map(s => [s.status, s.count]))
    };
  }

  /**
   * Migration logging and tracking
   */
  private async logMigrationStart(totalSessions: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.run(`
      INSERT INTO migration_log (migration_type, start_time, total_sessions)
      VALUES ('json_to_sqlite', ?, ?)
    `, [new Date().toISOString(), totalSessions]);

    return result.lastID!;
  }

  private async logMigrationComplete(migrationId: number, progress: MigrationProgress): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      UPDATE migration_log 
      SET end_time = ?, migrated_sessions = ?, failed_sessions = ?, status = ?, error_log = ?
      WHERE id = ?
    `, [
      new Date().toISOString(),
      progress.migratedSessions,
      progress.failedSessions,
      progress.failedSessions === 0 ? 'completed' : 'completed_with_errors',
      JSON.stringify(progress.errors),
      migrationId
    ]);
  }

  private async getLastMigration(): Promise<any> {
    if (!this.db) return null;

    return await this.db.get(`
      SELECT * FROM migration_log 
      WHERE migration_type = 'json_to_sqlite' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
  }

  private createEmptyProgress(startTime: Date): MigrationProgress {
    return {
      totalSessions: 0,
      migratedSessions: 0,
      failedSessions: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime,
      estimatedTimeRemaining: 0,
      processingRate: 0,
      errors: []
    };
  }

  /**
   * Closes database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Gets current configuration
   */
  getConfig(): MigrationConfig {
    return { ...this.migrationConfig };
  }

  /**
   * Updates migration configuration
   */
  updateConfig(config: Partial<MigrationConfig>): void {
    this.migrationConfig = { ...this.migrationConfig, ...config };
  }
}