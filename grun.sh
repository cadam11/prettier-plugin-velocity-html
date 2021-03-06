#!/bin/bash

set -ex
cp ~/workspace/prettier-velocity-html-plugin/src/parser/VelocityHtml.g4 .
java -jar $ANTLR_JAR VelocityHtml.g4
javac -cp $ANTLR_CLASSPATH *.java