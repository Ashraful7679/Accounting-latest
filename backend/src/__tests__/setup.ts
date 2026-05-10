// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SYSTEM_MODE = 'TEST';

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
});

// Suppress console logs during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}