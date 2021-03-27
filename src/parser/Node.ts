import { VelocityToken } from "./VelocityToken";

export abstract class ParserNode {
  public prev: ParserNode | undefined;
  public next: ParserNode | undefined;

  abstract isLeadingSpaceSensitive(): boolean;
}

export abstract class NodeWithChildren extends ParserNode {
  public children: ParserNode[] = [];

  public addChild(child: ParserNode) {
    this.children.push(child);
  }
}

export class AttributeNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public constructor(public key: VelocityToken, public value?: VelocityToken) {
    super();
  }
}

export class RootNode extends NodeWithChildren {
  isLeadingSpaceSensitive(): boolean {
    return false;
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
    public startNode: HtmlTagNode,
    public locationStart: number
  ) {
    super();
  }
}
