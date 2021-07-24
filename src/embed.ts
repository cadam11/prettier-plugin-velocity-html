import { AstPath, doc, Doc, Options, ParserOptions } from "prettier";
import {
  AttributeNode,
  HtmlTagNode,
  HtmlTextNode,
  ParserNode,
  VelocityDirectiveNode,
  VelocityReferenceNode,
} from "./parser/VelocityParserNodes";
import { concatChildren, printClosingTag, printOpeningTag } from "./printer";

const { breakParent, group } = doc.builders;

const CSS_PARSER_OPTIONS = {
  parser: "css",
  __isHTMLStyleAttribute: true,
  __embeddedInHtml: true,
};

const JS_PARSER_OPTIONS = {
  parser: "babel",
  __embeddedInHtml: true,
  __babelSourceType: "script",
};

export const embed = (
  path: AstPath<ParserNode>,
  print: (path: AstPath<ParserNode>) => Doc,
  textToDoc: (
    text: string,
    options: Options,
    textToDocOptions: { stripTrailingHardline: true }
  ) => Doc,
  options: ParserOptions
): Doc | null => {
  const node = path.getValue();

  if (node instanceof AttributeNode) {
    let doc: Doc | null = null;
    if (node.name === "style" && node.value.length > 0) {
      doc = textToDoc(
        node.unescapedValue,
        {
          ...options,
          parser: "css",
          __isHTMLStyleAttribute: true,
          __embeddedInHtml: true,
        } as any,
        // TODO Scheduled for removal
        { stripTrailingHardline: true }
      );
    }
    if (doc != null) {
      return group([node.name, '="', concatChildren(node, doc), '"']);
    }
  } else if (node instanceof HtmlTagNode) {
    if (node.tagName == "script" || node.tagName === "style") {
      /**
       * Safely format "invalid" css
       */
      const preformatted = node.isPreformatted();
      const scriptText = node.children
        .map((child) => {
          if (child instanceof HtmlTextNode) {
            return child.text;
          } else if (
            child instanceof VelocityReferenceNode ||
            child instanceof VelocityDirectiveNode
          ) {
            if (!preformatted) {
              throw new Error(
                "Node is not preformatted, but has velocity nodes."
              );
            }
            return child.tokens.map((token) => token.textValue).join("");
          } else {
            throw new Error(`Unexpected type ${child.toString()}`);
          }
        })
        .join(preformatted ? "" : " ");

      const parserOptions = inferParserOptions(node);

      const doc =
        scriptText != "" && parserOptions != null && !preformatted
          ? textToDoc(
              scriptText,
              {
                ...parserOptions,
              },
              // TODO Scheduled for removal
              { stripTrailingHardline: true }
            )
          : scriptText;
      return [
        breakParent,
        printOpeningTag(node, path, print),
        concatChildren(node, doc),
        printClosingTag(node),
      ];
    }
  }
  return null;
};

function inferParserOptions(node: HtmlTagNode): Record<string, unknown> | null {
  if (node.tagName === "style") {
    return CSS_PARSER_OPTIONS;
  } else {
    if (node.scriptParser === "babel") {
      return JS_PARSER_OPTIONS;
    } else {
      return null;
    }
  }
}
