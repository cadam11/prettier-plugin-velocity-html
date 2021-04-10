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
import { VelocityHtmlParser } from "./generated/VelocityHtmlParser";
import {
  HtmlCommentNode,
  HtmlDocTypeNode,
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
  public loc: {
    start: {
      column: number;
      line: number;
    };
  };
  constructor(
    token: VelocityToken,
    mode?: string,
    recognizer?: Recognizer<unknown, ATNSimulator>
  ) {
    const tokenName =
      recognizer != null
        ? recognizer.vocabulary.getDisplayName(token.type)
        : token.type;
    super(
      `Unexpected token <${tokenName}> ${mode != null ? "in mode " + mode : ""}`
    );
    this.loc = {
      start: {
        column: token.charPositionInLine,
        line: token.line,
      },
    };
  }
}

type LexerMode =
  | "tagOpen"
  | "attributeLHS"
  | "attributeRHS"
  | "outsideTag"
  | "tagClose"
  | "doctype";

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
  const parentStack: NodeWithChildren[] = [rootNode];
  const tokens = tokenStream.getTokens();
  let currentNode: ParserNode = rootNode;
  let currentHtmlAttribute: VelocityToken | null = null;

  let mode: LexerMode = "outsideTag";

  for (let i = 0; i < tokens.length; i++) {
    const token: VelocityToken = tokens[i] as VelocityToken;
    const newParserException = () => new ParserException(token, mode, lexer);
    let nextToken: Token | undefined;
    // Not every node is a parent.
    const parent = parentStack[0];
    if (i < tokens.length - 1) {
      nextToken = tokens[i + 1];
    }

    switch (mode) {
      case "outsideTag": {
        if (!(currentNode instanceof NodeWithChildren)) {
          throw newParserException();
        }
        const addTextNode = (text: string, token: VelocityToken) => {
          const lastChild = (currentNode as NodeWithChildren).lastChild;
          if (lastChild != null && lastChild instanceof HtmlTextNode) {
            lastChild.addText(text, token);
          } else {
            (currentNode as NodeWithChildren).addChild(
              new HtmlTextNode(text, token)
            );
          }
        };
        switch (token.type) {
          case VelocityHtmlLexer.TAG_START_OPEN: {
            currentNode = new HtmlStartTagNode(token);
            currentNode.parent = parent;
            parent.addChild(currentNode);
            mode = "tagOpen";
            break;
          }
          case VelocityHtmlLexer.EOF: {
            break;
          }
          case VelocityHtmlLexer.TAG_END_OPEN: {
            if (!(currentNode instanceof HtmlStartTagNode)) {
              throw newParserException();
            }
            mode = "tagClose";
            currentNode.endToken = token;
            break;
          }
          case VelocityHtmlLexer.HTML_TEXT: {
            addTextNode(token.textValue, token);
            break;
          }
          case VelocityHtmlLexer.COMMENT: {
            const commentNode = new HtmlCommentNode(token);
            commentNode.parent = currentNode;
            currentNode.addChild(commentNode);
            break;
          }
          case VelocityHtmlLexer.WS: {
            // Trim leading whitespace. Collapse other whitespace
            // TODO Trim trailing whitespace.
            if (
              currentNode.isWhitespaceSensitive() &&
              currentNode.children.length !== 0
            ) {
              addTextNode(" ", token);
            } else if (
              !currentNode.isWhitespaceSensitive() &&
              token.text != null
            ) {
              addTextNode(token.textValue, token);
            }
            // else ignore whitespace
            break;
          }
          case VelocityHtmlLexer.DOCTYPE_START: {
            mode = "doctype";
            currentNode = new HtmlDocTypeNode(token);
            currentNode.parent = parent;
            parent.addChild(currentNode);
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "tagOpen": {
        if (!(currentNode instanceof HtmlStartTagNode)) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentNode.tagName = token.textValue;
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
        if (!(currentNode instanceof HtmlTagNode)) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            if (
              nextToken != null &&
              nextToken.type !== VelocityHtmlLexer.EQUAL
            ) {
              currentNode.addAttribute(token);
            } else {
              currentHtmlAttribute = token;
              i++;
              mode = "attributeRHS";
            }
            break;
          }
          case VelocityHtmlLexer.SELF_CLOSING_TAG_CLOSE: {
            mode = "outsideTag";
            break;
          }
          case VelocityHtmlLexer.TAG_CLOSE: {
            // Self closing tag
            if (!currentNode.isSelfClosing) {
              parentStack.unshift(currentNode);
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
        if (!(currentNode instanceof HtmlStartTagNode)) {
          throw newParserException();
        }
        if (currentHtmlAttribute == null) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentNode.addAttribute(currentHtmlAttribute, token);
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
        if (!(currentNode instanceof HtmlStartTagNode)) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            currentNode.hasClosingTag = true;
            break;
          }
          case VelocityHtmlLexer.TAG_CLOSE: {
            parentStack.shift();
            // TODO
            currentNode = parentStack[0] as HtmlTagNode;
            mode = "outsideTag";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "doctype": {
        if (!(currentNode instanceof HtmlDocTypeNode)) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.DOCTYPE_TYPE: {
            currentNode.types.push(token.textValue);
            break;
          }
          case VelocityHtmlLexer.DOCTYPE_END: {
            currentNode.endToken = token;
            // TODO Duplicated logic
            currentNode = parentStack[0] as HtmlTagNode;
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
    //       throw parserException(token, "currentHtml not set");
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
