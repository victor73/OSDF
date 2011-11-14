#!/bin/bash

set -e

while [ -z $COUCH_SERVER ]; do
    read -p "Enter the CouchDB hostname: " COUCH_SERVER
done

while [ -z $COUCH_PORT ]; do
    read -p "Enter the CouchDB port: " COUCH_PORT
done

while [ -z $COUCH_DB ]; do
    read -p "Enter the CouchDB database name: " COUCH_DB
done

while [ -z $COUCH_ADMIN ]; do
    read -p "Enter the CouchDB Admin username: " COUCH_ADMIN
done

while [ -z $COUCH_ADMIN_PW ]; do
    stty -echo
    read -p "Enter the CouchDB Admin password: " COUCH_ADMIN_PW; echo
    stty echo
done

read -p "Enter the new user's username: " NEW_COUCH_USER 

while [ -z $COUCH_PW ]; do
    stty -echo
    read -p "Enter the new user's password: " COUCH_PW; echo
    stty echo
done

while [ -z $COUCH_ROLE ]; do
    read -p "Enter the new user's role: " COUCH_ROLE
done


SALT=`openssl rand 16 | openssl md5`
PW_HASH=`echo -n "${COUCH_PW}${SALT}" | openssl sha1`

USER_JSON=$(cat <<JSON
{ "_id":"org.couchdb.user:$NEW_COUCH_USER",
  "type":"user",
  "name":"$NEW_COUCH_USER",
  "roles":["$COUCH_ROLE"],
  "password_sha":"$PW_HASH",
  "salt":"$SALT"
}
JSON
)

# Convert the JSON to a single line and collapse out excess white space
USER_JSON=$(echo "$USER_JSON" |  tr '\n' ' ' | sed 's/  */\ /g')

echo $USER_JSON
exit

curl -X POST http://$COUCH_SERVER:$COUCH_PORT/_users -u $COUCH_ADMIN:$COUCH_ADMIN_PW \
     -H "Content-Type: application/json" -d "$USER_JSON"
