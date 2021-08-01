"use strict";

const path = require('path');
const glob = require("glob");
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const SOURCE_PATH = "src";
const GENERATED_PARSER_FILES = SOURCE_PATH + "/parser/generated";
const ANTLR_CMD = `./node_modules/.bin/antlr4ts -Dlanguage=JavaScript -Xexact-output-dir -o ${GENERATED_PARSER_FILES}`;

module.exports = {
  mode: 'development',
  entry: {
    index: "./src/index.ts",
    'test/index': glob.sync("./test/**/*.ts"),
    'tools/TestRig': './tools/TestRig.ts'
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
    new WebpackShellPluginNext({
      onBuildStart:{
        scripts: [`rm -r ${GENERATED_PARSER_FILES} && ${ANTLR_CMD} -no-listener -no-visitor ${SOURCE_PATH}/parser/VelocityHtmlLexer.g4`],
        blocking: true,
        parallel: false
      }, 
    })
  ],
  stats: {
    errorDetails: true
  }
};