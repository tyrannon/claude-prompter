import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import PatternChart from './charts/PatternChart';
import ProgressOverview from './ProgressOverview';
import TopicNetwork from './TopicNetwork';
import SessionTimeline from './SessionTimeline';
import SessionBrowser from './SessionBrowser';

interface LearningData {
  sessionCount: number;
  experienceLevel: string;
  totalQueries: number;
  successRate: number;
  avgQueriesPerSession: number;
  topPatterns: Array<{
    pattern: string;
    frequency: number;
    category: string;
  }>;
  growthMetrics: {
    weeklyGrowth: number;
    consistencyScore: number;
    diversityIndex: number;
  };
  topicEvolution: Array<{
    topic: string;
    date: string;
    frequency: number;
  }>;
  recentSessions: Array<{
    id: number;
    date: string;
    topic: string;
    intensity: number;
  }>;
  recentTopics?: string[];
  languages?: string[];
}

const Dashboard: React.FC = () => {
  const [learningData, setLearningData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'analytics' | 'sessions' | 'projects' | 'usage'>('analytics');

  useEffect(() => {
    const fetchLearningData = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching learning data from API...');
        
        const response = await fetch('http://localhost:3001/api/learning-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Learning data received:', data);
        
        setLearningData(data);
      } catch (error) {
        console.error('❌ Error fetching learning data:', error);
        
        // Fallback to mock data if API is not available
        const fallbackData: LearningData = {
          sessionCount: 0,
          experienceLevel: 'Getting Started',
          totalQueries: 0,
          successRate: 100,
          avgQueriesPerSession: 0,
          topPatterns: [],
          growthMetrics: {
            weeklyGrowth: 0,
            consistencyScore: 0,
            diversityIndex: 0
          },
          topicEvolution: [],
          recentSessions: [],
          recentTopics: ['Start using claude-prompter to see your learning data!'],
          languages: []
        };
        
        setLearningData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <h2>🌱 Analyzing your learning journey...</h2>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (!learningData) {
    return (
      <div className="dashboard-error">
        <h2>❌ Unable to load learning data</h2>
        <p>Please check your claude-prompter database connection.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🌱 Claude Prompter Learning Dashboard</h1>
        <div className="dashboard-nav">
          <button 
            className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            📊 Analytics
          </button>
          <button 
            className={`nav-item ${activeView === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveView('sessions')}
          >
            📚 Sessions
          </button>
          <button 
            className={`nav-item ${activeView === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveView('projects')}
          >
            🚀 Projects
          </button>
          <button 
            className={`nav-item ${activeView === 'usage' ? 'active' : ''}`}
            onClick={() => setActiveView('usage')}
          >
            💰 Usage
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {activeView === 'analytics' && (
          <div className="dashboard-grid">
            {/* Progress Overview Card */}
            <div className="dashboard-card">
              <ProgressOverview 
                sessionCount={learningData.sessionCount}
                experienceLevel={learningData.experienceLevel}
                recentTopics={learningData.recentTopics || []}
                languages={learningData.languages || []}
                totalQueries={learningData.totalQueries}
                successRate={learningData.successRate}
              />
            </div>

            {/* Pattern Mastery Chart */}
            <div className="dashboard-card">
              <h2>📈 Pattern Mastery</h2>
              <PatternChart patterns={learningData.topPatterns} />
            </div>

            {/* Topic Network Visualization */}
            <div className="dashboard-card full-width">
              <h2>🌐 Topic Evolution Network</h2>
              <TopicNetwork topics={learningData.recentTopics || []} />
            </div>

            {/* Session Timeline */}
            <div className="dashboard-card full-width">
              <h2>📅 Learning Timeline</h2>
              <SessionTimeline 
                sessionCount={learningData.sessionCount}
                recentSessions={learningData.recentSessions}
              />
            </div>

            {/* Growth Metrics */}
            <div className="dashboard-card">
              <h2>🚀 Growth Metrics</h2>
              <div className="growth-metrics">
                <div className="metric-item">
                  <span className="metric-label">Weekly Growth</span>
                  <span className="metric-value">{learningData.growthMetrics.weeklyGrowth}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Consistency Score</span>
                  <span className="metric-value">{learningData.growthMetrics.consistencyScore.toFixed(1)}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Diversity Index</span>
                  <span className="metric-value">{learningData.growthMetrics.diversityIndex.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="dashboard-card">
              <h2>🏆 Recent Achievements</h2>
              <div className="achievements">
                <div className="achievement-item">
                  <span className="achievement-icon">⭐</span>
                  <div className="achievement-text">
                    <strong>Top Pattern</strong>
                    <p>{learningData.topPatterns.length > 0 ? `${learningData.topPatterns[0].pattern} (${learningData.topPatterns[0].frequency}x)` : 'Start using patterns!'}</p>
                  </div>
                </div>
                <div className="achievement-item">
                  <span className="achievement-icon">🔥</span>
                  <div className="achievement-text">
                    <strong>Success Rate</strong>
                    <p>{learningData.successRate.toFixed(1)}% successful queries</p>
                  </div>
                </div>
                <div className="achievement-item">
                  <span className="achievement-icon">🌟</span>
                  <div className="achievement-text">
                    <strong>Experience Level</strong>
                    <p>{learningData.experienceLevel} ({learningData.sessionCount} sessions)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'sessions' && (
          <div className="dashboard-single-view">
            <SessionBrowser 
              onSessionSelect={(session) => {
                console.log('Selected session:', session);
                // TODO: Implement session details view
              }}
            />
          </div>
        )}

        {activeView === 'projects' && (
          <div className="dashboard-single-view">
            <div className="dashboard-card">
              <h2>🚀 Project Analytics</h2>
              <p>Coming soon! This will show learning insights for each project:</p>
              <ul>
                <li><strong>claude-prompter</strong>: Meta-learning about prompt engineering</li>
                <li><strong>stylemuse</strong>: UI/UX patterns and design evolution</li>
                <li><strong>codeagent</strong>: Code generation and automation patterns</li>
                <li><strong>Custom projects</strong>: Automatically detected project categories</li>
              </ul>
            </div>
          </div>
        )}

        {activeView === 'usage' && (
          <div className="dashboard-single-view">
            <div className="dashboard-card">
              <h2>💰 Usage Analytics</h2>
              <p>Coming soon! This will show detailed cost and usage metrics:</p>
              <ul>
                <li><strong>Token usage trends</strong>: Input/output token consumption over time</li>
                <li><strong>Cost breakdown</strong>: Daily/monthly spending with projections</li>
                <li><strong>Efficiency metrics</strong>: Cost per successful interaction</li>
                <li><strong>Resource optimization</strong>: Recommendations for better efficiency</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;