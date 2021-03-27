import { Doc, doc, FastPath } from "prettier";
import {
  AttributeNode,
  HtmlTagNode,
  HtmlTextNode,
  ParserNode,
  RootNode,
} from "./parser/Node";
import { Token } from "antlr4ts";

const { concat, hardline, softline, join, group, indent, line } = doc.builders;

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
          childNode.next && childNode.next.isLeadingSpaceSensitive
            ? hardline
            : "";
        return concat([printedChild, nextBetweenLine]);
      }, "children")
    );
  } else if (node instanceof HtmlTagNode) {
    const printedAttributes: Doc[] = path.map(print, "attributes");

    const el: Doc[] = [
      group(
        concat([
          "<",
          node.tagName,
          indent(concat([line, join(line, printedAttributes)])),
          // ),
          !node.isSelfClosing() ? ">" : "",
        ])
      ),
    ];
    if (node.children.length > 0) {
      el.push(indent(concat(path.map(print, "children"))));
    }

    if (node.closeTag) {
      el.push(concat(["</", node.closeTag.tagName, ">"]));
    }
    if (node.isSelfClosing()) {
      el.push(concat([line, "/>"]));
    }
    return group(concat(el));
  } else if (node instanceof AttributeNode) {
    if (node.value) {
      return concat([node.key.textValue, "=", '"', node.value.textValue, '"']);
    } else {
      return concat([node.key.textValue]);
    }
  } else if (node instanceof HtmlTextNode) {
    return concat([node.token.text]);
  } else {
    throw new Error("Unknown type " + node.toString());
  }
}
