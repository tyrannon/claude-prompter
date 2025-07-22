import React, { useState } from 'react';

interface LearningMilestone {
  id: string;
  date: string;
  title: string;
  emoji: string;
  description: string;
  type: 'discovery' | 'breakthrough' | 'mastery' | 'pattern' | 'streak' | 'celebration';
  skills: string[];
  complexity: number; // 1-5
}

interface LearningJourneyInsightsProps {
  projectName: string;
  milestones: LearningMilestone[];
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const LearningJourneyInsights: React.FC<LearningJourneyInsightsProps> = ({ 
  projectName, 
  milestones,
  theme 
}) => {
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case 'discovery': return '🌱';
      case 'breakthrough': return '💡';
      case 'mastery': return '🌳';
      case 'pattern': return '🔍';
      case 'streak': return '🔥';
      case 'celebration': return '🎉';
      default: return '⭐';
    }
  };

  const getStoryNarrative = (milestone: LearningMilestone, index: number) => {
    const storyTemplates = {
      discovery: [
        `Your journey with ${milestone.skills[0]} began as a curious ${milestone.emoji} seedling, planted in the fertile soil of exploration!`,
        `Like a brave explorer, you discovered the mystical land of ${milestone.skills[0]}, where endless possibilities awaited!`,
        `The ${milestone.emoji} spark of curiosity ignited when you first encountered ${milestone.skills[0]} - and what a beautiful beginning it was!`
      ],
      breakthrough: [
        `EUREKA! ${milestone.emoji} The breakthrough moment when ${milestone.skills[0]} suddenly clicked - like solving a cosmic puzzle!`,
        `This was your "aha!" moment that propelled you into the ranks of ${milestone.skills[0]} wizards! ${milestone.emoji}`,
        `The lightbulb ${milestone.emoji} didn't just turn on - it blazed like a supernova, illuminating your path to mastery!`
      ],
      mastery: [
        `Your ${milestone.skills[0]} skills grew from a humble seedling into a mighty ${milestone.emoji} tree of knowledge!`,
        `Like a skilled artisan, you've crafted your ${milestone.skills[0]} abilities into something truly magnificent! ${milestone.emoji}`,
        `Behold! Your ${milestone.skills[0]} mastery stands tall like a ${milestone.emoji} monument to persistence and learning!`
      ],
      pattern: [
        `Detective work paid off! ${milestone.emoji} You uncovered the hidden patterns in ${milestone.skills[0]} like finding treasure!`,
        `Pattern recognition activated! ${milestone.emoji} You discovered the secret sauce that makes ${milestone.skills[0]} truly powerful!`,
        `Like an architect of code, you ${milestone.emoji} mapped out the beautiful patterns that govern ${milestone.skills[0]}!`
      ],
      streak: [
        `WOW! ${milestone.emoji} You were absolutely ON FIRE during this learning streak - unstoppable coding machine!`,
        `The learning ${milestone.emoji} burned bright as you conquered challenge after challenge with unwavering determination!`,
        `This streak was legendary! ${milestone.emoji} Day after day, you pushed the boundaries of your ${milestone.skills[0]} knowledge!`
      ],
      celebration: [
        `Time to party! ${milestone.emoji} This milestone deserves confetti, cake, and a victory dance!`,
        `Achievement unlocked! ${milestone.emoji} Your hard work in ${milestone.skills[0]} paid off spectacularly!`,
        `Pop the champagne! ${milestone.emoji} This accomplishment is worth celebrating with joy and pride!`
      ]
    };

    const templates = storyTemplates[milestone.type] || storyTemplates.discovery;
    return templates[index % templates.length];
  };

  const getComplexityStars = (complexity: number) => {
    return '⭐'.repeat(complexity) + '☆'.repeat(5 - complexity);
  };

  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="learning-journey-insights">
      <div className="journey-header" style={{ borderLeft: `4px solid ${theme.primary}` }}>
        <h3>📚 Your {projectName} Learning Adventure</h3>
        <p>Every line of code tells a story - here's yours! ✨</p>
      </div>

      <div className="journey-stats">
        <div className="stat-bubble" style={{ background: `${theme.primary}20`, color: theme.primary }}>
          <span className="stat-emoji">🗓️</span>
          <span className="stat-label">Journey Span</span>
          <span className="stat-value">
            {sortedMilestones.length > 0 ? 
              `${Math.ceil((new Date(sortedMilestones[sortedMilestones.length - 1].date).getTime() - 
                new Date(sortedMilestones[0].date).getTime()) / (1000 * 60 * 60 * 24))} days` : '0 days'
            }
          </span>
        </div>
        <div className="stat-bubble" style={{ background: `${theme.secondary}20`, color: theme.secondary }}>
          <span className="stat-emoji">🏆</span>
          <span className="stat-label">Milestones</span>
          <span className="stat-value">{milestones.length}</span>
        </div>
        <div className="stat-bubble" style={{ background: `${theme.accent}20`, color: theme.accent }}>
          <span className="stat-emoji">🧠</span>
          <span className="stat-label">Skills Mastered</span>
          <span className="stat-value">
            {Array.from(new Set(milestones.flatMap(m => m.skills))).length}
          </span>
        </div>
      </div>

      <div className="milestone-timeline">
        {sortedMilestones.map((milestone, index) => (
          <div 
            key={milestone.id} 
            className={`milestone-card ${expandedMilestone === milestone.id ? 'expanded' : ''}`}
            onClick={() => setExpandedMilestone(
              expandedMilestone === milestone.id ? null : milestone.id
            )}
          >
            <div className="milestone-header">
              <div className="milestone-icon" style={{ background: theme.primary }}>
                <span className="milestone-emoji">{getMilestoneIcon(milestone.type)}</span>
              </div>
              <div className="milestone-info">
                <div className="milestone-title">
                  <span className="milestone-number">Chapter {index + 1}</span>
                  <h4>{milestone.title}</h4>
                </div>
                <div className="milestone-date">{milestone.date}</div>
              </div>
              <div className="milestone-expand">
                <span>{expandedMilestone === milestone.id ? '▼' : '▶'}</span>
              </div>
            </div>

            {expandedMilestone === milestone.id && (
              <div className="milestone-details">
                <div className="milestone-story">
                  <p className="story-text">
                    {getStoryNarrative(milestone, index)}
                  </p>
                </div>

                <div className="milestone-meta">
                  <div className="complexity-rating">
                    <span className="meta-label">Complexity:</span>
                    <span className="complexity-stars">{getComplexityStars(milestone.complexity)}</span>
                  </div>
                  
                  <div className="skills-gained">
                    <span className="meta-label">Skills Gained:</span>
                    <div className="skill-tags">
                      {milestone.skills.map((skill, skillIndex) => (
                        <span 
                          key={skillIndex} 
                          className="skill-tag"
                          style={{ 
                            background: `${theme.accent}20`, 
                            color: theme.accent,
                            border: `1px solid ${theme.accent}40`
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="achievement-celebration">
                  <div className="celebration-text">
                    🎉 <strong>Achievement Unlocked:</strong> {milestone.description}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="journey-footer">
        <div className="motivational-message" style={{ background: `${theme.primary}10` }}>
          <span className="motivation-emoji">🚀</span>
          <div className="motivation-text">
            <strong>Keep going, coding champion!</strong>
            <p>Your learning journey is a masterpiece in progress. Every challenge conquered and every skill mastered adds another brilliant stroke to your developer story! ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningJourneyInsights;