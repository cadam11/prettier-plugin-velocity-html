import { Token } from "antlr4ts";

export class ParserNode {}

export class HtmlTagNode extends ParserNode {
  public tagName: string;
  public attributes: { key: Token; value: Token }[] = [];
  public closeTag: HtmlCloseTagNode;
  private content: Token[] = [];
  public children: HtmlTagNode[] = [];
  public constructor(public parent: HtmlTagNode, public locationStart: number) {
    super();
  }

  public addAttribute(key: Token, value: Token): void {
    this.attributes.push({ key, value });
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
