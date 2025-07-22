import React, { useState, useEffect } from 'react';
import { useHeroTheme } from './HeroTheme';
import './ProjectSuggestions.css';

interface ProjectSuggestion {
  id: string;
  project: string;
  feature: string;
  description: string;
  reasoning: string;
  basedOnSessions: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  technologies: string[];
  benefits: string[];
  nextSteps: string[];
  confidence: number; // 0-100
}

interface LearningInsight {
  pattern: string;
  frequency: number;
  lastUsed: string;
  projectContext: string;
}

const ProjectSuggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsight[]>([]);
  const [selectedProject, setSelectedProject] = useState<'all' | 'stylemuse' | 'permitagent' | 'claude-prompter'>('all');
  const [loading, setLoading] = useState(true);
  const { isHeroMode, getRandomCatchphrase } = useHeroTheme();

  useEffect(() => {
    fetchProjectSuggestions();
    fetchLearningInsights();
  }, [selectedProject]);

  const fetchProjectSuggestions = async () => {
    setLoading(true);
    
    // Simulate API call - this would analyze session history in real implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockSuggestions: ProjectSuggestion[] = [
      {
        id: 'stylemuse-dark-mode',
        project: 'StyleMuse',
        feature: 'Advanced Dark Mode Generator',
        description: 'Build an intelligent dark mode variant generator that automatically creates beautiful dark themes from any color palette.',
        reasoning: 'Based on your 12 sessions with CSS theming and color manipulation, you\'ve consistently worked with color transformations and theme generation.',
        basedOnSessions: [
          'CSS color palette generation (3 sessions)',
          'Theme customization patterns (5 sessions)', 
          'Color contrast calculations (2 sessions)',
          'CSS variable manipulation (2 sessions)'
        ],
        difficulty: 'medium',
        estimatedTime: '4-6 hours',
        technologies: ['CSS Custom Properties', 'Color Theory', 'Accessibility APIs'],
        benefits: [
          'Solve a real user pain point',
          'Learn advanced color manipulation',
          'Improve accessibility knowledge',
          'Add significant value to StyleMuse'
        ],
        nextSteps: [
          'Research color inversion algorithms',
          'Study WCAG contrast requirements',
          'Implement color transformation functions',
          'Create preview system'
        ],
        confidence: 87
      },
      {
        id: 'permitagent-auto-fix',
        project: 'PermitAgent',
        feature: 'Automated Permission Fixes',
        description: 'Create a smart system that not only identifies permission issues but can automatically apply safe fixes with user confirmation.',
        reasoning: 'Your 8 sessions show deep understanding of file permissions and security patterns. You\'ve explored both analysis and remediation approaches.',
        basedOnSessions: [
          'File permission analysis (4 sessions)',
          'Security vulnerability detection (2 sessions)',
          'Automated scripting patterns (2 sessions)'
        ],
        difficulty: 'hard',
        estimatedTime: '8-12 hours',
        technologies: ['Shell Scripting', 'Security Auditing', 'File System APIs'],
        benefits: [
          'Make PermitAgent truly actionable',
          'Learn advanced security concepts',
          'Understand system administration',
          'Create practical automation tools'
        ],
        nextSteps: [
          'Design safe permission change rules',
          'Implement rollback mechanisms',
          'Create confirmation workflows',
          'Add logging and audit trails'
        ],
        confidence: 73
      },
      {
        id: 'claude-prompter-context',
        project: 'Claude-Prompter',
        feature: 'Smart Context Detection',
        description: 'Enhance claude-prompter to automatically detect project context and suggest relevant prompts based on your current codebase.',
        reasoning: 'Your usage patterns show you work across multiple projects. A context-aware system would save significant time and provide better suggestions.',
        basedOnSessions: [
          'Multi-project prompt patterns (6 sessions)',
          'Context switching workflows (4 sessions)',
          'Codebase analysis discussions (3 sessions)'
        ],
        difficulty: 'medium',
        estimatedTime: '6-8 hours',
        technologies: ['File System Analysis', 'Pattern Matching', 'AI/ML'],
        benefits: [
          'Dramatically improve prompt relevance',
          'Reduce context setup time',
          'Learn codebase analysis techniques',
          'Make claude-prompter more intelligent'
        ],
        nextSteps: [
          'Analyze git repository structure',
          'Detect programming languages',
          'Identify common project patterns',
          'Build context scoring system'
        ],
        confidence: 91
      },
      {
        id: 'hero-dashboard-insights',
        project: 'Hero Dashboard',
        feature: 'Predictive Learning Insights',
        description: 'Add AI-powered insights that predict what you should learn next based on your coding patterns and industry trends.',
        reasoning: 'You\'ve shown interest in learning analytics and personalized experiences. This would make the dashboard truly intelligent.',
        basedOnSessions: [
          'Learning analytics discussions (3 sessions)',
          'Personalization patterns (2 sessions)',
          'Data visualization work (4 sessions)'
        ],
        difficulty: 'hard',
        estimatedTime: '10-15 hours',
        technologies: ['Machine Learning', 'Data Analysis', 'Trend Analysis'],
        benefits: [
          'Create cutting-edge learning experience',
          'Learn ML and data science',
          'Build predictive systems',
          'Make dashboard truly unique'
        ],
        nextSteps: [
          'Research learning path algorithms',
          'Analyze skill progression patterns',
          'Implement trend detection',
          'Create recommendation engine'
        ],
        confidence: 68
      }
    ];

    // Filter by project if selected
    const filteredSuggestions = selectedProject === 'all' 
      ? mockSuggestions 
      : mockSuggestions.filter(s => s.project.toLowerCase().includes(selectedProject));

    setSuggestions(filteredSuggestions);
    setLoading(false);
  };

  const fetchLearningInsights = async () => {
    const mockInsights: LearningInsight[] = [
      {
        pattern: 'CSS color manipulation',
        frequency: 12,
        lastUsed: '2024-01-20',
        projectContext: 'StyleMuse theming system'
      },
      {
        pattern: 'File permission analysis',
        frequency: 8,
        lastUsed: '2024-01-19',
        projectContext: 'PermitAgent security auditing'
      },
      {
        pattern: 'React component architecture',
        frequency: 15,
        lastUsed: '2024-01-21',
        projectContext: 'Hero Dashboard development'
      },
      {
        pattern: 'API design and integration',
        frequency: 6,
        lastUsed: '2024-01-18',
        projectContext: 'Claude-prompter backend'
      }
    ];
    
    setLearningInsights(mockInsights);
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'hard': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return '#22c55e';
    if (confidence >= 60) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="project-suggestions-loading">
        <div className={isHeroMode() ? "hero-loading" : "loading-spinner"}>
          {isHeroMode() ? "🤖" : ""}
        </div>
        <h2>
          {isHeroMode() ? 
            "⚡ ANALYZING YOUR HERO CODING PATTERNS... ⚡" : 
            "🧠 Analyzing your learning patterns..."
          }
        </h2>
        <p>{isHeroMode() ? "CHANNELING AI POWER..." : "Generating intelligent suggestions..."}</p>
      </div>
    );
  }

  return (
    <div className="project-suggestions-container">
      {/* Header */}
      <div className="suggestions-header">
        <div className="header-content">
          <h1 className={isHeroMode() ? "hero-title" : ""}>
            {isHeroMode() ? 
              "🤖 INTELLIGENT PROJECT SUGGESTIONS" : 
              "🎯 Smart Project Suggestions"
            }
          </h1>
          <p className="header-description">
            {isHeroMode() ? 
              "BASED ON YOUR HEROIC CODING JOURNEY, HERE ARE FEATURES PERFECT FOR YOUR SKILL LEVEL!" :
              "Based on your learning patterns and session history, here are features tailored for you."
            }
          </p>
        </div>
        
        {/* Project Filter */}
        <div className="project-filter">
          <button 
            className={`filter-btn ${selectedProject === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedProject('all')}
          >
            All Projects
          </button>
          <button 
            className={`filter-btn ${selectedProject === 'stylemuse' ? 'active' : ''}`}
            onClick={() => setSelectedProject('stylemuse')}
          >
            🎨 StyleMuse
          </button>
          <button 
            className={`filter-btn ${selectedProject === 'permitagent' ? 'active' : ''}`}
            onClick={() => setSelectedProject('permitagent')}
          >
            🛡️ PermitAgent
          </button>
          <button 
            className={`filter-btn ${selectedProject === 'claude-prompter' ? 'active' : ''}`}
            onClick={() => setSelectedProject('claude-prompter')}
          >
            🤖 Claude-Prompter
          </button>
        </div>
      </div>

      {/* Learning Insights */}
      <div className="hero-card learning-insights">
        <h3>{isHeroMode() ? "🧠 YOUR HERO CODING PATTERNS" : "📊 Your Learning Patterns"}</h3>
        <div className="insights-grid">
          {learningInsights.map((insight, index) => (
            <div key={index} className="insight-item">
              <div className="insight-pattern">{insight.pattern}</div>
              <div className="insight-frequency">Used {insight.frequency}x</div>
              <div className="insight-context">{insight.projectContext}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="suggestions-grid">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="hero-card suggestion-card">
            <div className="suggestion-header">
              <div className="project-badge">{suggestion.project}</div>
              <div 
                className="confidence-score"
                style={{ color: getConfidenceColor(suggestion.confidence) }}
              >
                {suggestion.confidence}% match
              </div>
            </div>

            <h3 className="suggestion-title">{suggestion.feature}</h3>
            <p className="suggestion-description">{suggestion.description}</p>

            <div className="suggestion-reasoning">
              <h4>🧠 Why This Suggestion?</h4>
              <p>{suggestion.reasoning}</p>
            </div>

            <div className="suggestion-meta">
              <div className="meta-item">
                <span 
                  className="difficulty-badge"
                  style={{ backgroundColor: getDifficultyColor(suggestion.difficulty) }}
                >
                  {suggestion.difficulty.toUpperCase()}
                </span>
              </div>
              <div className="meta-item">
                <span className="time-estimate">⏱️ {suggestion.estimatedTime}</span>
              </div>
            </div>

            <div className="suggestion-technologies">
              <h4>🔧 Technologies</h4>
              <div className="tech-tags">
                {suggestion.technologies.map((tech, index) => (
                  <span key={index} className="tech-tag">{tech}</span>
                ))}
              </div>
            </div>

            <div className="suggestion-sessions">
              <h4>📚 Based On Your Sessions</h4>
              <ul>
                {suggestion.basedOnSessions.map((session, index) => (
                  <li key={index}>{session}</li>
                ))}
              </ul>
            </div>

            <div className="suggestion-benefits">
              <h4>💪 What You'll Learn</h4>
              <ul>
                {suggestion.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>

            <div className="suggestion-next-steps">
              <h4>🚀 Next Steps</h4>
              <ol>
                {suggestion.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="suggestion-actions">
              <button className="hero-button generate-prompt-btn">
                {isHeroMode() ? "⚡ GENERATE HERO PROMPT" : "🤖 Generate Prompt"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isHeroMode() && (
        <div className="hero-encouragement-footer">
          <h3>💪 {getRandomCatchphrase()}</h3>
          <p>These suggestions are based on YOUR unique coding journey. Each one is perfectly tailored to your current skill level!</p>
        </div>
      )}
    </div>
  );
};

export default ProjectSuggestions;