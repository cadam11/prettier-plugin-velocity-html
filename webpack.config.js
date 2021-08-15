"use strict";

const TerserPlugin = require('terser-webpack-plugin');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const glob = require("glob");
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const fs = require('fs');

const SOURCE_PATH = "src";
const GENERATED_PARSER_FILES = SOURCE_PATH + "/parser/generated";
const ANTLR_CMD = `./node_modules/.bin/antlr4ts -Dlanguage=JavaScript -Xexact-output-dir -o ${GENERATED_PARSER_FILES}`;

const generateLexer = new WebpackShellPluginNext({
  onBuildStart:{
    scripts: [`npx rimraf ${GENERATED_PARSER_FILES} && ${ANTLR_CMD} -no-listener -no-visitor ${SOURCE_PATH}/parser/VelocityHtmlLexer.g4`],
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
  optimization: {
    minimizer: [new TerserPlugin({
      // Omit LICENSE generation
      extractComments: false,
    })],
  },
  stats: {
    errorDetails: true
  }
  // stats: 'verbose'
}

// TODO Rename
if (process.env.BUILD_STANDALONE == "true") {
  module.exports = [{
    ...DEFAULT_CONFIG,
    mode: 'production',
    target: 'web',
    entry: {
      standalone: "./src/index.ts",
    },
    output: {
      path:  OUTPUT_PATH,
      filename: '[name].js',
      library: {
        type: "umd"
      },
      globalObject: 'this'
    },
    plugins: [
      generateLexer, 
      new NodePolyfillPlugin(),
      new CopyPlugin({
        patterns: [
          { from: "package.json" }
        ],
      }),
    ]
  }, {
    entry: {
      playground: "./website/playground/index.js",
    },
    output: {
      path: OUTPUT_PATH,
      library: {
        type: "umd"
      },
    },
    devtool: 'inline-source-map',
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
    plugins: [new HtmlWebpackPlugin({
      template: 'website/playground/index.html'
    }), new CopyPlugin({
      patterns: [
        {
          from: "website/static/"
        }
      ],
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
  }, {
    entry: {
      server: "./website/server.js",
    },
    output: {
      path: OUTPUT_PATH,
      filename: '[name].js',
      library: {
        type: "commonjs"
      },
    },
    optimization: {
      minimize: false,
    },
    target: 'node',
    externalsPresets: { node: true },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "website/static/"
          },
          {
            from: "node_modules/prettier/{standalone,parser-postcss,parser-babel}.js"
          }
        ],
      })
    ]
  }]
} else {
  const printDocLocalPath = './tools/local/printDocLocal.ts';
  let printLocalEntry = {}
  if (fs.existsSync(printDocLocalPath)) {
    printLocalEntry = {
      'tools/printDocLocal': printDocLocalPath
    }
  }
  module.exports = {
    ...DEFAULT_CONFIG,
    entry: {
      index: "./src/index.ts",
      'test/index': glob.sync("./test/**/*.ts"),
      'tools/TestRig': './tools/TestRig.ts',
      ...printLocalEntry
    },
    devtool: 'inline-source-map',
    output: {
      path: OUTPUT_PATH,
      filename: '[name].js',
      library: {
        type: "commonjs"
      },
    },
    target: 'node',
    externalsPresets: { node: true },
    externals: [
      {"./printDocLocal": './printDocLocal'},
      nodeExternals()
    ],
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
          { from: ".npmignore"},
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