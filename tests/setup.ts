// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests unless debugging
  log: process.env.DEBUG ? console.log : jest.fn(),
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

export {};