import { Token } from "antlr4ts";

export class ParserNode {}

export class AttributeNode extends ParserNode {
  public constructor(public key: Token, public value?: Token) {
    super();
  }
}

export class HtmlTagNode extends ParserNode {
  public tagName: string;
  public attributes: AttributeNode[] = [];
  public closeTag: HtmlCloseTagNode;
  private content: Token[] = [];
  public children: HtmlTagNode[] = [];
  public constructor(public parent: HtmlTagNode, public locationStart: number) {
    super();
  }

  public addAttribute(key: Token, value?: Token): void {
    this.attributes.push(new AttributeNode(key, value));
  }

  public addContent(content: Token) {
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
