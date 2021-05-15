import { CharStreams, CommonTokenStream, Recognizer, Token } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";
import { AST } from "prettier";
import { VelocityHtmlLexer } from "./generated/VelocityHtmlLexer";
import {
  HtmlCdataNode,
  HtmlCloseNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode as HtmlStartTagNode,
  HtmlTagNode,
  HtmlTextNode,
  IeConditionalCommentNode,
  NodeWithChildren,
  NodeWithChildrenDecoration,
  ParserNode,
  DecoratedNode,
  RootNode,
  VoidNode,
} from "./VelocityParserNodes";
import { VelocityToken } from "./VelocityToken";
import { VelocityTokenFactory } from "./VelocityTokenFactory";

const interpolateErrorMsg = (msg: string, tokenName: string, mode: string) => {
  const ctx = {
    tokenName,
    mode,
  };
  return Object.entries(ctx).reduce((interpolatedMsg, [key, value]) => {
    return interpolatedMsg.replace(new RegExp(`{{\w*${key}\w*}}`, "g"), value);
  }, msg);
};
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
    mode: string,
    recognizer: Recognizer<unknown, ATNSimulator>,
    msg?: string
  ) {
    const tokenName =
      recognizer != null
        ? recognizer.vocabulary.getDisplayName(token.type)
        : token.type;
    super(
      interpolateErrorMsg(
        msg != null ? msg : `Unexpected token <{{tokenName}}> in mode {{mode}}`,
        tokenName.toString(),
        mode
      )
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

  const openIeConditinalChildren: NodeWithChildren[] = [];

  let revealedConditionComment: VelocityToken | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token: VelocityToken = tokens[i] as VelocityToken;
    const newParserException = (msg?: string) =>
      new ParserException(token, mode, lexer, msg);
    let nextToken: Token | undefined;
    // Not every node is a parent.
    let parent = parentStack[0];
    if (i < tokens.length - 1) {
      nextToken = tokens[i + 1];
    }

    const popOpenIeConditionalChild = (): void => {
      const child = parentStack.shift();
      if (child == null) {
        throw new Error("Nothing to shift()");
      }
      openIeConditinalChildren.push(new VoidNode(child.startLocation));
      currentNode = parentStack[0];
    };

    const popParentStack = (): void => {
      if (currentNode.endLocation == null) {
        throw new Error("endToken of currentNode is null");
      }
      parentStack.shift();
      currentNode = parentStack[0];
    };

    switch (mode) {
      case "outsideTag": {
        if (!(currentNode instanceof NodeWithChildren)) {
          throw newParserException();
        }
        // Concatenate text to be able to use fill() later.
        const addTextNode = (token: VelocityToken) => {
          const lastChild = (currentNode as NodeWithChildren).lastChild;
          if (
            lastChild != null &&
            lastChild instanceof HtmlTextNode &&
            lastChild.revealedConditionalCommentEnd == null &&
            revealedConditionComment == null
          ) {
            lastChild.addText(token);
          } else {
            (currentNode as NodeWithChildren).addChild(new HtmlTextNode(token));
          }
        };
        const setNewCurrentNode = (node: ParserNode): ParserNode => {
          currentNode = node;
          currentNode.parent = parent;
          parent.addChild(currentNode);
          return node;
        };
        switch (token.type) {
          case VelocityHtmlLexer.TAG_START_OPEN: {
            setNewCurrentNode(new HtmlStartTagNode(token));
            mode = "tagOpen";
            break;
          }
          case VelocityHtmlLexer.EOF: {
            break;
          }
          case VelocityHtmlLexer.TAG_END_OPEN: {
            if (parent instanceof VoidNode) {
              setNewCurrentNode(new HtmlCloseNode(token));
            } else if (currentNode instanceof HtmlTagNode) {
              currentNode.endNode = new NodeWithChildrenDecoration();
            } else {
              throw newParserException();
            }

            mode = "tagClose";
            break;
          }
          case VelocityHtmlLexer.IE_COMMENT_START: {
            setNewCurrentNode(new IeConditionalCommentNode(token));
            parentStack.unshift(currentNode);
            while (openIeConditinalChildren.length > 0) {
              const child = openIeConditinalChildren.pop();
              if (child == null) {
                throw new Error("Nothing to pop()");
              }
              if (parent instanceof VoidNode) {
                parent.addChild(child);
              } else {
                // IE comment node
                currentNode.addChild(child);
              }
              parentStack.unshift(child);
              parent = child;
            }
            mode = "outsideTag";
            break;
          }
          case VelocityHtmlLexer.IE_COMMENT_CLOSE: {
            while (!(currentNode instanceof IeConditionalCommentNode)) {
              popOpenIeConditionalChild();
            }
            currentNode.endNode = new NodeWithChildrenDecoration();
            currentNode.endToken = token;
            popParentStack();
            break;
          }
          case VelocityHtmlLexer.SCRIPT_START_OPEN: {
            setNewCurrentNode(new HtmlStartTagNode(token));
            (currentNode as HtmlStartTagNode).tagName = "script";
            mode = "attributeLHS";
            break;
          }
          case VelocityHtmlLexer.SCRIPT_END_TAG: {
            currentNode.endToken = token;
            currentNode.endNode = new NodeWithChildrenDecoration();
            popParentStack();
            break;
          }
          case VelocityHtmlLexer.COMMENT: {
            const commentNode = new HtmlCommentNode(token);
            commentNode.parent = parent;
            parent.addChild(commentNode);
            break;
          }
          case VelocityHtmlLexer.HTML_TEXT:
          case VelocityHtmlLexer.WS: {
            addTextNode(token);
            break;
          }
          case VelocityHtmlLexer.DOCTYPE_START: {
            mode = "doctype";
            currentNode = new HtmlDocTypeNode(token);
            currentNode.parent = parent;
            parent.addChild(currentNode);
            break;
          }
          case VelocityHtmlLexer.CDATA: {
            const cdataNode = new HtmlCdataNode(token);
            cdataNode.parent = parent;
            parent.addChild(cdataNode);
            break;
          }
          case VelocityHtmlLexer.IE_REVEALED_COMMENT_START: {
            revealedConditionComment = token;
            break;
          }
          case VelocityHtmlLexer.IE_REVEALED_COMMENT_CLOSE: {
            if (revealedConditionComment == null) {
              // Attach to previous comment
              // See below
              revealedConditionComment = token;
            } else {
              // Remove empty conditional comment.
              revealedConditionComment = null;
            }
            break;
          }
          default: {
            throw newParserException();
          }
        }

        // Attach to next node.
        if (
          revealedConditionComment != null &&
          token.type != VelocityHtmlLexer.IE_REVEALED_COMMENT_START
        ) {
          // Cannot attach to whitespace only nodes
          let lastNode: DecoratedNode | undefined = parent.lastChild;
          lastNode =
            lastNode != null &&
            !(lastNode instanceof HtmlTextNode && lastNode.isWhitespaceOnly)
              ? lastNode
              : currentNode;
          if (lastNode == null) {
            throw newParserException(
              `Cannot attach conditional comment. No last child.`
            );
          }

          if (lastNode instanceof NodeWithChildren) {
            if (lastNode.endNode == null) {
              lastNode = lastNode.startNode;
            } else {
              lastNode = lastNode.endNode;
            }
          }
          if (token.type == VelocityHtmlLexer.IE_REVEALED_COMMENT_CLOSE) {
            lastNode.revealedConditionalCommentEnd = revealedConditionComment;
          } else {
            lastNode.revealedConditionalCommentStart = revealedConditionComment;
          }
          revealedConditionComment = null;
        }
        break;
      }
      case "tagOpen": {
        if (!(currentNode instanceof HtmlStartTagNode)) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME: {
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
          case VelocityHtmlLexer.SELF_CLOSING_TAG_CLOSE:
          case VelocityHtmlLexer.TAG_CLOSE: {
            const isSelfClosing =
              currentNode.isSelfClosing ||
              token.type == VelocityHtmlLexer.SELF_CLOSING_TAG_CLOSE;
            if (!isSelfClosing) {
              parentStack.unshift(currentNode);
            } else {
              // Self closing tags must not be added to the parent stack.
              currentNode.endToken = token;
              currentNode = parentStack[0];
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
        if (
          !(
            currentNode instanceof HtmlStartTagNode ||
            currentNode instanceof HtmlCloseNode
          )
        ) {
          throw newParserException();
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            if (currentNode instanceof HtmlTagNode) {
              if (
                currentNode.tagName.toLowerCase() !=
                token.textValue.toLowerCase()
              ) {
                throw new Error(
                  `Tag was opened with ${currentNode.tagName}, but closed with ${token.textValue}. Mixed tags not supported`
                );
              }
            } else {
              currentNode.tagName = token.textValue;
            }
            break;
          }
          case VelocityHtmlLexer.TAG_CLOSE: {
            currentNode.endToken = token;
            popParentStack();
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
            currentNode = parentStack[0];
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
  }
  return rootNode;
}
