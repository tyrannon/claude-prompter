import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import PatternChart from './charts/PatternChart';
import ProgressOverview from './ProgressOverview';
import TopicNetwork from './TopicNetwork';
import SessionTimeline from './SessionTimeline';
import SessionBrowser from './SessionBrowser';
import GalaxyScene from './galaxy/GalaxyScene';
import ProjectAnalytics from './ProjectAnalytics';
import UsageAnalytics from './UsageAnalytics';
import HeroThemeProvider, { useHeroTheme } from './HeroTheme';
import SessionDetailsModal from './SessionDetailsModal';
import ProjectSuggestions from './ProjectSuggestions';

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

const DashboardInner: React.FC = () => {
  const [learningData, setLearningData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'analytics' | 'sessions' | 'projects' | 'usage' | 'galaxy' | 'training'>('analytics');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const { currentTheme, setTheme, isHeroMode, getRandomCatchphrase } = useHeroTheme();

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

  const openSessionDetails = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const closeSessionDetails = () => {
    setSelectedSessionId(null);
    setIsSessionModalOpen(false);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className={isHeroMode() ? "hero-loading" : "loading-spinner"}>
          {isHeroMode() ? "💪" : ""}
        </div>
        <h2>
          {isHeroMode() ? 
            "⚡ ANALYZING YOUR HERO TRAINING JOURNEY... ⚡" : 
            "🌱 Analyzing your learning journey..."
          }
        </h2>
        <p>{isHeroMode() ? "CHANNELING HERO POWER..." : "Loading analytics data..."}</p>
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
      {/* Hero Theme Toggle */}
      <button 
        className="hero-theme-toggle"
        onClick={() => setTheme(currentTheme.mode === 'allmight' ? 'default' : 'allmight')}
        title={isHeroMode() ? 'Switch to Default Mode' : 'ACTIVATE HERO MODE!'}
      >
        {isHeroMode() ? '⚡' : '🦸'}
      </button>

      <header className="dashboard-header">
        <h1 className={isHeroMode() ? "hero-title" : ""}>
          {isHeroMode() ? 
            "🦸 HERO TRAINING ACADEMY 🦸" : 
            "🌱 Claude Prompter Learning Dashboard"
          }
        </h1>
        <div className="dashboard-nav">
          <button 
            className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            {isHeroMode() ? '📊 HERO ANALYTICS' : '📊 Analytics'}
          </button>
          <button 
            className={`nav-item ${activeView === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveView('sessions')}
          >
            {isHeroMode() ? '📚 TRAINING LOGS' : '📚 Sessions'}
          </button>
          <button 
            className={`nav-item ${activeView === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveView('projects')}
          >
            {isHeroMode() ? '🚀 HERO PROJECTS' : '🚀 Projects'}
          </button>
          <button 
            className={`nav-item ${activeView === 'usage' ? 'active' : ''}`}
            onClick={() => setActiveView('usage')}
          >
            {isHeroMode() ? '💰 POWER USAGE' : '💰 Usage'}
          </button>
          <button 
            className={`nav-item ${activeView === 'galaxy' ? 'active' : ''}`}
            onClick={() => setActiveView('galaxy')}
          >
            {isHeroMode() ? '🌌 HERO GALAXY' : '🌌 Galaxy'}
          </button>
          <button 
            className={`nav-item ${activeView === 'training' ? 'active' : ''}`}
            onClick={() => setActiveView('training')}
          >
            {isHeroMode() ? '🤖 INTELLIGENT SUGGESTIONS' : '🎯 Smart Suggestions'}
          </button>
        </div>
        
        {isHeroMode() && (
          <div className="hero-encouragement-banner">
            <span>💪 {getRandomCatchphrase()} 💪</span>
          </div>
        )}
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
                openSessionDetails(session.sessionId);
              }}
            />
          </div>
        )}

        {activeView === 'projects' && (
          <div className="dashboard-single-view">
            <ProjectAnalytics />
          </div>
        )}

        {activeView === 'usage' && (
          <div className="dashboard-single-view">
            <UsageAnalytics />
          </div>
        )}

        {activeView === 'galaxy' && (
          <div className="dashboard-single-view">
            <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
              <GalaxyScene 
                sessions={[
                  {
                    id: '1',
                    title: 'React Components',
                    date: '2025-01-20',
                    complexity: 'moderate',
                    topics: ['React', 'TypeScript', 'Hooks'],
                    patterns: ['useState', 'useEffect', 'component-composition']
                  },
                  {
                    id: '2', 
                    title: 'Three.js Basics',
                    date: '2025-01-21',
                    complexity: 'complex',
                    topics: ['Three.js', 'WebGL', '3D Graphics'],
                    patterns: ['scene-setup', 'mesh-creation', 'animation-loop']
                  },
                  {
                    id: '3',
                    title: 'API Integration', 
                    date: '2025-01-19',
                    complexity: 'simple',
                    topics: ['REST API', 'Fetch', 'Error Handling'],
                    patterns: ['async-await', 'try-catch', 'data-fetching']
                  },
                  {
                    id: '4',
                    title: 'State Management',
                    date: '2025-01-18', 
                    complexity: 'moderate',
                    topics: ['Redux', 'Context', 'State'],
                    patterns: ['reducer-pattern', 'action-creators', 'state-normalization']
                  },
                  {
                    id: '5',
                    title: 'Performance Optimization',
                    date: '2025-01-17',
                    complexity: 'complex', 
                    topics: ['React.memo', 'useMemo', 'useCallback'],
                    patterns: ['memoization', 'virtual-dom', 'render-optimization']
                  }
                ]} 
              />
            </div>
          </div>
        )}

        {activeView === 'training' && (
          <div className="dashboard-single-view">
            <ProjectSuggestions />
          </div>
        )}
      </main>

      {/* Session Details Modal */}
      <SessionDetailsModal 
        isOpen={isSessionModalOpen}
        onClose={closeSessionDetails}
        sessionId={selectedSessionId}
      />
    </div>
  );
};

// Main Dashboard component wrapped with Hero Theme Provider
const Dashboard: React.FC = () => {
  return (
    <HeroThemeProvider>
      <DashboardInner />
    </HeroThemeProvider>
  );
};

export default Dashboard;