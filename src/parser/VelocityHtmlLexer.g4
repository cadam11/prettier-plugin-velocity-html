lexer grammar VelocityHtmlLexer;

@lexer::header { 
   import { Interval } from 'antlr4ts/misc/Interval';
} 
//@lexer::members { function memberHello() {console.log("hello, Member!");}}
@lexer::members {
   private isNotStartOfVtlReference(): boolean {
      const currentPosition = this._tokenStartCharIndex;
      const nextTwoCharacters = this.inputStream.getText(Interval.of(currentPosition, currentPosition + 1));
      console.log('nextCharacters', nextTwoCharacters);
      // Curly braces break formatting of antlr4 plugin
      return nextTwoCharacters !== '$\u007B';
   }
}

TAG_START_OPEN: '<' { console.log('after TAG_START_OPEN') } -> pushMode(INSIDE_TAG);

TAG_END_OPEN: '<' '/' { console.log('after TAG_END_OPEN') }-> pushMode(INSIDE_TAG);

VELOCITY_REFERENCE: '$' '{'  -> skip, pushMode(INSIDE_VELOCITY_REFERENCE);

HTML_TEXT        : {this.isNotStartOfVtlReference()}? ~[<]+  { console.log('after HTML_TEXT') };



mode INSIDE_VELOCITY_REFERENCE;

VTL_IDENTIFIER: [a-zA-Z][a-zA-Z0-9_]*;

VTL_METHOD_OPEN: '(';

VTL_METHOD_CLOSE: ')';

VTL_INSIDE_REFERENCE: '$' VTL_IDENTIFIER;

VTL_VALUE
   : VTL_STRING
   | VTL_NUMBER
   | VTL_INSIDE_REFERENCE;

VTL_STRING
   : '"' (('\\' ~[\\\u0000-\u001F]) |  ~ ["\\\u0000-\u001F])* '"';

VTL_NUMBER
   : [1-9][0-9]*;

VTL_CLOSE
   : '}' -> skip, popMode;

VTL_WS
   : [ ] + -> skip
   ;

mode INSIDE_TAG;
HTML_NAME: [a-zA-Z0-9]+ { console.log('after HTML_NAME') };
EQUAL: '=';
// \- since - means "range" inside [...]

HTML_STRING
   : '"' (('\\' ~[\\\u0000-\u001F]) |  ~ ["\\\u0000-\u001F])* '"'
   // Unescaped one must not contain spaces
//    | (('\\' ~[\\\u0000-\u0020]) |  ~ ["\\\u0000-\u0020])+
   ;

TAG_CLOSE: '>' { console.log('after TAG_CLOSE') } -> popMode;
SELF_CLOSING_TAG_CLOSE :'/' '>' -> popMode;

HTML_TAG_VTL:  '$' '{' -> skip, pushMode(INSIDE_VELOCITY_REFERENCE);

WS
   : [ \t\n\r] + -> skip
   ;

// handle characters which failed to match any other token
ErrorCharacter : . ;