import React, { useState, useEffect } from 'react';

interface UsageData {
  overview: {
    totalTokens: number;
    totalCost: number;
    totalSessions: number;
    avgCostPerSession: number;
    thisMonth: {
      tokens: number;
      cost: number;
      sessions: number;
    };
    lastMonth: {
      tokens: number;
      cost: number;
      sessions: number;
    };
  };
  dailyUsage: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    sessions: number;
  }>;
  costBreakdown: {
    byProject: Array<{
      project: string;
      tokens: number;
      cost: number;
      percentage: number;
    }>;
    byModel: Array<{
      model: string;
      tokens: number;
      cost: number;
      percentage: number;
    }>;
  };
  efficiency: {
    avgTokensPerQuery: number;
    avgCostPerQuery: number;
    successRate: number;
    avgResponseTime: number;
  };
  projections: {
    monthlyEstimate: number;
    yearlyEstimate: number;
    nextMonthPrediction: number;
  };
}

const UsageAnalytics: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    // Mock usage data - in real app, this would come from claude-prompter analytics
    const mockData: UsageData = {
      overview: {
        totalTokens: 1247683,
        totalCost: 12.47,
        totalSessions: 39,
        avgCostPerSession: 0.32,
        thisMonth: {
          tokens: 423891,
          cost: 4.24,
          sessions: 15
        },
        lastMonth: {
          tokens: 312456,
          cost: 3.12,
          sessions: 12
        }
      },
      dailyUsage: [
        { date: '2025-01-15', inputTokens: 12000, outputTokens: 8000, cost: 0.24, sessions: 2 },
        { date: '2025-01-16', inputTokens: 15000, outputTokens: 10000, cost: 0.30, sessions: 3 },
        { date: '2025-01-17', inputTokens: 18000, outputTokens: 12000, cost: 0.36, sessions: 2 },
        { date: '2025-01-18', inputTokens: 22000, outputTokens: 15000, cost: 0.44, sessions: 4 },
        { date: '2025-01-19', inputTokens: 16000, outputTokens: 11000, cost: 0.32, sessions: 3 },
        { date: '2025-01-20', inputTokens: 28000, outputTokens: 19000, cost: 0.56, sessions: 5 },
        { date: '2025-01-21', inputTokens: 31000, outputTokens: 21000, cost: 0.62, sessions: 6 },
        { date: '2025-01-22', inputTokens: 35000, outputTokens: 24000, cost: 0.70, sessions: 7 }
      ],
      costBreakdown: {
        byProject: [
          { project: 'claude-prompter', tokens: 547231, cost: 5.47, percentage: 44 },
          { project: 'stylemuse', tokens: 374297, cost: 3.74, percentage: 30 },
          { project: 'permitagent', tokens: 249738, cost: 2.50, percentage: 20 },
          { project: 'other', tokens: 76417, cost: 0.76, percentage: 6 }
        ],
        byModel: [
          { model: 'GPT-4o', tokens: 998146, cost: 9.98, percentage: 80 },
          { model: 'GPT-4o-mini', tokens: 249537, cost: 2.49, percentage: 20 }
        ]
      },
      efficiency: {
        avgTokensPerQuery: 3247,
        avgCostPerQuery: 0.032,
        successRate: 94.2,
        avgResponseTime: 1.8
      },
      projections: {
        monthlyEstimate: 6.80,
        yearlyEstimate: 81.60,
        nextMonthPrediction: 7.20
      }
    };

    setUsageData(mockData);
    setLoading(false);
  }, [timeRange]);

  if (loading) {
    return (
      <div className="usage-analytics-loading">
        <div className="loading-spinner"></div>
        <h3>💰 Analyzing usage data...</h3>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="usage-analytics-error">
        <h3>❌ Unable to load usage data</h3>
        <p>Please check your analytics connection.</p>
      </div>
    );
  }

  const growthRate = ((usageData.overview.thisMonth.cost - usageData.overview.lastMonth.cost) / usageData.overview.lastMonth.cost) * 100;

  return (
    <div className="usage-analytics">
      {/* Header */}
      <div className="usage-header">
        <h2>💰 Usage & Cost Analytics</h2>
        <div className="time-range-selector">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="usage-overview">
        <div className="usage-card primary">
          <div className="card-header">
            <h3>💸 Total Cost</h3>
            <span className="trend positive">
              +{growthRate.toFixed(1)}% vs last month
            </span>
          </div>
          <div className="card-value">
            <span className="main-value">${usageData.overview.totalCost.toFixed(2)}</span>
            <span className="sub-value">All time</span>
          </div>
          <div className="card-breakdown">
            <div className="breakdown-item">
              <span>This month: ${usageData.overview.thisMonth.cost.toFixed(2)}</span>
              <span>Last month: ${usageData.overview.lastMonth.cost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="usage-card">
          <div className="card-header">
            <h3>🔢 Total Tokens</h3>
          </div>
          <div className="card-value">
            <span className="main-value">{usageData.overview.totalTokens.toLocaleString()}</span>
            <span className="sub-value">Input + Output</span>
          </div>
          <div className="card-breakdown">
            <span>This month: {usageData.overview.thisMonth.tokens.toLocaleString()}</span>
          </div>
        </div>

        <div className="usage-card">
          <div className="card-header">
            <h3>📊 Sessions</h3>
          </div>
          <div className="card-value">
            <span className="main-value">{usageData.overview.totalSessions}</span>
            <span className="sub-value">Learning sessions</span>
          </div>
          <div className="card-breakdown">
            <span>Avg cost/session: ${usageData.overview.avgCostPerSession.toFixed(2)}</span>
          </div>
        </div>

        <div className="usage-card">
          <div className="card-header">
            <h3>⚡ Efficiency</h3>
          </div>
          <div className="card-value">
            <span className="main-value">{usageData.efficiency.successRate}%</span>
            <span className="sub-value">Success rate</span>
          </div>
          <div className="card-breakdown">
            <span>Avg: ${usageData.efficiency.avgCostPerQuery.toFixed(3)}/query</span>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="usage-analytics-grid">
        {/* Daily Usage Chart */}
        <div className="analytics-card daily-usage">
          <h4>📈 Daily Usage Trend</h4>
          <div className="usage-chart">
            <div className="chart-container">
              {usageData.dailyUsage.map((day, index) => {
                const maxCost = Math.max(...usageData.dailyUsage.map(d => d.cost));
                const height = (day.cost / maxCost) * 100;
                return (
                  <div key={index} className="chart-bar">
                    <div 
                      className="bar-fill"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: $${day.cost.toFixed(2)}`}
                    ></div>
                    <span className="bar-label">{day.date.slice(-2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cost Breakdown by Project */}
        <div className="analytics-card">
          <h4>🚀 Cost by Project</h4>
          <div className="breakdown-list">
            {usageData.costBreakdown.byProject.map((project, index) => (
              <div key={index} className="breakdown-item">
                <div className="item-header">
                  <span className="item-name">{project.project}</span>
                  <span className="item-value">${project.cost.toFixed(2)}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${project.percentage}%` }}
                  ></div>
                </div>
                <div className="item-details">
                  <span>{project.tokens.toLocaleString()} tokens</span>
                  <span>{project.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Usage */}
        <div className="analytics-card">
          <h4>🤖 Usage by Model</h4>
          <div className="model-usage">
            {usageData.costBreakdown.byModel.map((model, index) => (
              <div key={index} className="model-item">
                <div className="model-header">
                  <span className="model-name">{model.model}</span>
                  <span className="model-cost">${model.cost.toFixed(2)}</span>
                </div>
                <div className="model-bar">
                  <div 
                    className="model-fill"
                    style={{ width: `${model.percentage}%` }}
                  ></div>
                </div>
                <span className="model-percentage">{model.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="analytics-card">
          <h4>⚡ Efficiency Metrics</h4>
          <div className="efficiency-grid">
            <div className="efficiency-item">
              <span className="metric-label">Avg Tokens/Query</span>
              <span className="metric-value">{usageData.efficiency.avgTokensPerQuery.toLocaleString()}</span>
            </div>
            <div className="efficiency-item">
              <span className="metric-label">Avg Cost/Query</span>
              <span className="metric-value">${usageData.efficiency.avgCostPerQuery.toFixed(3)}</span>
            </div>
            <div className="efficiency-item">
              <span className="metric-label">Success Rate</span>
              <span className="metric-value">{usageData.efficiency.successRate}%</span>
            </div>
            <div className="efficiency-item">
              <span className="metric-label">Avg Response Time</span>
              <span className="metric-value">{usageData.efficiency.avgResponseTime}s</span>
            </div>
          </div>
        </div>

        {/* Cost Projections */}
        <div className="analytics-card projections">
          <h4>🔮 Cost Projections</h4>
          <div className="projections-list">
            <div className="projection-item">
              <span className="projection-label">Monthly Estimate</span>
              <span className="projection-value">${usageData.projections.monthlyEstimate.toFixed(2)}</span>
            </div>
            <div className="projection-item">
              <span className="projection-label">Yearly Estimate</span>
              <span className="projection-value">${usageData.projections.yearlyEstimate.toFixed(2)}</span>
            </div>
            <div className="projection-item highlight">
              <span className="projection-label">Next Month Prediction</span>
              <span className="projection-value">${usageData.projections.nextMonthPrediction.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="projection-insights">
            <h5>💡 Optimization Tips</h5>
            <ul>
              <li>🎯 Your success rate is excellent at {usageData.efficiency.successRate}%</li>
              <li>⚡ Consider using GPT-4o-mini for simpler queries to reduce costs</li>
              <li>📊 claude-prompter project is your highest usage - great learning investment!</li>
              <li>💰 Current trajectory: ${usageData.projections.yearlyEstimate.toFixed(2)}/year</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageAnalytics;