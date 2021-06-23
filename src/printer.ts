import { AstPath, Doc, doc } from "prettier";
import { RenderMode } from "./parser/tagRegistry";
import {
  AttributeNode,
  DecoratedNode,
  HtmlCdataNode,
  HtmlCloseNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode,
  HtmlTextNode,
  IeConditionalCommentNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
  VelocityCommentNode,
  VelocityDirectiveNode,
  WhitespaceToken,
} from "./parser/VelocityParserNodes";
import { NEWLINE_REGEX } from "./parser/VelocityToken";

const {
  literalline,
  breakParent,
  dedentToRoot,
  fill,
  ifBreak,
  hardline,
  softline,
  join,
  group,
  indent,
  line,
} = doc.builders;

function escapeDoubleQuote(text: string): string {
  return text.replace(/"/g, "&quot;");
}

function printRevealedConditionalComment(
  text: string,
  trimWhitespace = true
): string {
  return (trimWhitespace ? text.trim() : text)
    .replace(/\s+/g, " ")
    .replace(/\s+]/, "]");
}

function decorateStart(node: DecoratedNode | undefined): Doc {
  return node != null && node.revealedConditionalCommentStart != null
    ? printRevealedConditionalComment(
        node.revealedConditionalCommentStart.textValue
      )
    : "";
}

function decorateEnd(node: DecoratedNode | undefined): Doc {
  return node != null && node.revealedConditionalCommentEnd != null
    ? printRevealedConditionalComment(
        node.revealedConditionalCommentEnd.textValue
      )
    : "";
}

function decorate(doc: Doc | Doc[], node: DecoratedNode | undefined): Doc {
  return [
    decorateStart(node),
    ...(doc instanceof Array ? doc : [doc]),
    decorateEnd(node),
  ];
}

export function printOpeningTag(
  node: HtmlTagNode,
  path: AstPath<ParserNode>,
  print: (path: AstPath) => Doc
): Doc {
  const printedAttributes: Doc[] = path.map(print, "attributes");
  const tagOpenParts: Doc[] = [
    decorateStart(node.startNode),
    `<${node.tagName}`,
  ];

  if (printedAttributes.length > 0) {
    tagOpenParts.push(indent([line, join(line, printedAttributes)]));
  }

  if (!node.isSelfClosing && !breakOpeningTag(node)) {
    tagOpenParts.push(
      node.attributes.length > 0 ? softline : "",
      ">",
      decorateEnd(node.startNode)
    );
  }

  return [group(tagOpenParts), node.maxDepth > 2 ? breakParent : ""];
}

export function printClosingTag(node: HtmlTagNode): Doc {
  if (node.forceCloseTag || node.endNode != null) {
    const parts: Doc[] = [];
    if (!breakClosingTag(node)) {
      parts.push(decorateStart(node.endNode), `</${node.tagName}`);
    }
    parts.push(`>`, decorateEnd(node.endNode));
    return parts;
  } else if (node.isSelfClosing) {
    return [line, "/>"];
  } else {
    return "";
  }
}

export function concatChildren(node: ParserNode, children: Doc[] | Doc): Doc {
  if (children == "" || (children instanceof Array && children.length == 0)) {
    return "";
  }
  const firstChild = node instanceof NodeWithChildren ? node.children[0] : null;
  /**
   * The close node is special, because it prints its children first (no start tag).
   * This will result in too many softlines (one per level) before the children content starts.
   */
  const softlineBeforeChildren =
    !node.isSelfOrParentPreformatted && !(firstChild instanceof HtmlCloseNode);
  /**
   * Same as above, but for nodes missing the end tag.
   */
  const softlineAfterChildren =
    !node.isSelfOrParentPreformatted &&
    !(node instanceof HtmlTagNode && node.endNode == null);
  const forceBreakChildren =
    (node instanceof NodeWithChildren &&
      (node.forceBreakChildren || node.maxDepth >= 2)) ||
    (firstChild instanceof HtmlTagNode &&
      node instanceof NodeWithChildren &&
      // Try to keep nodes with text on one line to improve readability.
      node.children.reduce(
        (acc, child) => acc && !(child instanceof HtmlTextNode),
        true
      ) &&
      firstChild.startLocation.line > node.startLocation.line);
  return [
    indent([
      /**
       * An indent only works with a softline and it only indents to the level of the softline.
       * Therefore we always must place softline inside the inner most indent.
       * This seems to be a design decision by prettier.
       */
      softlineBeforeChildren ? softline : "",
      ...(children instanceof Array ? children : [children]),
      /**
       * Break up content that is too deeply nested.
       * An indentation of 2 is considered too much by prettier, so I will do the same.
       */
      forceBreakChildren ? breakParent : "",
    ]),
    softlineAfterChildren ? softline : "",
  ];
}

function calculateDifferenceBetweenChildren(
  prev: ParserNode,
  next: ParserNode,
  sameLineDoc: Doc
): Doc {
  const lineDifference = next.startLocation.line - prev.endLocation.line;
  if (lineDifference == 0) {
    return sameLineDoc;
  } else if (lineDifference == 1) {
    return hardline;
  } else {
    return [hardline, hardline];
  }
}

function breakOpeningTag(parent: NodeWithChildren) {
  return (
    (parent instanceof HtmlTagNode
      ? parent.getChildrenRenderMode() == RenderMode.INLINE
      : parent.isInlineRenderMode) &&
    parent.firstChild != null &&
    parent.firstChild.isInlineRenderMode &&
    !parent.firstChild.hasLeadingSpaces
  );
}

function breakClosingTag(parent: NodeWithChildren) {
  return (
    (parent instanceof HtmlTagNode
      ? parent.getChildrenRenderMode() == RenderMode.INLINE
      : parent.isInlineRenderMode) &&
    parent.endNode != null &&
    parent.lastChild != null &&
    parent.lastChild.isInlineRenderMode &&
    !parent.lastChild.hasTrailingSpaces
  );
}

/*
 * Inline content should fill as much horizontal space as possible.
 * In contrast, block content should break uniformly.
 * <p>foo <strong>baz</strong> bar bar </p>
 * should break like
 * <p>
 *   foo <strong>baz</strong>
 *   bar bar
 * </p>
 * and not like
 * <p>
 *   foo
 *   <strong>baz</strong>
 *   bar
 *   bar
 * </p>
 * This is achieved by pushing the linebreaks inside the children group and instead of next to it:
 * [
 *   group(fill("<span>Hello,World!</span>"))
 *   group([
 *     line,
 *     group([
 *       group(fill("<span>")),
 *       group(fill("Hello, World!")
 *     ])
 *   ])
 * ]
 * vs
 * [
 *   group(fill("<span>Hello,World!</span>")),
 *   line,
 *   group([
 *     group(fill("<span>")),
 *     group(fill("Hello, World!")
 *   ])
 * ]
 *
 *
 * This is loosely based on https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
 */
function printChildren(
  path: AstPath<ParserNode>,
  options: unknown,
  print: (path: AstPath) => Doc
): Doc[] {
  return path.map((childPath) => {
    const childNode = childPath.getValue();
    const parts: Doc[] = [];
    const childParts = print(childPath);

    const parent = childNode.parent;
    if (parent == null) {
      throw new Error("parent cannot be null inside printChildren");
    }
    if (
      childNode.isFirstChild &&
      parent instanceof HtmlTagNode &&
      breakOpeningTag(parent)
    ) {
      parts.push(">", decorateEnd(parent.startNode));
    }

    if (childNode.isOnlyChild) {
      const isParentInlineRenderingMode = parent.isInlineRenderMode;
      /**
       * Preserve whitespace from input, but don't use linebreaks.
       * Children are enclosed by line breaks in concatChildren()
       */
      if (isParentInlineRenderingMode && childNode.hasLeadingSpaces) {
        parts.push(ifBreak("", " "));
      }
      parts.push(childParts);
      if (isParentInlineRenderingMode && childNode.hasTrailingSpaces) {
        parts.push(ifBreak("", " "));
      }
    } else {
      /**
       * Look at previous node to determine if line break is needed before child content.
       */
      if (childNode.prev != null) {
        const prev = childNode.prev;
        let lineBreak: Doc = "";

        if (
          prev.isPreformatted() ||
          // TODO This should be renamed because its logic is only made for <br/> tags.
          (prev.forceBreak && prev.hasTrailingSpaces)
        ) {
          // At least one hardline after preformatted text
          lineBreak = calculateDifferenceBetweenChildren(
            prev,
            childNode,
            hardline
          );
        } else if (
          prev.isInlineRenderMode &&
          childNode.isInlineRenderMode &&
          !(childNode instanceof HtmlTextNode)
        ) {
          // In inline mode, use line instead of softline to seperate content.
          lineBreak = childNode.hasLeadingSpaces
            ? calculateDifferenceBetweenChildren(prev, childNode, line)
            : "";
        }
        parts.push(group([lineBreak, childParts]));
      } else {
        // Block Mode requires no linebreak, because there will be a linebreak at the end of the prev
        parts.push(childParts);
      }

      /**
       * Look at next node to determine if line break is needed after child content.
       */
      // Preformatted and force break is handled in prev check of next node.
      if (
        childNode.next != null &&
        !(childNode.isPreformatted() || childNode.forceBreak)
      ) {
        const next = childNode.next;
        const seperator = calculateDifferenceBetweenChildren(
          childNode,
          next,
          hardline
        );
        if (next.isInlineRenderMode && childNode.isBlockRenderMode) {
          parts[parts.length - 1] = group([parts[parts.length - 1], seperator]);
        } else if (next.isBlockRenderMode) {
          parts.push(seperator, breakParent);
        } else if (
          // Push line breaks to node surrounding text nodes.
          // Prettier can only work well with fill(...) if it is not grouped with linebreaks.
          next.isInlineRenderMode &&
          childNode.isInlineRenderMode &&
          next instanceof HtmlTextNode &&
          childNode.hasTrailingSpaces
        ) {
          parts[parts.length - 1] = group([
            parts[parts.length - 1],
            calculateDifferenceBetweenChildren(childNode, next, line),
          ]);
        }
      }
    }

    if (
      childNode.isLastChild &&
      !(childNode instanceof HtmlTextNode) &&
      parent instanceof HtmlTagNode &&
      breakClosingTag(parent)
    ) {
      parts.push(
        decorateStart(childNode.parent?.endNode),
        `</${parent.tagName}`
      );
    }

    return parts;
  }, "children");
}

export default function print(
  path: AstPath<ParserNode>,
  options: {
    originalText: string;
  },
  print: (path: AstPath) => Doc
): Doc {
  const node: ParserNode = path.getValue();

  if (node.prettierIgnore.length > 0) {
    const lines = options.originalText.split(NEWLINE_REGEX);
    const textLines = lines.slice(
      node.prettierIgnore[0].startLocation.line - 1,
      node.endLocation.line
    );
    textLines[0] = textLines[0].substr(
      node.prettierIgnore[0].startLocation.column - 1
    );
    textLines[textLines.length - 1] = textLines[textLines.length - 1].substr(
      0,
      node.endLocation.column
    );
    /**
     * Replicate prettiers algorithm:
     * Intend <!--prettier-ignore--> and starting tag with the current indentation.
     */
    return textLines.reduce((parts, text, index) => {
      const removeIntendation = index <= node.prettierIgnore.length;
      /**
       * Either use hardline and remove left whitespace or use literalline and keep whitespace.
       * Whatever follows hardline is intended, whatever follows a literalline is not.
       */
      if (index > 0) {
        parts.push(removeIntendation ? hardline : literalline);
      }
      parts.push(removeIntendation ? text.trimLeft() : text);
      return parts;
    }, [] as Doc[]);
  } else if (node instanceof RootNode) {
    return printChildren(path, options, print);
  } else if (node instanceof HtmlTagNode) {
    return group([
      printOpeningTag(node, path, print),
      concatChildren(node, printChildren(path, options, print)),
      printClosingTag(node),
    ]);
  } else if (node instanceof AttributeNode) {
    if (node.value != null) {
      if (node.name === "class") {
        const classNames = node.value.trim().split(/\s+/);
        return [
          group([
            'class="',
            indent([softline, join(line, classNames)]),
            softline,
            '"',
          ]),
        ];
      } else {
        return `${node.name}="${escapeDoubleQuote(node.value)}"`;
      }
    } else {
      return node.name;
    }
  } else if (node instanceof HtmlTextNode) {
    const parts: Doc[] = [];
    const isPreformatted = node.isSelfOrParentPreformatted;
    if (isPreformatted) {
      const textLines = node.text.split(NEWLINE_REGEX);
      textLines.forEach((textLine, index) => {
        parts.push(textLine);
        if (index < textLines.length - 1) {
          parts.push(literalline, breakParent);
        }
      });
    } else {
      let prettierIgnoreMode = false;
      node.tokens.forEach((token: WhitespaceToken, index: number) => {
        let doc: Doc;
        if (token.type == "prettierIgnore") {
          prettierIgnoreMode = true;
          doc = [
            token.text.trimRight(),
            /**
             * This is similar to calculateDifferenceBetweenLines.
             * Use linebreak for spaces or one linebreak, otherwise use most two linebreaks.
             */
            ...(token.text.endsWith("-->")
              ? []
              : token.text.split(NEWLINE_REGEX).length > 2
              ? [hardline, hardline]
              : [hardline]),
          ];
        } else if (prettierIgnoreMode) {
          doc = token.text;
        } else if (token.isWhitespaceOnly && index < node.tokens.length - 1) {
          doc = line;
        } else if (token.type === "text") {
          doc = token.text;
        } else if (token.type === "conditionalComment") {
          // Cannot trim whitespace inside text
          doc = printRevealedConditionalComment(token.text, false);
        } else {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new Error(`Unknown whitespace token type ${token.type}`);
        }
        parts.push(doc);
      });
    }
    if (
      node.isLastChild &&
      node.parent instanceof HtmlTagNode &&
      breakClosingTag(node.parent)
    ) {
      parts[parts.length - 1] = [
        parts[parts.length - 1],
        decorateStart(node.parent?.endNode),
        `</${node.parent.tagName}`,
      ];
    }
    return decorate(
      isPreformatted ? dedentToRoot(fill(parts)) : fill(parts),
      node
    );
  } else if (node instanceof HtmlCommentNode) {
    return decorate([node.text], node);
  } else if (node instanceof HtmlDocTypeNode) {
    // Lowercase root element
    const types = node.types
      .map((type, index) => (index == 0 ? type.toLowerCase() : type))
      .join(" ");
    return decorate(group([group([`<!DOCTYPE ${types}`]), ">"]), node);
  } else if (node instanceof IeConditionalCommentNode) {
    return group([
      decorate(node.text, node.startNode),
      concatChildren(node, printChildren(path, options, print)),
      decorate(`<![endif]-->`, node.endNode),
    ]);
  } else if (node instanceof HtmlCdataNode) {
    return decorate([node.text], node);
  } else if (node instanceof HtmlCloseNode) {
    return [
      concatChildren(node, printChildren(path, options, print)),
      breakParent,
      // Children are always preceeded by softline to make indent work.
      node.isFirstChild && node.children.length == 0 ? softline : "",
      `</${node.tagName}>`,
    ];
  } else if (node instanceof VelocityDirectiveNode) {
    return decorate(
      [
        `#${node.directive}(${node.tokens
          .map((token) => token.textValue)
          .join("")}`,
        ...(node.hasChildren
          ? [concatChildren(node, printChildren(path, options, print)), "#end"]
          : []),
      ],
      node
    );
  } else if (node instanceof VelocityCommentNode) {
    const parts: Doc[] = [];
    const textLines = node.text.split(NEWLINE_REGEX);
    textLines.forEach((textLine, index) => {
      parts.push(textLine);
      if (index < textLines.length - 1) {
        parts.push(literalline);
      }
    });
    return decorate(parts, node);
  } else {
    throw new Error("Unknown type " + node.constructor.toString());
  }
}
