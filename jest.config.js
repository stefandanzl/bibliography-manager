module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2017',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'utils/**/*.ts',
    '!src/**/*.d.ts',
    '!utils/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/mocks/obsidian-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};