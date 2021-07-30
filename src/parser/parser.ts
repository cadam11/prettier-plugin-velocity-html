import { CharStreams, CommonTokenStream, Recognizer, Token } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";
import { AST } from "prettier";
import { VelocityHtmlLexer } from "./generated/VelocityHtmlLexer";
import {
  HtmlCdataNode,
  HtmlCloseNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode,
  HtmlTextNode,
  IeConditionalCommentNode,
  NodeWithChildrenDecoration,
  ParserNode,
  DecoratedNode,
  RootNode,
  VelocityDirectiveNode,
  VelocityCommentNode,
  VelocityReferenceNode,
  AnyNodeWithChildren,
  NodeWithChildren,
  VelocityDirectiveEndNode,
  AttributeNode,
  AttributeValueToken,
} from "./VelocityParserNodes";
import { VelocityToken } from "./VelocityToken";
import { VelocityTokenFactory } from "./VelocityTokenFactory";

const interpolateErrorMsg = (msg: string, tokenName: string, mode: string) => {
  const ctx = {
    tokenName,
    mode,
  };
  return Object.entries(ctx).reduce((interpolatedMsg, [key, value]) => {
    return interpolatedMsg.replace(
      new RegExp(`{{\\w*${key}\\w*}}`, "g"),
      value
    );
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
        column: token.startLocation.column,
        line: token.startLocation.line,
      },
    };
  }
}

type LexerMode =
  | "DefaultMode"
  | "TagOpenMode"
  | "TagCloseMode"
  | "AttributeLhsMode"
  | "AttributeRhsMode"
  | "DocTypeMode"
  | "VelocityMode"
  | "AttributeStringMode";

export default function parse(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parsers: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: unknown
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
      offendingSymbol: unknown,
      line: unknown,
      charPositionInLine: unknown,
      msg: string
    ) {
      errors.push(new Error(msg));
    },
  });
  const tokenStream = new CommonTokenStream(lexer);
  tokenStream.fill();

  const rootNode = new RootNode();
  const parentStack: AnyNodeWithChildren[] = [rootNode];
  const tokens: VelocityToken[] = tokenStream.getTokens() as VelocityToken[];
  let currentNode: ParserNode = rootNode;
  let currentHtmlAttribute: AttributeNode | null = null;

  const addChild = (node: ParserNode): ParserNode => {
    parentStack[0].addChild(node);
    return node;
  };

  const setNewCurrentNode = (node: ParserNode): ParserNode => {
    currentNode = node;
    addChild(node);
    return node;
  };

  let mode: LexerMode = "DefaultMode";

  let velocityModeNode: VelocityReferenceNode | VelocityDirectiveNode | null =
    null;
  let revealedConditionalComment: VelocityToken | null = null;
  let prettierIgnore: VelocityToken[] = [];
  let velocityModeStack: LexerMode[] = [];

  const addAttributeNode = () => {
    if (currentHtmlAttribute == null) {
      throw new Error("currentHtmlAttribute is null");
    }
    if (currentNode instanceof HtmlTagNode) {
      currentNode.addAttribute(currentHtmlAttribute);
    } else if (currentNode instanceof VelocityDirectiveNode) {
      currentNode.addChild(currentHtmlAttribute);
    }
    currentHtmlAttribute = null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const newParserException = (msg?: string) =>
      new ParserException(token, mode, lexer, msg);
    let nextToken: Token | undefined;
    // Not every node is a parent.
    if (i < tokens.length - 1) {
      nextToken = tokens[i + 1];
    }

    const popParentStack = (): void => {
      if (currentNode.endLocation == null) {
        throw newParserException("endToken of currentNode is null");
      }
      parentStack.shift();
      currentNode = parentStack[0];
    };

    switch (token.type) {
      case VelocityHtmlLexer.VTL_MACRO_WITH_BODY_START:
      case VelocityHtmlLexer.VTL_DIRECTIVE_START:
      case VelocityHtmlLexer.VTL_NO_CODE_DIRECTIVE:
      case VelocityHtmlLexer.VTL_ELSE: {
        const node = new VelocityDirectiveNode(token);

        // End preceeding if or elseif
        if (["else", "elseif"].includes(node.directive)) {
          popParentStack();
        }

        if (mode == "AttributeStringMode") {
          // Handled in AttributeRhsMode
          break;
        }

        switch (mode) {
          case "DefaultMode": {
            addChild(node);
            break;
          }
          case "AttributeLhsMode": {
            if (!(currentNode instanceof HtmlTagNode)) {
              throw newParserException("Current node not html tag node.");
            }
            currentNode.addAttribute(node);
            break;
          }
          default: {
            throw newParserException(
              `Velocity Directive not supported at this position in mode ${mode}.`
            );
          }
        }
        if (node.hasVelocityCode) {
          velocityModeStack = [mode];
          mode = "VelocityMode";
        }

        if (node.hasVelocityCode || node.hasChildren) {
          currentNode = node;
          velocityModeNode = node;
        }

        if (node.hasChildren) {
          parentStack.unshift(node);
        }
        continue;
      }
      case VelocityHtmlLexer.VTL_DIRECTIVE_END: {
        // Remove dangling nodes from parent stack
        while (!(currentNode instanceof VelocityDirectiveNode)) {
          parentStack.shift();
          currentNode = parentStack[0];
        }
        // TODO endToken vs endNode
        currentNode.endToken = token;
        currentNode.endNode = new VelocityDirectiveEndNode(token);
        popParentStack();
        currentNode = parentStack[0];
        continue;
      }
    }

    switch (mode) {
      case "DefaultMode": {
        if (!(currentNode instanceof NodeWithChildren)) {
          throw newParserException("Current node not NodeWithChildren");
        }
        // Concatenate text to be able to use fill() later.
        const addTextNode = (token: VelocityToken) => {
          const lastChild = (currentNode as AnyNodeWithChildren).lastChild;
          if (lastChild != null && lastChild instanceof HtmlTextNode) {
            lastChild.addText(token);
          } else {
            (currentNode as AnyNodeWithChildren).addChild(
              new HtmlTextNode(token)
            );
          }
        };

        switch (token.type) {
          case VelocityHtmlLexer.TAG_START_OPEN: {
            const tagName = token.textValue
              .substring(1, token.textValue.length)
              .trim();
            const node = new HtmlTagNode(token);
            node.tagName = tagName;
            setNewCurrentNode(node);
            parentStack.unshift(node);
            mode = "AttributeLhsMode";
            break;
          }
          case VelocityHtmlLexer.EOF: {
            break;
          }
          case VelocityHtmlLexer.TAG_END: {
            const tagName = token.textValue
              .substring(2, token.textValue.length - 1)
              .trim();
            if (currentNode instanceof HtmlTagNode) {
              if (currentNode.tagName.toLowerCase() != tagName.toLowerCase()) {
                throw newParserException(
                  `Tag was opened with ${currentNode.tagName}, but closed with ${tagName}. Mixed tags are not supported.`
                );
              }
              currentNode.endNode = new NodeWithChildrenDecoration();
            } else {
              const closeNode = new HtmlCloseNode(token);
              closeNode.tagName = tagName;
              /*
               * This is an incomplete html snippet. Assemble the tree "bottom-up".
               * </td><td></td></tr></table>
               * should be parsed as
               * Root
               *  - /table
               *    - /tr
               *      - /td
               *      - td
               */
              parentStack[0].children.forEach((child) => {
                closeNode.addChild(child);
              });
              parentStack[0].children = [];
              setNewCurrentNode(closeNode);
              parentStack.unshift(currentNode);
            }

            currentNode.endToken = token;
            popParentStack();

            break;
          }
          case VelocityHtmlLexer.IE_COMMENT_START: {
            const conditionalCommentNode = new IeConditionalCommentNode(token);
            setNewCurrentNode(conditionalCommentNode);
            parentStack.unshift(currentNode);

            mode = "DefaultMode";
            break;
          }
          case VelocityHtmlLexer.IE_COMMENT_CLOSE: {
            // Remove dangling nodes from parent stack
            while (!(currentNode instanceof IeConditionalCommentNode)) {
              parentStack.shift();
              currentNode = parentStack[0];
            }
            currentNode.endNode = new NodeWithChildrenDecoration();
            currentNode.endToken = token;
            popParentStack();
            break;
          }
          case VelocityHtmlLexer.COMMENT: {
            addChild(new HtmlCommentNode(token));
            break;
          }
          case VelocityHtmlLexer.HTML_TEXT:
          case VelocityHtmlLexer.WS: {
            addTextNode(token);
            break;
          }
          case VelocityHtmlLexer.DOCTYPE_START: {
            setNewCurrentNode(new HtmlDocTypeNode(token));
            mode = "DocTypeMode";
            break;
          }
          case VelocityHtmlLexer.CDATA: {
            addChild(new HtmlCdataNode(token));
            break;
          }
          case VelocityHtmlLexer.IE_REVEALED_COMMENT_START: {
            revealedConditionalComment = token;
            break;
          }
          case VelocityHtmlLexer.IE_REVEALED_COMMENT_CLOSE: {
            if (revealedConditionalComment == null) {
              // Attach to previous comment
              // See below
              revealedConditionalComment = token;
            } else {
              // Remove empty conditional comment.
              revealedConditionalComment = null;
            }
            break;
          }
          case VelocityHtmlLexer.PRETTIER_IGNORE: {
            prettierIgnore.push(token);
            break;
          }
          case VelocityHtmlLexer.VTL_COMMENT:
          case VelocityHtmlLexer.VTL_MULTILINE_COMMENT: {
            addChild(new VelocityCommentNode(token));
            break;
          }
          case VelocityHtmlLexer.VTL_VARIABLE: {
            // TODO This is broken
            velocityModeNode = new VelocityReferenceNode(token);
            addChild(velocityModeNode);
            if (velocityModeNode.isFormalReference) {
              velocityModeStack = ["DefaultMode"];
              mode = "VelocityMode";
            }
            break;
          }
          case VelocityHtmlLexer.VTL_REFERENCE_DOT:
          case VelocityHtmlLexer.VTL_IDENTIFIER:
          case VelocityHtmlLexer.VTL_PARENS_OPEN:
          case VelocityHtmlLexer.VTL_INDEX_OPEN: {
            if (velocityModeNode == null) {
              throw newParserException("Velocity reference node is null");
            }
            velocityModeNode.tokens.push(token);
            if (
              [
                VelocityHtmlLexer.VTL_PARENS_OPEN,
                VelocityHtmlLexer.VTL_INDEX_OPEN,
              ].includes(token.type)
            ) {
              velocityModeStack = ["DefaultMode"];
              mode = "VelocityMode";
            }
            break;
          }
          default: {
            throw newParserException();
          }
        }

        if (
          prettierIgnore.length > 0 &&
          token.type != VelocityHtmlLexer.PRETTIER_IGNORE
        ) {
          let lastNode: ParserNode | undefined = parentStack[0].lastChild;
          lastNode =
            lastNode != null &&
            // TODO Was wenn es kein WS gibt?
            !(lastNode instanceof HtmlTextNode && lastNode.isWhitespaceOnly)
              ? lastNode
              : currentNode;

          if (lastNode == null) {
            // TODO Add as normal comment node?
            throw newParserException(
              `Cannot attach prettier ignore. No last child.`
            );
          }

          lastNode.prettierIgnore = prettierIgnore;
          prettierIgnore = [];
        }

        if (
          revealedConditionalComment != null &&
          token.type != VelocityHtmlLexer.IE_REVEALED_COMMENT_START
        ) {
          /**
           * Attach to the last node:
           * 1. The last child:
           * <!--[if lt IE 9]><!-->
           *  <html>
           * 2. The current node:
           *  <html>
           * <!--<![endif]-->
           */
          let lastNode: DecoratedNode | undefined = parentStack[0].lastChild;
          lastNode =
            lastNode != null &&
            // TODO Preserve newlines after <!--[if lt IE 9]><!-->
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
              lastNode = lastNode.startNode as NodeWithChildrenDecoration;
            } else {
              lastNode = lastNode.endNode as NodeWithChildrenDecoration;
            }
          }
          if (token.type == VelocityHtmlLexer.IE_REVEALED_COMMENT_CLOSE) {
            lastNode.revealedConditionalCommentEnd = revealedConditionalComment;
          } else {
            lastNode.revealedConditionalCommentStart =
              revealedConditionalComment;
          }
          revealedConditionalComment = null;
        }
        break;
      }
      case "AttributeLhsMode": {
        switch (token.type) {
          case VelocityHtmlLexer.HTML_NAME:
          case VelocityHtmlLexer.HTML_STRING: {
            if (
              !(
                currentNode instanceof HtmlTagNode ||
                currentNode instanceof VelocityDirectiveNode
              )
            ) {
              throw newParserException(
                "Current node not a html tag node or velocity directive node"
              );
            }
            if (
              nextToken != null &&
              nextToken.type !== VelocityHtmlLexer.EQUAL
            ) {
              const attributeNode = new AttributeNode(token);
              if (currentNode instanceof HtmlTagNode) {
                currentNode.addAttribute(attributeNode);
              } else {
                currentNode.addChild(attributeNode);
              }
            } else {
              currentHtmlAttribute = new AttributeNode(token);
              i++;
              mode = "AttributeRhsMode";
            }

            break;
          }
          case VelocityHtmlLexer.SELF_CLOSING_TAG_CLOSE:
          case VelocityHtmlLexer.TAG_CLOSE: {
            if (!(currentNode instanceof HtmlTagNode)) {
              throw newParserException("Current node not a html tag node");
            }
            currentNode.endToken = token;
            const isSelfClosing =
              currentNode.isSelfClosing ||
              token.type == VelocityHtmlLexer.SELF_CLOSING_TAG_CLOSE;
            currentNode.isSelfClosing = isSelfClosing;
            if (isSelfClosing) {
              popParentStack();
            } else {
              // Self closing tags must not be added to the parent stack.
              currentNode = parentStack[0];
            }
            mode = "DefaultMode";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "AttributeRhsMode": {
        if (currentHtmlAttribute == null) {
          throw newParserException("Current html attribute is null");
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_STRING_START: {
            mode = "AttributeStringMode";
            break;
          }
          case VelocityHtmlLexer.HTML_NAME: {
            currentHtmlAttribute.addValueToken(token);
            addAttributeNode();
            mode = "AttributeLhsMode";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "AttributeStringMode": {
        if (currentHtmlAttribute == null) {
          throw newParserException("Current html attribute is null");
        }
        switch (token.type) {
          case VelocityHtmlLexer.HTML_STRING_END: {
            if (currentHtmlAttribute.value.length == 0) {
              currentHtmlAttribute.value.push(
                new AttributeValueToken("", false)
              );
            }
            addAttributeNode();
            mode = "AttributeLhsMode";
            break;
          }
          default: {
            currentHtmlAttribute.addValueToken(token);
            break;
          }
        }
        break;
      }
      case "DocTypeMode": {
        if (!(currentNode instanceof HtmlDocTypeNode)) {
          throw newParserException("Current node not a html tag node");
        }
        switch (token.type) {
          case VelocityHtmlLexer.DOCTYPE_TYPE: {
            currentNode.types.push(token.textValue);
            break;
          }
          case VelocityHtmlLexer.DOCTYPE_END: {
            currentNode.endToken = token;
            currentNode = parentStack[0];
            mode = "DefaultMode";
            break;
          }
          default: {
            throw newParserException();
          }
        }
        break;
      }
      case "VelocityMode": {
        if (velocityModeNode == null) {
          throw newParserException("Did not find velocity node");
        }

        switch (token.type) {
          case VelocityHtmlLexer.WS:
          case VelocityHtmlLexer.VTL_REFERENCE:
          case VelocityHtmlLexer.VTL_KEYWORD:
          case VelocityHtmlLexer.VTL_IDENTIFIER:
          case VelocityHtmlLexer.VTL_REFERENCE_DOT:
          case VelocityHtmlLexer.VTL_STRING:
          case VelocityHtmlLexer.VTL_NUMBER: {
            velocityModeNode.addToken(token);
            break;
          }
          case VelocityHtmlLexer.VTL_PARENS_OPEN:
          case VelocityHtmlLexer.VTL_INDEX_OPEN:
          case VelocityHtmlLexer.VTL_CURLY_OPEN:
          case VelocityHtmlLexer.VTL_FORMAL_REFERENCE_OPEN: {
            velocityModeNode.addToken(token);
            velocityModeStack.push("VelocityMode");
            break;
          }
          case VelocityHtmlLexer.VTL_PARENS_CLOSE:
          case VelocityHtmlLexer.VTL_INDEX_CLOSE:
          case VelocityHtmlLexer.VTL_FORMAL_CLOSE: {
            if (velocityModeStack.length == 0) {
              throw newParserException("Velocity mode stack is empty");
            }
            velocityModeNode.addToken(token);
            mode = velocityModeStack.pop()!;
            if (
              velocityModeStack.length == 0 &&
              !velocityModeNode.hasChildren
            ) {
              currentNode = parentStack[0];
            }
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

  const newParserExceptionLastToken = (message: string): ParserException => {
    return new ParserException(tokens[tokens.length - 1], mode, lexer, message);
  };

  // TODO Test
  if (revealedConditionalComment != null) {
    throw newParserExceptionLastToken("Dangling revealed conditional comment");
  }
  // TODO Test
  if (prettierIgnore.length > 0) {
    throw newParserExceptionLastToken("Dangling prettier ignores");
  }
  return rootNode;
}
