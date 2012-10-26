Coding standard
---------------
To maintain consistency in the codebase, committers are asked to check their
code with the nodelint tool. There is a nodelint.conf file in the root of the
project with the settings that the code in the project should use.

Example invocation:

$ nodelint --config nodelint.conf file.js

Synchronous code
----------------
Node's synchronous functions are not to be used, except perhaps in
initialization code which is executed before the server is ready to begin
accepting requests. Synchronous code has an extermely negative impact on the
server's performance and ability to handle concurrent requests.
