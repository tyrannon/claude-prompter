/**
 * Terminal-based paginated display utilities
 * Provides interactive pagination and streaming output for large datasets
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { PaginatedResult, StreamResult } from './StreamProcessor';

/**
 * Configuration for paginated display
 */
export interface DisplayConfig {
  /** Show pagination controls */
  showControls: boolean;
  /** Show performance metrics */
  showMetrics: boolean;
  /** Show progress indicators */
  showProgress: boolean;
  /** Maximum width for terminal output */
  maxWidth: number;
  /** Color theme */
  theme: 'default' | 'minimal' | 'compact';
}

/**
 * Navigation instructions for pagination
 */
export interface NavigationInfo {
  /** Command to go to next page */
  nextCommand?: string;
  /** Command to go to previous page */
  prevCommand?: string;
  /** Command to jump to specific page */
  jumpCommand?: string;
  /** Additional help text */
  helpText?: string;
}

/**
 * Terminal-based paginated display manager
 */
export class PaginatedDisplay {
  private config: DisplayConfig;

  constructor(config?: Partial<DisplayConfig>) {
    this.config = {
      showControls: true,
      showMetrics: false,
      showProgress: true,
      maxWidth: process.stdout.columns || 120,
      theme: 'default',
      ...config
    };
  }

  /**
   * Displays paginated results with navigation
   * @param result - Paginated result to display
   * @param formatter - Function to format individual items
   * @param navigation - Navigation information
   */
  displayPaginated<T>(
    result: PaginatedResult<T>,
    formatter: (items: T[]) => string,
    navigation?: NavigationInfo
  ): void {
    // Display header
    this.displayHeader(result);
    
    // Display items
    if (result.items.length > 0) {
      const formattedContent = formatter(result.items);
      console.log(formattedContent);
    } else {
      console.log(chalk.yellow('No items found on this page.'));
    }
    
    // Display pagination controls
    if (this.config.showControls) {
      this.displayPaginationControls(result, navigation);
    }
    
    // Display performance metrics
    if (this.config.showMetrics) {
      this.displayPerformanceMetrics(result.performance);
    }
  }

  /**
   * Displays streaming results with progress
   * @param result - Stream result to display
   * @param formatter - Function to format the results
   */
  displayStream<T>(
    result: StreamResult<T>,
    formatter: (items: T[]) => string
  ): void {
    // Display stream header
    this.displayStreamHeader(result);
    
    // Display items
    if (result.items.length > 0) {
      const formattedContent = formatter(result.items);
      console.log(formattedContent);
    } else {
      console.log(chalk.yellow('No items processed in stream.'));
    }
    
    // Display stream metrics
    this.displayStreamMetrics(result.metadata);
    
    // Display errors if any
    if (result.metadata.errors.length > 0) {
      this.displayStreamErrors(result.metadata.errors);
    }
  }

  /**
   * Creates a live progress indicator for streaming
   * @param totalItems - Total number of items to process
   * @returns Progress update function
   */
  createProgressIndicator(totalItems: number): (processed: number) => void {
    let lastUpdate = 0;
    const updateInterval = Math.max(1, Math.floor(totalItems / 50)); // Update every 2%
    
    return (processed: number) => {
      if (processed - lastUpdate >= updateInterval || processed === totalItems) {
        const percentage = Math.round((processed / totalItems) * 100);
        const progressBar = this.createProgressBar(percentage);
        
        // Clear line and write progress
        process.stdout.write('\r' + chalk.cyan('Processing: ') + progressBar + chalk.gray(` ${processed}/${totalItems}`));
        
        if (processed === totalItems) {
          process.stdout.write('\n');
        }
        
        lastUpdate = processed;
      }
    };
  }

  /**
   * Displays table with pagination support
   * @param data - Array of objects to display in table
   * @param columns - Column definitions
   * @param paginationConfig - Pagination configuration
   */
  displayTable<T extends Record<string, any>>(
    data: T[],
    columns: Array<{
      key: keyof T;
      header: string;
      width?: number;
      formatter?: (value: any) => string;
    }>,
    paginationConfig?: {
      pageSize: number;
      currentPage: number;
    }
  ): void {
    const { pageSize = 20, currentPage = 0 } = paginationConfig || {};
    
    // Paginate data
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, data.length);
    const pageData = data.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
      console.log(chalk.yellow('No data to display.'));
      return;
    }
    
    // Create table
    const table = new Table({
      head: columns.map(col => chalk.cyan(col.header)),
      colWidths: columns.map(col => col.width || undefined),
      style: {
        head: ['cyan'],
        border: ['gray']
      },
      wordWrap: true
    });
    
    // Add rows
    pageData.forEach(item => {
      const row = columns.map(col => {
        const value = item[col.key];
        const formatted = col.formatter ? col.formatter(value) : String(value || '');
        return formatted.length > 50 ? formatted.substring(0, 47) + '...' : formatted;
      });
      table.push(row);
    });
    
    console.log(table.toString());
    
    // Display pagination info for tables
    this.displayTablePagination(data.length, pageSize, currentPage);
  }

  /**
   * Displays header for paginated results
   */
  private displayHeader<T>(result: PaginatedResult<T>): void {
    const { pagination } = result;
    const title = `📄 Page ${pagination.currentPage + 1} of ${pagination.totalPages}`;
    const subtitle = `Showing ${result.items.length} of ${pagination.totalItems} items`;
    
    console.log('\n' + boxen(
      chalk.green.bold(title) + '\n' + chalk.gray(subtitle),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
        align: 'center'
      }
    ));
  }

  /**
   * Displays header for stream results
   */
  private displayStreamHeader<T>(result: StreamResult<T>): void {
    const { metadata } = result;
    const title = '🌊 Stream Processing Results';
    const subtitle = `Processed ${metadata.totalProcessed} items in ${metadata.chunksProcessed} chunks`;
    
    console.log('\n' + boxen(
      chalk.blue.bold(title) + '\n' + chalk.gray(subtitle),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        align: 'center'
      }
    ));
  }

  /**
   * Displays pagination controls and navigation
   */
  private displayPaginationControls<T>(
    result: PaginatedResult<T>,
    navigation?: NavigationInfo
  ): void {
    const { pagination } = result;
    
    console.log('\n' + chalk.bold('📋 Navigation'));
    
    // Page information
    console.log(chalk.gray('├── ') + chalk.cyan('Current Page: ') + chalk.white.bold(`${pagination.currentPage + 1}/${pagination.totalPages}`));
    console.log(chalk.gray('├── ') + chalk.cyan('Items per Page: ') + chalk.white(pagination.pageSize.toString()));
    console.log(chalk.gray('└── ') + chalk.cyan('Total Items: ') + chalk.white(pagination.totalItems.toString()));
    
    // Navigation commands
    if (navigation) {
      console.log('\n' + chalk.bold('🔗 Commands'));
      
      if (pagination.hasNextPage && navigation.nextCommand) {
        console.log(chalk.gray('├── ') + chalk.green('Next: ') + chalk.yellow(navigation.nextCommand));
      }
      
      if (pagination.hasPreviousPage && navigation.prevCommand) {
        console.log(chalk.gray('├── ') + chalk.green('Previous: ') + chalk.yellow(navigation.prevCommand));
      }
      
      if (navigation.jumpCommand) {
        console.log(chalk.gray('├── ') + chalk.green('Jump to Page: ') + chalk.yellow(navigation.jumpCommand.replace('<page>', 'N')));
      }
      
      if (navigation.helpText) {
        console.log(chalk.gray('└── ') + chalk.blue('Help: ') + chalk.gray(navigation.helpText));
      }
    }
  }

  /**
   * Displays performance metrics
   */
  private displayPerformanceMetrics(performance: {
    processingTime: number;
    itemsProcessed: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
  }): void {
    console.log('\n' + chalk.bold('⚡ Performance'));
    console.log(chalk.gray('├── ') + chalk.cyan('Processing Time: ') + chalk.white(`${performance.processingTime}ms`));
    console.log(chalk.gray('├── ') + chalk.cyan('Items Processed: ') + chalk.white(performance.itemsProcessed.toString()));
    console.log(chalk.gray('├── ') + chalk.cyan('Memory Usage: ') + chalk.white(this.formatBytes(performance.memoryUsage)));
    
    if (performance.cacheHits + performance.cacheMisses > 0) {
      const hitRate = ((performance.cacheHits / (performance.cacheHits + performance.cacheMisses)) * 100).toFixed(1);
      console.log(chalk.gray('└── ') + chalk.cyan('Cache Hit Rate: ') + chalk.white(`${hitRate}%`));
    }
  }

  /**
   * Displays stream processing metrics
   */
  private displayStreamMetrics(metadata: {
    totalProcessed: number;
    chunksProcessed: number;
    processingTime: number;
    averageChunkTime: number;
    memoryPeak: number;
  }): void {
    console.log('\n' + chalk.bold('📊 Stream Metrics'));
    console.log(chalk.gray('├── ') + chalk.cyan('Total Processed: ') + chalk.white(metadata.totalProcessed.toString()));
    console.log(chalk.gray('├── ') + chalk.cyan('Chunks: ') + chalk.white(metadata.chunksProcessed.toString()));
    console.log(chalk.gray('├── ') + chalk.cyan('Total Time: ') + chalk.white(`${metadata.processingTime}ms`));
    console.log(chalk.gray('├── ') + chalk.cyan('Avg Chunk Time: ') + chalk.white(`${metadata.averageChunkTime.toFixed(1)}ms`));
    console.log(chalk.gray('└── ') + chalk.cyan('Memory Peak: ') + chalk.white(this.formatBytes(metadata.memoryPeak)));
  }

  /**
   * Displays stream processing errors
   */
  private displayStreamErrors(errors: Array<{ chunk: number; error: string }>): void {
    console.log('\n' + chalk.bold.red('❌ Processing Errors'));
    
    errors.slice(0, 5).forEach((error, index) => {
      const prefix = index === errors.length - 1 ? '└──' : '├──';
      console.log(chalk.gray(prefix) + chalk.red(` Chunk ${error.chunk}: `) + chalk.yellow(error.error));
    });
    
    if (errors.length > 5) {
      console.log(chalk.gray('└── ') + chalk.yellow(`... and ${errors.length - 5} more errors`));
    }
  }

  /**
   * Displays table pagination information
   */
  private displayTablePagination(totalItems: number, pageSize: number, currentPage: number): void {
    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = currentPage * pageSize + 1;
    const endItem = Math.min((currentPage + 1) * pageSize, totalItems);
    
    console.log('\n' + chalk.gray(`Showing ${startItem}-${endItem} of ${totalItems} items (Page ${currentPage + 1}/${totalPages})`));
  }

  /**
   * Creates a progress bar string
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + chalk.white(` ${percentage}%`);
  }

  /**
   * Formats bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Reconfigures the display
   */
  reconfigure(newConfig: Partial<DisplayConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets current configuration
   */
  getConfig(): DisplayConfig {
    return { ...this.config };
  }
}