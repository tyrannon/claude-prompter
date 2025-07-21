import React, { useState, useEffect, useMemo } from 'react';
import './SessionBrowser.css';

interface Session {
  sessionId: string;
  projectName: string;
  createdDate: string;
  lastAccessed: string;
  conversationCount: number;
  status: 'active' | 'completed' | 'archived';
  tags: string[];
  totalCost?: number;
  successRate?: number;
}

interface SessionBrowserProps {
  onSessionSelect?: (session: Session) => void;
}

const SessionBrowser: React.FC<SessionBrowserProps> = ({ onSessionSelect }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'lastAccessed' | 'createdDate' | 'conversationCount' | 'projectName'>('lastAccessed');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/sessions?limit=50');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the data to include mock additional fields for demo
      const enhancedSessions = data.map((session: any) => ({
        ...session,
        totalCost: Math.random() * 0.25 + 0.05, // Mock cost data
        successRate: Math.random() * 20 + 80, // Mock success rate 80-100%
        tags: session.tags || ['general'],
        createdDate: new Date(session.createdDate).toISOString(),
        lastAccessed: new Date(session.lastAccessed).toISOString()
      }));
      
      setSessions(enhancedSessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      
      // Fallback to mock data for demonstration
      const mockSessions: Session[] = [
        {
          sessionId: 'session-1',
          projectName: 'claude-prompter',
          createdDate: new Date(Date.now() - 86400000).toISOString(),
          lastAccessed: new Date(Date.now() - 3600000).toISOString(),
          conversationCount: 15,
          status: 'active',
          tags: ['meta-learning', 'prompt-engineering'],
          totalCost: 0.12,
          successRate: 94.2
        },
        {
          sessionId: 'session-2',
          projectName: 'stylemuse',
          createdDate: new Date(Date.now() - 172800000).toISOString(),
          lastAccessed: new Date(Date.now() - 7200000).toISOString(),
          conversationCount: 8,
          status: 'completed',
          tags: ['ui-design', 'react'],
          totalCost: 0.08,
          successRate: 87.5
        },
        {
          sessionId: 'session-3',
          projectName: 'codeagent',
          createdDate: new Date(Date.now() - 259200000).toISOString(),
          lastAccessed: new Date(Date.now() - 10800000).toISOString(),
          conversationCount: 23,
          status: 'active',
          tags: ['code-generation', 'automation'],
          totalCost: 0.19,
          successRate: 91.3
        }
      ];
      
      setSessions(mockSessions);
    } finally {
      setLoading(false);
    }
  };

  const projects = useMemo(() => {
    const projectSet = new Set(sessions.map(s => s.projectName));
    return ['all', ...Array.from(projectSet)];
  }, [sessions]);

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions.filter(session => {
      const matchesSearch = searchTerm === '' || 
        session.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesProject = projectFilter === 'all' || session.projectName === projectFilter;
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      
      return matchesSearch && matchesProject && matchesStatus;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdDate' || sortBy === 'lastAccessed') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [sessions, searchTerm, projectFilter, statusFilter, sortBy, sortOrder]);

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session.sessionId);
    onSessionSelect?.(session);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: Session['status']) => {
    switch (status) {
      case 'active': return '🟢';
      case 'completed': return '✅';
      case 'archived': return '📦';
      default: return '⭕';
    }
  };

  if (loading) {
    return (
      <div className="session-browser-loading">
        <div className="loading-spinner"></div>
        <p>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="session-browser">
      <div className="session-browser-header">
        <h2>📚 Session Browser</h2>
        <div className="session-count">
          {filteredAndSortedSessions.length} of {sessions.length} sessions
        </div>
      </div>

      <div className="session-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="🔍 Search sessions, projects, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="filter-select"
          >
            {projects.map(project => (
              <option key={project} value={project}>
                {project === 'all' ? 'All Projects' : project}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="filter-select"
          >
            <option value="lastAccessed-desc">Latest Activity</option>
            <option value="createdDate-desc">Newest First</option>
            <option value="createdDate-asc">Oldest First</option>
            <option value="conversationCount-desc">Most Active</option>
            <option value="projectName-asc">Project A-Z</option>
          </select>
        </div>
      </div>

      <div className="session-list">
        {filteredAndSortedSessions.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions found matching your criteria.</p>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredAndSortedSessions.map((session) => (
            <div
              key={session.sessionId}
              className={`session-item ${selectedSession === session.sessionId ? 'selected' : ''}`}
              onClick={() => handleSessionClick(session)}
            >
              <div className="session-item-header">
                <div className="session-project">
                  {getStatusIcon(session.status)} {session.projectName}
                </div>
                <div className="session-id">{session.sessionId}</div>
              </div>

              <div className="session-item-body">
                <div className="session-metrics">
                  <div className="metric">
                    <span className="metric-label">Conversations</span>
                    <span className="metric-value">{session.conversationCount}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Success Rate</span>
                    <span className="metric-value">{session.successRate?.toFixed(1)}%</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Cost</span>
                    <span className="metric-value">${session.totalCost?.toFixed(3)}</span>
                  </div>
                </div>

                <div className="session-tags">
                  {session.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="session-item-footer">
                <div className="session-dates">
                  <div className="date-item">
                    <span className="date-label">Created:</span>
                    <span className="date-value">{formatDate(session.createdDate)}</span>
                  </div>
                  <div className="date-item">
                    <span className="date-label">Last accessed:</span>
                    <span className="date-value">{formatDate(session.lastAccessed)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredAndSortedSessions.length > 10 && (
        <div className="session-pagination">
          <button className="pagination-btn">Load More Sessions</button>
        </div>
      )}
    </div>
  );
};

export default SessionBrowser;