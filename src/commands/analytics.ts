/**
 * Analytics command for viewing performance metrics and insights
 */

import { Command } from 'commander';
import { PerformanceTracker } from '../metrics/PerformanceMetrics';
import chalk from 'chalk';
import Table from 'cli-table3';

export function createAnalyticsCommand(): Command {
  const analytics = new Command('analytics')
    .alias('stats')
    .description('View performance metrics and analytics')
    .option('--summary', 'Show summary statistics')
    .option('--trends', 'Show performance trends')
    .option('--costs', 'Show cost analysis')
    .option('--quality', 'Show quality insights')
    .option('--days <number>', 'Limit analysis to last N days', '7')
    .option('--format <format>', 'Output format (table, json)', 'table')
    .option('--export', 'Export all data to file')
    .action(async (options) => {
      const tracker = new PerformanceTracker();
      
      try {
        await tracker.loadHistoricalMetrics();
        
        const days = parseInt(options.days) || 7;
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (days * 24 * 60 * 60 * 1000));
        const timeRange = { start: startTime, end: endTime };
        
        console.log(chalk.cyan(`\n📊 ClaudePrompter Analytics (Last ${days} days)\n`));
        
        if (options.summary || (!options.trends && !options.costs && !options.quality)) {
          await showSummary(tracker, timeRange, options.format);
        }
        
        if (options.trends) {
          await showTrends(tracker, options.format);
        }
        
        if (options.costs) {
          await showCostAnalysis(tracker, timeRange, options.format);
        }
        
        if (options.quality) {
          await showQualityInsights(tracker, options.format);
        }
        
        if (options.export) {
          await exportData(tracker, options.format);
        }
        
      } catch (error) {
        console.error(chalk.red('Failed to load analytics:'), error);
        process.exit(1);
      }
    });

  return analytics;
}

async function showSummary(tracker: PerformanceTracker, timeRange: { start: Date; end: Date }, format: string) {
  const summary = tracker.getPerformanceSummary(timeRange);
  
  if (format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  
  console.log(chalk.yellow('📈 Performance Summary'));
  console.log('─'.repeat(50));
  
  const summaryTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [25, 25]
  });
  
  summaryTable.push(
    ['Total Runs', summary.totalRuns.toString()],
    ['Total Cost', `$${summary.totalCost.toFixed(4)}`],
    ['Avg Response Time', `${summary.avgResponseTime.toFixed(0)}ms`],
    ['Avg Quality Score', summary.avgQualityScore > 0 ? `${summary.avgQualityScore.toFixed(1)}/10` : 'N/A'],
    ['Success Rate', `${(summary.successRate * 100).toFixed(1)}%`]
  );
  
  console.log(summaryTable.toString());
  
  if (summary.topModels.length > 0) {
    console.log(chalk.yellow('\n🏆 Top Models'));
    console.log('─'.repeat(50));
    
    const modelsTable = new Table({
      head: ['Model', 'Usage', 'Avg Quality'],
      colWidths: [30, 10, 15]
    });
    
    summary.topModels.forEach(model => {
      modelsTable.push([
        model.model,
        model.usage.toString(),
        model.avgScore > 0 ? `${model.avgScore.toFixed(1)}/10` : 'N/A'
      ]);
    });
    
    console.log(modelsTable.toString());
  }
}

async function showTrends(tracker: PerformanceTracker, _format: string) {
  console.log(chalk.yellow('\n📊 Performance Trends'));
  console.log('─'.repeat(50));
  
  const metrics = ['cost', 'responseTime', 'qualityScore', 'successRate'];
  const trendsTable = new Table({
    head: ['Metric', 'Trend', 'Change', 'Status'],
    colWidths: [15, 12, 12, 20]
  });
  
  for (const metric of metrics) {
    const trend = tracker.getTrends(metric as any, 'day');
    if (trend) {
      const trendEmoji = trend.trend === 'improving' ? '📈' : 
                        trend.trend === 'declining' ? '📉' : '➡️';
      const changeDisplay = `${trend.changePercentage > 0 ? '+' : ''}${trend.changePercentage.toFixed(1)}%`;
      
      trendsTable.push([
        metric,
        `${trendEmoji} ${trend.trend}`,
        changeDisplay,
        trend.dataPoints.length > 0 ? `${trend.dataPoints.length} data points` : 'No data'
      ]);
    }
  }
  
  console.log(trendsTable.toString());
}

async function showCostAnalysis(tracker: PerformanceTracker, timeRange: { start: Date; end: Date }, format: string) {
  const costAnalysis = tracker.analyzeCostEfficiency(timeRange);
  
  if (format === 'json') {
    console.log(JSON.stringify({
      totalSpent: costAnalysis.totalSpent,
      avgCostPerRequest: costAnalysis.avgCostPerRequest,
      projectedMonthlyCost: costAnalysis.projectedMonthlyCost,
      costSavingsVsBaseline: costAnalysis.costSavingsVsBaseline,
      costByModel: Object.fromEntries(costAnalysis.costByModel)
    }, null, 2));
    return;
  }
  
  console.log(chalk.yellow('\n💰 Cost Analysis'));
  console.log('─'.repeat(50));
  
  const costTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [25, 25]
  });
  
  costTable.push(
    ['Total Spent', `$${costAnalysis.totalSpent.toFixed(4)}`],
    ['Avg Cost/Request', `$${costAnalysis.avgCostPerRequest.toFixed(4)}`],
    ['Projected Monthly', `$${costAnalysis.projectedMonthlyCost.toFixed(2)}`],
    ['Savings vs Baseline', `$${costAnalysis.costSavingsVsBaseline.toFixed(4)}`]
  );
  
  console.log(costTable.toString());
  
  if (costAnalysis.costByModel.size > 0) {
    console.log(chalk.yellow('\n💸 Cost by Model'));
    console.log('─'.repeat(50));
    
    const modelCostTable = new Table({
      head: ['Model', 'Total Cost', 'Percentage'],
      colWidths: [30, 12, 12]
    });
    
    const sortedModels = Array.from(costAnalysis.costByModel.entries())
      .sort(([, a], [, b]) => b - a);
    
    for (const [model, cost] of sortedModels) {
      const percentage = costAnalysis.totalSpent > 0 ? 
        ((cost / costAnalysis.totalSpent) * 100).toFixed(1) : '0';
      
      modelCostTable.push([
        model,
        `$${cost.toFixed(4)}`,
        `${percentage}%`
      ]);
    }
    
    console.log(modelCostTable.toString());
  }
  
  if (costAnalysis.recommendations.length > 0) {
    console.log(chalk.yellow('\n💡 Cost Optimization Recommendations'));
    console.log('─'.repeat(50));
    costAnalysis.recommendations.forEach(rec => {
      console.log(chalk.green(`• ${rec}`));
    });
  }
}

async function showQualityInsights(tracker: PerformanceTracker, format: string) {
  const insights = tracker.getQualityInsights();
  
  if (format === 'json') {
    console.log(JSON.stringify({
      avgQualityByModel: Object.fromEntries(insights.avgQualityByModel),
      recommendations: insights.recommendations
    }, null, 2));
    return;
  }
  
  console.log(chalk.yellow('\n🎯 Quality Insights'));
  console.log('─'.repeat(50));
  
  if (insights.avgQualityByModel.size > 0) {
    const qualityTable = new Table({
      head: ['Model', 'Avg Quality', 'Rating'],
      colWidths: [30, 12, 15]
    });
    
    const sortedModels = Array.from(insights.avgQualityByModel.entries())
      .sort(([, a], [, b]) => b - a);
    
    for (const [model, quality] of sortedModels) {
      const stars = '★'.repeat(Math.round(quality / 2)) + '☆'.repeat(5 - Math.round(quality / 2));
      qualityTable.push([
        model,
        `${quality.toFixed(1)}/10`,
        stars
      ]);
    }
    
    console.log(qualityTable.toString());
  }
  
  if (insights.recommendations.length > 0) {
    console.log(chalk.yellow('\n🚀 Quality Recommendations'));
    console.log('─'.repeat(50));
    insights.recommendations.forEach(rec => {
      console.log(chalk.green(`• ${rec}`));
    });
  }
}

async function exportData(tracker: PerformanceTracker, format: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `claude-prompter-analytics-${timestamp}.${format === 'json' ? 'json' : 'csv'}`;
  
  const exportData = tracker.exportMetrics(format as 'json' | 'csv');
  
  const fs = await import('fs/promises');
  
  try {
    await fs.writeFile(filename, exportData);
    console.log(chalk.green(`\n📁 Analytics exported to: ${filename}`));
  } catch (error) {
    console.error(chalk.red('Failed to export analytics:'), error);
  }
}