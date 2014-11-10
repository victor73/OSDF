This folder contains the various views and design documents required by this
OSDF implementation. To install them into a new CouchDB instance, simply
run the generate_design_docs.js script and provide the necessary information
when prompted. To confirm that the documents have been loaded correctly, you
can check with CouchDB's "Futon" web interface. If CouchDB is running on the
standard port on localhost, the URL would be:

http://localhost:5984/_utils/

1. Browse to the correct URL, as noted above.

2. Click on the "osdf" database, or the database name you have chosen to use.

3. Verify that under the "View:" dropdown at the upper right, that the
  following entries appear:

  linkage
    in
    out
    reverse

4. If the entries appear, the required design documents have been loaded.
