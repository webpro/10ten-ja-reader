import webpack from 'webpack';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pjson = require('./package.json');

return {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['css-loader'],
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' },
    ],
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
    },
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new webpack.DefinePlugin({
      __ACTIVE_TAB_ONLY__: false,
      __SUPPORTS_SVG_ICONS__: false,
      __SUPPORTS_TAB_CONTEXT_TYPE__: false,
      __VERSION__: `'${pjson.version}'`,
    }),
  ],
};
