import { Doc, doc, FastPath } from "prettier";
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
  ParserNode,
  RootNode,
  VoidNode,
} from "./parser/VelocityParserNodes";
import { VelocityToken } from "./parser/VelocityToken";

const {
  literalline,
  breakParent,
  dedentToRoot,
  fill,
  ifBreak,
  concat,
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

function printRevealedConditionalComment(token: VelocityToken) {
  return token.textValue.trim().replace(/\s/g, " ").replace(/\s+]/, "]");
}

function decorate(doc: Doc | Doc[], node: DecoratedNode | undefined): Doc {
  return concat([
    node != null && node.revealedConditionalCommentStart != null
      ? printRevealedConditionalComment(node.revealedConditionalCommentStart)
      : "",
    ...(doc instanceof Array ? doc : [doc]),
    node != null && node.revealedConditionalCommentEnd != null
      ? printRevealedConditionalComment(node.revealedConditionalCommentEnd)
      : "",
  ]);
}

export function printOpeningTag(
  node: HtmlTagNode,
  path: FastPath<ParserNode>,
  print: (path: FastPath) => Doc
): Doc {
  const printedAttributes: Doc[] = path.map(print, "attributes");
  const tagOpenParts: Doc[] = [`<${node.tagName}`];

  if (printedAttributes.length > 0) {
    tagOpenParts.push(indent(concat([line, join(line, printedAttributes)])));
  }

  if (!node.isSelfClosing) {
    tagOpenParts.push(softline, ">");
  }

  return decorate(group(concat(tagOpenParts)), node.startNode);
}

export function printClosingTag(node: HtmlTagNode): Doc {
  if (node.forceCloseTag || node.endNode != null) {
    return decorate(`</${node.tagName}>`, node.endNode);
  } else if (node.isSelfClosing) {
    return concat([line, "/>"]);
  } else {
    return "";
  }
}

export function concatChildren(node: ParserNode, children: Doc[] | Doc): Doc {
  if (children == "") {
    return "";
  }
  const noLeadingWhitespace = node.isSelfOrParentPreformatted;
  const noTrailingWhitespace = node.isSelfOrParentPreformatted;
  return group(
    concat([
      indent(
        concat([
          noLeadingWhitespace ? "" : softline,
          ...(children instanceof Array ? children : [children]),
        ])
      ),
      noTrailingWhitespace ? "" : softline,
    ])
  );
}

function calculateDifferenceBetweenChildren(
  prev: ParserNode,
  next: ParserNode,
  sameLineDoc: Doc
): Doc {
  const lineDifference = next.startLocation.line - prev.endLocation!.line;
  if (lineDifference == 0) {
    return sameLineDoc;
  } else if (lineDifference == 1) {
    return hardline;
  } else {
    return concat([hardline, hardline]);
  }
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
  path: FastPath<ParserNode>,
  options: unknown,
  print: (path: FastPath) => Doc
): Doc[] {
  return path.map((childPath, childIndex) => {
    const childNode = childPath.getValue();
    const parts: Doc[] = [];
    const childParts = print(childPath);

    if (childNode.isOnlyChild && childNode.isInlineRenderMode) {
      const isParentInlineRenderingMode =
        childNode.parent != null && childNode.parent.isInlineRenderMode;
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
          prev.isPreformatted ||
          (prev instanceof HtmlTagNode && prev.forceBreak)
        ) {
          // At least one hardline after preformatted text
          lineBreak = calculateDifferenceBetweenChildren(
            prev,
            childNode,
            hardline
          );
        } else if (prev.isInlineRenderMode && childNode.isInlineRenderMode) {
          // In inline mode, use line instead of softline to seperate content.
          lineBreak = childNode.hasLeadingSpaces
            ? calculateDifferenceBetweenChildren(prev, childNode, line)
            : /**
               * Allow the formatter insert a line break before the next tag:
               * <span> inline </span><span> inline </span> <span> inline </span>
               * <span> inline </span>
               * Instead of having to break the whole tag:
               * <span> inline </span><span> inline </span> <span>
               *  inline
               * </span> <span> inline </span>
               */
              ifBreak(softline, "");
        }
        parts.push(group(concat([lineBreak, childParts])));
      } else {
        // Block Mode requires no linebreak, because there will be a linebreak at the end of the prev
        parts.push(childParts);
      }

      // Ensure forceBreak, even if there is no next node.
      if (
        childNode instanceof HtmlTagNode &&
        childNode.forceBreak &&
        childNode.next == null
      ) {
        parts.push(breakParent);
      }

      /**
       * Look at next node to determine if line break is needed after child content.
       */
      // Preformatted and force break is handled in prev check of next node.
      if (
        childNode.next != null &&
        !(
          childNode.isPreformatted ||
          (childNode instanceof HtmlTagNode && childNode.forceBreak)
        )
      ) {
        const next = childNode.next;
        if (
          next.isInlineRenderMode &&
          !childNode.isInlineRenderMode &&
          childNode.hasTrailingSpaces
        ) {
          parts[parts.length - 1] = group(
            concat([
              parts[parts.length - 1],
              // In inline mode, use line instead of softline to seperate content.
              calculateDifferenceBetweenChildren(childNode, next, line),
            ])
          );
        } else if (next.isBlockRenderMode) {
          parts.push(
            calculateDifferenceBetweenChildren(childNode, next, softline)
          );
        }
      }
    }
    return concat(parts);
  }, "children");
}

export default function print(
  path: FastPath<ParserNode>,
  options: unknown,
  print: (path: FastPath) => Doc
): Doc {
  const node: ParserNode = path.getValue();

  if (node instanceof RootNode) {
    return concat(printChildren(path, options, print));
  } else if (node instanceof HtmlTagNode) {
    return group(
      concat([
        printOpeningTag(node, path, print),
        node.children.length > 0
          ? concatChildren(node, printChildren(path, options, print))
          : "",
        printClosingTag(node),
      ])
    );
  } else if (node instanceof AttributeNode) {
    if (node.value != null) {
      if (node.name === "class") {
        const classNames = node.value.trim().split(/\s+/);
        return concat([
          group(
            concat([
              'class="',
              indent(concat([softline, join(line, classNames)])),
              softline,
              '"',
            ])
          ),
        ]);
      } else {
        return concat([`${node.name}="${escapeDoubleQuote(node.value)}"`]);
      }
    } else {
      return concat([node.name]);
    }
  } else if (node instanceof HtmlTextNode) {
    if (node.isSelfOrParentPreformatted) {
      const textLines = node.text.split("\n");
      const parts: Doc[] = [];
      textLines.forEach((textLine, index) => {
        parts.push(textLine);
        if (index < textLines.length - 1) {
          parts.push(literalline, breakParent);
        }
      });
      return decorate(concat([dedentToRoot(softline), fill(parts)]), node);
    } else {
      const words = node.text.trim().split(/\s+/);
      const parts: Doc[] = [];
      words.forEach((word, index) => {
        parts.push(word);
        if (index < words.length - 1) {
          parts.push(line);
        }
      });
      return decorate(fill(parts), node);
    }
  } else if (node instanceof HtmlCommentNode) {
    return decorate([node.text], node);
  } else if (node instanceof HtmlDocTypeNode) {
    return decorate(
      group(
        concat([group(concat([`<!DOCTYPE ${node.types.join(" ")}`])), ">"])
      ),
      node
    );
  } else if (node instanceof IeConditionalCommentNode) {
    const el: Doc[] = [decorate(node.text, node.startNode)];

    if (node.children.length > 0) {
      const printedChildren = printChildren(path, options, print);
      el.push(indent(concat([softline, ...printedChildren])));
      el.push(softline);
    }

    el.push(decorate(`<![endif]-->`, node.endNode));
    return group(concat(el));
  } else if (node instanceof HtmlCdataNode) {
    return decorate([node.text], node);
  } else if (node instanceof VoidNode) {
    return concatChildren(node, printChildren(path, options, print));
  } else if (node instanceof HtmlCloseNode) {
    return concat([`</${node.tagName}>`]);
  } else {
    throw new Error("Unknown type " + node.constructor.toString());
  }
}
