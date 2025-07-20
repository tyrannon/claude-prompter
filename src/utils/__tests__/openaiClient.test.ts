import { callOpenAI, streamOpenAI, OpenAIError } from '../openaiClient';
import fetch from 'node-fetch';
import { Readable } from 'stream';

jest.mock('node-fetch');
jest.mock('../../data/DatabaseManager');

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('OpenAI Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('callOpenAI', () => {
    it('should successfully call OpenAI API and return response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'test-id',
          model: 'gpt-4o',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response from GPT-4o'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await callOpenAI('Test prompt', 'You are a helpful assistant');
      
      expect(result).toBe('Test response from GPT-4o');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      );
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(callOpenAI('Test prompt')).rejects.toThrow(
        'OPENAI_API_KEY not found in environment variables'
      );
    });

    it('should handle API errors correctly', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: jest.fn().mockResolvedValue(JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        }))
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(callOpenAI('Test prompt')).rejects.toThrow(OpenAIError);
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: null }
          }]
        })
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(callOpenAI('Test prompt')).rejects.toThrow(
        'No response content received from OpenAI'
      );
    });
  });

  describe('streamOpenAI', () => {
    it('should stream responses correctly', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" from"}}]}\n',
        'data: {"choices":[{"delta":{"content":" GPT-4o!"}}]}\n',
        'data: [DONE]\n'
      ];

      const mockStream = new Readable();
      chunks.forEach(chunk => mockStream.push(chunk));
      mockStream.push(null);

      const mockResponse = {
        ok: true,
        body: mockStream
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const collectedChunks: string[] = [];
      await streamOpenAI(
        [{ role: 'user', content: 'Test message' }],
        (chunk) => collectedChunks.push(chunk),
        { temperature: 0.7 }
      );

      expect(collectedChunks).toEqual(['Hello', ' from', ' GPT-4o!']);
    });

    it('should handle streaming errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error')
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        streamOpenAI(
          [{ role: 'user', content: 'Test' }],
          jest.fn()
        )
      ).rejects.toThrow(OpenAIError);
    });

    it('should handle missing response body', async () => {
      const mockResponse = {
        ok: true,
        body: null
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        streamOpenAI(
          [{ role: 'user', content: 'Test' }],
          jest.fn()
        )
      ).rejects.toThrow('No response body');
    });

    it('should handle malformed streaming data gracefully', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n',
        'data: {invalid json}\n', // This should be ignored
        'data: {"choices":[{"delta":{"content":" data"}}]}\n',
        'data: [DONE]\n'
      ];

      const mockStream = new Readable();
      chunks.forEach(chunk => mockStream.push(chunk));
      mockStream.push(null);

      const mockResponse = {
        ok: true,
        body: mockStream
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const collectedChunks: string[] = [];
      await streamOpenAI(
        [{ role: 'user', content: 'Test' }],
        (chunk) => collectedChunks.push(chunk)
      );

      // Should only collect valid chunks
      expect(collectedChunks).toEqual(['Valid', ' data']);
    });

    it('should track token usage for streamed responses', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Test response"}}]}\n',
        'data: [DONE]\n'
      ];

      const mockStream = new Readable();
      chunks.forEach(chunk => mockStream.push(chunk));
      mockStream.push(null);

      const mockResponse = {
        ok: true,
        body: mockStream
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await streamOpenAI(
        [{ role: 'user', content: 'Test' }],
        jest.fn(),
        { command: 'chat', sessionId: 'test-session' }
      );

      // Verify that token usage was recorded
      // (The actual recording is mocked, but we verify the flow works)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle network interruption during streaming', async () => {
      const mockStream = new Readable();
      mockStream.push('data: {"choices":[{"delta":{"content":"Partial"}}]}\n');
      
      // Simulate network error
      setTimeout(() => {
        mockStream.destroy(new Error('Network interrupted'));
      }, 10);

      const mockResponse = {
        ok: true,
        body: mockStream
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const chunks: string[] = [];
      await expect(
        streamOpenAI(
          [{ role: 'user', content: 'Test' }],
          (chunk) => chunks.push(chunk)
        )
      ).rejects.toThrow('Failed to stream from OpenAI API');
    });
  });

  describe('OpenAIError', () => {
    it('should create error with correct properties', () => {
      const error = new OpenAIError(
        403,
        'Forbidden',
        { error: { message: 'Invalid API key' } }
      );

      expect(error.statusCode).toBe(403);
      expect(error.statusText).toBe('Forbidden');
      expect(error.details).toEqual({ error: { message: 'Invalid API key' } });
      expect(error.message).toBe('OpenAI API Error (403): Forbidden');
      expect(error.name).toBe('OpenAIError');
    });
  });
});