const path = require('path');
const webpack = require('webpack')

const mode = process.env.NODE_ENV ? process.env.NODE_ENV : 'development'
console.log("Mode chosen for webpack: " + mode)
const devtool = mode === 'development' ? 'eval': 'source-map'
const config = {
  mode: mode,
  devtool: devtool,
  entry: './src-client/entrypoint.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
          },
          {
            loader: 'postcss-loader',
          }
        ]
      },
      {
        test: /(\.scss|\.sass)$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
          },
          {
            loader: 'postcss-loader',
          },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: [
                  path.resolve(__dirname, './node_modules'),
                  path.resolve(__dirname, './src-client')
                ]
              }
            },
          }
        ]
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery"
    })
  ]
}

const jsConfig = Object.assign({}, config, {
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist/client/'),
  }
});

const cssConfig = Object.assign({}, config, {
  output: {
    filename: '[name].css',
    path: path.resolve(__dirname, 'dist/client/css/'),
  }
});

module.exports = [
  jsConfig, cssConfig,
];