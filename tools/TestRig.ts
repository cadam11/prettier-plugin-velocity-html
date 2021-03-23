import {
  CharStreams,
  CommonToken,
  CommonTokenStream,
  Recognizer,
  Token,
} from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";
import { VelocityHtmlLexer } from "../src/parser/generated/VelocityHtmlLexer";
import { VelocityTokenFactory } from "../src/parser/VelocityTokenFactory";
import { VelocityHtmlParser } from "../src/parser/generated/VelocityHtmlParser";
import * as fs from "fs";
import { VelocityToken } from "../src/parser/VelocityToken";
import { Command, opts } from "commander";
const program = new Command();

interface TestRigOpts {
  file: string | undefined;
  text: string | undefined;
}

function main(): void {
  // prettier-ignore
  program
    .option("--file <file>", "file input")
    .option("--text <text>", "text input");

  console.log(process.argv);
  program.parse(process.argv);
  const options: TestRigOpts = program.opts() as TestRigOpts;

  let input = null;

  if (options.file) {
    input = fs.readFileSync(process.argv[2], "utf-8").toString();
  } else if (options.text) {
    input = options.text;
  } else {
    program.help();
    process.exit(1);
  }

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
  //   const errors: Error[] = [];
  //   lexer.removeErrorListeners();
  //   lexer.addErrorListener({
  //     syntaxError(
  //       recognizer: Recognizer<Token, ATNSimulator>,
  //       offendingSymbol,
  //       line,
  //       charPositionInLine,
  //       msg,
  //       e
  //     ) {
  //       errors.push(new Error(msg));
  //     },
  //   });
  //   const tokenStream = new CommonTokenStream(lexer);
  //   console.log(tokenStream);
  //   const parser = new VelocityHtmlParser(tokenStream);
  //   parser.removeErrorListeners();
  //   parser.addErrorListener({
  //     syntaxError(
  //       recognizer: Recognizer<Token, ATNSimulator>,
  //       offendingSymbol,
  //       line,
  //       charPositionInLine,
  //       msg,
  //       e
  //     ) {
  //       errors.push(new Error(msg));
  //     },
  //   });
  //   const jsonContext = parser.document();
  //   if (errors.length > 0) {
  //     throw errors[0];
  //   }
}

main();
