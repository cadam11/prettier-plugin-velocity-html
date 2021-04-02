import {
  HtmlTextNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./parser/Node";

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
          if (child instanceof HtmlTextNode && child.isWhitespaceOnly) {
            return newChildren;
          } else {
            const previousSibling = children[childIndex - 1];
            child.hasLeadingSpaces =
              previousSibling instanceof HtmlTextNode &&
              previousSibling.isWhitespaceOnly;
            const nextSibling = children[childIndex + 1];
            child.hasTrailingSpaces =
              nextSibling instanceof HtmlTextNode &&
              nextSibling.isWhitespaceOnly;
            return [...newChildren, child];
          }
        },
        [] as ParserNode[]
      );
      return node;
    }
  });
}
