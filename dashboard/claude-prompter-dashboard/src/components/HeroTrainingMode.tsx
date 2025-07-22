import React, { useState, useEffect } from 'react';
import { useHeroTheme } from './HeroTheme';
import ChallengeDetailsModal from './ChallengeDetailsModal';
import './HeroTrainingMode.css';

interface TrainingChallenge {
  id: string;
  title: string;
  description: string;
  category: 'coding' | 'architecture' | 'debugging' | 'optimization' | 'security';
  difficulty: 'rookie' | 'hero' | 'pro' | 'legendary';
  xpReward: number;
  powerPoints: number;
  timeLimit?: number; // in minutes
  requirements: string[];
  hints: string[];
  solution?: string;
  completed?: boolean;
  score?: number;
}

interface HeroStats {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  powerPoints: number;
  rank: string;
  streakDays: number;
  completedChallenges: number;
  favoriteCategory: string;
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
}

const HeroTrainingMode: React.FC = () => {
  const [heroStats, setHeroStats] = useState<HeroStats | null>(null);
  const [challenges, setChallenges] = useState<TrainingChallenge[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<TrainingChallenge | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<TrainingChallenge | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { currentTheme, isHeroMode, getRandomCatchphrase } = useHeroTheme();

  useEffect(() => {
    fetchHeroStats();
    fetchChallenges();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft && timeLeft > 0 && isTraining) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, isTraining]);

  const fetchHeroStats = async () => {
    // Mock API call
    const mockStats: HeroStats = {
      level: 15,
      xp: 2750,
      xpToNext: 3000,
      totalXp: 12750,
      powerPoints: 89,
      rank: 'PRO HERO',
      streakDays: 7,
      completedChallenges: 23,
      favoriteCategory: 'coding',
      achievements: [
        {
          id: 'first_challenge',
          title: 'HERO\'S FIRST STEP',
          description: 'Complete your first training challenge',
          icon: '🦶',
          rarity: 'common',
          unlockedAt: '2024-01-15'
        },
        {
          id: 'code_master',
          title: 'CODE MASTER',
          description: 'Complete 10 coding challenges',
          icon: '💻',
          rarity: 'rare',
          unlockedAt: '2024-01-18'
        },
        {
          id: 'plus_ultra',
          title: 'PLUS ULTRA ACHIEVER',
          description: 'Maintain a 7-day training streak',
          icon: '⚡',
          rarity: 'epic',
          unlockedAt: '2024-01-20'
        }
      ]
    };
    setHeroStats(mockStats);
  };

  const fetchChallenges = async () => {
    // Project-specific challenges with real context
    const mockChallenges: TrainingChallenge[] = [
      {
        id: 'stylemuse-1',
        title: 'STYLEMUSE: CSS THEME GENERATOR',
        description: '🎨 Build a dynamic CSS theme generator component for StyleMuse! Create a React component that allows users to customize website themes with real-time preview. This challenge is based on the actual StyleMuse project - a tool for generating beautiful CSS themes.',
        category: 'coding',
        difficulty: 'hero',
        xpReward: 200,
        powerPoints: 35,
        timeLimit: 45,
        requirements: [
          'Create a color picker interface',
          'Generate CSS variables dynamically',
          'Implement real-time theme preview',
          'Export theme as downloadable CSS',
          'Handle dark/light mode variations'
        ],
        hints: [
          'Use CSS custom properties (--variables) for dynamic theming',
          'Consider using React.useRef for the preview container',
          'Think about color harmony algorithms for generating palettes',
          'localStorage can persist user preferences'
        ]
      },
      {
        id: 'permitagent-1',
        title: 'PERMITAGENT: SMART PERMISSION SYSTEM',
        description: '🛡️ Build an intelligent permission validation system for PermitAgent! Create a component that analyzes file system permissions and suggests security improvements. This is based on the real PermitAgent project - a tool for managing and auditing system permissions.',
        category: 'security',
        difficulty: 'pro',
        xpReward: 300,
        powerPoints: 50,
        timeLimit: 60,
        requirements: [
          'Parse file system permissions (chmod/ls -l output)',
          'Identify security vulnerabilities',
          'Suggest permission improvements',
          'Generate audit reports',
          'Handle different OS permission systems'
        ],
        hints: [
          'Use regular expressions to parse permission strings',
          'Think about least-privilege principle',
          'Consider executable files in web directories',
          'Research common permission attack vectors'
        ]
      },
      {
        id: 'claude-prompter-1',
        title: 'CLAUDE-PROMPTER: AI SUGGESTION ENGINE',
        description: '🤖 Enhance claude-prompter with smarter AI suggestions! Build a machine learning component that learns from user patterns and generates better prompt suggestions. This challenge extends our actual claude-prompter project with advanced AI capabilities.',
        category: 'optimization',
        difficulty: 'legendary',
        xpReward: 500,
        powerPoints: 75,
        timeLimit: 90,
        requirements: [
          'Analyze user prompt patterns with ML',
          'Create similarity matching algorithm',
          'Implement feedback learning system',
          'Generate contextual suggestions',
          'Build confidence scoring system'
        ],
        hints: [
          'Consider using TF-IDF for text similarity',
          'Think about user feedback loops for improvement',
          'Cosine similarity works well for prompt matching',
          'Local storage can cache learned patterns'
        ]
      },
      {
        id: 'hero-dashboard-1',
        title: 'HERO DASHBOARD: REAL-TIME WEBSOCKETS',
        description: '⚡ Add real-time superpowers to this Hero Dashboard! Implement WebSocket connections to show live updates when prompts are sent from the CLI. This challenge enhances the very dashboard you\'re using right now!',
        category: 'architecture',
        difficulty: 'hero',
        xpReward: 350,
        powerPoints: 55,
        timeLimit: 75,
        requirements: [
          'Set up WebSocket server connection',
          'Handle real-time session updates',
          'Add live notification system',
          'Sync CLI activity with dashboard',
          'Implement connection retry logic'
        ],
        hints: [
          'Socket.io makes WebSocket handling easier',
          'Consider using React Context for WebSocket state',
          'Debounce rapid updates to avoid UI flooding',
          'Server-sent events might be simpler than full WebSocket'
        ]
      }
    ];
    setChallenges(mockChallenges);
  };

  const openChallengeDetails = (challenge: TrainingChallenge) => {
    setSelectedChallenge(challenge);
    setIsDetailsModalOpen(true);
  };

  const closeChallengeDetails = () => {
    setSelectedChallenge(null);
    setIsDetailsModalOpen(false);
  };

  const startChallenge = (challenge?: TrainingChallenge) => {
    const challengeToStart = challenge || selectedChallenge;
    if (!challengeToStart) return;
    
    setActiveChallenge(challengeToStart);
    setIsTraining(true);
    setUserAnswer('');
    setShowHint(false);
    setCurrentHintIndex(0);
    if (challengeToStart.timeLimit) {
      setTimeLeft(challengeToStart.timeLimit * 60); // convert to seconds
    }
  };

  const submitAnswer = async () => {
    if (!activeChallenge || !userAnswer.trim()) return;

    // Mock evaluation - in real implementation, this would be more sophisticated
    const score = Math.floor(Math.random() * 40) + 60; // 60-100 score
    const passed = score >= 70;

    if (passed && heroStats) {
      const newXp = heroStats.xp + activeChallenge.xpReward;
      const newPowerPoints = heroStats.powerPoints + activeChallenge.powerPoints;
      
      setHeroStats({
        ...heroStats,
        xp: newXp,
        totalXp: heroStats.totalXp + activeChallenge.xpReward,
        powerPoints: newPowerPoints,
        completedChallenges: heroStats.completedChallenges + 1
      });

      // Check for level up
      if (newXp >= heroStats.xpToNext) {
        setTimeout(() => {
          alert(isHeroMode() ? 
            `🎉 LEVEL UP! YOU'RE NOW LEVEL ${heroStats.level + 1}! PLUS ULTRA! 💪` :
            `🎉 Level up! You're now level ${heroStats.level + 1}!`
          );
        }, 500);
      }
    }

    setActiveChallenge(prev => prev ? { ...prev, completed: passed, score } : null);
    setIsTraining(false);
    setTimeLeft(null);
  };

  const useHint = () => {
    if (activeChallenge && currentHintIndex < activeChallenge.hints.length) {
      setShowHint(true);
      if (heroStats && heroStats.powerPoints >= 5) {
        setHeroStats({
          ...heroStats,
          powerPoints: heroStats.powerPoints - 5
        });
      }
    }
  };

  const nextHint = () => {
    if (activeChallenge && currentHintIndex < activeChallenge.hints.length - 1) {
      setCurrentHintIndex(currentHintIndex + 1);
    }
  };

  const handleTimeUp = () => {
    setIsTraining(false);
    alert(isHeroMode() ? 
      '⏰ TIME\'S UP, HERO! BUT DON\'T WORRY - EVERY ATTEMPT MAKES YOU STRONGER!' :
      '⏰ Time\'s up! Try again when you\'re ready.'
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case 'common': return '#6b7280';
      case 'rare': return '#3b82f6';
      case 'epic': return '#8b5cf6';
      case 'legendary': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (!heroStats) {
    return (
      <div className="loading-hero-stats">
        <div className="hero-spinner">💪</div>
        <p>Loading Hero Training Academy...</p>
      </div>
    );
  }

  return (
    <div className="hero-training-container">
      {/* Hero Stats Dashboard */}
      <div className="hero-stats-panel">
        <div className="hero-card hero-profile">
          <div className="profile-header">
            <div className="hero-avatar">🦸</div>
            <div className="hero-info">
              <h2 className="hero-title">
                {isHeroMode() ? 'HERO IN TRAINING' : 'Developer'}
              </h2>
              <div className="hero-rank">{heroStats.rank}</div>
            </div>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Level</span>
              <span className="stat-value">{heroStats.level}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">XP</span>
              <span className="stat-value">{heroStats.xp}/{heroStats.xpToNext}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Power Points</span>
              <span className="stat-value">{heroStats.powerPoints}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Streak</span>
              <span className="stat-value">{heroStats.streakDays} days</span>
            </div>
          </div>

          <div className="xp-progress">
            <div className="hero-progress">
              <div 
                className="hero-progress-fill" 
                style={{ width: `${(heroStats.xp / heroStats.xpToNext) * 100}%` }}
              />
            </div>
            <span className="progress-text">
              {heroStats.xpToNext - heroStats.xp} XP to next level
            </span>
          </div>
        </div>

        {/* Achievements */}
        <div className="hero-card achievements-panel">
          <h3 className="panel-title">
            {isHeroMode() ? '🏆 HEROIC ACHIEVEMENTS' : '🏆 Achievements'}
          </h3>
          <div className="achievements-list">
            {heroStats.achievements.map(achievement => (
              <div key={achievement.id} className="achievement-item">
                <span 
                  className="achievement-icon"
                  style={{ color: getRarityColor(achievement.rarity) }}
                >
                  {achievement.icon}
                </span>
                <div className="achievement-details">
                  <div className="achievement-title">{achievement.title}</div>
                  <div className="achievement-description">{achievement.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Training Challenges */}
      <div className="challenges-section">
        {!activeChallenge ? (
          <>
            <div className="section-header">
              <h2 className="hero-title">
                {isHeroMode() ? '⚡ HERO TRAINING CHALLENGES' : '💪 Training Challenges'}
              </h2>
              <p className="section-subtitle">
                {isHeroMode() ? 
                  'CHOOSE YOUR TRAINING PATH TO BECOME A LEGENDARY DEVELOPER!' :
                  'Select a challenge to improve your skills'
                }
              </p>
            </div>

            <div className="challenges-grid">
              {challenges.map(challenge => (
                <div key={challenge.id} className="hero-card challenge-card">
                  <div className="challenge-header">
                    <h3 className="challenge-title">{challenge.title}</h3>
                    <div 
                      className="difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(challenge.difficulty) }}
                    >
                      {challenge.difficulty.toUpperCase()}
                    </div>
                  </div>
                  
                  <p className="challenge-description">{challenge.description}</p>
                  
                  <div className="challenge-rewards">
                    <div className="reward-item">
                      <span className="reward-icon">⭐</span>
                      <span>{challenge.xpReward} XP</span>
                    </div>
                    <div className="reward-item">
                      <span className="reward-icon">💎</span>
                      <span>{challenge.powerPoints} PP</span>
                    </div>
                    {challenge.timeLimit && (
                      <div className="reward-item">
                        <span className="reward-icon">⏰</span>
                        <span>{challenge.timeLimit} min</span>
                      </div>
                    )}
                  </div>

                  <div className="challenge-requirements">
                    <h4>Requirements:</h4>
                    <ul>
                      {challenge.requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="challenge-buttons">
                    <button 
                      className="hero-button challenge-details-btn"
                      onClick={() => openChallengeDetails(challenge)}
                    >
                      {isHeroMode() ? '📋 VIEW HERO MISSION' : '📋 View Details'}
                    </button>
                    <button 
                      className="hero-button challenge-start-btn"
                      onClick={() => startChallenge(challenge)}
                    >
                      {isHeroMode() ? '⚡ START NOW' : '🚀 Quick Start'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Active Challenge View */
          <div className="active-challenge">
            <div className="challenge-header">
              <h2 className="hero-title">{activeChallenge.title}</h2>
              <div className="challenge-controls">
                {timeLeft !== null && (
                  <div className="timer">
                    <span className="timer-icon">⏰</span>
                    <span className="timer-value">{formatTime(timeLeft)}</span>
                  </div>
                )}
                <button 
                  className="hero-button hint-btn"
                  onClick={useHint}
                  disabled={!isTraining || heroStats.powerPoints < 5}
                >
                  💡 Hint (5 PP)
                </button>
                <button 
                  className="hero-button quit-btn"
                  onClick={() => {
                    setActiveChallenge(null);
                    setIsTraining(false);
                    setTimeLeft(null);
                  }}
                >
                  🔙 Back
                </button>
              </div>
            </div>

            <div className="challenge-content">
              <div className="challenge-description-active">
                <p>{activeChallenge.description}</p>
                
                <div className="requirements-active">
                  <h4>Requirements:</h4>
                  <ul>
                    {activeChallenge.requirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </div>

                {showHint && (
                  <div className="hint-panel">
                    <h4>💡 Hint {currentHintIndex + 1}:</h4>
                    <p>{activeChallenge.hints[currentHintIndex]}</p>
                    {currentHintIndex < activeChallenge.hints.length - 1 && (
                      <button className="hero-button" onClick={nextHint}>
                        Next Hint
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="answer-section">
                <h4>Your Solution:</h4>
                <textarea
                  className="answer-textarea"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder={isHeroMode() ? 
                    "Write your heroic solution here... PLUS ULTRA!" :
                    "Write your solution here..."
                  }
                  disabled={!isTraining}
                />
                
                {isTraining ? (
                  <button 
                    className="hero-button submit-btn"
                    onClick={submitAnswer}
                    disabled={!userAnswer.trim()}
                  >
                    {isHeroMode() ? '💪 SUBMIT HERO SOLUTION' : '🚀 Submit Solution'}
                  </button>
                ) : (
                  <div className="challenge-result">
                    {activeChallenge.completed ? (
                      <div className="success-message">
                        <h3>
                          {isHeroMode() ? 
                            `🎉 HEROIC SUCCESS! PLUS ULTRA! Score: ${activeChallenge.score}/100` :
                            `🎉 Challenge Complete! Score: ${activeChallenge.score}/100`
                          }
                        </h3>
                        <p>{getRandomCatchphrase()}</p>
                      </div>
                    ) : (
                      <div className="failure-message">
                        <h3>
                          {isHeroMode() ? 
                            '💪 KEEP TRAINING, HERO! EVERY FAILURE MAKES YOU STRONGER!' :
                            'Try again! You\'ve got this!'
                          }
                        </h3>
                      </div>
                    )}
                    
                    <button 
                      className="hero-button"
                      onClick={() => {
                        setActiveChallenge(null);
                        setIsTraining(false);
                        setTimeLeft(null);
                      }}
                    >
                      Back to Challenges
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Challenge Details Modal */}
      <ChallengeDetailsModal 
        isOpen={isDetailsModalOpen}
        onClose={closeChallengeDetails}
        onStartChallenge={() => startChallenge()}
        challenge={selectedChallenge}
      />
    </div>
  );
};

export default HeroTrainingMode;