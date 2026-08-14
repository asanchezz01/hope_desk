// Jest do frontend.
//
// `transformIgnorePatterns: []` (como estava) força o Babel a transformar todo
// o node_modules — inclusive pacotes já em CommonJS —, o que torna a suíte
// lenta e instável. O padrão do jest-expo transforma apenas os pacotes que
// publicam ESM/JSX; a lista abaixo é a dele acrescida do que este projeto usa.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./test/setup.ts'],
  testMatch: [
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/*.spec.{ts,tsx}',
    '<rootDir>/app/**/*.test.{ts,tsx}',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/.*))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
}
