import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TokenCounter } from '../utils/tokenCounter';

export interface UsageRecord {
  command: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp?: string;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
}

export interface UsageReport {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageCostPerRequest: number;
  mostUsedCommand: string;
  records: UsageRecord[];
}

export class UsageManager {
  private usageDir: string;
  private tokenCounter: TokenCounter;
  
  constructor() {
    this.usageDir = path.join(os.homedir(), '.claude-prompter', 'usage');
    this.tokenCounter = new TokenCounter();
    fs.ensureDirSync(this.usageDir);
  }
  
  async record(usage: UsageRecord): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const file = path.join(this.usageDir, `${today}.json`);
    
    // Read existing or create new
    let records: UsageRecord[] = [];
    if (await fs.pathExists(file)) {
      try {
        records = await fs.readJson(file);
      } catch (error) {
        console.warn(`Failed to read usage file: ${file}`);
        records = [];
      }
    }
    
    // Calculate costs
    const costs = this.tokenCounter.estimateCost(
      usage.inputTokens, 
      usage.outputTokens, 
      usage.model
    );
    
    // Add record with timestamp and costs
    const record: UsageRecord = {
      ...usage,
      timestamp: new Date().toISOString(),
      inputCost: costs.inputCost,
      outputCost: costs.outputCost,
      totalCost: costs.totalCost
    };
    
    records.push(record);
    
    // Save atomically
    const tempFile = `${file}.tmp`;
    await fs.writeJson(tempFile, records, { spaces: 2 });
    await fs.move(tempFile, file, { overwrite: true });
  }
  
  async getReport(period: 'today' | 'week' | 'month' = 'today'): Promise<UsageReport> {
    const files = await this.getUsageFiles(period);
    const allRecords: UsageRecord[] = [];
    
    for (const file of files) {
      try {
        const records = await fs.readJson(file);
        allRecords.push(...records);
      } catch (error) {
        console.warn(`Failed to read usage file: ${file}`);
      }
    }
    
    return this.generateReport(allRecords);
  }
  
  private async getUsageFiles(period: 'today' | 'week' | 'month'): Promise<string[]> {
    const now = new Date();
    const files: string[] = [];
    
    if (period === 'today') {
      const today = now.toISOString().split('T')[0];
      const file = path.join(this.usageDir, `${today}.json`);
      if (await fs.pathExists(file)) {
        files.push(file);
      }
    } else if (period === 'week') {
      // Get last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const file = path.join(this.usageDir, `${dateStr}.json`);
        if (await fs.pathExists(file)) {
          files.push(file);
        }
      }
    } else if (period === 'month') {
      // Get current month
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        const file = path.join(this.usageDir, `${dateStr}.json`);
        if (await fs.pathExists(file)) {
          files.push(file);
        }
      }
    }
    
    return files;
  }
  
  private generateReport(records: UsageRecord[]): UsageReport {
    const totalRequests = records.length;
    const successfulRequests = records.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const totalTokens = records.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;
    
    // Find most used command
    const commandCounts = records.reduce((counts, r) => {
      counts[r.command] = (counts[r.command] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const mostUsedCommand = Object.entries(commandCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      totalCost,
      averageCostPerRequest,
      mostUsedCommand,
      records: records.sort((a, b) => 
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      )
    };
  }
  
  async setLimit(type: 'daily' | 'monthly', amount: number): Promise<void> {
    const limitsFile = path.join(this.usageDir, 'limits.json');
    let limits = {};
    
    if (await fs.pathExists(limitsFile)) {
      try {
        limits = await fs.readJson(limitsFile);
      } catch (error) {
        limits = {};
      }
    }
    
    limits[type] = amount;
    await fs.writeJson(limitsFile, limits, { spaces: 2 });
  }
  
  async checkLimits(): Promise<{ exceeded: boolean; message?: string }> {
    const limitsFile = path.join(this.usageDir, 'limits.json');
    
    if (!await fs.pathExists(limitsFile)) {
      return { exceeded: false };
    }
    
    try {
      const limits = await fs.readJson(limitsFile);
      const todayReport = await this.getReport('today');
      
      if (limits.daily && todayReport.totalCost > limits.daily) {
        return {
          exceeded: true,
          message: `Daily limit exceeded: $${todayReport.totalCost.toFixed(4)} > $${limits.daily}`
        };
      }
      
      if (limits.monthly) {
        const monthReport = await this.getReport('month');
        if (monthReport.totalCost > limits.monthly) {
          return {
            exceeded: true,
            message: `Monthly limit exceeded: $${monthReport.totalCost.toFixed(4)} > $${limits.monthly}`
          };
        }
      }
      
      return { exceeded: false };
    } catch (error) {
      console.warn('Failed to check limits');
      return { exceeded: false };
    }
  }
  
  dispose() {
    this.tokenCounter.dispose();
  }
}