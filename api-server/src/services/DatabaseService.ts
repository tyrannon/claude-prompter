export interface UsageRecord {
  id?: number;
  timestamp?: string;
  command: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  inputCost?: number;
  outputCost?: number;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
  batchId?: string;
  sessionId?: string;
  metadata?: any;
}

export interface UsageReport {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byCommand: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  hourlyDistribution?: number[];
  successRate: number;
}

export class DatabaseService {
  constructor() {
    console.log('📁 DatabaseService initialized with mock data');
  }

  // Get usage report for analytics (mock data for now)
  async getUsageReport(period: 'today' | 'month' | 'custom', startDate?: string, endDate?: string): Promise<UsageReport> {
    return {
      totalRequests: 127,
      totalTokens: 45230,
      totalCost: 0.23,
      byCommand: {
        'suggest': { requests: 45, tokens: 15000, cost: 0.08 },
        'prompt': { requests: 62, tokens: 20000, cost: 0.10 },
        'batch': { requests: 20, tokens: 10230, cost: 0.05 }
      },
      hourlyDistribution: Array.from({ length: 24 }, (_, i) => Math.floor(Math.random() * 10)),
      successRate: 94.5
    };
  }

  // Get command frequency analysis (mock data)
  getCommandFrequency(limit: number = 10): Array<{ command: string; count: number; lastUsed: string }> {
    return [
      { command: 'suggest', count: 45, lastUsed: new Date().toISOString() },
      { command: 'prompt', count: 62, lastUsed: new Date().toISOString() },
      { command: 'batch', count: 20, lastUsed: new Date().toISOString() }
    ];
  }

  // Get usage patterns over time (mock data)
  getUsagePatterns(days: number = 30): Array<{ date: string; requests: number; totalCost: number }> {
    const patterns = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      patterns.push({
        date: date.toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 20) + 5,
        totalCost: Math.random() * 0.05 + 0.01
      });
    }
    return patterns.reverse();
  }

  // Get recent usage records (mock data)
  getRecentUsage(limit: number = 50): UsageRecord[] {
    const records = [];
    const commands = ['suggest', 'prompt', 'batch', 'session'];
    
    for (let i = 0; i < Math.min(limit, 50); i++) {
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - i * 5);
      
      records.push({
        id: i + 1,
        timestamp: timestamp.toISOString(),
        command: commands[Math.floor(Math.random() * commands.length)],
        model: 'gpt-4o',
        inputTokens: Math.floor(Math.random() * 1000) + 100,
        outputTokens: Math.floor(Math.random() * 500) + 50,
        inputCost: Math.random() * 0.01,
        outputCost: Math.random() * 0.005,
        success: Math.random() > 0.1,
        durationMs: Math.floor(Math.random() * 3000) + 500,
        sessionId: `session-${Math.floor(Math.random() * 10) + 1}`
      });
    }
    
    return records;
  }

  // Get session-based usage analytics (mock data)
  getSessionAnalytics(): Array<{ sessionId: string; requests: number; totalCost: number; firstRequest: string; lastRequest: string }> {
    const sessions = [];
    for (let i = 1; i <= 10; i++) {
      const firstRequest = new Date();
      firstRequest.setHours(firstRequest.getHours() - Math.floor(Math.random() * 24));
      
      const lastRequest = new Date(firstRequest);
      lastRequest.setMinutes(lastRequest.getMinutes() + Math.floor(Math.random() * 120));
      
      sessions.push({
        sessionId: `session-${i}`,
        requests: Math.floor(Math.random() * 15) + 3,
        totalCost: Math.random() * 0.08 + 0.02,
        firstRequest: firstRequest.toISOString(),
        lastRequest: lastRequest.toISOString()
      });
    }
    return sessions;
  }

  // Get error analysis (mock data)
  getErrorAnalysis(): Array<{ command: string; errorCount: number; totalCount: number; errorRate: number; commonErrors: string[] }> {
    return [
      {
        command: 'suggest',
        errorCount: 3,
        totalCount: 45,
        errorRate: 6.7,
        commonErrors: ['Rate limit exceeded', 'Network timeout']
      },
      {
        command: 'batch',
        errorCount: 2,
        totalCount: 20,
        errorRate: 10.0,
        commonErrors: ['Invalid batch format']
      }
    ];
  }

  // Get cost trends (mock data)
  getCostTrends(days: number = 7): Array<{ date: string; cost: number; tokens: number }> {
    const trends = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        cost: Math.random() * 0.05 + 0.01,
        tokens: Math.floor(Math.random() * 5000) + 1000
      });
    }
    return trends.reverse();
  }

  // Close database connection (no-op for mock)
  close(): void {
    console.log('📁 DatabaseService closed');
  }
}