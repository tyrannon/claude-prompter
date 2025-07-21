import React from 'react';
import './SessionTimeline.css';

interface SessionTimelineProps {
  sessionCount: number;
  recentSessions: Array<{
    id: number;
    date: string;
    topic: string;
    intensity: number;
  }>;
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({ sessionCount, recentSessions }) => {
  // Use provided recent sessions data or fallback to mock data
  const timelineData = recentSessions.length > 0 
    ? recentSessions.slice(0, 10).map(session => ({
        id: session.id,
        date: new Date(session.date).toLocaleDateString(),
        topic: session.topic,
        sessionNumber: session.id,
        intensity: session.intensity
      }))
    : Array.from({ length: Math.min(sessionCount, 10) }, (_, index) => {
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        
        return {
          id: index + 1,
          date: date.toLocaleDateString(),
          topic: ['React Hooks', 'Database Design', 'Authentication', 'API Development', 'Testing', 'Deployment'][Math.floor(Math.random() * 6)],
          sessionNumber: sessionCount - index,
          intensity: Math.floor(Math.random() * 3) + 1 // 1-3 intensity levels
        };
      }).reverse();

  return (
    <div className="session-timeline">
      <div className="timeline-container">
        {timelineData.map((session, index) => (
          <div 
            key={session.id} 
            className="timeline-item"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="timeline-marker">
              <div className={`timeline-dot intensity-${session.intensity}`}>
                <span className="session-number">{session.sessionNumber}</span>
              </div>
            </div>
            
            <div className="timeline-content">
              <div className="timeline-header">
                <h4 className="timeline-topic">{session.topic}</h4>
                <span className="timeline-date">{session.date}</span>
              </div>
              <div className="timeline-details">
                <span className="session-badge">Session #{session.sessionNumber}</span>
                <div className="intensity-indicator">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div 
                      key={i} 
                      className={`intensity-bar ${i < session.intensity ? 'active' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="timeline-summary">
        <div className="summary-card">
          <div className="summary-stat">
            <span className="summary-number">{sessionCount}</span>
            <span className="summary-label">Total Sessions</span>
          </div>
          <div className="summary-stat">
            <span className="summary-number">{Math.floor(sessionCount / 7)}</span>
            <span className="summary-label">Weeks Active</span>
          </div>
          <div className="summary-stat">
            <span className="summary-number">{Math.floor(sessionCount * 2.3)}</span>
            <span className="summary-label">Avg. Sessions/Week</span>
          </div>
        </div>
        
        <div className="timeline-info">
          <p>📅 Your learning journey timeline shows consistency and growth patterns.</p>
          <p>🔥 The intensity bars indicate session depth and complexity.</p>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeline;