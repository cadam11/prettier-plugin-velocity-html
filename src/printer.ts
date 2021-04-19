import { Parser } from "antlr4ts";
import { should } from "chai";
import { Doc, doc, FastPath } from "prettier";
import {
  AttributeNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode,
  HtmlTextNode,
  IeConditionalCommentNode,
  ParserNode,
  RootNode,
} from "./parser/VelocityParserNodes";

const {
  fill,
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

export function concatChildren(children: Doc[] | Doc) {
  if (children === "") {
    return "";
  }
  return group(
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

function printChildren(
  path: FastPath<ParserNode>,
  options: object,
  print: (path: FastPath) => Doc
): Doc[] {
  return path.map((childPath, childIndex) => {
    const childNode = childPath.getValue();
    const parts: Doc[] = [];
    const childParts = print(childPath);
    if (childNode instanceof HtmlTextNode) {
      parts.push(childParts);
    } else {
      const prev = childNode.prev;
      /*
       * Text or text mixed in with tags should break differently than tags only.
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
      if (prev instanceof HtmlTextNode && childNode.hasLeadingSpaces) {
        parts.push(group(concat([line, childParts])));
      } else {
        parts.push(childParts);
      }

      const next = childNode.next;
      if (next != null) {
        const lineDifference =
          next.startLocation.line - childNode.endLocation!.line;
        /*
         * Keep the line break if current child is followed by text.
         * The children of
         * <label>
         *  <input name="address"/>
         *  Address
         * </label>
         * should not collapse onto single line
         */
        if (next instanceof HtmlTextNode && lineDifference == 0) {
          parts[parts.length - 1] = group(
            concat([
              parts[parts.length - 1],
              childNode.hasTrailingSpaces ? line : "",
            ])
          );
        } else {
          if (lineDifference == 0) {
            parts.push(line);
          } else if (lineDifference == 1) {
            parts.push(hardline);
          } else {
            parts.push(hardline, hardline);
          }
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
  options: object,
  print: (path: FastPath) => Doc
): Doc {
  const node: ParserNode = path.getValue();

  if (node instanceof RootNode) {
    // const printedChildren: Doc[] = path.map(print, "children");

    // return join(line, printedChildren);
    return concat(
      // path.map((childPath, childIndex) => {
      //   const childNode = childPath.getValue();
      //   const printedChild = print(childPath);
      //   const nextBetweenLine =
      //     childNode.next != null && !childNode.next.isLeadingSpaceSensitive()
      //       ? hardline
      //       : "";
      //   return concat([printedChild, nextBetweenLine]);
      // }, "children")
      printChildren(path, options, print)
    );
  } else if (node instanceof HtmlTagNode) {
    const el: Doc[] = [printOpeningTag(node, path, print)];

    if (node.children.length > 0) {
      const printedChildren = printChildren(path, options, print);
      // el.push(indent(concat([softline, ...printedChildren])));
      // el.push(softline);
      el.push(concatChildren(printedChildren));
    }

    el.push(printClosingTag(node));
    return group(concat(el));
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
    const words = node.text.trim().split(/\s+/);
    const parts: Doc[] = [];
    words.forEach((word, index) => {
      parts.push(word);
      if (index < words.length - 1) {
        parts.push(line);
      }
    });
    return fill(parts);
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
