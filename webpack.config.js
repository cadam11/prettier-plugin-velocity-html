"use strict";

const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const path = require('path');
const glob = require("glob");
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const SOURCE_PATH = "src";
const GENERATED_PARSER_FILES = SOURCE_PATH + "/parser/generated";
const ANTLR_CMD = `./node_modules/.bin/antlr4ts -Dlanguage=JavaScript -Xexact-output-dir -o ${GENERATED_PARSER_FILES}`;

const generateLexer = new WebpackShellPluginNext({
  onBuildStart:{
    scripts: [`rm -r ${GENERATED_PARSER_FILES} && ${ANTLR_CMD} -no-listener -no-visitor ${SOURCE_PATH}/parser/VelocityHtmlLexer.g4`],
    blocking: true,
    parallel: false
  }, 
});

const OUTPUT_PATH = path.resolve(__dirname, './dist');

const DEFAULT_CONFIG = {
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
  stats: {
    errorDetails: true
  }
}

if (process.env.BUILD_STANDALONE == "true") {
  module.exports = {
    ...DEFAULT_CONFIG,
    mode: 'production',
    target: 'web',
    entry: {
      index: "./src/index.ts",
    },
    output: {
      path:  OUTPUT_PATH,
      filename: 'standalone.js',
      library: {
        type: "umd"
      },
      globalObject: 'this'
    },
    plugins: [
      generateLexer, 
      new NodePolyfillPlugin()
    ]
  }
} else {
  module.exports = {
    ...DEFAULT_CONFIG,
    mode: 'development',
    entry: {
      index: "./src/index.ts",
      'test/index': glob.sync("./test/**/*.ts"),
      'tools/TestRig': './tools/TestRig.ts'
    },
    devtool: 'inline-source-map',
    output: {
      path: OUTPUT_PATH,
      filename: '[name].js',
      library: {
        type: "umd"
      },
    },
    target: 'node',
    externals: [nodeExternals()],
    plugins: [
      new CopyPlugin({
        patterns: [
          { 
            from: "./test/**/*",  
            globOptions: {
            dot: false,
            ignore: ["**/*.ts", "**/velocity-java"]
            }
          },
          { from: "package.json" },
          { from: "LICENSE" },
          { from: "legal/**/*" },
          { from: "README.md" },
          { from: "CHANGELOG.md" }
        ],
      }),
      generateLexer
    ]
  }
}