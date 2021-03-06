
/** Taken from "The Definitive ANTLR 4 Reference" by Terence Parr */

// Derived from http://json.org
grammar VelocityHtml;

document
   : node* EOF
   ;

node
   : openTag node* closeTag
   | selfClosingTag
   ;

selfClosingTag
    : TAG_START_OPEN GENERIC_WORD_DOUBLE_QUOTED attribute* SELF_CLOSING_TAG_CLOSE;

openTag
    : TAG_START_OPEN GENERIC_WORD_DOUBLE_QUOTED attribute* TAG_CLOSE ;

closeTag
    : TAG_END_OPEN attribute* TAG_CLOSE;

attributes
    : attribute*;

attribute:
    GENERIC_WORD_DOUBLE_QUOTED '=' GENERIC_WORD_DOUBLE_QUOTED;

GENERIC_WORD_DOUBLE_QUOTED
   : '"' (('\\' ~[\\\u0000-\u001F]) |  ~ ["\\\u0000-\u001F])* '"'
   // Unescaped one must not contain spaces
   | (('\\' ~[\\\u0000-\u0020]) |  ~ ["\\\u0000-\u0020])+
   ;

SELF_CLOSING_TAG_CLOSE :'/' '>';

TAG_START_OPEN: '<';

TAG_CLOSE: '>';

TAG_END_OPEN: '<' '/';

// \- since - means "range" inside [...]

WS
   : [ \t\n\r] + -> skip
   ;

// handle characters which failed to match any other token
ErrorCharacter : . ;
