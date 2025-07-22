import React from 'react';
import { useHeroTheme } from './HeroTheme';
import './ChallengeDetailsModal.css';

interface TrainingChallenge {
  id: string;
  title: string;
  description: string;
  category: 'coding' | 'architecture' | 'debugging' | 'optimization' | 'security';
  difficulty: 'rookie' | 'hero' | 'pro' | 'legendary';
  xpReward: number;
  powerPoints: number;
  timeLimit?: number;
  requirements: string[];
  hints: string[];
  solution?: string;
  completed?: boolean;
  score?: number;
}

interface ChallengeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChallenge: () => void;
  challenge: TrainingChallenge | null;
}

const ChallengeDetailsModal: React.FC<ChallengeDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  onStartChallenge,
  challenge 
}) => {
  const { isHeroMode, getRandomCatchphrase } = useHeroTheme();

  if (!isOpen || !challenge) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'rookie': return '#22c55e';
      case 'hero': return '#3b82f6';
      case 'pro': return '#f59e0b';
      case 'legendary': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'coding': return '💻';
      case 'architecture': return '🏗️';
      case 'debugging': return '🐛';
      case 'optimization': return '⚡';
      case 'security': return '🛡️';
      default: return '🎯';
    }
  };

  const getProjectContext = (challengeId: string): { project: string; context: string; tips: string[] } => {
    if (challengeId.startsWith('stylemuse')) {
      return {
        project: 'StyleMuse',
        context: 'StyleMuse is a powerful CSS theme generation tool that helps developers create beautiful, consistent designs. This challenge focuses on building the core theme customization features.',
        tips: [
          'Check out the StyleMuse repository for inspiration',
          'Look at popular design systems like Material Design or Tailwind CSS',
          'Consider accessibility (WCAG) when generating color palettes',
          'Think about how designers actually work - they need previews!'
        ]
      };
    }
    
    if (challengeId.startsWith('permitagent')) {
      return {
        project: 'PermitAgent',
        context: 'PermitAgent is a security-focused tool for analyzing and managing file system permissions. This challenge deals with real security scenarios developers face daily.',
        tips: [
          'Study common Linux/Unix permission patterns',
          'Research recent security vulnerabilities related to file permissions',
          'Consider both security and usability in your solutions',
          'Think about automation - manual permission auditing is slow!'
        ]
      };
    }
    
    if (challengeId.startsWith('claude-prompter')) {
      return {
        project: 'Claude-Prompter',
        context: 'This is the very project you\'re using right now! Claude-prompter helps developers work more effectively with AI by generating intelligent suggestions based on context and patterns.',
        tips: [
          'Look at the existing suggestion algorithms in the codebase',
          'Think about what makes a good prompt suggestion',
          'Consider different types of users (beginners vs experts)',
          'Machine learning doesn\'t always need complex models - simple patterns work!'
        ]
      };
    }
    
    if (challengeId.startsWith('hero-dashboard')) {
      return {
        project: 'Hero Dashboard',
        context: 'You\'re looking at the Hero Dashboard right now! This challenge involves adding real-time capabilities to connect the CLI tool with this web interface.',
        tips: [
          'WebSockets can be tricky - start with simple connection testing',
          'Think about what data should update in real-time',
          'Consider offline scenarios and reconnection logic',
          'Real-time doesn\'t mean instant - some debouncing helps UX'
        ]
      };
    }
    
    return {
      project: 'General Challenge',
      context: 'This is a general programming challenge designed to test your skills across multiple domains.',
      tips: [
        'Break the problem down into smaller parts',
        'Start with the simplest working solution first',
        'Don\'t forget to handle edge cases',
        'Good code is readable code!'
      ]
    };
  };

  const projectInfo = getProjectContext(challenge.id);

  return (
    <div className="hero-modal-overlay" onClick={handleOverlayClick}>
      <div className="hero-modal challenge-details-modal">
        <div className="challenge-modal-header">
          <div className="challenge-title-section">
            <div className="challenge-category-badge">
              <span className="category-icon">{getCategoryIcon(challenge.category)}</span>
              <span className="category-name">{challenge.category.toUpperCase()}</span>
            </div>
            
            <h2 className={isHeroMode() ? "hero-title" : ""}>
              {challenge.title}
            </h2>
            
            <div className="challenge-meta-info">
              <div 
                className="difficulty-badge"
                style={{ backgroundColor: getDifficultyColor(challenge.difficulty) }}
              >
                {challenge.difficulty.toUpperCase()}
              </div>
              <div className="reward-info">
                <span className="xp-reward">⭐ {challenge.xpReward} XP</span>
                <span className="pp-reward">💎 {challenge.powerPoints} PP</span>
                {challenge.timeLimit && (
                  <span className="time-limit">⏰ {challenge.timeLimit} min</span>
                )}
              </div>
            </div>
          </div>
          
          <button className="modal-close" onClick={onClose}>
            {isHeroMode() ? '⚡' : '✕'}
          </button>
        </div>

        <div className="challenge-modal-content">
          {/* Project Context Section */}
          <div className="hero-card project-context">
            <h3>🎯 Project Context: {projectInfo.project}</h3>
            <p className="context-description">{projectInfo.context}</p>
          </div>

          {/* Challenge Description */}
          <div className="hero-card challenge-description">
            <h3>📋 Challenge Description</h3>
            <p>{challenge.description}</p>
          </div>

          {/* Requirements Section */}
          <div className="hero-card requirements-section">
            <h3>✅ Requirements to Complete</h3>
            <div className="requirements-list">
              {challenge.requirements.map((req, index) => (
                <div key={index} className="requirement-item">
                  <span className="req-number">{index + 1}</span>
                  <span className="req-text">{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips Section */}
          <div className="hero-card tips-section">
            <h3>💡 Pro Tips & Resources</h3>
            <div className="tips-list">
              {projectInfo.tips.map((tip, index) => (
                <div key={index} className="tip-item">
                  <span className="tip-icon">💡</span>
                  <span className="tip-text">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Getting Started Section */}
          <div className="hero-card getting-started">
            <h3>🚀 Getting Started</h3>
            <div className="starter-steps">
              <div className="step-item">
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Read the requirements carefully</strong>
                  <p>Make sure you understand exactly what needs to be built</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Set up your development environment</strong>
                  <p>Create a new project or use an existing codebase</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Start coding and use hints when stuck</strong>
                  <p>Don't be afraid to use the hint system - it costs Power Points but helps you learn!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="challenge-actions">
            {isHeroMode() ? (
              <>
                <button 
                  className="hero-button start-challenge-btn"
                  onClick={() => {
                    onStartChallenge();
                    onClose();
                  }}
                >
                  ⚡ START HERO TRAINING ⚡
                </button>
                <div className="hero-encouragement">
                  <strong>{getRandomCatchphrase()}</strong>
                  <p>Remember: Every hero started as a beginner. You've got this!</p>
                </div>
              </>
            ) : (
              <button 
                className="hero-button start-challenge-btn"
                onClick={() => {
                  onStartChallenge();
                  onClose();
                }}
              >
                🚀 Start Challenge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailsModal;