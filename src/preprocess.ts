import {
  HtmlCloseNode,
  HtmlTextNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./parser/VelocityParserNodes";

import { Options } from "prettier";

const PREPROCESS_PIPELINE: ((ast: RootNode, options: Options) => void)[] = [
  extractWhitespaces,
  // cleanVoidNodes,
];

export function preprocess(ast: RootNode, options: Options): RootNode {
  for (const fn of PREPROCESS_PIPELINE) {
    fn(ast, options);
  }
  return ast;
}

function extractWhitespaces(ast: RootNode): void {
  ast.walk((node, index, nodes) => {
    if (node instanceof NodeWithChildren) {
      node.children = node.children.reduce(
        (newChildren, child, childIndex, children) => {
          if (!child.isSelfOrParentPreformatted) {
            if (child instanceof HtmlTextNode) {
              child.trimWhitespace();

              const previousSibling = children[childIndex - 1];

              previousSibling != null &&
                (previousSibling.hasTrailingSpaces = child.hasLeadingSpaces);

              const nextSibling = children[childIndex + 1];
              nextSibling != null &&
                (nextSibling.hasLeadingSpaces = child.hasTrailingSpaces);
              if (child.text == "") {
                return newChildren;
              } else {
                return [...newChildren, child];
              }
            }
          }
          return [...newChildren, child];
        },
        [] as ParserNode[]
      );
    }
  });
}
