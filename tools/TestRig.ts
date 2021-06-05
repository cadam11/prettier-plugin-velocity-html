/* eslint-disable @typescript-eslint/ban-ts-comment, no-console */

import { CharStreams, CommonTokenStream } from "antlr4ts";
import { VelocityHtmlLexer } from "../src/parser/generated/VelocityHtmlLexer";
import { VelocityTokenFactory } from "../src/parser/VelocityTokenFactory";
import * as fs from "fs";
import * as path from "path";
import { VelocityToken } from "../src/parser/VelocityToken";
import { Command } from "commander";
import * as prettier from "prettier";
import { RootNode } from "../src/parser/VelocityParserNodes";

const program = new Command();

interface ReadTestCaseOpts {
  file: string | undefined;
  text: string | undefined;
  token: boolean;
  doc: boolean;
  ast: boolean;
  format: boolean;
}

interface PrintDocOpts {
  file: string;
}

// @ts-ignore
const prettierWithDebug = prettier as PrettierWithDebug;

interface PrettierWithDebug {
  __debug: PrettierDebug;
  format: (input: string, options: prettier.Options) => string;
}

interface PrettierDebug {
  parse: (input: string, options: prettier.Options) => { ast: RootNode };
  printToDoc: (input: string, options: prettier.Options) => prettier.Doc;
  formatDoc: (input: prettier.Doc, options: prettier.Options) => string;
  printDocToString: (
    input: prettier.Doc,
    options: prettier.Options
  ) => { formatted: string };
}

function main(): void {
  program
    .command("read-test-case")
    .option("--file <file>", "file input")
    .option("--token", "display tokens")
    .option("--ast", "display AST")
    .option("--doc", "display Doc[]")
    .option("--format", "format input")
    .action((options: ReadTestCaseOpts) => {
      let input = null;

      if (options.file != null) {
        input = fs.readFileSync(options.file, "utf-8").toString();
      } else {
        program.help();
        process.exit(1);
      }

      const seperator = "\n" + "=".repeat(79) + "\n";
      if (input.includes(seperator)) {
        [input] = input.split(seperator);
      }

      if (options.token) {
        // (LexerATNSimulator as any).debug = true;
        const inputStream = CharStreams.fromString(input);
        const lexer = new VelocityHtmlLexer(inputStream);
        lexer.isDebugEnabled = true;
        const tokenFactory = new VelocityTokenFactory(lexer);
        lexer.tokenFactory = tokenFactory;
        const tokens = new CommonTokenStream(lexer);
        tokens.fill();
        tokens.getTokens().forEach((token) => {
          if (token instanceof VelocityToken) {
            console.log(token.toVelocityString(lexer));
          } else {
            console.log(token.toString());
          }
        });
      }

      const prettierOptions: prettier.Options = {
        parser: "velocity-html",
        // pluginSearchDirs: ["./dir-with-plugins"],
        plugins: ["./dist/src"],
        printWidth: 80,
      };

      if (options.ast) {
        const ast = prettierWithDebug.__debug.parse(input, prettierOptions).ast;
        console.log(JSON.stringify(ast, null, 2));
      }

      if (options.doc) {
        const doc = prettierWithDebug.__debug.formatDoc(
          prettierWithDebug.__debug.printToDoc(input, prettierOptions),
          prettierOptions
        );
        console.log(doc);
      }

      if (options.format) {
        console.log(prettier.format(input, prettierOptions));
      }
    });

  program
    .command("print-doc")
    .option("--file <file>")
    .action((options: PrintDocOpts) => {
      const modulePath = `${path.relative(
        __dirname,
        process.cwd()
      )}/${options.file.replace(".js", "")}`;

      const doc: prettier.Doc[] = require(modulePath).default as prettier.Doc[];
      console.log(
        prettierWithDebug.__debug.printDocToString(
          prettier.doc.builders.concat(doc),
          { parser: "html" }
        ).formatted
      );
    });

  console.log(process.argv);
  program.parse(process.argv);
}

main();
