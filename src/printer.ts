import { Doc, doc, FastPath } from "prettier";
import {
  AttributeNode,
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
      path.map((childPath, childIndex) => {
        const childNode = childPath.getValue();
        const printedChild = print(childPath);
        const nextBetweenLine =
          childNode.next != null && !childNode.next.isLeadingSpaceSensitive()
            ? hardline
            : "";
        return concat([printedChild, nextBetweenLine]);
      }, "children")
    );
  } else if (node instanceof HtmlTagNode) {
    const printedAttributes: Doc[] = path.map(print, "attributes");

    const el: Doc[] = [];

    const tagOpenParts: Doc[] = [`<${node.tagName}`];

    if (printedAttributes.length > 0) {
      tagOpenParts.push(indent(concat([line, join(line, printedAttributes)])));
    }

    if (!node.isSelfClosing()) {
      tagOpenParts.push(softline, ">");
    }

    el.push(group(concat(tagOpenParts)));

    if (node.children.length > 0) {
      const printedChildren = path.map((childPath, childIndex) => {
        const childNode = childPath.getValue();
        const parts: Doc[] = [print(childPath)];
        if (childNode.next != null && childNode.hasTrailingSpaces) {
          parts.push(line);
        }
        return concat(parts);
      }, "children");
      el.push(indent(concat([softline, ...printedChildren])));
      el.push(softline);
    }

    if (node.closeTag != null) {
      el.push(concat([`</${node.closeTag.tagName}>`]));
    }
    if (node.isSelfClosing()) {
      el.push(concat([line, "/>"]));
    }
    return group(concat(el));
  } else if (node instanceof AttributeNode) {
    if (node.value != null) {
      if (node.name === "class") {
        const classNames = node.value.trim().split(/\s+/);
        return concat([
          'class="',
          indent(concat([softline, join(line, classNames)])),
          '"',
          softline,
        ]);
      } else {
        return concat([`${node.name}="${node.value}"`]);
      }
    } else {
      return concat([node.nameToken.textValue]);
    }
  } else if (node instanceof HtmlTextNode) {
    return fill([node.text]);
  } else {
    throw new Error("Unknown type " + node.constructor.toString());
  }
}
