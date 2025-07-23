import { createStatsCommand } from '../stats';
import { createPatternsCommand } from '../patterns';
import { Command } from 'commander';

// Simple mocks to avoid memory issues
jest.mock('../../data/SessionManager', () => ({
  SessionManager: jest.fn(() => ({
    getAllSessions: jest.fn()
  }))
}));

jest.mock('chalk', () => ({
  red: (text: string) => text,
  yellow: (text: string) => text,
  gray: (text: string) => text,
  green: (text: string) => text,
  cyan: (text: string) => text,
  white: (text: string) => text,
  bold: {
    yellow: (text: string) => text,
    cyan: (text: string) => text
  }
}));

jest.mock('boxen', () => (text: string) => text);
jest.mock('cli-table3', () => jest.fn(() => ({
  push: jest.fn(),
  toString: () => 'mocked table'
})));
jest.mock('date-fns', () => ({
  format: () => '2025-07-22'
}));
jest.mock('fs', () => ({
  writeFileSync: jest.fn()
}));

describe('Analytics Commands', () => {
  describe('Stats Command', () => {
    it('should create a command with correct configuration', () => {
      const command = createStatsCommand();
      
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('stats');
      expect(command.description()).toBe('Display learning statistics and progress in terminal');
      
      const options = command.options;
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].flags).toBe('-d, --detailed');
      expect(options[1].flags).toBe('-p, --project <name>');
      expect(options[2].flags).toBe('-j, --json');
    });
  });

  describe('Patterns Command', () => {
    it('should create a command with correct configuration', () => {
      const command = createPatternsCommand();
      
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('patterns');
      expect(command.description()).toBe('Analyze pattern frequency and usage trends in your learning history');
      
      const options = command.options;
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].flags).toBe('-t, --type <type>');
      expect(options[1].flags).toBe('-p, --project <name>');
      expect(options[2].flags).toBe('-d, --days <number>');
    });
  });
});