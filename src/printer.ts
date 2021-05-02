import { Doc, doc, FastPath } from "prettier";
import {
  AttributeNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode,
  HtmlTextNode,
  IeConditionalCommentNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./parser/VelocityParserNodes";

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

  return group(concat(tagOpenParts));
}

export function printClosingTag(node: HtmlTagNode): Doc {
  if (node.isSelfClosing) {
    return concat([line, "/>"]);
  } else {
    return concat([`</${node.tagName}>`]);
  }
}

export function concatChildren(children: Doc[] | Doc): Doc {
  if (children == "") {
    return "";
  }
  return group(
    // TODO softline and line if only one child
    concat([
      indent(
        concat([
          softline,
          ...(children instanceof Array ? children : [children]),
        ])
      ),
      softline,
    ])
  );
}

export function concatTagChildren(
  node: NodeWithChildren,
  children: Doc[]
): Doc {
  // Add no line if preformatted or we already have a line
  const noLeadingWhitespace = node.isSelfOrParentPreformatted;
  const noTrailingWhitespace = node.isSelfOrParentPreformatted;
  return group(
    // TODO softline and line if only one child
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

function printChildren(
  path: FastPath<ParserNode>,
  options: unknown,
  print: (path: FastPath) => Doc
): Doc[] {
  return path.map((childPath, childIndex) => {
    const childNode = childPath.getValue();
    const parts: Doc[] = [];
    const childParts = print(childPath);
    /*
     * Text or mixed content should fill as much horizontal space as possible.
     * In contrast, tag content should break uniformly.
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
     * This is achieved by pushing the line inside the children group and instead of next to it.
     */
    // https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
    if (childNode.isOnlyChild && childNode instanceof HtmlTextNode) {
      const isParentInlineRenderingMode =
        childNode.parent != null && childNode.parent.isInlineRenderMode;
      // If only child and inline rendering mode, then output leading and trailing space.
      if (isParentInlineRenderingMode && childNode.hasLeadingSpaces) {
        parts.push(ifBreak("", " "));
      }
      parts.push(childParts);
      if (isParentInlineRenderingMode && childNode.hasTrailingSpaces) {
        parts.push(ifBreak("", " "));
      }
    } else {
      const prev = childNode.prev;
      // Different treatment for mixed content. See above.
      if (prev != null && prev instanceof HtmlTagNode && prev.isPreformatted) {
        parts.push(
          group(
            concat([
              calculateDifferenceBetweenChildren(prev, childNode, hardline),
              childParts,
            ])
          )
        );
      } else if (
        prev != null &&
        prev.isInlineRenderMode &&
        childNode.isInlineRenderMode
      ) {
        parts.push(
          group(
            concat([
              childNode.hasLeadingSpaces
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
                  ifBreak(softline, ""),
              childParts,
            ])
          )
        );
      } else {
        parts.push(childParts);
      }

      const next = childNode.next;
      if (next != null) {
        // Different treatment for mixed content. See above.
        if (childNode instanceof HtmlTagNode && childNode.isPreformatted) {
          // Always at least one hardline after preformatted text
          // parts.push(
          //   calculateDifferenceBetweenChildren(childNode, next, hardline)
          // );
        } else if (
          next.isInlineRenderMode &&
          !childNode.isInlineRenderMode &&
          // childNode.isInlineRenderMode &&
          childNode.hasTrailingSpaces
        ) {
          parts[parts.length - 1] = group(
            concat([
              parts[parts.length - 1],
              // Whitespace sensitive text or mixed content cannot use softline.
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

// function isLastChildTagOpen(node: HtmlTagNode) {
//   const lastChild = node.lastChild;
//   // return (
//   //   lastChild != null &&
//   //   lastChild.isTrailingSpaceSensitive() &&
//   //   !lastChild.hasTrailingSpaces
//   // );
//   return (
//     lastChild != null &&
//     lastChild instanceof HtmlTagNode &&
//     !shouldTagBeClosed(lastChild)
//   );
// }

// function shouldTagBeClosed(node: HtmlTagNode) {
//   return node.parent instanceof RootNode || node.next == null;
// }

// function isPreviousTagOpen(node: HtmlTagNode) {
//   return (
//     node.prev != null &&
//     node.prev instanceof HtmlTagNode &&
//     !shouldTagBeClosed(node.prev)
//   );
// }

export default function (
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
          ? concatTagChildren(node, printChildren(path, options, print))
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
      return concat([node.nameToken.textValue]);
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
      return concat([dedentToRoot(softline), fill(parts)]);
    } else {
      const words = node.text.trim().split(/\s+/);
      const parts: Doc[] = [];
      words.forEach((word, index) => {
        parts.push(word);
        if (index < words.length - 1) {
          parts.push(line);
        }
      });
      return fill(parts);
    }
  } else if (node instanceof HtmlCommentNode) {
    return concat([node.text]);
  } else if (node instanceof HtmlDocTypeNode) {
    return group(
      concat([group(concat([`<!DOCTYPE ${node.types.join(" ")}`])), ">"])
    );
  } else if (node instanceof IeConditionalCommentNode) {
    const el: Doc[] = [node.text];

    if (node.children.length > 0) {
      const printedChildren = printChildren(path, options, print);
      el.push(indent(concat([softline, ...printedChildren])));
      el.push(softline);
    }

    el.push(`<![endif]-->`);
    return group(concat(el));
  } else {
    throw new Error("Unknown type " + node.constructor.toString());
  }
}
