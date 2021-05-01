import {
  HtmlTagNode,
  HtmlTextNode,
  NodeWithChildren,
  ParserNode,
  RootNode,
} from "./parser/VelocityParserNodes";

import { Options } from "prettier";
import { Parser } from "antlr4ts";

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
          if (!child.isSelfOrParentPreformatted) {
            if (child instanceof HtmlTextNode) {
              // Throw away whitespace only text. printer uses sourceLocation later to determine formatting.
              // if (child.isWhitespaceOnly) {
              //   return newChildren;
              // }
              // if (child.isOnlyChild) {
              // Can removeWhitespace() mutates states, so we must take care where to call it.

              child.trimWhitespace();

              const previousSibling = children[childIndex - 1];

              previousSibling != null &&
                (previousSibling.hasTrailingSpaces = child.hasLeadingSpaces);

              const nextSibling = children[childIndex + 1];
              nextSibling != null &&
                (nextSibling.hasLeadingSpaces = child.hasTrailingSpaces);
              // }
              if (child.text == "") {
                return newChildren;
              } else {
                return [...newChildren, child];
              }
            }
            // else {
            //   const previousSibling = children[childIndex - 1];
            //   child.hasLeadingSpaces =
            //     previousSibling instanceof HtmlTextNode &&
            //     (previousSibling.isWhitespaceOnly ||
            //       previousSibling.removeTrailingWhitespaceTokens());
            //   const nextSibling = children[childIndex + 1];
            //   child.hasTrailingSpaces =
            //     nextSibling instanceof HtmlTextNode &&
            //     (nextSibling.isWhitespaceOnly ||
            //       nextSibling.removeLeadingWhitespace());
            // }
          }
          return [...newChildren, child];
        },
        [] as ParserNode[]
      );
    }
  });
}
