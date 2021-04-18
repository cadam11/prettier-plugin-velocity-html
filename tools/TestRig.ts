/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { CharStreams, CommonTokenStream } from "antlr4ts";
import { VelocityHtmlLexer } from "../src/parser/generated/VelocityHtmlLexer";
import { VelocityTokenFactory } from "../src/parser/VelocityTokenFactory";
import * as fs from "fs";
import { VelocityToken } from "../src/parser/VelocityToken";
import { Command } from "commander";
import * as prettier from "prettier";
import { LexerATNSimulator } from "antlr4ts/atn/LexerATNSimulator";
const program = new Command();

interface TestRigOpts {
  file: string | undefined;
  text: string | undefined;
  token: boolean;
  doc: boolean;
  ast: boolean;
  format: boolean;
}

function main(): void {
  // prettier-ignore
  program
    .option("--file <file>", "file input")
    .option("--text <text>", "text input")
    .option("--token", "display tokens")
    .option("--ast", "display AST")
    .option("--doc", "display Doc[]")
    .option("--format", "format input");

  console.log(process.argv);
  program.parse(process.argv);
  const options: TestRigOpts = program.opts() as TestRigOpts;

  let input = null;

  if (options.file) {
    input = fs.readFileSync(options.file, "utf-8").toString();
  } else if (options.text) {
    input = options.text;
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
  };

  if (options.ast) {
    const ast = (prettier as any).__debug.parse(input, prettierOptions).ast;
    console.log(JSON.stringify(ast, null, 2));
  }

  if (options.doc) {
    const doc = (prettier as any).__debug.formatDoc(
      (prettier as any).__debug.printToDoc(input, prettierOptions),
      prettierOptions
    );
    console.log(doc);
  }

  if (options.format) {
    console.log(prettier.format(input, prettierOptions));
  }
}

main();
