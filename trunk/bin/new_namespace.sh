#!/bin/bash

# Determine the path to this script
ABSPATH="$(cd "${0%/*}" 2>/dev/null; echo "$PWD"/"${0##*/}")"
DIR=`dirname $ABSPATH`

NS_NAME=$1

if [ -z $NS_NAME ]; then
    echo "$0 <namespace_name>" >&2
    exit 1;
fi

if [ -d "$DIR/namespaces/$NS_NAME" ]; then
    echo "It appears that this namespace already exists." >&2
    exit 2;
fi

mkdir "$DIR/namespaces/$NS_NAME" && \
mkdir "$DIR/namespaces/$NS_NAME/aux" && \
mkdir "$DIR/namespaces/$NS_NAME/schemas" && \
mkdir "$DIR/namespaces/$NS_NAME/vocabs"

INFO_JSON="$DIR/namespaces/$NS_NAME/info.json"
cat > $INFO_JSON <<Endofmessage
{
  "$NS_NAME": {
    "description": "This is a auto-generated descriptor for the $NS_NAME namespace.",
    "title": "$NS_NAME",
    "url": "http://example.org"
  }
}
Endofmessage

echo "Done."
