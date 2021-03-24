import { VelocityToken } from "./VelocityToken";

export class ParserNode {}

export class AttributeNode extends ParserNode {
  public constructor(public key: VelocityToken, public value?: VelocityToken) {
    super();
  }
}

export class HtmlTagNode extends ParserNode {
  public tagName: string;
  public attributes: AttributeNode[] = [];
  public closeTag: HtmlCloseTagNode;
  private content: VelocityToken[] = [];
  public children: HtmlTagNode[] = [];
  public constructor(public parent: HtmlTagNode, public locationStart: number) {
    super();
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }

  public addContent(content: VelocityToken) {
    this.content.push(content);
  }
}

export class HtmlCloseTagNode extends ParserNode {
  public tagName: string;

  public constructor(
    public startNode: HtmlTagNode,
    public locationStart: number
  ) {
    super();
  }
}
