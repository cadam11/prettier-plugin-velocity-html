import { CharStreams, CommonTokenStream, Recognizer, Token } from 'antlr4ts';
import { ATNSimulator } from 'antlr4ts/atn/ATNSimulator';
import { VelocityHtmlLexer } from './generated/VelocityHtmlLexer';
import { VelocityHtmlParser } from './generated/VelocityHtmlParser';

export default function parseVelocityHtml(text: string): void {
    const inputStream = CharStreams.fromString(text);
    const lexer = new VelocityHtmlLexer(inputStream);
    const errors: Error[] = [];
    lexer.removeErrorListeners();
    lexer.addErrorListener({
        syntaxError(recognizer: Recognizer<Token, ATNSimulator>, offendingSymbol, line, charPositionInLine, msg, e) {
            errors.push(new Error(msg));
          },
    })
    const tokenStream = new CommonTokenStream(lexer);
    console.log(tokenStream);
    const parser = new VelocityHtmlParser(tokenStream);
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError(recognizer: Recognizer<Token, ATNSimulator>, offendingSymbol, line, charPositionInLine, msg, e) {
        errors.push(new Error(msg));
      },
    });
    const jsonContext = parser.document();
    if (errors.length > 0) {
      throw errors[0];
    }   
  }
  