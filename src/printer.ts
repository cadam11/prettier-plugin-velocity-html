import { Doc, doc, FastPath } from "prettier";
import { AttributeNode, HtmlTagNode, ParserNode } from "./parser/Node";
import { Token } from "antlr4ts";

const { concat, hardline, softline, join, group, indent, line } = doc.builders;

export default function (
  path: FastPath,
  options: object,
  print: (path: FastPath) => Doc
): Doc {
  const node: ParserNode = path.getValue();

  if (node instanceof HtmlTagNode) {
    const printedAttributes: Doc[] = path.map(print, "attributes");

    const el: Doc[] = [
      group(
        concat([
          "<",
          node.tagName,
          indent(concat([line, join(line, printedAttributes)])),
          // ),
          ">",
        ])
      ),
    ];
    if (node.children.length > 0) {
      el.push(indent(concat([line, ...path.map(print, "children")])));
    }

    if (node.closeTag) {
      el.push(concat(["</", node.closeTag.tagName, ">"]));
    }
    return concat(el);
  } else if (node instanceof AttributeNode) {
    if (node.value) {
      return concat([node.key.textValue, "=", '"', node.value.textValue, '"']);
    } else {
      return concat([node.key.textValue]);
    }
  }
}
