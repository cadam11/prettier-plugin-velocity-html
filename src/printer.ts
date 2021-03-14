import { Doc, doc, FastPath } from "prettier";
import { HtmlTagNode } from "./parser/Node";
import { Token } from "antlr4ts";

const { concat, hardline, join, group, indent } = doc.builders;

export default function (
  path: FastPath,
  options: object,
  print: (path: FastPath) => Doc
): Doc {
  const node: HtmlTagNode = path.getValue();

  const attributes: Doc[] = [];
  node.attributes.forEach(({ key, value }) => {
    attributes.push(group(`${key.text} = ${value.text}`));
  });

  const el: Doc[] = [
    group(
      concat([
        "<",
        group(concat([node.tagName, group(concat(attributes))])),
        ">",
      ])
    ),
    indent(concat([hardline, ...path.map(print, "children")])),
  ];

  if (node.closeTag) {
    el.push(concat([hardline, "</", node.closeTag.tagName, ">"]));
  }
  return concat(el);
}
