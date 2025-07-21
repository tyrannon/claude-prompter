import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { LearningAnalyticsService } from './services/LearningAnalyticsService';
import { DatabaseService } from './services/DatabaseService';
import { SessionService } from './services/SessionService';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize services
const dbService = new DatabaseService();
const sessionService = new SessionService();
const analyticsService = new LearningAnalyticsService(dbService, sessionService);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Learning analytics endpoints
app.get('/api/learning-data', async (req, res) => {
  try {
    const learningData = await analyticsService.getLearningData();
    res.json(learningData);
  } catch (error) {
    console.error('Error fetching learning data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch learning data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Usage analytics endpoints
app.get('/api/usage-report/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const { startDate, endDate } = req.query;

    if (!['today', 'month', 'custom'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use: today, month, or custom' });
    }

    const report = await dbService.getUsageReport(
      period as 'today' | 'month' | 'custom',
      startDate as string,
      endDate as string
    );
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching usage report:', error);
    res.status(500).json({ 
      error: 'Failed to fetch usage report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Session analytics endpoints
app.get('/api/sessions', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const sessions = await sessionService.getRecentSessions(parseInt(limit as string));
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/sessions/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const sessions = await sessionService.searchSessions(query);
    res.json(sessions);
  } catch (error) {
    console.error('Error searching sessions:', error);
    res.status(500).json({ 
      error: 'Failed to search sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Pattern analysis endpoints
app.get('/api/patterns', async (req, res) => {
  try {
    const patterns = await analyticsService.getPatternAnalysis();
    res.json(patterns);
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pattern analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Growth metrics endpoints
app.get('/api/growth', async (req, res) => {
  try {
    const growth = await analyticsService.getGrowthMetrics();
    res.json(growth);
  } catch (error) {
    console.error('Error fetching growth metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch growth metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Topic evolution endpoints
app.get('/api/topics/evolution', async (req, res) => {
  try {
    const evolution = await analyticsService.getTopicEvolution();
    res.json(evolution);
  } catch (error) {
    console.error('Error fetching topic evolution:', error);
    res.status(500).json({ 
      error: 'Failed to fetch topic evolution',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// WebSocket connection for real-time updates
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Send initial data
  ws.send(JSON.stringify({ 
    type: 'connection', 
    message: 'Connected to claude-prompter analytics',
    timestamp: new Date().toISOString()
  }));

  // Handle client messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          // Client wants to subscribe to real-time updates
          ws.send(JSON.stringify({
            type: 'subscribed',
            message: 'Subscribed to real-time updates',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'get-live-data':
          // Send current learning data
          const learningData = await analyticsService.getLearningData();
          ws.send(JSON.stringify({
            type: 'live-data',
            data: learningData,
            timestamp: new Date().toISOString()
          }));
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl 
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 claude-prompter API server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard should connect to: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket available at: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    dbService.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    dbService.close();
    process.exit(0);
  });
});