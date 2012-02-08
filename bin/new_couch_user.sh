#!/bin/bash

DEFAULT_COUCHDB_PORT=5984

# Ask for the hostname or IP address of the CouchDB server.
while [ -z $COUCHDB_SERVER ]; do
    read -p "Enter the CouchDB hostname or IP address: " COUCHDB_SERVER
done

# Ask for the port number of the CouchDB server.
read -p "Enter the CouchDB port (default is $DEFAULT_COUCHDB_PORT): " COUCHDB_PORT
if [ -z $COUCHDB_PORT ]; then
    COUCHDB_PORT=$DEFAULT_COUCHDB_PORT
fi

# Ask for the administrators username.
while [ -z $COUCHDB_ADMIN ]; do
    read -p "Enter the CouchDB Admin username: " COUCHDB_ADMIN
done

# Ask for the administrators password to CouchDB. Be careful not to echo it
# to the terminal.
while [ -z $COUCHDB_ADMIN_PW ]; do
    stty -echo
    read -p "Enter the CouchDB Admin password (not visible when typed): " COUCHDB_ADMIN_PW; echo
    stty echo
done

# Ask for the new user's username
while [ -z $NEW_COUCHDB_USER ]; do
    read -p "Enter the new user's username: " NEW_COUCHDB_USER 
done

# Ask for the new user's password. Again, be careful not to echo it
# to the terminal.
while [ -z $COUCHDB_PW ]; do
    stty -echo
    read -p "Enter the new user's password (not visible when typed): " COUCHDB_PW; echo
    stty echo
done

# CouchDB has a notion of "roles" for users. Here we can assign the user to such a role.
while [ -z $COUCHDB_ROLE ]; do
    read -p "Enter the new user's role (can't be blank): " COUCHDB_ROLE
done


SALT=`openssl rand 16 | openssl md5`
PW_HASH=`echo -n "${COUCHDB_PW}${SALT}" | openssl sha1`

USER_JSON=$(cat <<JSON
{ "_id":"org.couchdb.user:$NEW_COUCHDB_USER",
  "type":"user",
  "name":"$NEW_COUCHDB_USER",
  "roles":["$COUCHDB_ROLE"],
  "password_sha":"$PW_HASH",
  "salt":"$SALT"
}
JSON
)

# Convert the JSON to a single line and collapse out excess white space
USER_JSON=$(echo "$USER_JSON" |  tr '\n' ' ' | sed 's/  */\ /g')

echo "Creating user."
CURL_OUT=`curl -s -X POST http://$COUCHDB_SERVER:$COUCHDB_PORT/_users -u $COUCHDB_ADMIN:$COUCHDB_ADMIN_PW \
     -H "Content-Type: application/json" -d "$USER_JSON"`

CURL_RV=$?
if [ "$CURL_RV" != "0" ]; then
    echo "Problem creating account." >&2
    exit 2
else
    ERROR_COUNT=`echo "$CURL_OUT" | grep -ci "[e]rror"`
    if [ "$ERROR_COUNT" != "0" ]; then
        echo "$CURL_OUT" >&2
        exit 1
    fi
fi

echo "Successfully created new user."
exit 0
