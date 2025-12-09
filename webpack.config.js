const path = require('path');

const mode = process.env.NODE_ENV ? process.env.NODE_ENV : 'development'
console.log("Mode chosen for webpack: " + mode)
const devtool = mode === 'development' ? 'eval': 'nosources-source-map'
module.exports = {
  mode: mode,
  devtool: devtool,
  entry: {
    'index': './src/index.ts',
  },
  target: 'node',
  node: {
    __dirname: false,
    __filename: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.html', '.ico']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './dist/'),
  }
};
