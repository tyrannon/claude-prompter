import React, { useState, useEffect } from 'react';
import PatternChart from './charts/PatternChart';
import LearningJourneyInsights from './LearningJourneyInsights';

interface ProjectData {
  name: string;
  displayName: string;
  icon: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  sessions: number;
  totalQueries: number;
  languages: string[];
  topPatterns: Array<{
    pattern: string;
    frequency: number;
    category: string;
  }>;
  recentActivity: Array<{
    date: string;
    action: string;
    outcome: string;
  }>;
  insights: string[];
  complexity: {
    simple: number;
    moderate: number;
    complex: number;
  };
  learningMilestones: Array<{
    id: string;
    date: string;
    title: string;
    emoji: string;
    description: string;
    type: 'discovery' | 'breakthrough' | 'mastery' | 'pattern' | 'streak' | 'celebration';
    skills: string[];
    complexity: number;
  }>;
}

const ProjectAnalytics: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<string>('claude-prompter');
  const [projectData, setProjectData] = useState<{ [key: string]: ProjectData }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock project data - in real app, this would come from claude-prompter analytics
    const mockData: { [key: string]: ProjectData } = {
      'claude-prompter': {
        name: 'claude-prompter',
        displayName: 'Claude Prompter',
        icon: '🤖',
        theme: {
          primary: '#8B5CF6',
          secondary: '#06B6D4', 
          accent: '#F59E0B'
        },
        sessions: 15,
        totalQueries: 127,
        languages: ['TypeScript', 'React', 'Three.js', 'Node.js'],
        topPatterns: [
          { pattern: 'meta-learning', frequency: 23, category: 'ai' },
          { pattern: 'prompt-engineering', frequency: 18, category: 'ai' },
          { pattern: 'data-visualization', frequency: 15, category: 'frontend' },
          { pattern: 'three-js-setup', frequency: 12, category: 'graphics' },
          { pattern: 'react-components', frequency: 10, category: 'frontend' }
        ],
        recentActivity: [
          { date: '2025-01-22', action: 'Added Learning Galaxy 3D visualization', outcome: 'success' },
          { date: '2025-01-22', action: 'Implemented particle effects system', outcome: 'success' },
          { date: '2025-01-21', action: 'Created robot buddy Galexie', outcome: 'success' },
          { date: '2025-01-21', action: 'Built project region gates', outcome: 'success' },
          { date: '2025-01-20', action: 'Enhanced dashboard with Three.js', outcome: 'success' }
        ],
        insights: [
          '🚀 Most innovative project - exploring cutting-edge 3D learning visualizations',
          '🧠 Meta-learning focus - using AI to improve AI interactions',
          '🎨 Visual learning emphasis - 73% of patterns involve UI/visualization',
          '⚡ Rapid development - 5 major features added in last 3 days',
          '🔥 High success rate - 94% of implementations work on first try'
        ],
        complexity: {
          simple: 20,
          moderate: 45, 
          complex: 35
        },
        learningMilestones: [
          {
            id: '1',
            date: '2025-01-15',
            title: 'The Great Prompt Engineering Discovery',
            emoji: '🌱',
            description: 'First steps into the world of AI-powered development assistance',
            type: 'discovery',
            skills: ['prompt-engineering', 'ai-collaboration'],
            complexity: 2
          },
          {
            id: '2', 
            date: '2025-01-18',
            title: 'Dashboard Architecture Breakthrough',
            emoji: '💡',
            description: 'Cracked the code for beautiful, responsive learning analytics',
            type: 'breakthrough',
            skills: ['react-architecture', 'data-visualization'],
            complexity: 4
          },
          {
            id: '3',
            date: '2025-01-20',
            title: 'Three.js Mastery Unlocked',
            emoji: '🌳',
            description: 'From 2D charts to immersive 3D learning galaxies',
            type: 'mastery',
            skills: ['three-js', '3d-visualization', 'webgl'],
            complexity: 5
          },
          {
            id: '4',
            date: '2025-01-21',
            title: 'Pattern Recognition Wizard',
            emoji: '🔍',
            description: 'Discovered the secret patterns that make learning visible',
            type: 'pattern',
            skills: ['pattern-analysis', 'meta-learning'],
            complexity: 4
          },
          {
            id: '5',
            date: '2025-01-22',
            title: 'Innovation Celebration',
            emoji: '🎉',
            description: 'Built the most advanced learning dashboard in existence!',
            type: 'celebration',
            skills: ['innovation', 'user-experience', 'gamification'],
            complexity: 5
          }
        ]
      },
      'stylemuse': {
        name: 'stylemuse',
        displayName: 'StyleMuse',
        icon: '🎨',
        theme: {
          primary: '#FF6B9D',
          secondary: '#A855F7',
          accent: '#FCD34D'
        },
        sessions: 12,
        totalQueries: 89,
        languages: ['React', 'TypeScript', 'CSS', 'Tailwind'],
        topPatterns: [
          { pattern: 'component-design', frequency: 19, category: 'ui' },
          { pattern: 'responsive-layout', frequency: 15, category: 'css' },
          { pattern: 'color-schemes', frequency: 12, category: 'design' },
          { pattern: 'animations', frequency: 10, category: 'css' },
          { pattern: 'user-experience', frequency: 8, category: 'design' }
        ],
        recentActivity: [
          { date: '2025-01-21', action: 'Redesigned landing page layout', outcome: 'success' },
          { date: '2025-01-20', action: 'Added dark mode support', outcome: 'success' },
          { date: '2025-01-19', action: 'Implemented smooth animations', outcome: 'success' },
          { date: '2025-01-18', action: 'Created component library', outcome: 'success' }
        ],
        insights: [
          '🎨 Design-focused - 87% of queries involve visual/aesthetic improvements',
          '📱 Mobile-first approach - consistent responsive design patterns',
          '🌈 Color mastery - advanced understanding of design systems',
          '✨ Animation expertise - smooth micro-interactions throughout'
        ],
        complexity: {
          simple: 35,
          moderate: 50,
          complex: 15
        },
        learningMilestones: [
          {
            id: '1',
            date: '2025-01-10',
            title: 'Design System Genesis',
            emoji: '🌱',
            description: 'The journey into beautiful, consistent UI design began',
            type: 'discovery',
            skills: ['design-systems', 'ui-principles'],
            complexity: 2
          },
          {
            id: '2',
            date: '2025-01-14',
            title: 'Component Architecture Epiphany',
            emoji: '💡',
            description: 'Realized the power of reusable, composable components',
            type: 'breakthrough',
            skills: ['component-design', 'react-patterns'],
            complexity: 3
          },
          {
            id: '3',
            date: '2025-01-19',
            title: 'Animation Mastery',
            emoji: '🌳',
            description: 'Brought interfaces to life with smooth, delightful animations',
            type: 'mastery',
            skills: ['css-animations', 'micro-interactions'],
            complexity: 4
          }
        ]
      },
      'permitagent': {
        name: 'permitagent',
        displayName: 'PermitAgent',
        icon: '🔧',
        theme: {
          primary: '#10B981',
          secondary: '#3B82F6',
          accent: '#6366F1'
        },
        sessions: 8,
        totalQueries: 64,
        languages: ['Python', 'Node.js', 'API', 'Docker'],
        topPatterns: [
          { pattern: 'automation', frequency: 16, category: 'backend' },
          { pattern: 'error-handling', frequency: 12, category: 'reliability' },
          { pattern: 'async-processing', frequency: 10, category: 'performance' },
          { pattern: 'api-integration', frequency: 9, category: 'backend' },
          { pattern: 'data-validation', frequency: 7, category: 'reliability' }
        ],
        recentActivity: [
          { date: '2025-01-20', action: 'Optimized permit processing pipeline', outcome: 'success' },
          { date: '2025-01-19', action: 'Added comprehensive error handling', outcome: 'success' },
          { date: '2025-01-18', action: 'Implemented retry mechanisms', outcome: 'success' }
        ],
        insights: [
          '🔧 Automation specialist - 78% of patterns focus on process automation',
          '🛡️ Reliability-focused - extensive error handling and validation',
          '⚡ Performance optimized - async patterns for scalability',
          '🎯 Backend mastery - deep understanding of server-side architecture'
        ],
        complexity: {
          simple: 25,
          moderate: 60,
          complex: 15
        },
        learningMilestones: [
          {
            id: '1',
            date: '2025-01-08',
            title: 'Automation Awakening',
            emoji: '🌱',
            description: 'Discovered the power of automating repetitive processes',
            type: 'discovery',
            skills: ['process-automation', 'python-scripting'],
            complexity: 3
          },
          {
            id: '2',
            date: '2025-01-16',
            title: 'Error Handling Enlightenment',
            emoji: '💡',
            description: 'Mastered the art of graceful failure and recovery',
            type: 'breakthrough',
            skills: ['error-handling', 'resilient-systems'],
            complexity: 4
          },
          {
            id: '3',
            date: '2025-01-20',
            title: 'Performance Optimization Guru',
            emoji: '🌳',
            description: 'Transformed slow processes into lightning-fast automation',
            type: 'mastery',
            skills: ['performance-optimization', 'async-processing'],
            complexity: 5
          }
        ]
      }
    };

    setProjectData(mockData);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="project-analytics-loading">
        <div className="loading-spinner"></div>
        <h3>🔍 Analyzing project data...</h3>
      </div>
    );
  }

  const currentProject = projectData[selectedProject];

  if (!currentProject) {
    return (
      <div className="project-analytics-error">
        <h3>❌ Project not found</h3>
        <p>Unable to load data for project: {selectedProject}</p>
      </div>
    );
  }

  return (
    <div className="project-analytics">
      {/* Project Selector */}
      <div className="project-selector">
        <h2>🚀 Project Analytics</h2>
        <div className="project-tabs">
          {Object.keys(projectData).map((projectKey) => {
            const project = projectData[projectKey];
            return (
              <button
                key={projectKey}
                className={`project-tab ${selectedProject === projectKey ? 'active' : ''}`}
                onClick={() => setSelectedProject(projectKey)}
                style={{
                  backgroundColor: selectedProject === projectKey ? project.theme.primary : 'transparent',
                  borderColor: project.theme.primary,
                  color: selectedProject === projectKey ? 'white' : project.theme.primary
                }}
              >
                <span className="project-icon">{project.icon}</span>
                <span className="project-name">{project.displayName}</span>
                <span className="project-sessions">{project.sessions} sessions</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Project Overview */}
      <div className="project-overview">
        <div className="project-header" style={{ borderLeft: `4px solid ${currentProject.theme.primary}` }}>
          <div className="project-title">
            <span className="project-icon-large">{currentProject.icon}</span>
            <div>
              <h3>{currentProject.displayName}</h3>
              <p>Learning analytics and insights</p>
            </div>
          </div>
          <div className="project-stats">
            <div className="stat-item">
              <span className="stat-number">{currentProject.sessions}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{currentProject.totalQueries}</span>
              <span className="stat-label">Queries</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{currentProject.languages.length}</span>
              <span className="stat-label">Languages</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="project-analytics-grid">
        {/* Pattern Mastery */}
        <div className="analytics-card">
          <h4>📈 Pattern Mastery</h4>
          <PatternChart patterns={currentProject.topPatterns} />
        </div>

        {/* Complexity Distribution */}
        <div className="analytics-card">
          <h4>🎯 Complexity Distribution</h4>
          <div className="complexity-chart">
            <div className="complexity-bar">
              <div className="complexity-segment simple" 
                   style={{ width: `${currentProject.complexity.simple}%` }}>
                <span>Simple ({currentProject.complexity.simple}%)</span>
              </div>
              <div className="complexity-segment moderate" 
                   style={{ width: `${currentProject.complexity.moderate}%` }}>
                <span>Moderate ({currentProject.complexity.moderate}%)</span>
              </div>
              <div className="complexity-segment complex" 
                   style={{ width: `${currentProject.complexity.complex}%` }}>
                <span>Complex ({currentProject.complexity.complex}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Languages & Technologies */}
        <div className="analytics-card">
          <h4>💻 Languages & Technologies</h4>
          <div className="language-tags">
            {currentProject.languages.map((language, index) => (
              <span 
                key={index} 
                className="language-tag"
                style={{ backgroundColor: currentProject.theme.accent + '20', color: currentProject.theme.primary }}
              >
                {language}
              </span>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="analytics-card">
          <h4>📅 Recent Activity</h4>
          <div className="activity-timeline">
            {currentProject.recentActivity.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-date">{activity.date}</div>
                <div className="activity-content">
                  <span className="activity-action">{activity.action}</span>
                  <span className={`activity-outcome ${activity.outcome}`}>
                    {activity.outcome === 'success' ? '✅' : '❌'} {activity.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="analytics-card insights-card">
          <h4>🧠 AI-Generated Insights</h4>
          <div className="insights-list">
            {currentProject.insights.map((insight, index) => (
              <div key={index} className="insight-item">
                <span className="insight-text">{insight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Journey Insights */}
        <LearningJourneyInsights
          projectName={currentProject.displayName}
          milestones={currentProject.learningMilestones}
          theme={currentProject.theme}
        />
      </div>
    </div>
  );
};

export default ProjectAnalytics;