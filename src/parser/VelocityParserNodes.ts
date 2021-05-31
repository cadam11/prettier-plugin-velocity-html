import { VelocityToken } from "./VelocityToken";
import officalHtmlTags from "./officialHtmlTags";
import selfClosingHtmlTags from "./selfClosingHtmlTags";

interface SourceCodeLocation {
  line: number;
}

export enum RenderMode {
  BLOCK,
  INLINE,
}

export class DecoratedNode {
  public _revealedConditionalCommentStart: VelocityToken | null;

  public get revealedConditionalCommentStart(): VelocityToken | null {
    if (this instanceof NodeWithChildren) {
      return this.startNode.revealedConditionalCommentStart;
    } else {
      return this._revealedConditionalCommentStart;
    }
  }
  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    this._revealedConditionalCommentStart = token;
  }

  public _revealedConditionalCommentEnd: VelocityToken | null = null;

  public get revealedConditionalCommentEnd(): VelocityToken | null {
    if (this instanceof NodeWithChildren) {
      return this.endNode != null
        ? this.endNode.revealedConditionalCommentEnd
        : null;
    } else {
      return this._revealedConditionalCommentEnd;
    }
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    this._revealedConditionalCommentEnd = token;
  }
}

export abstract class ParserNode extends DecoratedNode {
  public _endToken: VelocityToken | undefined;

  public get endToken(): VelocityToken | undefined {
    return this._endToken;
  }

  public set endToken(token: VelocityToken | undefined) {
    if (this.endToken != null) {
      throw new Error("Cannot set endToken more than once.");
    }
    this._endToken = token;
  }

  public _startLocation: SourceCodeLocation;
  public get startLocation(): SourceCodeLocation {
    if (this.revealedConditionalCommentStart != null) {
      return {
        line: this.revealedConditionalCommentStart.line,
      };
    } else {
      return this._startLocation;
    }
  }
  public _endLocation: SourceCodeLocation | undefined;
  public get endLocation(): SourceCodeLocation | undefined {
    if (this.revealedConditionalCommentEnd != null) {
      return {
        line: this.calculateEndLine(this.revealedConditionalCommentEnd),
      };
    }
    return this.endToken != null
      ? {
          line: this.calculateEndLine(this.endToken),
        }
      : this._endLocation;
  }

  private calculateEndLine(token: VelocityToken) {
    const match = token.textValue.match(/\n/g);
    return token.line + (match != null ? match.length : 0);
  }

  public _isPreformatted = false;

  public isPreformatted(): boolean {
    return this._isPreformatted;
  }

  public get isInlineRenderMode(): boolean {
    return this.getRenderMode() == RenderMode.INLINE;
  }

  public get isBlockRenderMode(): boolean {
    return this.getRenderMode() == RenderMode.BLOCK;
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    super();
    if (startLocation instanceof VelocityToken) {
      this._startLocation = {
        line: startLocation.line,
      };
    } else {
      this._startLocation = startLocation;
    }
  }

  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
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
  public get isFirstChild(): boolean {
    return this.index == 0;
  }
  public parent: NodeWithChildren | undefined;

  public get isOnlyChild(): boolean {
    return this.parent != null && this.parent.children.length == 1;
  }

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    fn(this, 0, [this]);
  }

  public hasLeadingSpaces = false;
  public hasTrailingSpaces = false;

  public get isSelfOrParentPreformatted(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let parent: ParserNode | undefined = this;
    if (this.isPreformatted()) {
      return true;
    }
    while (parent != null) {
      if (parent instanceof HtmlTagNode && parent.isPreformatted()) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  // TODO Should this also insert hardline?
  public forceBreak = false;
}

export class NodeWithChildrenDecoration extends DecoratedNode {
  constructor() {
    super();
  }
}

export abstract class NodeWithChildren extends ParserNode {
  public children: ParserNode[] = [];

  public get lastChild(): ParserNode | undefined {
    return this.children[this.children.length - 1];
  }

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    this.children.forEach((node) => {
      node.walk(fn);
    });
    super.walk(fn);
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    super(startLocation);
    this.startNode = new NodeWithChildrenDecoration();
  }

  public startNode: NodeWithChildrenDecoration;
  public endNode: NodeWithChildrenDecoration | undefined;

  public forceBreakChildren = false;

  public addChild(child: ParserNode): void {
    this.children.push(child);
    child.parent = this;
  }

  public get maxDepth(): number {
    return this.children.reduce((maxDepth, child) => {
      if (child instanceof NodeWithChildren) {
        const childDepth = child.maxDepth + 1;
        return Math.max(childDepth, maxDepth);
      } else {
        // Text nodes and simliar should be considere "content" not depth.
        return maxDepth;
      }
    }, 0);
  }

  public get firstChild(): ParserNode | undefined {
    return this.children[0];
  }
}

export class AttributeNode extends ParserNode {
  public knownAttributes = [
    "id",
    "name",
    "class",
    "async",
    "defer",
    "content",
    "charset",
  ];
  clone(): ParserNode {
    return new AttributeNode(this.nameToken, this.valueToken);
  }
  get name(): string {
    const attributeName = this.nameToken.stringValue;
    return this.knownAttributes.includes(attributeName.toLowerCase())
      ? attributeName.toLowerCase()
      : attributeName;
  }
  get value(): string | undefined {
    return this.valueToken != null ? this.valueToken.stringValue : undefined;
  }

  public constructor(
    public nameToken: VelocityToken,
    public valueToken?: VelocityToken
  ) {
    super(nameToken);
  }
}

export class RootNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  clone(): ParserNode {
    return new RootNode();
  }
  public constructor() {
    super({ line: 0 });
  }

  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }
}

export class HtmlTextNode extends ParserNode {
  public tokens: VelocityToken[] = [];

  public constructor(token: VelocityToken) {
    super(token);
    // Bypass check
    this._endToken = token;
    this.tokens.push(token);
  }

  public get text(): string {
    return this.tokens.map((token) => token.textValue).join("");
  }

  public addText(token: VelocityToken): void {
    // TODO Fix this in a different way
    // if (this.isWhitespaceOnly && !token.isWhitespaceOnly) {
    //   this.text = text;
    //   // Discard leading spaces. It will be trimmed later and then the startLocation is wrong.
    //   this.startLocation = {
    //     column: token.charPositionInLine,
    //     line: token.line,
    //   };
    //   // Bypass check
    //   this._endToken = token;
    // } else {

    // this.text += text;
    this.tokens.push(token);
    // Bypass check
    this._endToken = token;
    // }
  }

  public get isWhitespaceOnly(): boolean {
    return /^\s+$/.exec(this.text) != null;
  }

  public removeTrailingWhitespaceTokens(): boolean {
    const tokens = this.tokens;
    return this.removeWhitespaceTokens(
      (function* () {
        for (let i = tokens.length - 1; i >= 0; i--) {
          yield tokens[i];
        }
      })(),
      (numberOfWhitespaceTokens) => tokens.length - numberOfWhitespaceTokens
    );
  }

  public trimWhitespace(): void {
    if (this.isWhitespaceOnly) {
      this.tokens = [];
      this.hasLeadingSpaces = true;
      this.hasTrailingSpaces = true;
    } else {
      // Don't overwrite. May have been set be previous or next child. Must trim anyway.
      this.hasLeadingSpaces =
        this.removeLeadingWhitespace() ||
        this.hasLeadingSpaces ||
        (this.revealedConditionalCommentStart != null &&
          /\s+$/.exec(this.revealedConditionalCommentStart.textValue) != null);
      this.hasTrailingSpaces =
        this.removeTrailingWhitespaceTokens() ||
        this.hasTrailingSpaces ||
        (this.revealedConditionalCommentEnd != null &&
          /^\s+/.exec(this.revealedConditionalCommentEnd.textValue) != null);
    }
  }

  public removeLeadingWhitespace(): boolean {
    const tokens = this.tokens;
    return this.removeWhitespaceTokens(
      (function* () {
        for (let i = 0; i < tokens.length; i++) {
          yield tokens[i];
        }
      })(),
      () => 0
    );
  }

  private removeWhitespaceTokens(
    iterator: Generator<VelocityToken>,
    startIndexFn: (numberOfWhitespaceTokens: number) => number
  ): boolean {
    if (this.isWhitespaceOnly) {
      throw new Error(
        "Cannot remove whitespace tokens on whitespace only text. Result would be the empty string."
      );
    }
    let numberOfTailingWhitespaceTokens = 0;

    let token = iterator.next();
    while (token.done != null && !token.done) {
      if (token.value.isWhitespaceOnly) {
        numberOfTailingWhitespaceTokens++;
        token = iterator.next();
      } else {
        break;
      }
    }
    this.tokens.splice(
      startIndexFn(numberOfTailingWhitespaceTokens),
      numberOfTailingWhitespaceTokens
    );
    this._endToken = this.tokens[this.tokens.length - 1];
    this._startLocation = {
      line: this.tokens[0].line,
    };
    return numberOfTailingWhitespaceTokens > 0;
  }
}

export class HtmlTagNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return this._isInlineRenderMode ? RenderMode.INLINE : RenderMode.BLOCK;
  }

  private forceBreakChildrenTags = [
    "body",
    "head",
    "ul",
    "ol",
    "script",
    "datalist",
    "details",
    "table",
    "ol",
    "ul",
    "select",
    "style",
  ];

  private forceBreakTags = ["br"];

  private forceCloseTags = ["script"];

  private blockLevelElements = [
    "address",
    "article",
    "aside",
    "body",
    "blockquote",
    "button",
    "details",
    "datalist",
    "dialog",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "g",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "html",
    "header",
    "head",
    "hgroup",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "select",
    "optgroup",
    "option",
    "summary",
    "script",
    "style",
    "param",
    "table",
    "ul",
  ];

  private preformattedTags = ["pre", "textarea"];

  private _tagName: string;
  public isSelfClosing: boolean;
  public attributes: AttributeNode[] = [];
  public _isInlineRenderMode: boolean;
  public forceCloseTag: boolean;

  public constructor(public token: VelocityToken) {
    super(token);
  }

  public get scriptParser(): string | undefined {
    const typeAttribute = this.attributes.find(
      (attribute) => attribute.name === "type"
    );
    const scriptType = typeAttribute != null ? typeAttribute.value : undefined;
    return Object.keys(this.supportedScriptTypes).find((parser) =>
      this.supportedScriptTypes[parser].includes(scriptType)
    );
  }

  public supportedScriptTypes: { [key: string]: (string | undefined)[] } = {
    babel: [
      "text/javascript",
      "text/babel",
      "application/javascript",
      "jsx",
      undefined,
    ],
  };

  public isPreformatted(): boolean {
    return (
      this.preformattedTags.includes(this.tagName) ||
      (this.tagName === "script" && this.scriptParser == null)
    );
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    this.isSelfClosing = selfClosingHtmlTags.has(this.tagName);
    // this._isPreformatted = this.preformattedTags.includes(this.tagName);
    this._isInlineRenderMode = !this.blockLevelElements.includes(this.tagName);
    this.forceCloseTag = this.forceCloseTags.includes(this.tagName);
    this.forceBreak = this.forceBreakTags.includes(this.tagName);
    this.forceBreakChildren = this.forceBreakChildrenTags.includes(
      this.tagName
    );
  }

  public get tagName(): string {
    if (this._tagName != null) {
      return !officalHtmlTags.has(this._tagName.toLowerCase())
        ? this._tagName
        : this._tagName.toLowerCase();
    }
    return "";
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }
}

export class HtmlCommentNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class IeConditionalCommentNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  get text(): string {
    return this.token.textValue;
  }

  public constructor(public token: VelocityToken) {
    super(token);
  }
}

export class HtmlDocTypeNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public types: string[] = [];

  public constructor(token: VelocityToken) {
    super(token);
  }
}

export class HtmlCdataNode extends ParserNode {
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class HtmlCloseNode extends NodeWithChildren {
  public tagName: string;

  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    super(startLocation);
    /**
     * Always break children of close nodes to improve readability:
     * <!--[if lt IE 9]><td></td></td>
     *        </tr>
     * To break this, we have to force the break into the first children group:
     * <!--[if lt IE 9]>
     *          <td></td></td>
     *        </tr>
     */
    this.forceBreakChildren = true;
  }
}
