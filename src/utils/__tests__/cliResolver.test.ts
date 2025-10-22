/**
 * Tests for CLIResolver utility
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { CLIResolver } from '../cliResolver';

// Mock fs and spawn
jest.mock('fs', () => ({
  promises: {
    access: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

const mockFS = fs as jest.Mocked<typeof fs>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('CLIResolver', () => {
  beforeEach(() => {
    // Clear cache before each test
    CLIResolver.clearCache();
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.CLAUDE_PROMPTER_BIN;
  });

  describe('resolvePrompter', () => {
    it('should find local node_modules binary', async () => {
      mockFS.access.mockImplementation((path) => {
        if (path.toString().includes('node_modules/.bin/claude-prompter')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.method).toBe('local');
      expect(result.success).toBe(true);
      expect(result.path).toContain('node_modules/.bin/claude-prompter');
    });

    it('should find local dist/cli.js', async () => {
      mockFS.access.mockImplementation((path) => {
        if (path.toString().includes('dist/cli.js')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.method).toBe('local');
      expect(result.success).toBe(true);
      expect(result.path).toContain('node dist/cli.js');
    });

    it('should use environment variable when set', async () => {
      const envPath = '/custom/path/to/claude-prompter';
      process.env.CLAUDE_PROMPTER_BIN = envPath;
      
      mockFS.access.mockImplementation((path) => {
        if (path.toString() === envPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.method).toBe('env');
      expect(result.success).toBe(true);
      expect(result.path).toBe(envPath);
    });

    it('should fallback to npx when available', async () => {
      // Mock all file access to fail
      mockFS.access.mockRejectedValue(new Error('Not found'));
      
      // Mock successful npx test
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10); // Simulate successful exit
          }
        }),
        kill: jest.fn()
      } as any;
      
      mockSpawn.mockReturnValue(mockChild);

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.method).toBe('npx');
      expect(result.success).toBe(true);
      expect(result.path).toBe('npx -y claude-prompter');
    });

    it('should find global paths', async () => {
      // Mock home directory
      const originalHome = process.env.HOME;
      process.env.HOME = '/mock/home';
      
      mockFS.access.mockImplementation((path) => {
        if (path.toString().includes('.local/bin/claude-prompter-global')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.method).toBe('global');
      expect(result.success).toBe(true);
      expect(result.path).toContain('claude-prompter-global');
      
      // Restore home directory
      if (originalHome) {
        process.env.HOME = originalHome;
      } else {
        delete process.env.HOME;
      }
    });

    it('should return failure when nothing is found', async () => {
      // Mock all methods to fail
      mockFS.access.mockRejectedValue(new Error('Not found'));
      
      // Mock npx test failure
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Simulate failure
          }
        }),
        kill: jest.fn()
      } as any;
      
      mockSpawn.mockReturnValue(mockChild);

      const result = await CLIResolver.resolvePrompter();
      
      expect(result.success).toBe(false);
      expect(result.method).toBe('npx'); // Default fallback
    });
  });

  describe('executeCommand', () => {
    it('should execute command with resolved CLI', async () => {
      // Mock successful resolution
      mockFS.access.mockResolvedValue();
      
      // Mock successful command execution
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10); // Success
          }
        })
      } as any;
      
      mockSpawn.mockReturnValue(mockChild);

      const result = await CLIResolver.executeCommand(['suggest', '-t', 'test']);
      
      expect(result).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle node commands properly', async () => {
      // Mock local dist/cli.js found
      mockFS.access.mockImplementation((path) => {
        if (path.toString().includes('dist/cli.js')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });
      
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      } as any;
      
      mockSpawn.mockReturnValue(mockChild);

      await CLIResolver.executeCommand(['suggest', '-t', 'test']);
      
      // Should spawn with 'node' as command
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining([expect.stringContaining('dist/cli.js'), 'suggest', '-t', 'test']),
        expect.any(Object)
      );
    });

    it('should handle npx commands properly', async () => {
      // Mock all file access to fail, npx to succeed
      mockFS.access.mockRejectedValue(new Error('Not found'));
      
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        kill: jest.fn()
      } as any;
      
      mockSpawn.mockReturnValue(mockChild);

      await CLIResolver.executeCommand(['suggest', '-t', 'test']);
      
      // Should eventually spawn with 'npx'
      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['-y', 'claude-prompter', 'suggest', '-t', 'test']),
        expect.any(Object)
      );
    });
  });

  describe('caching', () => {
    it('should cache resolution results', async () => {
      mockFS.access.mockResolvedValue();

      // First call
      const result1 = await CLIResolver.resolvePrompter();
      
      // Second call
      const result2 = await CLIResolver.resolvePrompter();
      
      expect(result1).toBe(result2); // Same object reference
      expect(mockFS.access).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should allow cache clearing', async () => {
      mockFS.access.mockResolvedValue();

      await CLIResolver.resolvePrompter();
      CLIResolver.clearCache();
      await CLIResolver.resolvePrompter();
      
      expect(mockFS.access).toHaveBeenCalledTimes(2); // Called twice after cache clear
    });
  });
});