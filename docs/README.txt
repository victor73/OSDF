Coding standard
---------------

To maintain consistency in the codebase, committers are asked to ensure
check their code with the nodelint tool. There is a nodelint.conf file
in the root of the project with the settings that the code in the project
should use.

Example invocation:

$ nodelint --config nodelint.conf file.js

Synchronous code
----------------
Usage of node's synchronous functions is highly discouraged, except perhaps
in initialization code which is executed before the server is ready to begin
accepting requests.
