"use strict";

const path = require('path');
const glob = require("glob");
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  entry: {
    index: "./src/index.ts",
    'test/index': glob.sync("./test/**/*.ts")
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].js',
    clean: true,
    library: {
      type: "umd"
    }
  },
  target: 'node',
  externals: [nodeExternals()],
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./test/**/*",  globOptions: {
          dot: false,
          ignore: ["**/*.ts", "**/velocity-java"]
        } },
      ],
    }),
  ],
};