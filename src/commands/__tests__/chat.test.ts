import { createChatCommand } from '../chat';
import { Command } from 'commander';

// Mock dependencies to avoid complex type issues
jest.mock('../../utils/openaiClient', () => ({
  callOpenAI: jest.fn(),
  streamOpenAI: jest.fn(),
  OpenAIError: class extends Error {
    constructor(public statusCode: number, public statusText: string, public details?: any) {
      super(`OpenAI API Error (${statusCode}): ${statusText}`);
    }
  }
}));

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
  
  beforeEach(() => {
    jest.clearAllMocks();
    command = createChatCommand();
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
      expect(optionNames).toContain('--save-history');
      expect(optionNames).toContain('--temperature');
      expect(optionNames).toContain('--max-tokens');
    });
  });

  describe('Basic Functionality', () => {
    it('should be a valid Commander.js command', () => {
      expect(command).toBeInstanceOf(Command);
      expect(typeof command.action).toBe('function');
    });

    it('should have proper option defaults', () => {
      const temperatureOption = command.options.find(opt => opt.long === '--temperature');
      const maxTokensOption = command.options.find(opt => opt.long === '--max-tokens');
      
      expect(temperatureOption?.defaultValue).toBe('0.7');
      expect(maxTokensOption?.defaultValue).toBe('2000');
    });
  });
});