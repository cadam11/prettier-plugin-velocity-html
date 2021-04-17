import { Parser } from "antlr4ts";
import { should } from "chai";
import { Doc, doc, FastPath } from "prettier";
import {
  AttributeNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlTagNode,
  HtmlTextNode,
  ParserNode,
  RootNode,
} from "./parser/Node";

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

function printChildren(
  path: FastPath<ParserNode>,
  options: object,
  print: (path: FastPath) => Doc
): Doc[] {
  return path.map((childPath, childIndex) => {
    const childNode = childPath.getValue();
    const parts: Doc[] = [];
    parts.push(print(childPath));
    const next = childNode.next;
    if (next != null) {
      const lineDifference =
        next.startLocation.line - childNode.endLocation!.line;
      if (lineDifference == 0) {
        parts.push(line);
      } else if (lineDifference == 1) {
        parts.push(hardline);
      } else {
        parts.push(hardline, hardline);
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
    const printedAttributes: Doc[] = path.map(print, "attributes");

    const el: Doc[] = [];

    const tagOpenParts: Doc[] = [`<${node.tagName}`];

    if (printedAttributes.length > 0) {
      tagOpenParts.push(indent(concat([line, join(line, printedAttributes)])));
    }

    if (!node.isSelfClosing) {
      tagOpenParts.push(softline, ">");
    }

    el.push(group(concat(tagOpenParts)));

    if (node.children.length > 0) {
      const printedChildren = printChildren(path, options, print);
      el.push(indent(concat([softline, ...printedChildren])));
      el.push(softline);
    }

    if (node.hasClosingTag != null) {
      el.push(concat([`</${node.tagName}>`]));
    }
    if (node.isSelfClosing) {
      el.push(concat([line, "/>"]));
    }
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
    return fill([node.text]);
  } else if (node instanceof HtmlCommentNode) {
    return concat([node.text]);
  } else if (node instanceof HtmlDocTypeNode) {
    return group(
      concat([group(concat([`<!DOCTYPE ${node.types.join(" ")}`])), ">"])
    );
  } else {
    throw new Error("Unknown type " + node.constructor.toString());
  }
}
