/**
 * Integration tests for Natural Language Interface
 */

import { NaturalLanguageParser } from '../natural';

describe('NaturalLanguageParser', () => {
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    parser = new NaturalLanguageParser();
  });

  describe('parseIntent - multishot commands', () => {
    it('should parse multishot request correctly', async () => {
      const input = 'analyze a Duolingo-style streak tracker with freezes and AsyncStorage';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.parameters.message).toBe('a Duolingo-style streak tracker with freezes and AsyncStorage');
      expect(result.parameters.compare).toBe(true);
    });

    it('should parse multishot with explicit models', async () => {
      const input = 'analyze React patterns with opus and sonnet models';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.parameters.models).toEqual(['opus', 'sonnet']);
      expect(result.parameters.message).toBe('React patterns');
    });

    it('should handle complex message without corrupting --models', async () => {
      const input = 'analyze a streak freezes implementation with reward gamification';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.parameters.message).toBe('a streak freezes implementation with reward gamification');
      expect(result.parameters.models).toBeUndefined();
    });
  });

  describe('parseIntent - suggest commands', () => {
    it('should parse single model suggest request', async () => {
      const input = 'quick suggestion for React authentication';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('suggest');
      expect(result.parameters.topic).toBe('React authentication');
    });

    it('should parse suggest with complexity', async () => {
      const input = 'simple suggestion for basic React components';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('suggest');
      expect(result.parameters.complexity).toBe('simple');
    });
  });

  describe('parseIntent - other commands', () => {
    it('should parse usage commands', async () => {
      const input = 'show me my usage today';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('usage');
      expect(result.parameters.today).toBe(true);
    });

    it('should parse stats commands', async () => {
      const input = 'show me detailed statistics';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('stats');
      expect(result.parameters.detailed).toBe(true);
    });

    it('should parse patterns commands', async () => {
      const input = 'show me coding patterns';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('patterns');
      expect(result.parameters.type).toBe('coding');
    });
  });

  describe('confidence scoring', () => {
    it('should have high confidence for clear commands', async () => {
      const input = 'multishot analysis of React authentication patterns';
      const result = await parser.parseIntent(input);

      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should have lower confidence for ambiguous input', async () => {
      const input = 'something about React';
      const result = await parser.parseIntent(input);

      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('opt-out keywords', () => {
    it('should route to suggest for opt-out keywords', async () => {
      const input = 'quick help with React patterns';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('suggest');
    });

    it('should route to suggest for single model keywords', async () => {
      const input = 'simple suggestion for authentication';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('suggest');
    });
  });

  describe('configuration options', () => {
    it('should respect disable multishot config', async () => {
      const customParser = new NaturalLanguageParser({
        defaultToMultishot: false
      });

      const input = 'help me with React authentication';
      const result = await customParser.parseIntent(input);

      expect(result.command).toBe('suggest');
    });

    it('should respect force multishot config', async () => {
      const customParser = new NaturalLanguageParser({
        defaultToMultishot: true,
        multishotOptOutKeywords: [] // Remove opt-out keywords
      });

      const input = 'quick help with React';
      const result = await customParser.parseIntent(input);

      expect(result.command).toBe('multishot');
    });

    it('should respect confidence threshold', async () => {
      const customParser = new NaturalLanguageParser({
        confidenceThreshold: 0.9
      });

      const input = 'vague request';
      const result = await customParser.parseIntent(input);

      // Should still return a result, but confidence checking is done elsewhere
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('message extraction edge cases', () => {
    it('should handle messages with commas correctly', async () => {
      const input = 'analyze React patterns, authentication, and state management';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.parameters.message).toContain('React patterns, authentication, and state management');
      // Should not interpret commas as model separators
      expect(result.parameters.models).toBeUndefined();
    });

    it('should handle messages with dashes and special characters', async () => {
      const input = 'analyze React-Native authentication with OAuth2';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.parameters.message).toBe('React-Native authentication with OAuth2');
    });

    it('should clean up command artifacts from messages', async () => {
      const input = 'help me implement a user authentication system';
      const result = await parser.parseIntent(input);

      expect(result.command).toBe('multishot');
      expect(result.parameters.message).toBe('a user authentication system');
      expect(result.parameters.message).not.toContain('help me implement');
    });
  });

  describe('clarification generation', () => {
    it('should generate clarifications for low confidence', () => {
      const lowConfidenceIntent = {
        command: 'multishot',
        confidence: 0.5,
        parameters: { message: 'vague request' },
        originalText: 'vague request'
      };

      const clarifications = parser.generateClarification(lowConfidenceIntent);

      expect(clarifications.length).toBeGreaterThan(0);
      expect(clarifications[0]).toContain('multishot');
    });

    it('should generate specific clarifications for missing parameters', () => {
      const intentWithoutMessage = {
        command: 'multishot',
        confidence: 0.5,
        parameters: {},
        originalText: 'analyze'
      };

      const clarifications = parser.generateClarification(intentWithoutMessage);

      expect(clarifications.some(q => q.includes('analyze'))).toBe(true);
    });
  });
});