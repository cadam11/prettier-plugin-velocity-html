"use strict";

const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    playground: "./playground/index.js",
  },
  devtool: 'inline-source-map',
  // output: {
  //   filename: "[name].js",
  //   path: __dirname + "/static/",
  // },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader",
        options: {
          presets: ["@babel/env", "@babel/react"],
        },
      },
    ],
  },
  // output: {
  //   path: path.resolve(__dirname, './dist'),
  //   filename: 'index_bundle.js',
  // },
  plugins: [new HtmlWebpackPlugin({
    template: 'playground/index.html'
  })],
  externals: {
    clipboard: "ClipboardJS",
    codemirror: "CodeMirror",
    react: "React",
    "react-dom": "ReactDOM",
  },
  devServer: {
    contentBase: path.join(__dirname, 'static'),
    setup: function(app, server) {
      app.get('/lib/:file', function (req, res) {
        console.log(`Getting file ${req.params.file}`);
        if (req.params.file === "parser-velocity-html.js") {
          res.sendFile(path.join(__dirname, 'node_modules', 'prettier-plugin-velocity-html', 'standalone.js'))
        } else {
          res.sendFile(path.join(__dirname, 'node_modules', 'prettier', req.params.file));
        }
      })
    }
  }
};
