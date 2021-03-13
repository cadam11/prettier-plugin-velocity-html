
/** Taken from "The Definitive ANTLR 4 Reference" by Terence Parr */

// Derived from http://json.org
parser grammar VelocityHtmlParser;

options {
	tokenVocab=VelocityHtmlLexer;
}

document
   : node* EOF
   ;


node
    : TAG_END_OPEN;

// node
//    : openTag node* closeTag
//    | selfClosingTag
//    ;

// selfClosingTag
//     : TAG_START_OPEN GENERIC_WORD_DOUBLE_QUOTED attribute* SELF_CLOSING_TAG_CLOSE;

// openTag
//     : TAG_START_OPEN GENERIC_WORD_DOUBLE_QUOTED attribute* TAG_CLOSE ;

// closeTag
//     : TAG_END_OPEN attribute* TAG_CLOSE;

// attributes
//     : attribute*;

// attribute:
//     GENERIC_WORD_DOUBLE_QUOTED EQUAL GENERIC_WORD_DOUBLE_QUOTED;


