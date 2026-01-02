const path = require('path');
const common = require('./webpack-client.common');
const webpackMerge = require('webpack-merge');

module.exports = webpackMerge.merge(common, {
  mode: 'development',
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          configFile: "tsconfig.dev.json"
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',   // 3. Injects css into DOM
          {
            loader: 'css-loader', // 2. Turns css into commonJS
          },
          {
            loader: 'postcss-loader',
          }
        ]
      },
      {
        test: /(\.scss|\.sass)$/,
        use: [
          'style-loader',  // 3. Injects css into DOM
          {
            loader: 'css-loader',   // 2. Turns css into commonJS
          },
          {
            loader: 'postcss-loader',
          },
          {
            loader: 'sass-loader', // 1. Turns sass to css
            options: {
              sassOptions: {
                includePaths: [
                  path.resolve(__dirname, './node_modules'),
                  path.resolve(__dirname, './src-client')
                ]
              }
            }
          }
        ]
      }
    ]
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist/client/'),
  }
});