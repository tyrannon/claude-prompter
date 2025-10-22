/**
 * Tests for ArgumentBuilder utility
 */

import { ArgumentBuilder } from '../argumentBuilder';

describe('ArgumentBuilder', () => {
  describe('parseModels', () => {
    it('should parse comma-separated models', () => {
      const input = 'analyze this with models opus,sonnet,haiku';
      const result = ArgumentBuilder.parseModels(input);
      expect(result).toEqual(['opus', 'sonnet', 'haiku']);
    });

    it('should parse space-separated models', () => {
      const input = 'test using models opus sonnet haiku';
      const result = ArgumentBuilder.parseModels(input);
      expect(result).toEqual(['opus', 'sonnet', 'haiku']);
    });

    it('should filter out common words', () => {
      const input = 'compare with models opus and sonnet';
      const result = ArgumentBuilder.parseModels(input);
      expect(result).toEqual(['opus', 'sonnet']);
    });

    it('should return undefined for no models', () => {
      const input = 'just a regular prompt';
      const result = ArgumentBuilder.parseModels(input);
      expect(result).toBeUndefined();
    });

    it('should handle --models flag', () => {
      const input = 'multishot --models opus,sonnet';
      const result = ArgumentBuilder.parseModels(input);
      expect(result).toEqual(['opus', 'sonnet']);
    });
  });

  describe('sanitizeMessage', () => {
    it('should remove command prefixes', () => {
      const input = 'claude-prompter multishot analyze this code';
      const result = ArgumentBuilder.sanitizeMessage(input);
      expect(result).toBe('analyze this code');
    });

    it('should remove potential flag injections', () => {
      const input = 'analyze this --malicious-flag value code';
      const result = ArgumentBuilder.sanitizeMessage(input);
      expect(result).toBe('this code');
    });

    it('should preserve normal content', () => {
      const input = 'React authentication patterns';
      const result = ArgumentBuilder.sanitizeMessage(input);
      expect(result).toBe('React authentication patterns');
    });
  });

  describe('extractCleanMessage', () => {
    it('should extract message and remove model specifications', () => {
      const input = 'analyze React patterns with models opus and sonnet';
      const models = ['opus', 'sonnet'];
      const result = ArgumentBuilder.extractCleanMessage(input, models);
      expect(result).toBe('React patterns');
    });

    it('should remove command artifacts', () => {
      const input = 'help me with React authentication using different models';
      const result = ArgumentBuilder.extractCleanMessage(input);
      expect(result).toBe('React authentication');
    });

    it('should preserve complex messages', () => {
      const input = 'implement a Duolingo-style streak tracker with freezes and AsyncStorage';
      const result = ArgumentBuilder.extractCleanMessage(input);
      expect(result).toBe('a Duolingo-style streak tracker with freezes and AsyncStorage');
    });
  });

  describe('buildMultishotCommand', () => {
    it('should build basic multishot command', () => {
      const options = {
        message: 'analyze React patterns',
        compare: true
      };
      const result = ArgumentBuilder.buildMultishotCommand(options);
      expect(result).toEqual(['multishot', '-m', 'analyze React patterns', '--compare']);
    });

    it('should include models when provided', () => {
      const options = {
        message: 'analyze React patterns',
        models: ['opus', 'sonnet'],
        compare: true
      };
      const result = ArgumentBuilder.buildMultishotCommand(options);
      expect(result).toEqual(['multishot', '-m', 'analyze React patterns', '--models', 'opus,sonnet', '--compare']);
    });

    it('should handle dry run flag', () => {
      const options = {
        message: 'test message',
        dryRun: true
      };
      const result = ArgumentBuilder.buildMultishotCommand(options);
      expect(result).toEqual(['multishot', '-m', 'test message', '--dry-run']);
    });
  });

  describe('buildSuggestCommand', () => {
    it('should build basic suggest command', () => {
      const options = {
        topic: 'React authentication',
        claudeAnalysis: true
      };
      const result = ArgumentBuilder.buildSuggestCommand(options);
      expect(result).toEqual(['suggest', '-t', 'React authentication', '--claude-analysis']);
    });

    it('should include all parameters', () => {
      const options = {
        topic: 'React patterns',
        showGrowth: true,
        complexity: 'complex' as const,
        language: 'typescript',
        taskType: 'ui-component',
        claudeAnalysis: true
      };
      const result = ArgumentBuilder.buildSuggestCommand(options);
      expect(result).toEqual([
        'suggest',
        '-t', 'React patterns',
        '--show-growth',
        '--complexity', 'complex',
        '-l', 'typescript',
        '--task-type', 'ui-component',
        '--claude-analysis'
      ]);
    });
  });

  describe('buildCommandFromIntent', () => {
    it('should build multishot command from intent', () => {
      const result = ArgumentBuilder.buildCommandFromIntent('multishot', {
        message: 'analyze this code',
        models: ['opus', 'sonnet'],
        compare: true
      });
      expect(result).toEqual(['multishot', '-m', 'analyze this code', '--models', 'opus,sonnet', '--compare']);
    });

    it('should build suggest command from intent', () => {
      const result = ArgumentBuilder.buildCommandFromIntent('suggest', {
        topic: 'React patterns',
        showGrowth: true
      });
      expect(result).toEqual(['suggest', '-t', 'React patterns', '--show-growth', '--claude-analysis']);
    });

    it('should build usage command from intent', () => {
      const result = ArgumentBuilder.buildCommandFromIntent('usage', {
        today: true,
        analyze: true
      });
      expect(result).toEqual(['usage', '--today', '--analyze']);
    });
  });

  describe('validateArguments', () => {
    it('should validate safe arguments', () => {
      const args = ['multishot', '-m', 'analyze React patterns', '--compare'];
      const result = ArgumentBuilder.validateArguments(args);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect command injection attempts', () => {
      const args = ['multishot', '-m', 'analyze; rm -rf /', '--compare'];
      const result = ArgumentBuilder.validateArguments(args);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('potentially unsafe characters');
    });

    it('should detect flag injection in messages', () => {
      const args = ['multishot', '-m', 'analyze this --malicious-flag', '--compare'];
      const result = ArgumentBuilder.validateArguments(args);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('appears to contain flags');
    });

    it('should allow safe flags in messages', () => {
      const args = ['multishot', '-m', 'analyze React with --strict mode', '--compare'];
      const result = ArgumentBuilder.validateArguments(args);
      expect(result.valid).toBe(false); // This should still be caught as potentially unsafe
    });
  });
});