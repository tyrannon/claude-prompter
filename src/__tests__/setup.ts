// Jest setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock chalk to avoid ES module issues
jest.mock('chalk', () => ({
  default: {
    red: jest.fn((str) => str),
    green: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    blue: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    magenta: jest.fn((str) => str),
    white: jest.fn((str) => str),
    gray: jest.fn((str) => str),
    grey: jest.fn((str) => str),
    bold: jest.fn((str) => str),
    dim: jest.fn((str) => str),
    underline: jest.fn((str) => str),
  },
  red: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  magenta: jest.fn((str) => str),
  white: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  grey: jest.fn((str) => str),
  bold: jest.fn((str) => str),
  dim: jest.fn((str) => str),
  underline: jest.fn((str) => str),
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

// Mock ora
jest.mock('ora', () => jest.fn(() => ({
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  text: '',
})));

// Mock boxen  
jest.mock('boxen', () => jest.fn((str) => str));

// Set test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Basic setup test
describe('Jest Setup', () => {
  it('should load test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});