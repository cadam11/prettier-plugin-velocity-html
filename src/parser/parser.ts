import {
  CharStreams,
  CommonTokenStream,
  Parser,
  Recognizer,
  Token,
} from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";
import { AST } from "prettier";
import { VelocityHtmlLexer } from "./generated/VelocityHtmlLexer";
import {
  HtmlCloseTagNode,
  HtmlTagNode as HtmlStartTagNode,
  ParserNode,
} from "./Node";
import { VelocityTokenFactory } from "./VelocityTokenFactory";

export class ParserException extends Error {
  // loc is read by prettier error handler
  public loc: number;
  constructor(token: Token, message: string) {
    super(message);
    this.loc = token.charPositionInLine;
  }
}

export default function parse(
  text: string,
  parsers: object,
  options: object
): AST {
  const inputStream = CharStreams.fromString(text);
  const lexer = new VelocityHtmlLexer(inputStream);
  const tokenFactory = new VelocityTokenFactory(lexer);
  const errors: Error[] = [];
  lexer.removeErrorListeners();
  lexer.addErrorListener({
    syntaxError(
      recognizer: Recognizer<Token, ATNSimulator>,
      offendingSymbol,
      line,
      charPositionInLine,
      msg,
      e
    ) {
      errors.push(new Error(msg));
    },
  });
  const tokenStream = new CommonTokenStream(lexer);
  tokenStream.fill();

  const nodes: ParserNode[] = [];
  const parentStack: HtmlStartTagNode[] = [];
  const tokens = tokenStream.getTokens();
  let currentHtmlNode: HtmlStartTagNode;
  let currentHtmlAttribute: Token;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let nextToken: Token | undefined;
    if (i < tokens.length - 1) {
      nextToken = tokens[i + 1];
    }
    switch (token.type) {
      case VelocityHtmlLexer.TAG_START_OPEN: {
        const parent = parentStack[0];
        currentHtmlNode = new HtmlStartTagNode(
          parent,
          token.charPositionInLine
        );
        if (parent) {
          parent.children.push(currentHtmlNode);
        }
        break;
      }
      case VelocityHtmlLexer.HTML_NAME:
        if (!currentHtmlNode) {
          throw new ParserException(token, "currentHtml not set");
        }
        if (nextToken && nextToken.text !== "=") {
          if (currentHtmlNode.tagName) {
            throw new ParserException(
              token,
              "Want to set tag name, but tag name already set"
            );
          }
          currentHtmlNode.tagName = token.text;
        } else if (nextToken.text == "=") {
          i++;
          currentHtmlAttribute = token;
        }
        break;
      case VelocityHtmlLexer.HTML_WS:
        // WS ignored in tags.
        break;
      case VelocityHtmlLexer.VTL_IDENTIFIER:
        if (currentHtmlAttribute != null) {
          currentHtmlNode.addAttribute(currentHtmlAttribute, token);
          currentHtmlAttribute = null;
        } else {
          throw new ParserException(
            token,
            "Expected attribute key to be present"
          );
        }
        break;
      case VelocityHtmlLexer.TAG_CLOSE:
        nodes.push(currentHtmlNode);
        parentStack.unshift(currentHtmlNode);
        break;
      case VelocityHtmlLexer.WS:
        // Ignore WS in HTML
        break;
      case VelocityHtmlLexer.HTML_TEXT:
        currentHtmlNode.addContent(token);
        break;
      case VelocityHtmlLexer.TAG_END_OPEN: {
        let currentCloseToken = token;
        const closeTagNode = new HtmlCloseTagNode(
          currentHtmlNode,
          token.charPositionInLine
        );
        currentHtmlNode.closeTag = closeTagNode;
        do {
          currentCloseToken = tokens[++i];
          if (currentCloseToken.type === VelocityHtmlLexer.HTML_NAME) {
            closeTagNode.tagName = currentCloseToken.text;
          } else if (currentCloseToken.type === VelocityHtmlLexer.TAG_CLOSE) {
            break;
          } else {
            throw new ParserException(
              token,
              `Unexpected token type ${currentCloseToken.type}`
            );
          }
        } while (i < tokens.length);
        parentStack.shift();
        currentHtmlNode = parentStack[0];
        break;
      }
      case VelocityHtmlLexer.EOF:
        break;
      default:
        throw new ParserException(token, `Unexpected token ${token.type}`);
    }
  }
  return nodes[0];
}
