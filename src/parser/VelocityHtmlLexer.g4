lexer grammar VelocityHtmlLexer;

@lexer::header { 
   import { Interval } from 'antlr4ts/misc/Interval';
} 
//@lexer::members { function memberHello() {console.log("hello, Member!");}}
@lexer::members {
   private isNotStartOfVtlReference(offset: number = 0): boolean {
      const currentPosition = this._tokenStartCharIndex + offset;
      const nextTwoCharacters = this.inputStream.getText(Interval.of(currentPosition, currentPosition + 1));
      this.debug('nextCharacters', nextTwoCharacters);
      // Curly braces break formatting of antlr4 plugin
      return nextTwoCharacters !== '$\u007B';
   }

   public isVtlReferenceInsideString = false;

   public nextTagCloseMode : number | null = null;

   public popModeForCurrentTag() : void {
     this.debug(`before ${this.text}`, this.printModeStack());
     if (this.nextTagCloseMode != null) {
      this.mode(this.nextTagCloseMode);
      this.nextTagCloseMode = null;
     } else {
      this.popMode();
     }
     this.debug(`after ${this.text}`, this.printModeStack());
  }

  public printModeStack() {
    const modeStack = this._modeStack.toArray();
    return `mode: ${this._mode}, modeStack: ${modeStack.length === 0? '<empty>' : modeStack}`;
  }


   private makeVtlReferenceInsideToken(): void {
   }

   public isDebugEnabled = false;

   private debug(...something: any[]): void {
     if (this.isDebugEnabled) {
       console.log.apply(undefined, something);
     }
   }
}


IE_COMMENT_START: '<!--[' .*? ']>';

IE_COMMENT_CLOSE: '<![endif]-->';

// Comment that is NOT an IE comment.
COMMENT: '<!--' ~[[]*? '-->';

// doctype case-insensitive
DOCTYPE_START: '<!' [dD] [oO] [cC] [tT] [yY] [pP] [eE] -> pushMode(DOCTYPE_MODE);

// Text inside a script tag cannot be tokenized with the DEFAULT_MODE, because tags behave differently.
// See SCRIPT_MODE for more information.
SCRIPT_START_OPEN: '<script' { this.nextTagCloseMode = VelocityHtmlLexer.SCRIPT_MODE } -> pushMode(TAG_MODE);

TAG_START_OPEN: '<' -> pushMode(TAG_MODE);

TAG_END_OPEN: '<' '/' -> pushMode(TAG_MODE);

HTML_OUTSIDE_TAG_VTL_REFERENCE: VTL_REFERENCE_START  -> skip, pushMode(INSIDE_VELOCITY_REFERENCE);

HTML_TEXT        : {this.isNotStartOfVtlReference()}? ~[ \t\n\r\f<]+;

WS
   : DEFAULT_WS
   ;

fragment DEFAULT_WS: [ \t\n\r\f] +;

// handle characters which failed to match any other token
ERROR_CHARACTER : . ;

fragment VTL_REFERENCE_START: '$' '{';

mode INSIDE_VELOCITY_REFERENCE;

VTL_IDENTIFIER: [a-zA-Z][a-zA-Z0-9_]* { this.makeVtlReferenceInsideToken() };

VTL_DOT: '.';

VTL_METHOD_OPEN: '(';

VTL_METHOD_CLOSE: ')';

VTL_INSIDE_REFERENCE: '$' VTL_IDENTIFIER;

VTL_VALUE
   : VTL_STRING
   | VTL_NUMBER
   | VTL_INSIDE_REFERENCE;

VTL_STRING
   : '"' (('\\' ~[\\\u0000-\u001F]) |  ~ ["\\\u0000-\u001F])* '"'
   | '\'' (('\\' ~[\\\u0000-\u001F]) |  ~ ['\\\u0000-\u001F])* '\''
   ;

VTL_NUMBER
   : [1-9][0-9]*;

VTL_CLOSE
   : '}' '"'? -> skip, popMode;

VTL_WS
   : [ ] + 
   ;

VTL_ERROR_CHARACTER: . -> type(ERROR_CHARACTER);

mode TAG_MODE;
// Mix between tag name and attribute name:
// Tag open state: ASCII alpha https://html.spec.whatwg.org/#tag-open-state
// Tag name state: Not tab, lf, ff, space, solidus, > https://html.spec.whatwg.org/#tag-name-state
// Attribute name: https://html.spec.whatwg.org/#attribute-name-state
fragment HTML_LIBERAL_NAME: ~[ \t\n\r\f/><="']+;

HTML_NAME: HTML_LIBERAL_NAME;
EQUAL: '=';
// \- since - means "range" inside [...]

HTML_STRING
   : {this.isNotStartOfVtlReference(1)}?  '"' ( VALID_ESCAPES |  ~ ["])* '"'
   // Unescaped one must not contain spaces
   | {this.isNotStartOfVtlReference(1)}? '\'' ( VALID_ESCAPES |  ~ ['])* '\''
   ;

// Just allow everything to be escaped.
// TODO Does this make sense?
fragment VALID_ESCAPES: '\\' ~[\\\u0000-\u001F];

HTML_INSIDE_TAG_STRING_VTL_REFERENCE: '"' VTL_REFERENCE_START { this.isVtlReferenceInsideString = true} -> skip, pushMode(INSIDE_VELOCITY_REFERENCE);

TAG_CLOSE: '>' { this.popModeForCurrentTag() };
SELF_CLOSING_TAG_CLOSE :'/' '>' -> popMode;

HTML_TAG_VTL:  VTL_REFERENCE_START -> skip, pushMode(INSIDE_VELOCITY_REFERENCE);

HTML_WS
   : DEFAULT_WS -> skip
   ;

HTML_ERROR_CHARACTER: . -> type(ERROR_CHARACTER);

mode DOCTYPE_MODE;

// https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-name-state
DOCTYPE_TYPE: ~[ \t\n\r\f>] +;

DOCTYPE_WS: DEFAULT_WS + -> skip;

DOCTYPE_END: '>' -> popMode;

DOCTYPE_ERROR_CHARACTER: . -> type(ERROR_CHARACTER);

mode SCRIPT_MODE;

// Script state only changes on closing script tag: https://html.spec.whatwg.org/#script-data-less-than-sign-state
// TODO Space after t possible?
SCRIPT_END_TAG: '</'[sS] [cC] [rR] [iI] [pP] [tT] '>' -> mode(DEFAULT_MODE);

// All other valid tags (ASCII alpha: https://html.spec.whatwg.org/#script-data-end-tag-open-state)
SCRIPT_OTHER_CLOSING_TAG: '<' '/'? HTML_LIBERAL_NAME -> type(HTML_TEXT);

SCRIPT_TEXT: ~[ \t\n\r\f<]+ -> type(HTML_TEXT);

SCRIPT_WS: DEFAULT_WS -> type(HTML_TEXT);

SCRIPT_ERROR_CHARACTER: . -> type(ERROR_CHARACTER);
