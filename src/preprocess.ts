import {
  NodeWithChildren,
  ParserNode,
  RootNode,
  WhitespaceNode,
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
          if (child instanceof WhitespaceNode) {
            return newChildren;
          } else {
            child.hasLeadingSpaces =
              childIndex !== 0 &&
              children[childIndex - 1] instanceof WhitespaceNode;
            child.hasTrailingSpaces =
              childIndex !== node.children.length - 1 &&
              children[childIndex + 1] instanceof WhitespaceNode;
            return [...newChildren, child];
          }
        },
        [] as ParserNode[]
      );
      return node;
    }
  });
}
