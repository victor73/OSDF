# Open Science Data Framework (OSDF) API
<a name="top"></a> 

***

## Contents

* [Authentication](#auth)
* [Server Information](#info)
* [Namespaces](#ns)
  * [List Available Namespaces](#namespace_list)
  * [Retrieve a Namespace](#namespace_retrieve)
* [Nodes](#nodes)
  * [Create a Node](#node_create)
  * [Retrieve a Node](#node_retrieve)
  * [Retrieve Node Version/History](#node_version)
  * [Retrieve Nodes Linked To](#node_out)
  * [Retrieve Nodes Linked From](#node_in)
  * [Edit a Node](#node_edit)
  * [Delete a Node](#node_del)
* [Schemas](#schemas)
  * [Create a Schema](#schema_create)
  * [List All Namespace Schemas](#schema_list)
  * [Retrieve a Schema](#schema_retrieve)
  * [Edit a Schema](#schema_edit)
  * [Delete a Schema](#schema_del)
* [Auxiliary Schemas](#aux_schemas)
  * [Create an Auxiliary Schema](#aux_schema_create)
  * [List All Namespace Auxiliary Schemas](#aux_schema_list)
  * [Retrieve an Auxiliary Schema](#aux_schema_retrieve)
  * [Delete an Auxiliary Schema](#aux_schema_del)
* [Queries and Search](#queries)
  * [Query DSL Examples](#query_dsl_examples)
  * [Filters](#query_filters)
  * [Pagination](#query_pag)


## <a name="auth"></a> Authentication

Authentication to an OSDF is managed with “Basic” HTTP authentication and each request must include the “Authorization” HTTP header. Use your assigned OSDF username and the API token as the password.

Username: jdoe
Password: p@ssw0rd

    $ curl -u jdoe:p@ssw0rd -X GET <OSDF_URL>/nodes/<NODE_ID>
    
For the remainder of this API documentation, the combination of the username and the password, will be referred to as "\<AUTH>" for brevity.

[top](#top)

***

## <a name="info"></a> Server Information

Basic information about the OSDF instance, such as a description, contact information, and the version of the API (which may change over time) may be retrieved with a simple HTTP GET request. The "title", "comment1" and "comment2" fields are limited to 128 characters, the "description" is limited to 512 characters. The email contact fields values must adhere to RFC 5322 and RFC 5321 but are further limited to a maximum of 128 characters.

**Request: GET /info**

A GET to the URL will an object.

Example Request:

    $ curl -u <AUTH> -X GET <OSDF_URL>/info

**Response: (application/json)**

Example Response:

	{	  "api_version" = "<api_version>",	  "title": "<title1>",	  "description": "<description1>",	  "url": "<url1>",	  "admin_contact_email1": "<admin_email1>",	  "admin_contact_email2": "<admin_email2>",	  "technical_contact1": "<tech_email1>",	  "technical_contact2": "<tech_email2>",	  "comment1": "<comment1>",	  "comment2": "<comment2>"	}	Concrete Example Response:		{	  "api_version" = "1.0",	  "title": "Example OSDF Server",	  "description": "OSDF instance for scientific metadata",	  "url": "http://osdf.example.org",	  "admin_contact_email1": "admin@osdf.example.org",	  "admin_contact_email2": "help@osdf.example.org",	  "technical_contact1": "osdf-helpdesk@osdf.example.org",	  "technical_contact2": "osdf@osdf.example.org",	  "comment1": "",	  "comment2": "You can also call us at 555-123-4567"	}

[top](#top)

## <a name="ns"></a> Namespaces

Each namespace associated with OSDF will have its own specific schemas that determine how a developers and users will interact with it. Namespaces will be globally unique. In other words, there cannot be a more than one namespace with a given name that would result in a namespace name collision. Namespace names beginning with the string "osdf" are reserved for internal system and implementation use and are prohibited from use by end users. Namespace names are limited to 32 characters and descriptions to 256 characters. For the namespace name, each character must be a member of the alphanumeric ASCII character set (A-Za-z0-9) or an underscore (_) or hyphen (-).

### <a name="namespace_list"></a> List Available Namespaces

**Request: GET /namespaces**

A GET to the URL will yield a JSON object with namespace names as keys.

Example Request:

    $ curl -u <AUTH> -X GET <OSDF_URL>/namespaces**Response: (application/json)**
Example Response:	{	  "<ns1>":     { "title": "<title1>",	                 "description": "<description1>",	                 "url": "<url1>" },		  "<ns2>":     { "title": "<title2>",	                 "description": "<description2>",	                 "url": "<url2>" },		  "<nsN>":     { "title": "<titleN>",	                 "description": "<descriptionN>",	                 "url": "<urlN>" }	}Concrete Example Response:	{	    "test": {	        "title": "The test project",	        "description": "The aim of test project is to...",	        "url": "http://test.example.org"	    }	}
### <a name="namespace_retrieve"></a> Retrieve a Namespace

**Request: GET /namespaces/${ns}**
    
A GET to the URL will yield specific namespace details.

Example Request:

    $ curl -u <AUTH> -X GET <OSDF_URL>/namespaces/<NS>**Response: (application/json)**

A JSON object with the details of the requested namespace.
Example Response:	{	    "<ns>": {	        "title": "<title>",	        "description": "<description>",	        "url": "<url>"	    }	}Concrete Example Response:	{	    "test": {	        "title": "The Test Project",	        "description": "The aim of the Test Project is to...",	        "url": "http://test.example.org"	    }	}

[top](#top)

***

## <a name="nodes"></a> Nodes

An OSDF node is a generic data container. The specific mandatory attributes for an OSDF node are a namespace that defines the node's general project, a unique ID, the linkages (if any) describing relationships to other nodes, the node type, ACLs restricting for access control, and a generic “meta” key for arbitrary JSON data. The intent of the “meta” field is to hold the namespace specific node content (controlled by the namespace and in conjunction with the optional use of JSON-Schema). In the “linkage” field, each node describes how it is connected to other nodes. Since there may be multiple connection types, there can be multiple links for each. Each linkage type has node members listed by node id.

[top](#top)

### <a name="node_create"></a> Create a Node

**Request: POST /nodes**

Abstract Form: 	{	    "ns": "<namespace_id>",	    "linkage": { "<ns_linkage_cv1>": ["<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<ns_linkage_cv2>": ["<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<ns_linkage_cvN>": ["<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ]	    },	    "acl": { "read": [ "<acl1>", "<acl2>", "<aclN>" ],	             "write": [ "<acl1>", "<acl2>", "<aclN>" ]	           },	    "node_type": "<node_type_cv1>",	    "meta": {	       <arbitrary_json>	    }	}Concrete Example:	{	    "ns": "test",  	    "linkage": { "collected_from" : [ "23435e57" ] },	    "acl": { "read" : [ "all" ],	             "write": [ "researchers" ]	           },	    "node_type": "sample",	    "meta": {	        "name": "New sample name",	        "alt_name": “New alternate name",	        "description": “New description",	        "tags": [ "female", "oral" ]	    }	}

Command line example (where data.json is a file containing the data):

    $ curl -u <AUTH> -X POST -d @data.json <OSDF_URL>/nodes**Response:**

Returns HTTP 201 ("Created") on success. The HTTP Location header is set to the URL for the new node and the node’s ID can be extracted from the URL. Failed requests, an invalid "node_type", or ACL value, or a "meta" section that does not conform to the node type's registered JSON-Schema, will yield HTTP 422 ("Unprocessable Entity"). Error details may be found in the X-OSDF-Error HTTP header. Other errors may result in HTTP 500 ("Server error") responses.Security related errors for users attempting to create nodes without appropriate entries in the namespaces ACLs will result in an HTTP 403 "Forbidden" status code.[top](#top)

### <a name="node_retrieve"></a> Retrieve a Node

**Request: GET /nodes/${node_id}**

A GET to the URL will yield a JSON document describing the node.

Example Request:

    $ curl -u <AUTH> -X GET <OSDF_URL>/nodes/<NODE_ID>
    
where \<NODE_ID> is the ID of the node we wish to retrieve the data for.
    **Response: (application/json)**
Example Response:	{	    "ns": "<namespace_id>",	    "id": "<id>",	    "ver": N,	    "linkage": { "<linkage_name1":   [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<linkage_name2":   [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<linkage_nameN>":  [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ]	    },	    "acl": { "read": [ "<acl1>", "<acl2>", "<aclN>" ],	             "write": [ "<acl1>", "<acl2>", "<aclN>" ]	           },	    "node_type": "<node_type>",	    "meta": {	       <arbitrary_json>	    }	}Concrete Example Response:	{	   "ns": "test",	   "id": "dc0e2473ac6cf2f2739104f10ffef1ef",	   "ver": 1,	   "linkage": {	       "collected_from": [ "dc0e2473ac6cf2f2739104f10fea5632" ],	   },	   "acl": { "read": [ "all" ],	            "write": [ "researchers" ]	          },	   "node_type": "sample",	   "meta": {	       "body_site": "throat",	       "sex": "female",	       "collection_date": "2010-06-01",	       "tags": [ "human", "healthy" ],	       "visit_number": 1,	       "comment": "A sample collected from a human subject"	   }	}
Failed requests (for an unknown node ID) will an yield HTTP status code 404 ("Not Found").

[top](#top)

### <a name="node_version"></a> Retrieve Node Version/History

All Nodes are versioned so that an authorized user can always retrieve a previous version of a node and examine how a node has changed over time. This ensures that the combination of node ID and version is immutable and can be easily retrieved at any point in time unless the node itself is deleted.

**Request: GET /nodes/${node_id}/ver/${version_number}**

A GET to the URL will yield a document describing the previous node version.Example Request:    $ curl –u <AUTH> –X GET <OSDF_URL>/nodes/<NODE_ID>/ver/<VER>
where \<VER> is the version number of interest belonging to node with ID of \<NODE_ID>
**Response: (application/json)**

Example Response: 	{	    "ns": "<namespace_id>",	    "id": "<id>",	    "ver": <version_number>,	    "linkage": {	        "<ns_linkage_cv1>":  [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	        "<ns_linkage_cv2>":  [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	        "<ns_linkage_cvN>":  [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ]	    },	    "acl": { "read": [ "<acl1>", "<acl2>", "<aclN>" ],	             "write": [ "<acl1>", "<acl2>, "<aclN>" ]	           },	    "node_type": "<node_type_cv1>",	    "meta": {	       <arbitrary_json>	    }	}Concrete Example Response:	{	   "ns": "test",	   "id": "dc0e2473ac6cf2f2739104f10ff57561",	   "ver": 2,	   "linkage": {	       "collected_from": [ "10b955c73ee92a34fa55631571c0b398" ]	   },	   "node_type": "sample",	   "acl": { "read": [ "all" ],
                "write": [ "researchers" ]
              },	   "meta": {	       "body_site": "throat",	       "visit_number": 2	   }	}
Requests for an unrecognized id will yield an HTTP 404 ("Not found") status code. Other errors will result in an HTTP 500 ("Server error") response.Security related errors for users attempting to retrieve nodes without appropriate entries in the namespaces ACLs will result in an HTTP 403 "Forbidden" status code.

[top](#top)

### <a name="node_out"></a> Retrieve Nodes Linked To

To retrieve the nodes that a particular node links out to, via the "linkage" section of the node's JSON, one can simply parse the node IDs from the various arrays in the JSON object, or one can simply make a GET request to a URL to retrieve the nodes in one JSON data structure.

**Request: GET /nodes/${node_id}/out**

Example Request:    $ curl –u <AUTH> –X GET <OSDF_URL>/nodes/<NODE_ID>/out
where \<NODE_ID> is the ID of the node we want the outbound connections/edges for.

**Response: (application/json)**
    {    	"result_count": N,
        "page": 1,    	"results": [	        <NODE1>,
            <NODE2>,
            <NODEN>	    ]	}[top](#top)

### <a name="node_in"></a> Retrieve Nodes Linked From

To retrieve the nodes that point to a particular node (as a target), then simply make a GET request to the sepecial "in" URL that every node possesses.

**Request: GET /nodes/${node_id}/in**

Example Request:    $ curl –u <AUTH> –X GET <OSDF_URL>/nodes/<NODE_ID>/in
where \<NODE_ID> is the ID of the node we wish to know what nodes point to.

**Response: (application/json)**
    {    	"result_count": N,
        "page": 1,    	"results": [	        <NODE1>,
            <NODE2>,
            <NODEN>	    ]	}

[top](#top)

### <a name="node_edit"></a> Edit a Node

Users may edit/update nodes with new data by using the HTTP PUT method. However, because of the nature of REST and HTTP, multiple simultaneous requests to update a node are possible. Therefore, for consistency, and to ensure that the correct version of a node is being operated on, requests to update a node must include the node's version. If a request for a node is received for an older version, that request will fail.

**Request: PUT /nodes/${node_id}**

A PUT to the URL with a JSON structure describing the new node data.Example data:   	"ns": "<namespace_id>",	    "ver": <version>	    "linkage": { "<ns_linkage_cv1>": [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<ns_linkage_cv2>": [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	                 "<ns_linkage_cvN>": [ "<osdf_id_1>", "<osdf_id_2>", "<osdf_id_N>" ],	    "acl": { "read": [ "<acl1>", "<acl2>", "<aclN>" ],	             "write": [ "<acl1>", "<acl2", "<aclN>" ]	           },	    "node_type": "<node_type_cv>",	    "meta": {	       <arbitrary_json_defined_by_the_namespace>	    }	}Concrete Example:	{	    "ns": "test",	    "ver": 5,	    "linkage": { "collected_from" : [ "j23zrcp82zJKb2dfwv5p" ] },	    "acl": { "read" : [ "all" ],	             "write": [ "researchers" ]	           },	    "node_type": "sample",	    "meta": {	        "name": "New sample name",	        "alt_name": “New alternate name",	        "description": "New description",	        "tags": [ "female", "human" ]	    }	}
**Response:**

Returns HTTP status code 200 on success.Failed requests, such as those using malformed JSON, or an invalid ACL value, will yield HTTP 422 ("Unprocessable Entity") responses. Other errors will result in HTTP 500 ("Server error") responses.Security related errors for users attempting to edit/alter nodes without appropriate entries in the namespace ACLs will result in an HTTP 403 "Forbidden" status code.

### <a name="node_del"></a> Delete a Node
**Request: DELETE /nodes/${node_id}**A DELETE request to the URL containing the node id to delete.    $ curl –u <AUTH> -X DELETE <OSDF_URL>/nodes/<NODE_ID>where \<NODE_ID> is the ID of the node to delete.
**Response:**Returns HTTP 204 ("No content") on success.Failed requests (unrecognized id) will yield HTTP 422 ("Unprocessable Entity") or 500 ("Server error") responses.**Special note:** To prevent linkage errors when deleting nodes, users must first delete the node’s linkages through node edits. This measure exists to prevent broken/dangling links.Security related errors for users attempting to delete nodes without appropriate entries in the namespaces ACLs will result in an HTTP 403 "Forbidden" status code.

[top](#top)

***

## <a name="schemas"></a> Schemas

Each namespace may have multiple schemas (expressed with the [JSON-Schema](http://json-schema.org) standard) to control the structure of nodes and to provide validation. A schema is itself a JSON document that defines how other JSON documents must be formatted.
In OSDF, if a schema is created in a namespace, the name of the schema will then be applied to any nodes with "node_type" of the same name. If a namespace contains nodes of type "transaction", and the namespace wishes to impose control and validation on these nodes, then a schema of name "transaction" must be defined and registered in the OSDF server for the namespace. Once registered, future insertions for nodes of that type will be validated against the schema. If the document does not validate, an OSDF error will be generated.### <a name="schema_create"></a> Create a Schema**Request: POST /namespaces/${ns}/schemas**

A POST to the URL with a properly formatted and valid document will create a new schema in the specified namespace. The schema will then be used to validate any new incoming nodes that have a "node_type" that matches the schema's name.Example Requests:    $ curl –u <AUTH> –X POST -d <SCHEMA_DOC> <OSDF_URL>/namespaces/<NS>/schemas    or, if the schema document is stored in a file:
    $ curl -u <AUTH> -X POST -d @schema_doc.json <OSDF_URL>/namespaces/<NS>/schemas
where \<NS> is the name of the namespace being modified and schema.json is a file containing a [JSON-Schema](http://json-schema.org) document.
The schema document being posted must have the following structure:
    {
        "name": "schema_name",
        "schema": {  properly formatted and valid JSON-Schema }    }

**Response:**

If the JSON-Schema was properly registered into the namespace, an HTTP Status code of 201 will be returned. However, if the document was malformed or if it contained invalid JSON-Schema data, then an HTTP 422 error will be returned. If an attempt to insert a schema is made where the schema name conflicts with an already registered schema, an HTTP 409 error will be returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.
### <a name="schema_list"></a> List All Namespace Schemas
**Request: GET /namespaces/${ns}/schemas**

A GET to the URL will retrieve a collection of all the schemas belonging to the specified namespace.Example Request:    $ curl –u <AUTH> –X GET <OSDF_URL>/namespaces/<NS>/schemaswhere \<NS> is the name of the namespace for which the schemas are wanted.

**Response: (application/json)**

Example Response: 	{	    "schema_name1": <SCHEMA_DOC1>,	    "schema_name2": <SCHEMA_DOC2>,	    "schema_nameN": <SCHEMA_DOCN>	}

Concrete Example Response:
	{
        "schema_name": {
              "type": "object",
              "properties": {
                  "my_json_property": {
                      "type": "string",
                      "required": true
                  }
              },
              "additionalProperties": false
        }
    }Requests for an unknown namespace will yield an HTTP 404 ("Not found") status code. Other errors will result in an HTTP 500 ("Server error") response. Error details may be found in the X-OSDF-Error HTTP header.
Users attempting to retrieve schemas without appropriate entries in the namespace's ACL will encounter an HTTP 403 "Forbidden" status code.
### <a name="schema_retrieve"></a> Retrieve a Schema
**Request: GET /namespaces/${ns}/schemas/${schema}**

A GET to the URL will retrieve the specified [JSON-Schema](http://json-schema.org) document.Example Requests:    $ curl –u <AUTH> –X GET <OSDF_URL>/namespaces/<NS>/schemas/<SCHEMA>where \<NS> is the name of the namespace and \<SCHEMA> is the name of the schema/node_type.

**Response: (application/json)**

Example Response: 	{
        "type": "object",
        "properties": {
            "my_json_property": {
                "type": "string",
                "required": true
            }
        },
        "additionalProperties": false	}

Requests for an unknown namespace or schema name will yield an HTTP 404 ("Not found") status code. Other errors will result in an HTTP 500 ("Server error") response. Error details may be found in the X-OSDF-Error HTTP header.
Users attempting to retrieve a schema without appropriate entries in the namespace's ACL will encounter an HTTP 403 "Forbidden" status code.

### <a name="schema_edit"></a> Edit/Update a Schema**Request: PUT /namespaces/${ns}/schemas/${schema}**

A PUT to the URL with a properly formatted and valid document will update the schema used to validate
nodes with a "node_type" matching the schema name.Example Requests:    $ curl –u <AUTH> –X PUT -d <SCHEMA_JSON> <OSDF_URL>/namespaces/<NS>/schemas/<SCHEMA>    or, if the JSON-Schema is stored in a file:
    $ curl -u <AUTH> -X PUT -d @schema.json <OSDF_URL>/namespaces/<NS>/schemas/<SCHEMA>
where \<NS> is the name of the namespace and schema.json is a file containing a [JSON-Schema](http://json-schema.org) document.

**Response:**

If the JSON-Schema was successfully modified an HTTP Status code of 200 will be returned. However, if the document was malformed or if it contained invalid JSON-Schema data, then an HTTP 422 error will be returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.

### <a name="schema_del"></a> Delete a Schema**Request: DELETE /namespaces/${ns}/schemas/${schema}**

A DELETE to the URL will remove the schema used for validation from the specified namespace .Example Request:    $ curl –u <AUTH> –X DELETE <OSDF_URL>/namespaces/<NS>/schemas/<SCHEMA>where \<NS> is the name of the namespace and \<SCHEMA> is the schema that is being removed.

**Response:**

If the schema was successfully removed an HTTP Status code of 204 will be returned. If the namespace
or the schema are unknown, then an HTTP 404 is returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.

***

## <a name="aux_schemas"></a> Auxiliary Schemas

It is frequently useful to have schema fragments that can be reusable between various other schemas
in order to avoid duplication and to ease maintenance and updates. In this API we call these auxiliary schemas, because they can be referenced and reused by the primary schemas that are used to validate node documents using the "$ref" key.

### <A NAME="aux_schema_create"></a> Create an Auxiliary Schema

**Request: POST /namespaces/${ns}/schemas/aux**

A POST to the URL with a properly formatted and valid document will create a new auxiliary schema in the specified namespace. The auxiliary schema will then be available for any new schemas that are inserted that make reference to this auxiliary or if any schemas are updated/modified to make make reference to it.Example Requests:    $ curl –u <AUTH> –X POST -d <AUX_SCHEMA_DOC> <OSDF_URL>/namespaces/<NS>/schemas/aux    or, if the document is stored in a file:
    $ curl -u <AUTH> -X POST -d @aux_schema_doc.json <OSDF_URL>/namespaces/<NS>/schemas/aux
where \<NS> is the name of the namespace being modified and aux_schema.json is a file containing a [JSON-Schema](http://json-schema.org) document.
The auxiliary schema document being posted must have the following structure:
    {
        "name": "aux_schema_name",
        "schema": {  properly formatted and valid JSON-Schema }    }

**Response:**

If the document was properly registered into the namespace, an HTTP Status code of 201 will be returned. However, if the document was malformed or if it contained invalid JSON-Schema data, then an HTTP 422 error will be returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.

**Special note:** If an attempt to insert an auxiliary schema is made where the auxiliary schema name conflicts with an already registered auxiliary schema, an HTTP 409 error will be returned.

### <A NAME="aux_schema_list"></a> List all Namespace Auxiliary Schemas

**Request: GET /namespaces/${ns}/schemas/aux**

A GET to the URL will retrieve a collection of all the auxiliary schemas belonging to the specified namespace.Example Request:    $ curl –u <AUTH> –X GET <OSDF_URL>/namespaces/<NS>/schemas/auxwhere \<NS> is the name of the namespace for which the auxiliary schemas are wanted.

**Response: (application/json)**

Example Response: 	{	    "aux_schema_name1": <AUX_SCHEMA_DOC1>,	    "aux_schema_name2": <AUX_SCHEMA_DOC2>,	    "aux_schema_nameN": <AUX_SCHEMA_DOCN>	}

Concrete Example Response:
	{
        "aux_schema_name": {
              "type": "object",
              "properties": {
                  "my_json_property": {
                      "type": "string",
                      "required": true
                  }
              },
              "additionalProperties": false
        }
    }Requests for an unknown namespace will yield an HTTP 404 ("Not found") status code. Other errors will result in an HTTP 500 ("Server error") response. Error details may be found in the X-OSDF-Error HTTP header.
Users attempting to retrieve auxiliary schemas without appropriate entries in the namespace's ACL will encounter an HTTP 403 "Forbidden" status code.

### <A NAME="aux_schema_retrieve"></a> Retrieve an Auxiliary Schema

**Request: GET /namespaces/${ns}/schemas/aux/${aux_schema}**

A GET to the URL will retrieve the specified [JSON-Schema](http://json-schema.org) document.Example Requests:    $ curl –u <AUTH> –X GET <OSDF_URL>/namespaces/<NS>/schemas/aux/<AUX_SCHEMA>where \<NS> is the name of the namespace and \<AUX_SCHEMA> is the name of the auxiliary schema.

**Response: (application/json)**

Example Response: 	{
        "type": "object",
        "properties": {
            "my_json_property": {
                "type": "string",
                "required": true
            }
        },
        "additionalProperties": false	}

Requests for an unknown namespace or auxiliary schema name will yield an HTTP 404 ("Not found") status code. Other errors will result in an HTTP 500 ("Server error") response. Error details may be found in the X-OSDF-Error HTTP header.
Users attempting to retrieve an auxiliary schema without appropriate entries in the namespace's ACL will encounter an HTTP 403 "Forbidden" status code.

### <A NAME="aux_schema_edit"></a> Edit/Update an Auxiliary Schema

**Request: PUT /namespaces/${ns}/schemas/aux/${aux_schema}**

A PUT to the URL with a properly formatted and valid document will update the auxiliary schema.Example Requests:    $ curl –u <AUTH> –X PUT -d <AUX_SCHEMA_JSON> <OSDF_URL>/namespaces/<NS>/schemas/aux/<AUX_SCHEMA>    or, if the JSON-Schema document is stored in a file:
    $ curl -u <AUTH> -X PUT -d @aux_schema.json <OSDF_URL>/namespaces/<NS>/schemas/aux/<AUX_SCHEMA>
where \<NS> is the name of the namespace and aux_schema.json is a file containing a [JSON-Schema](http://json-schema.org) document.

**Response:**

If the JSON-Schema was successfully modified an HTTP Status code of 200 will be returned. However, if the document was malformed or if it contained invalid JSON-Schema data, then an HTTP 422 error will be returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.

### <A NAME="aux_schema_del"></a> Delete an Auxiliary Schema

**Request: DELETE /namespaces/${ns}/schemas/aux/${aux_schema}**

A DELETE to the URL will remove the auxiliary schema from the specified namespace .Example Request:    $ curl –u <AUTH> –X DELETE <OSDF_URL>/namespaces/<NS>/schemas/aux/<AUX_SCHEMA>where \<NS> is the name of the namespace and \<AUX_SCHEMA> is the name of the auxiliary schema that is being removed.

**Response:**

If the auxiliary chema was successfully removed an HTTP Status code of 204 will be returned. If the namespace or the auxiliary schema name are unknown, then an HTTP 404 is returned. Other errors may result in an HTTP 500 error. Error details may be contained in the X-OSDF-Error HTTP response header.

**Special note:** An auxiliary schema may not be removed while it is still being used or referenced from
a primary schema or another auxiliary schema. If an attempt is made to remove an auxiliary schema while
it is still being used, an HTTP 409 will be returned. Users must first clear these dependencies by editing
or removing the schemas that make reference to the auxiliary schema being deleted.

[top](#top)
***

## <a name="queries"></a> Queries/Search

Queries for nodes may be performed by posting a JSON document to namespace specific URL. The query JSON documents use the “Elasticsearch Query DSL” to formulate the search criteria and each search request is limited to a single namespace. The [Elasticsearch DSL](http://www.elasticsearch.org/guide/reference/query-dsl/) provides a robust mechanism for formulating complicated queries in which terms can be logically combined, filtered; marked as must include, should include, or must not include; as well as many other search options.

### <a name="query_create"></a> Query Nodes

**Request: POST /nodes/query/${ns}**

A POST to the URL with a properly formed query will return the search results within the specified namespace.Example Requests:    $ curl –u <AUTH> –X POST -d <QUERY_JSON> <OSDF_URL>/nodes/query/<NS>    $ curl -u <AUTH> -X POST -d '{"query" : { "term" : { "node_type" : "sample" }}}' \
      <OSDF_URL>/nodes/query/<NS>
    or, if the JSON query is stored in a file:
    $ curl -u <AUTH> -X POST -d @query.json <OSDF_URL>/nodes/query/<NS>
where \<NS> is the name of the namespace being queried and query.json is a file containing the JSON query document using the Query DSL.

**Response: (application/json)**

Example Response: Returns HTTP status code 200 on success along with a JSON document Example Response:	{	   "result_count": <RESULT_COUNT>,	   "search_result_total": <TOTAL_RESULTS_AVAILABLE>,	   "page": <PAGE>,	   "results": [           <RESULT_JSON_DOC_1>,
           <RESULT_JSON_DOC_2>,
           <RESULT_JSON_DOC_N>	   ]	}Concrete Example Response:	{	   "result_count": 1,	   "search_result_total": 1,	   "page": 1	   "results": [	      {	         "id": "9a1696ea79327fc87db6942a43bb266a",	         "ver": 1,	         "ns": "test",	         "acl": {	            "read": [ "all" ],	            "write": [ "researchers" ]	         },	         "linkage": {	            "collected_from": [ "9a1696ea79327fc87db6942a438d2531" ]	         },	         "node_type": "sample",	         "meta": {	             "name": "Sample name",	             "alt_name": “Alternate name",	             "description": “Description",	             "tags": [ "female", "oral" ]	         }	      }	   ]	}If the result is too large to return in a single response, the server will return a partial result set and an HTTP 206 response (“Partial content”) code. The “X-OSDF-Query-ResultSet” header will then contain a URL to allow the retrieval of the next page of search results. If a search result response does not contain the X-OSDF-Query-ResultSet header or if it returns an HTTP 200, then there are no further search results available.Requests will yield an HTTP 422 ("Unprocessable Entity") code if invalid query JSON is provided or an HTTP 500 ("Server error") if other errors occurred. A more detailed error message may be provided in the X-OSDF-Error HTTP response header.

[top](#top)

### <a name="query_dsl_examples"></a> Query DSL Examples

Presented here, for convenience, are a few examples of common queries. The full query DSL can be found [here](http://www.elasticsearch.org/guide/reference/query-dsl/).

#### Simple Term Query

This query will return all documents containing the top-level term “node_type” with the value “sample”.  If searching for a nested field, use the dot operator.**Note:** Be careful with the “term” query as it is “not analyzed” according to the documentation. The underlying Lucene analyzer both tokenizes the text and makes it lowercase. As a result, searching for a value that contains any upper case letters with this type of query will not yield results.	{ 	   "query": { 	      "term" : { "node_type" : "sample" }	   }	}

[top](#top)

#### Simple Value Query

This query will return all documents containing the literal “sample” string on any part of the document’s JSON structure.	{	   "query": {	        "query_string" : { "query" : "sample" }	   }	}[top](#top)
#### Hierarchichal JSON Value Query

Nested JSON fields can be specified using the dot operator. The query below will only return documents with a matching hierarchical JSON structure.	{ 	   "query" : { 	      "query_string" : { 	         "fields" : [ "meta.process.software" ],	         "query" : "blast"	      }	   }	}
[top](#top)
#### Literals AND'd and OR'dWill return all documents containing "this" AND "that" OR "thus". The default operator, if none specified, is the OR operator. This will automatically be inserted between literals if no operator is specified or the default operator is not set. In the query, "default_field"" is the JSON field on which to search, but is not required and, if not provided, make the query operate on all fields.		{	   "query": { 	      "query_string" : {	         "default_field" : "node_type",	         "query" : "this AND that OR thus"	      }	   }	}

[top](#top)
#### Boolean Query with Nested SubqueriesEach of the boolean query fields ("must", "should", and "must_not") takes an array of other DSL queries. These subqueries are not prefixed with the token “query” as in the outermost query. Note that "should" clauses are optional, and that a boolean query cannot be made up solely of a "must_not" clause… 	{	   "query" : {	      "bool" : {	         "must" : [
                 {
                     "term" : { "node_type" : "sample" }
                 }	         ],	         "should" : [	             {                     "term" : { "tags" : "female" }	             }	         ],	         "must_not" : [
                 {
                     "term" : { "visit_number" : 1 }
                 }	         ]	      }	   }	}[top](#top)

### <a name="query_filters"></a> Filters

In addition to queries, filters may be used to further limit the query results. For example, the following boolean query has been filtered to only return samples with a collection date of "2012-01-01". Filters have both "query" and "filter" sections, therefore, filtered queries can actually be nested. 	{	    "query" : {	        "filtered" : {	            "query" : {	                "bool" : {				        "must" : [
			                {
			                    "term" : { "node_type" : "sample" }
			                }				        ],				        "must_not" : [
			                {
			                    "term" : { "visit_number" : 1 }
			                }				        ]	                }	            },	            "filter" : {	                "and" : [ { "term" : { "collection_date" : "2012-01-01" } } ]	            }	        }	    }    }
[top](#top)

### <a name="query_pag"></a> Pagination

Query results are paginated if the results are too large. The number of results returned for each page is specified by the implementation. Rather than making a query and using the X-OSDF-Query-ResultSet header to retrieve the next page, an OSDF user may elect to request a specific page or result range. Retrieving a specific page returns the same results as a regular query, but allows the user to better control which results are returned. When making a query that returns a number of results that exceed the OSDF page size, you may find it more convenient to return specific pages. This can be achieved by posting a JSON query using the following URL:**Request: POST /nodes/query/${ns}/page/${page_number}**
Example request:    $ curl -u <AUTH> -d '{"query" : { "term" : { "node_type" : "sample" }}}' \      <OSDF_URL>/nodes/query/<ns>/page/<page_number>Or, if the JSON query is stored in a file:    $ curl -u <AUTH> -d @query.json <OSDF_URL>/nodes/query/<ns>/page/<page_number>Alternatively, query results may be paginated using the Query DSL "from" and "size" keywords.**Note:** When specifying the result set size in this way, queries are still limited by the OSDF page size specified by the implementation and may still be paginated. In other words, the "from" and "size" parameters may not be used to override the OSDF implementation's limit in order to increase it.
[top](#top)
