import { Parser } from "antlr4ts";
import { VelocityToken } from "./VelocityToken";

export abstract class ParserNode {
  public get prev(): ParserNode | undefined {
    return this.index != null && this.parent != null
      ? this.parent.children[this.index - 1]
      : undefined;
  }
  public get next(): ParserNode | undefined {
    return this.index != null && this.parent != null
      ? this.parent.children[this.index + 1]
      : undefined;
  }
  public get index(): number | undefined {
    return this.parent != null ? this.parent.children.indexOf(this) : undefined;
  }
  public parent: NodeWithChildren | undefined;

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    fn(this, 0, [this]);
  }

  public hasLeadingSpaces = false;
  public hasTrailingSpaces = false;

  abstract isLeadingSpaceSensitive(): boolean;
}

export abstract class NodeWithChildren extends ParserNode {
  public children: ParserNode[] = [];

  abstract isWhitespaceCollapsible(): boolean;

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    this.children = this.children.map((node) => {
      node.walk(fn);
      return node;
    });
    super.walk(fn);
  }

  public addChild(child: ParserNode): void {
    this.children.push(child);
  }
}

export class AttributeNode extends ParserNode {
  clone(): ParserNode {
    return new AttributeNode(this.key, this.value);
  }
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public constructor(public key: VelocityToken, public value?: VelocityToken) {
    super();
  }
}

export class RootNode extends NodeWithChildren {
  clone(): ParserNode {
    return new RootNode();
  }
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public isWhitespaceCollapsible(): boolean {
    return true;
  }
  public constructor() {
    super();
  }
}

export class HtmlTextNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public constructor(public token: VelocityToken) {
    super();
  }
}

export class WhitespaceNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public constructor(public whitespace: string) {
    super();
  }
}

export class HtmlTagNode extends NodeWithChildren {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public tagName: string;
  public attributes: AttributeNode[] = [];
  public closeTag: HtmlCloseTagNode;
  public constructor(
    public parent: NodeWithChildren,
    public locationStart: number
  ) {
    super();
  }

  public isSelfClosing(): boolean {
    return this.tagName === "input" || this.tagName === "meta";
  }

  public isWhitespaceCollapsible(): boolean {
    // TODO Add css whitespace.startsWith('pre')
    return this.tagName !== "pre";
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }
}

export class HtmlCloseTagNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public tagName: string;

  public constructor(
    public startNode: ParserNode,
    public locationStart: number
  ) {
    super();
  }
}
