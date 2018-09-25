const path = require('path');
const webpack = require('webpack');
module.exports = {
  optimization: {
    minimize: false
  },
  node: {
    fs: 'empty'
  },
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    alias: {
      "jquery-ui": "jquery-ui"
    }
  },
  // expose jquery's $ for imports
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    })
 ],
  module: {
    rules: [
      {
        enforce: "pre",
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "eslint-loader",
        options: {
          configFile: path.resolve('.eslintrc.json'),
          eslint: {
            configFile: path.resolve(__dirname, '.eslintrc.json')
          }
        }
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['@babel/preset-react', '@babel/preset-env'],

        }
      },
      {
        test: /\.css$/, // Only .css files
        loader: 'style-loader!css-loader' // Run both loaders
      }
    ]
  }
};