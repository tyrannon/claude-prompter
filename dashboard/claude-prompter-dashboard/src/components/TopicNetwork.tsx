import React from 'react';
import './TopicNetwork.css';

interface TopicNetworkProps {
  topics: string[];
}

const TopicNetwork: React.FC<TopicNetworkProps> = ({ topics }) => {
  return (
    <div className="topic-network">
      <div className="network-placeholder">
        <div className="network-nodes">
          {topics.map((topic, index) => (
            <div 
              key={index} 
              className="network-node"
              style={{
                left: `${20 + (index * 25)}%`,
                top: `${30 + (index % 2 * 20)}%`,
                animationDelay: `${index * 0.2}s`
              }}
            >
              <div className="node-circle"></div>
              <div className="node-label">{topic}</div>
            </div>
          ))}
        </div>
        
        <svg className="network-connections" width="100%" height="200">
          {topics.map((_, index) => {
            if (index === 0) return null;
            const x1 = 20 + ((index - 1) * 25);
            const y1 = 30 + ((index - 1) % 2 * 20);
            const x2 = 20 + (index * 25);
            const y2 = 30 + (index % 2 * 20);
            
            return (
              <line
                key={`connection-${index}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="url(#connectionGradient)"
                strokeWidth="2"
                className="network-connection"
                style={{ animationDelay: `${index * 0.3}s` }}
              />
            );
          })}
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#667eea" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#764ba2" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      <div className="network-info">
        <p>🌐 This visualization shows how your learning topics connect and evolve over time.</p>
        <p>📊 Interactive network graph with D3.js coming in Phase 2!</p>
      </div>
    </div>
  );
};

export default TopicNetwork;