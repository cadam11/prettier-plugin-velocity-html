import {
  isCollapsbileWhitespaceOnly,
  SourceCodeLocation,
  VelocityToken,
} from "./VelocityToken";
import { RenderDefinition, RenderMode, tagRegistry } from "./tagRegistry";

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
  public set endToken(token: VelocityToken) {
    if (this.endToken != null) {
      throw new Error("Cannot set endToken more than once.");
    }
    this._endLocation = token.endLocation;
  }

  public _startLocation: SourceCodeLocation;
  public get startLocation(): SourceCodeLocation {
    if (this.revealedConditionalCommentStart != null) {
      return this.revealedConditionalCommentStart.startLocation;
    } else {
      return this._startLocation;
    }
  }
  public _endLocation: SourceCodeLocation;
  public get endLocation(): SourceCodeLocation {
    if (this.revealedConditionalCommentEnd != null) {
      return this.revealedConditionalCommentEnd.endLocation;
    }
    return this._endLocation;
  }

  public _isPreformatted = false;

  public isPreformatted(): boolean {
    return this._isPreformatted;
  }

  public get isInlineRenderMode(): boolean {
    return this.getSiblingsRenderMode() == RenderMode.INLINE;
  }

  public get isBlockRenderMode(): boolean {
    return this.getSiblingsRenderMode() == RenderMode.BLOCK;
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    super();
    if (startLocation instanceof VelocityToken) {
      this._startLocation = startLocation.startLocation;
    } else {
      this._startLocation = startLocation;
    }
    this._endLocation = this._startLocation;
  }

  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }

  public get prev(): ParserNode | undefined {
    return this.parent.children[this.index - 1];
  }
  public get next(): ParserNode | undefined {
    return this.parent.children[this.index + 1];
  }
  public get index(): number {
    return this.parent.children.indexOf(this);
  }
  public get isFirstChild(): boolean {
    return this.index == 0;
  }
  public get isLastChild(): boolean {
    return this.index == this.parent.children.length - 1;
  }
  private _parent: NodeWithChildren;

  public get parent(): NodeWithChildren {
    return this._parent;
  }

  public set parent(parent: NodeWithChildren) {
    this._parent = parent;
  }

  public get isOnlyChild(): boolean {
    return this.parent.children.length == 1;
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
    while (!(parent instanceof RootNode)) {
      if (parent instanceof HtmlTagNode && parent.isPreformatted()) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  public forceBreak = false;

  public _prettierIgnore: VelocityToken | null;

  public set prettierIgnore(prettierIgnore: VelocityToken | null) {
    this._prettierIgnore = prettierIgnore;
  }

  public get prettierIgnore(): VelocityToken | null {
    return this._prettierIgnore;
  }
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
        // Text nodes and simliar should be considered "content" not depth.
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

  public get isSelfOrParentPreformatted(): boolean {
    return false;
  }

  public get parent(): NodeWithChildren {
    throw new Error("Root node has no parent");
  }

  public set parent(parent: NodeWithChildren) {
    throw new Error("Root node has no parent");
  }
}

export class RootNode extends NodeWithChildren {
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public constructor() {
    super({ line: 1, column: 1 });
  }

  public get parent(): NodeWithChildren {
    throw new Error("Root node has no parent");
  }

  public set parent(parent: NodeWithChildren) {
    throw new Error("Root node has no parent");
  }

  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }
}

export type WhitespaceTokenType =
  | "text"
  | "conditionalComment"
  | "prettierIgnore";
export class WhitespaceToken {
  public text: string;
  public type: WhitespaceTokenType;
  public isWhitespaceOnly: boolean;
  public line: number;
  public column: number;
  constructor(token: VelocityToken, type: WhitespaceTokenType = "text") {
    this.text = token.textValue;
    this.isWhitespaceOnly = token.isWhitespaceOnly;
    this.line = token.line;
    this.type = type;
  }
}

export class HtmlTextNode extends ParserNode {
  public tokens: WhitespaceToken[] = [];

  public constructor(token: VelocityToken) {
    super(token);
    this.tokens.push(new WhitespaceToken(token));
  }

  public get text(): string {
    return this.tokens.map((token) => token.text).join("");
  }

  public addText(token: VelocityToken): void {
    this.tokens.push(new WhitespaceToken(token));
  }

  public get isWhitespaceOnly(): boolean {
    return isCollapsbileWhitespaceOnly(this.text);
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
      // Collapse space to single space (inline elements only).
      if (this.isOnlyChild && this.parent.isInlineRenderMode) {
        this.tokens = [
          {
            line: this.startLocation.line,
            column: this.startLocation.column,
            isWhitespaceOnly: true,
            text: " ",
            type: "text",
          },
        ];
      } else {
        // Spaces are attached to siblings if there are any.
        this.tokens = [];
        this.hasLeadingSpaces = true;
        this.hasTrailingSpaces = true;
      }
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
    iterator: Generator<WhitespaceToken>,
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
    this._endLocation = this.tokens[this.tokens.length - 1];
    this._startLocation = {
      line: this.tokens[0].line,
      column: this.tokens[0].column,
    };
    return numberOfTailingWhitespaceTokens > 0;
  }

  /**
   * Integrate node decoration into text to avoid a text node followed by another text node.
   */
  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    if (token != null) {
      // Insert before the text node that is "annotated"
      this.tokens.splice(
        this.tokens.length - 1,
        0,
        new WhitespaceToken(token, "conditionalComment")
      );
    }
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    if (token != null) {
      this.tokens.push(new WhitespaceToken(token, "conditionalComment"));
    }
  }

  public set prettierIgnore(token: VelocityToken | null) {
    if (token != null) {
      // Insert before the text node that is "annotated"
      this.tokens.splice(
        this.tokens.length - 1,
        0,
        new WhitespaceToken(token, "prettierIgnore")
      );
    }
  }
}

export class HtmlTagNode extends NodeWithChildren {
  public getSiblingsRenderMode(): RenderMode {
    return this.renderDefinition.siblingsMode;
  }

  public getChildrenRenderMode(): RenderMode {
    return this.renderDefinition.childrenMode;
  }

  private renderDefinition: Required<RenderDefinition>;
  private _tagName: string;
  public isSelfClosing: boolean;
  public attributes: AttributeNode[] = [];
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
      this.renderDefinition.preformatted ||
      (this.tagName === "script" && this.scriptParser == null)
    );
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    const renderDefinition = tagRegistry.get(this.tagName);
    if (renderDefinition == null) {
      this.renderDefinition = {
        siblingsMode: RenderMode.INLINE,
        childrenMode: RenderMode.INLINE,
        forceBreak: false,
        forceBreakChildren: false,
        forceClose: false,
        preformatted: false,
        selfClosing: false,
      };
    } else {
      this.renderDefinition = {
        siblingsMode: renderDefinition.siblingsMode,
        childrenMode:
          renderDefinition.childrenMode != null
            ? renderDefinition.childrenMode
            : renderDefinition.siblingsMode,
        forceBreak:
          renderDefinition.forceBreak != null
            ? renderDefinition.forceBreak
            : false,
        forceBreakChildren:
          renderDefinition.forceBreakChildren != null
            ? renderDefinition.forceBreakChildren
            : false,
        forceClose:
          renderDefinition.forceClose != null
            ? renderDefinition.forceClose
            : false,
        preformatted:
          renderDefinition.preformatted != null
            ? renderDefinition.preformatted
            : false,
        selfClosing:
          renderDefinition.selfClosing != null
            ? renderDefinition.selfClosing
            : false,
      };
    }
    this.forceCloseTag = this.renderDefinition.forceClose;
    this.forceBreak = this.renderDefinition.forceBreak;
    this.forceBreakChildren = this.renderDefinition.forceBreakChildren;
    this.isSelfClosing = this.renderDefinition.selfClosing;
  }

  public get tagName(): string {
    if (this._tagName != null) {
      return !tagRegistry.has(this._tagName.toLowerCase())
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
  public getSiblingsRenderMode(): RenderMode {
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
  public getSiblingsRenderMode(): RenderMode {
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
  public getSiblingsRenderMode(): RenderMode {
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

  public getSiblingsRenderMode(): RenderMode {
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
