import {
  CharStreams,
  CommonTokenStream,
  Lexer,
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
  HtmlTagNode,
  HtmlTextNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./Node";
import { VelocityToken } from "./VelocityToken";
import { VelocityTokenFactory } from "./VelocityTokenFactory";

export class ParserException extends Error {
  // loc is read by prettier error handler
  public loc: number;
  constructor(
    token: VelocityToken,
    mode?: string,
    recognizer?: Recognizer<unknown, ATNSimulator>
  ) {
    const tokenName = recognizer
      ? recognizer.vocabulary.getDisplayName(token.type)
      : token.type;
    super(`Unexpected token <${tokenName}> ${mode ? " in mode " + mode : ""}`);
    this.loc = token.charPositionInLine;
  }
}

type LexerMode =
  | "tagOpen"
  | "attributeLHS"
  | "attributeRHS"
  | "outsideTag"
  | "tagClose";

export default function parse(
  text: string,
  parsers: object,
  options: object
): AST {
  const inputStream = CharStreams.fromString(text);
  const lexer = new VelocityHtmlLexer(inputStream);
  const tokenFactory = new VelocityTokenFactory(lexer);
  lexer.tokenFactory = tokenFactory;
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

  const rootNode = new RootNode();
  const nodes: ParserNode[] = [];
  const parentStack: NodeWithChildren[] = [rootNode];
  const tokens = tokenStream.getTokens();
  let currentHtmlNode: HtmlStartTagNode;
  let currentHtmlAttribute: VelocityToken;

  let mode: LexerMode = "outsideTag";

  for (let i = 0; i < tokens.length; i++) {
    const token: VelocityToken = tokens[i] as VelocityToken;
    const newParserException = () => new ParserException(token, mode, lexer);
    let nextToken: Token | undefined;
    if (i < tokens.length - 1) {
      nextToken = tokens[i + 1];
    }

    switch (mode) {
      case "outsideTag": {
        switch (token.type) {
          case VelocityHtmlLexer.TAG_START_OPEN: {
            const parent = parentStack[0];
            currentHtmlNode = new HtmlStartTagNode(
              parent,
              token.charPositionInLine
            );
            const prev = parent.children[parent.children.length - 1];
            if (prev != null) {
              currentHtmlNode.prev = prev;
              prev.next = currentHtmlNode;
            }
            parent.addChild(currentHtmlNode);
            mode = "tagOpen";
            break;
          }
          case VelocityHtmlLexer.EOF: {
            break;
          }
          case VelocityHtmlLexer.TAG_END_OPEN: {
            mode = "tagClose";
            const closeTagNode = new HtmlCloseTagNode(
              currentHtmlNode,
              token.charPositionInLine
            );
            currentHtmlNode.closeTag = closeTagNode;
            break;
          }
          case VelocityHtmlLexer.HTML_TEXT: {
            currentHtmlNode.addChild(new HtmlTextNode(token));
            break;
          }
          case VelocityHtmlLexer.WS: {
            if (token.text !== "\n") {
              throw newParserException();
            }
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "tagOpen": {
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentHtmlNode.tagName = token.textValue;
            mode = "attributeLHS";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "attributeLHS": {
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            if (nextToken.type !== VelocityHtmlLexer.EQUAL) {
              currentHtmlNode.addAttribute(token);
            } else {
              currentHtmlAttribute = token;
              i++;
              mode = "attributeRHS";
            }
            break;
          }
          case VelocityHtmlLexer.TAG_CLOSE: {
            nodes.push(currentHtmlNode);
            // Self closing tag
            if (!currentHtmlNode.isSelfClosing()) {
              parentStack.unshift(currentHtmlNode);
            }
            mode = "outsideTag";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "attributeRHS": {
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentHtmlNode.addAttribute(currentHtmlAttribute, token);
            currentHtmlAttribute = null;
            mode = "attributeLHS";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "tagClose": {
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentHtmlNode.closeTag.tagName = token.textValue;
            break;
          }
          case VelocityHtmlLexer.TAG_CLOSE: {
            parentStack.shift();
            // TODO
            currentHtmlNode = parentStack[0] as HtmlTagNode;
            mode = "outsideTag";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      default: {
        throw newParserException();
      }
    }

    // switch (token.type) {
    //   case VelocityHtmlLexer.HTML_NAME:
    //     if (!currentHtmlNode) {
    //       throw new ParserException(token, "currentHtml not set");
    //     }
    //     break;
    //   case VelocityHtmlLexer.VTL_IDENTIFIER:
    //     if (currentHtmlAttribute != null) {
    //       currentHtmlNode.addAttribute(currentHtmlAttribute, token);
    //       currentHtmlAttribute = null;
    //     } else {
    //       throw new ParserException(
    //         token,
    //         "Expected attribute key to be present"
    //       );
    //     }
    //     break;
    //   case VelocityHtmlLexer.TAG_CLOSE:
    //     nodes.push(currentHtmlNode);
    //     parentStack.unshift(currentHtmlNode);
    //     break;
    //   case VelocityHtmlLexer.WS:
    //     // Ignore WS in HTML
    //     break;
    //   case VelocityHtmlLexer.HTML_TEXT:
    //     currentHtmlNode.addContent(token);
    //     break;
    //   case VelocityHtmlLexer.TAG_END_OPEN: {
    //     let currentCloseToken = token;
    //     const closeTagNode = new HtmlCloseTagNode(
    //       currentHtmlNode,
    //       token.charPositionInLine
    //     );
    //     currentHtmlNode.closeTag = closeTagNode;
    //     do {
    //       currentCloseToken = tokens[++i];
    //       if (currentCloseToken.type === VelocityHtmlLexer.HTML_NAME) {
    //         closeTagNode.tagName = currentCloseToken.text;
    //       } else if (currentCloseToken.type === VelocityHtmlLexer.TAG_CLOSE) {
    //         break;
    //       } else {
    //         throw new ParserException(
    //           token,
    //           `Unexpected token type ${currentCloseToken.type}`
    //         );
    //       }
    //     } while (i < tokens.length);
    //     parentStack.shift();
    //     currentHtmlNode = parentStack[0];
    //     break;
    //   }
    //   case VelocityHtmlLexer.EOF:
    //     break;
    //   default:
    //     throw new ParserException(token, `Unexpected token ${token.type}`);
    // }
  }
  return rootNode;
}
