import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import PatternChart from './charts/PatternChart';
import ProgressOverview from './ProgressOverview';
import TopicNetwork from './TopicNetwork';
import SessionTimeline from './SessionTimeline';

interface LearningData {
  sessionCount: number;
  experienceLevel: string;
  recentTopics: string[];
  masteredPatterns: Array<{
    pattern: string;
    frequency: number;
    category: string;
  }>;
  growthAreas: string[];
  languages: string[];
}

const Dashboard: React.FC = () => {
  const [learningData, setLearningData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real data from claude-prompter's database
    // For now, using mock data to demonstrate the interface
    const mockData: LearningData = {
      sessionCount: 27,
      experienceLevel: 'Experienced',
      recentTopics: ['authentication', 'database', 'react'],
      masteredPatterns: [
        { pattern: 'async-await-pattern', frequency: 8, category: 'implementation' },
        { pattern: 'error-handling-middleware', frequency: 6, category: 'implementation' },
        { pattern: 'repository-pattern', frequency: 5, category: 'architecture' }
      ],
      growthAreas: ['testing', 'deployment', 'performance'],
      languages: ['typescript', 'javascript', 'python', 'sql']
    };

    // Simulate loading delay
    setTimeout(() => {
      setLearningData(mockData);
      setLoading(false);
    }, 1000);
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
          <button className="nav-item active">📊 Analytics</button>
          <button className="nav-item">💡 Suggestions</button>
          <button className="nav-item">⚙️ Settings</button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-grid">
          {/* Progress Overview Card */}
          <div className="dashboard-card">
            <ProgressOverview 
              sessionCount={learningData.sessionCount}
              experienceLevel={learningData.experienceLevel}
              recentTopics={learningData.recentTopics}
              languages={learningData.languages}
            />
          </div>

          {/* Pattern Mastery Chart */}
          <div className="dashboard-card">
            <h2>📈 Pattern Mastery</h2>
            <PatternChart patterns={learningData.masteredPatterns} />
          </div>

          {/* Topic Network Visualization */}
          <div className="dashboard-card full-width">
            <h2>🌐 Topic Evolution Network</h2>
            <TopicNetwork topics={learningData.recentTopics} />
          </div>

          {/* Session Timeline */}
          <div className="dashboard-card full-width">
            <h2>📅 Learning Timeline</h2>
            <SessionTimeline sessionCount={learningData.sessionCount} />
          </div>

          {/* Growth Areas */}
          <div className="dashboard-card">
            <h2>🚀 Growth Opportunities</h2>
            <div className="growth-areas">
              {learningData.growthAreas.map((area, index) => (
                <div key={index} className="growth-area-item">
                  <span className="growth-area-name">{area}</span>
                  <div className="growth-area-action">
                    <button className="explore-btn">Explore</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="dashboard-card">
            <h2>🏆 Recent Achievements</h2>
            <div className="achievements">
              <div className="achievement-item">
                <span className="achievement-icon">⭐</span>
                <div className="achievement-text">
                  <strong>Pattern Master</strong>
                  <p>Mastered async-await-pattern (8+ uses)</p>
                </div>
              </div>
              <div className="achievement-item">
                <span className="achievement-icon">🔥</span>
                <div className="achievement-text">
                  <strong>Learning Streak</strong>
                  <p>{learningData.sessionCount} sessions completed</p>
                </div>
              </div>
              <div className="achievement-item">
                <span className="achievement-icon">🌟</span>
                <div className="achievement-text">
                  <strong>Experience Level</strong>
                  <p>Reached {learningData.experienceLevel} status</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;