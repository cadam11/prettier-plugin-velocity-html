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

  /**
   * Can collapse and trim whitespace?
   */
  abstract isWhitespaceSensitive(): boolean;

  public get lastChild(): ParserNode | undefined {
    return this.children[this.children.length - 1];
  }

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
    child.parent = this;
  }
}

export class AttributeNode extends ParserNode {
  clone(): ParserNode {
    return new AttributeNode(this.nameToken, this.valueToken);
  }
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  get name(): string {
    return this.nameToken.textValue;
  }
  get value(): string | undefined {
    return this.valueToken != null ? this.valueToken.textValue : undefined;
  }

  public constructor(
    public nameToken: VelocityToken,
    public valueToken?: VelocityToken
  ) {
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
  public isWhitespaceSensitive(): boolean {
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
  public constructor(public text: string) {
    super();
  }

  public get isWhitespaceOnly(): boolean {
    return /^\s+$/.exec(this.text) != null;
  }
}

export class HtmlTagNode extends NodeWithChildren {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }

  private selfClosingTags = ["input", "meta", "img"];
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
    return this.selfClosingTags.includes(this.tagName);
  }

  public isWhitespaceSensitive(): boolean {
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
