import React, { useState, useEffect, useRef } from 'react';
import { useHeroTheme } from './HeroTheme';
import './SessionDetailsModal.css';

interface SessionMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    model?: string;
    duration?: number;
    cost?: number;
  };
}

interface SessionDetails {
  sessionId: string;
  title: string;
  startTime: string;
  endTime: string;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  project?: string;
  tags: string[];
  messages: SessionMessage[];
  summary?: string;
  achievements?: string[];
}

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({ isOpen, onClose, sessionId }) => {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversation' | 'analytics' | 'achievements'>('conversation');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentTheme, isHeroMode, getRandomCatchphrase } = useHeroTheme();

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchSessionDetails(sessionId);
    }
  }, [isOpen, sessionId]);

  const fetchSessionDetails = async (id: string) => {
    setLoading(true);
    try {
      // Mock API call - replace with real endpoint
      const response = await fetch(`http://localhost:3001/api/sessions/${id}/details`);
      const data = await response.json();
      setSessionDetails(data);
    } catch (error) {
      console.error('Failed to fetch session details:', error);
      // Mock data for demo
      setSessionDetails({
        sessionId: id,
        title: 'React Authentication Component',
        startTime: '2024-01-20T14:30:00Z',
        endTime: '2024-01-20T16:15:00Z',
        totalMessages: 12,
        totalTokens: 4500,
        totalCost: 0.08,
        project: 'E-commerce Platform',
        tags: ['react', 'authentication', 'security'],
        summary: 'Implemented a comprehensive authentication system with JWT tokens, password reset, and user registration.',
        achievements: ['First Auth Implementation', 'Security Expert', 'JWT Master'],
        messages: [
          {
            id: '1',
            type: 'user',
            content: 'Help me create a React authentication component with JWT tokens',
            timestamp: '2024-01-20T14:30:00Z',
            metadata: { tokens: 15 }
          },
          {
            id: '2',
            type: 'assistant',
            content: 'I\'ll help you create a comprehensive React authentication component! Let\'s start with the basic structure and JWT token management.\n\n```tsx\nimport React, { useState, useContext, createContext } from \'react\';\n\ninterface AuthContextType {\n  user: User | null;\n  login: (email: string, password: string) => Promise<void>;\n  logout: () => void;\n  isAuthenticated: boolean;\n}\n\nconst AuthContext = createContext<AuthContextType | undefined>(undefined);\n```',
            timestamp: '2024-01-20T14:31:30Z',
            metadata: { tokens: 250, model: 'gpt-4', duration: 1500, cost: 0.005 }
          },
          {
            id: '3',
            type: 'user',
            content: 'This looks great! Can you add password reset functionality?',
            timestamp: '2024-01-20T14:35:00Z',
            metadata: { tokens: 12 }
          },
          {
            id: '4',
            type: 'assistant',
            content: 'Absolutely! Let\'s add a complete password reset flow with email verification:\n\n```tsx\nconst useAuth = () => {\n  const context = useContext(AuthContext);\n  if (!context) {\n    throw new Error(\'useAuth must be used within AuthProvider\');\n  }\n  return context;\n};\n\nconst AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {\n  const [user, setUser] = useState<User | null>(null);\n  \n  const resetPassword = async (email: string) => {\n    const response = await fetch(\'/api/auth/reset-password\', {\n      method: \'POST\',\n      headers: { \'Content-Type\': \'application/json\' },\n      body: JSON.stringify({ email })\n    });\n    \n    if (!response.ok) {\n      throw new Error(\'Failed to send reset email\');\n    }\n  };\n```',
            timestamp: '2024-01-20T14:37:45Z',
            metadata: { tokens: 320, model: 'gpt-4', duration: 2100, cost: 0.0064 }
          }
        ]
      });
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionDetails]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="hero-modal-overlay" onClick={handleOverlayClick}>
      <div className="hero-modal session-details-modal">
        <div className="modal-header">
          <div className="modal-title-section">
            {isHeroMode() ? (
              <h2 className="hero-title">
                🦸 HERO SESSION ANALYSIS 🦸
              </h2>
            ) : (
              <h2>Session Details</h2>
            )}
            {sessionDetails && (
              <div className="session-meta">
                <h3>{sessionDetails.title}</h3>
                <div className="session-tags">
                  {sessionDetails.tags.map((tag, index) => (
                    <span key={index} className="hero-badge">
                      {isHeroMode() ? `🔥 ${tag.toUpperCase()}` : tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            {isHeroMode() ? '⚡' : '✕'}
          </button>
        </div>

        {loading ? (
          <div className="loading-section">
            {isHeroMode() ? (
              <div className="hero-loading">
                <div className="hero-spinner">💪</div>
                <p>CHANNELING HERO POWER...</p>
              </div>
            ) : (
              <div className="loading-spinner">Loading...</div>
            )}
          </div>
        ) : sessionDetails ? (
          <div className="modal-content">
            <div className="session-stats">
              <div className="hero-stat">
                <span className="stat-icon">{isHeroMode() ? '⚡' : '💬'}</span>
                <span className="stat-label">
                  {isHeroMode() ? 'HERO EXCHANGES' : 'Messages'}
                </span>
                <span className="stat-value">{sessionDetails.totalMessages}</span>
              </div>
              <div className="hero-stat">
                <span className="stat-icon">{isHeroMode() ? '🔥' : '🔤'}</span>
                <span className="stat-label">
                  {isHeroMode() ? 'POWER TOKENS' : 'Tokens'}
                </span>
                <span className="stat-value">{sessionDetails.totalTokens.toLocaleString()}</span>
              </div>
              <div className="hero-stat">
                <span className="stat-icon">{isHeroMode() ? '💰' : '💲'}</span>
                <span className="stat-label">
                  {isHeroMode() ? 'HERO COST' : 'Cost'}
                </span>
                <span className="stat-value">${sessionDetails.totalCost.toFixed(3)}</span>
              </div>
              <div className="hero-stat">
                <span className="stat-icon">{isHeroMode() ? '⏱️' : '🕐'}</span>
                <span className="stat-label">
                  {isHeroMode() ? 'TRAINING TIME' : 'Duration'}
                </span>
                <span className="stat-value">
                  {Math.round((new Date(sessionDetails.endTime).getTime() - new Date(sessionDetails.startTime).getTime()) / 1000 / 60)} min
                </span>
              </div>
            </div>

            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTab === 'conversation' ? 'active' : ''}`}
                onClick={() => setActiveTab('conversation')}
              >
                {isHeroMode() ? '🗣️ HERO DIALOGUE' : '💬 Conversation'}
              </button>
              <button 
                className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                {isHeroMode() ? '📊 POWER ANALYSIS' : '📊 Analytics'}
              </button>
              <button 
                className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
                onClick={() => setActiveTab('achievements')}
              >
                {isHeroMode() ? '🏆 HERO ACHIEVEMENTS' : '🏆 Achievements'}
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'conversation' && (
                <div className="conversation-flow">
                  {sessionDetails.messages.map((message, index) => (
                    <div key={message.id} className={`message ${message.type}`}>
                      <div className="message-header">
                        <div className="message-sender">
                          {message.type === 'user' ? 
                            (isHeroMode() ? '🦸 HERO' : '👤 You') : 
                            (isHeroMode() ? '🤖 MENTOR' : '🤖 Assistant')
                          }
                        </div>
                        <div className="message-time">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        {message.metadata?.tokens && (
                          <div className="message-tokens">
                            {isHeroMode() ? '⚡' : '🔤'} {message.metadata.tokens}
                          </div>
                        )}
                      </div>
                      <div className="message-content">
                        <pre>{message.content}</pre>
                      </div>
                      {message.metadata?.cost && (
                        <div className="message-metadata">
                          <span>Cost: ${message.metadata.cost.toFixed(4)}</span>
                          {message.metadata.duration && (
                            <span>Duration: {(message.metadata.duration / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="session-analytics">
                  <div className="analytics-grid">
                    <div className="hero-card">
                      <h4>{isHeroMode() ? '🎯 HERO EFFICIENCY' : '📈 Efficiency'}</h4>
                      <div className="metric-value">
                        {(sessionDetails.totalTokens / sessionDetails.totalMessages).toFixed(0)} tokens/message
                      </div>
                    </div>
                    <div className="hero-card">
                      <h4>{isHeroMode() ? '💰 POWER EFFICIENCY' : '💰 Cost Efficiency'}</h4>
                      <div className="metric-value">
                        ${(sessionDetails.totalCost / sessionDetails.totalMessages).toFixed(4)}/message
                      </div>
                    </div>
                    <div className="hero-card">
                      <h4>{isHeroMode() ? '🎭 HERO PROJECT' : '📁 Project'}</h4>
                      <div className="metric-value">
                        {sessionDetails.project || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  
                  {sessionDetails.summary && (
                    <div className="hero-card session-summary">
                      <h4>{isHeroMode() ? '📜 HEROIC SUMMARY' : '📝 Session Summary'}</h4>
                      <p>{sessionDetails.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'achievements' && (
                <div className="session-achievements">
                  {sessionDetails.achievements && sessionDetails.achievements.length > 0 ? (
                    <div className="achievements-grid">
                      {sessionDetails.achievements.map((achievement, index) => (
                        <div key={index} className="hero-card achievement-card">
                          <div className="achievement-icon">
                            {isHeroMode() ? '🏆' : '⭐'}
                          </div>
                          <div className="achievement-title">
                            {isHeroMode() ? `HERO ${achievement.toUpperCase()}` : achievement}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-achievements">
                      <p>{isHeroMode() ? 
                        '⚡ KEEP TRAINING TO UNLOCK HERO ACHIEVEMENTS!' : 
                        'No achievements unlocked in this session'
                      }</p>
                    </div>
                  )}
                  
                  {isHeroMode() && (
                    <div className="hero-encouragement">
                      <h4>💪 {getRandomCatchphrase()}</h4>
                      <p>Every session makes you stronger! Keep going PLUS ULTRA!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="error-section">
            <p>Failed to load session details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetailsModal;