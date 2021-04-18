import {
  HtmlTextNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./parser/VelocityParserNodes";

import { Options } from "prettier";

const PREPROCESS_PIPELINE: ((ast: RootNode, options: Options) => void)[] = [
  extractWhitespaces,
];

export function preprocess(ast: RootNode, options: Options): RootNode {
  for (const fn of PREPROCESS_PIPELINE) {
    fn(ast, options);
  }
  return ast;
}

function extractWhitespaces(ast: RootNode) {
  return ast.walk((node, index, nodes) => {
    if (node instanceof NodeWithChildren) {
      node.children = node.children.reduce(
        (newChildren, child, childIndex, children) => {
          // Throw away whitespace only text. printer uses sourceLocation later to determine formatting.
          if (child instanceof HtmlTextNode && child.isWhitespaceOnly) {
            return newChildren;
          }
          return [...newChildren, child];
        },
        [] as ParserNode[]
      );
      return node;
    }
  });
}
