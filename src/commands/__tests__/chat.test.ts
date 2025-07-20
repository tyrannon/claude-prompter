import { createChatCommand } from '../chat';
import { Command } from 'commander';
import * as openaiClient from '../../utils/openaiClient';
import { SessionManager } from '../../data/SessionManager';
import { TemplateManager } from '../../data/TemplateManager';
import { CommunicationBridge } from '../../data/CommunicationBridge';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Mock dependencies
jest.mock('../../utils/openaiClient');
jest.mock('../../data/SessionManager');
jest.mock('../../data/TemplateManager');
jest.mock('../../data/CommunicationBridge');
jest.mock('inquirer');
jest.mock('ora', () => ({
  default: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
    color: '',
    spinner: ''
  }))
}));

describe('Chat Command', () => {
  let command: Command;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockTemplateManager: jest.Mocked<TemplateManager>;
  let mockBridge: jest.Mocked<CommunicationBridge>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create command
    command = createChatCommand();
    
    // Setup mocks
    mockSessionManager = new SessionManager() as jest.Mocked<SessionManager>;
    mockTemplateManager = new TemplateManager() as jest.Mocked<TemplateManager>;
    mockBridge = new CommunicationBridge(mockSessionManager, mockTemplateManager) as jest.Mocked<CommunicationBridge>;
  });

  describe('Command Configuration', () => {
    it('should have correct command name and description', () => {
      expect(command.name()).toBe('chat');
      expect(command.description()).toBe('Start an interactive chat session with GPT-4o');
    });

    it('should have all required options', () => {
      const options = command.options;
      const optionNames = options.map(opt => opt.long);
      
      expect(optionNames).toContain('--system');
      expect(optionNames).toContain('--session');
      expect(optionNames).toContain('--stream');
      expect(optionNames).toContain('--no-stream');
      expect(optionNames).toContain('--save-history');
      expect(optionNames).toContain('--temperature');
      expect(optionNames).toContain('--max-tokens');
    });
  });

  describe('Streaming Responses', () => {
    it('should handle streaming responses correctly', async () => {
      const mockStreamFn = jest.fn();
      (openaiClient.streamOpenAI as jest.Mock).mockImplementation(
        async (messages, onChunk) => {
          // Simulate streaming chunks
          onChunk('Hello ');
          await new Promise(resolve => setTimeout(resolve, 10));
          onChunk('from ');
          await new Promise(resolve => setTimeout(resolve, 10));
          onChunk('GPT-4o!');
        }
      );

      // Mock user input
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Test message' })
        .mockResolvedValueOnce({ message: '/exit' });

      // Execute command with streaming
      await command.parseAsync(['node', 'test', '--stream']);

      expect(openaiClient.streamOpenAI).toHaveBeenCalled();
    });

    it('should handle streaming errors gracefully', async () => {
      (openaiClient.streamOpenAI as jest.Mock).mockRejectedValue(
        new openaiClient.OpenAIError(500, 'Internal Server Error', { error: 'API Error' })
      );

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Test message' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test', '--stream']);

      // Verify error was handled (console.error was called)
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should load existing session when --session is provided', async () => {
      const mockSession = {
        metadata: {
          sessionId: 'test-session-123',
          createdDate: new Date(),
          lastAccessed: new Date(),
          projectName: 'Test Project',
          status: 'active' as const
        },
        history: [],
        context: {}
      };

      mockSessionManager.loadSession.mockResolvedValue(mockSession);
      
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test', '--session', 'test-session-123']);

      expect(mockSessionManager.loadSession).toHaveBeenCalledWith('test-session-123');
    });

    it('should save conversation history when --save-history is enabled', async () => {
      const mockSession = {
        metadata: {
          sessionId: 'test-session-123',
          createdDate: new Date(),
          lastAccessed: new Date(),
          projectName: 'Test Project',
          status: 'active' as const
        },
        history: [],
        context: {}
      };

      mockSessionManager.loadSession.mockResolvedValue(mockSession);
      mockSessionManager.saveSession.mockResolvedValue();

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Hello' })
        .mockResolvedValueOnce({ message: '/save' })
        .mockResolvedValueOnce({ message: '/exit' });

      (openaiClient.callOpenAI as jest.Mock).mockResolvedValue('Hello! How can I help?');

      await command.parseAsync(['node', 'test', '--session', 'test-session-123', '--save-history']);

      // Verify save was attempted
      expect(mockSessionManager.saveSession).toHaveBeenCalled();
    });
  });

  describe('Command System', () => {
    beforeEach(() => {
      (inquirer.prompt as jest.Mock).mockReset();
    });

    it('should handle /help command', async () => {
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: '/help' })
        .mockResolvedValueOnce({ message: '/exit' });

      const logSpy = jest.spyOn(console, 'log');
      
      await command.parseAsync(['node', 'test']);

      // Check if help message was displayed
      const helpCalls = logSpy.mock.calls.filter(call => 
        call[0] && call[0].toString().includes('Available Commands')
      );
      expect(helpCalls.length).toBeGreaterThan(0);
    });

    it('should handle /clear command', async () => {
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'First message' })
        .mockResolvedValueOnce({ message: '/clear' })
        .mockResolvedValueOnce({ message: '/exit' });

      (openaiClient.callOpenAI as jest.Mock).mockResolvedValue('Response');

      await command.parseAsync(['node', 'test', '--no-stream']);

      // Verify clear message was shown
      expect(console.log).toHaveBeenCalledWith(chalk.green('✓ Conversation cleared'));
    });

    it('should handle /suggest command', async () => {
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Help me with coding' })
        .mockResolvedValueOnce({ message: '/suggest' })
        .mockResolvedValueOnce({ message: '/exit' });

      (openaiClient.callOpenAI as jest.Mock).mockResolvedValue('I can help with coding!');

      await command.parseAsync(['node', 'test', '--no-stream']);

      // Verify suggestions were generated
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n🔄 Generating suggestions based on conversation...\n')
      );
    });

    it('should handle /history command', async () => {
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Message 1' })
        .mockResolvedValueOnce({ message: '/history' })
        .mockResolvedValueOnce({ message: '/exit' });

      (openaiClient.callOpenAI as jest.Mock).mockResolvedValue('Response 1');

      await command.parseAsync(['node', 'test', '--no-stream']);

      // Verify history display logic was triggered
      const logCalls = console.log as jest.Mock;
      const historyCalls = logCalls.mock.calls.filter(call =>
        call[0] && call[0].toString().includes('Conversation History')
      );
      expect(historyCalls.length).toBeGreaterThan(0);
    });

    it('should handle unknown commands gracefully', async () => {
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: '/unknown' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test']);

      expect(console.log).toHaveBeenCalledWith(chalk.red('Unknown command: /unknown'));
    });
  });

  describe('Non-streaming Mode', () => {
    it('should handle non-streaming responses', async () => {
      (openaiClient.callOpenAI as jest.Mock).mockResolvedValue('Non-streaming response');

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Test message' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test', '--no-stream']);

      expect(openaiClient.callOpenAI).toHaveBeenCalled();
      expect(openaiClient.streamOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('Template Integration', () => {
    it('should list available templates when /template is used without args', async () => {
      const mockTemplates = [
        { name: 'code-review', description: 'Code review template' },
        { name: 'debug', description: 'Debugging assistant template' }
      ];

      mockTemplateManager.listTemplates.mockResolvedValue(mockTemplates);

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: '/template' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test']);

      expect(mockTemplateManager.listTemplates).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('Available templates:'));
    });
  });

  describe('Error Handling', () => {
    it('should handle API key missing error', async () => {
      (openaiClient.callOpenAI as jest.Mock).mockRejectedValue(
        new Error('OPENAI_API_KEY not found in environment variables')
      );

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Test' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test', '--no-stream']);

      expect(console.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Error: OPENAI_API_KEY not found in environment variables')
      );
    });

    it('should handle network errors gracefully', async () => {
      (openaiClient.streamOpenAI as jest.Mock).mockRejectedValue(
        new Error('Network error: Unable to connect')
      );

      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ message: 'Test' })
        .mockResolvedValueOnce({ message: '/exit' });

      await command.parseAsync(['node', 'test', '--stream']);

      expect(console.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Error: Network error: Unable to connect')
      );
    });
  });
});