import { tokenToString } from "typescript";
import { VelocityToken } from "./VelocityToken";

interface SourceCodeLocation {
  line: number;
  column: number;
}

export abstract class ParserNode {
  public endToken: VelocityToken | undefined;
  public startLocation: SourceCodeLocation;
  protected _endLocation: SourceCodeLocation | undefined;
  public get endLocation(): SourceCodeLocation | undefined {
    return this.endToken != null
      ? {
          column:
            this.endToken.charPositionInLine +
            (this.endToken.text != null ? this.endToken.text.length : 0),
          line: this.endToken.line,
        }
      : this._endLocation;
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    if (startLocation instanceof VelocityToken) {
      this.startLocation = {
        column: startLocation.charPositionInLine,
        line: startLocation.line,
      };
    } else {
      this.startLocation = startLocation;
    }
  }

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
    super(nameToken);
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
    super({ column: 0, line: 0 });
  }
}

export class HtmlTextNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }
  public constructor(public text: string, token: VelocityToken) {
    super(token);
  }

  public addText(text: string, token: VelocityToken): void {
    this.text += text;
    this.endToken = token;
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
  private _tagName: string;
  public isSelfClosing: boolean;
  public hasClosingTag: boolean;
  public attributes: AttributeNode[] = [];

  public constructor(public token: VelocityToken) {
    super(token);
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    this.isSelfClosing = this.selfClosingTags.includes(tagName);
    // TODO This is messed up.
    this._endLocation = this.startLocation;
  }

  public get tagName(): string {
    return this._tagName != null ? this._tagName : "";
  }

  public isWhitespaceSensitive(): boolean {
    // TODO Add css whitespace.startsWith('pre')
    return this.tagName !== "pre";
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }
}

export class HtmlCommentNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }

  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
  }
}

export class HtmlDocTypeNode extends ParserNode {
  isLeadingSpaceSensitive(): boolean {
    return false;
  }

  public types: string[] = [];

  public constructor(token: VelocityToken) {
    super(token);
  }
}
