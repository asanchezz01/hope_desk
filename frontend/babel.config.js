module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ts', '.tsx', '.android.ts', '.ios.ts', '.web.ts'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  }
}
