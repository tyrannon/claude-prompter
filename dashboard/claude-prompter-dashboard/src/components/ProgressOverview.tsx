import React from 'react';
import './ProgressOverview.css';

interface ProgressOverviewProps {
  sessionCount: number;
  experienceLevel: string;
  recentTopics: string[];
  languages: string[];
}

const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  sessionCount,
  experienceLevel,
  recentTopics,
  languages
}) => {
  // Calculate progress percentage based on experience level
  const getProgressPercentage = (level: string): number => {
    switch (level) {
      case 'Getting Started': return 15;
      case 'Building Knowledge': return 35;
      case 'Experienced': return 65;
      case 'Expert Level': return 90;
      default: return 0;
    }
  };

  const progressPercentage = getProgressPercentage(experienceLevel);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="progress-overview">
      <h2>🎯 Your Learning Progress</h2>
      
      <div className="progress-circle-container">
        <svg className="progress-circle" width="120" height="120">
          <circle
            cx="60"
            cy="60"
            r="45"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r="45"
            stroke="url(#gradient)"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="progress-bar"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
          </defs>
        </svg>
        <div className="progress-text">
          <div className="session-count">{sessionCount}</div>
          <div className="session-label">Sessions</div>
        </div>
      </div>

      <div className="experience-level">
        <span className="level-badge">{experienceLevel}</span>
        <div className="level-description">
          {progressPercentage < 30 && "Just getting started on your learning journey! 🌱"}
          {progressPercentage >= 30 && progressPercentage < 60 && "Building solid foundations! 📚"}
          {progressPercentage >= 60 && progressPercentage < 85 && "You're becoming quite experienced! 🚀"}
          {progressPercentage >= 85 && "You're a learning expert! 🏆"}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number">{recentTopics.length}</div>
          <div className="stat-label">Recent Topics</div>
          <div className="stat-detail">
            {recentTopics.slice(0, 3).map((topic, index) => (
              <span key={index} className="topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-number">{languages.length}</div>
          <div className="stat-label">Languages</div>
          <div className="stat-detail">
            {languages.slice(0, 3).map((lang, index) => (
              <span key={index} className="language-tag">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressOverview;