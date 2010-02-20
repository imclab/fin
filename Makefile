
.PHONY: init clean jsio node-couch node-growl monitor test

init: jsio node-couch

run:
	cd js/server; node run_server.js

clean:
	rm -rf lib/*
	touch lib/empty.txt

monitor:
	cd tests; node monitor_tests.js

test:
	cd tests; node run_tests.js

### util
####################

install-growl-notify:
	git clone git://github.com/marcuswestin/growl-notify.git
	cd growl-notify; sudo ./install.sh;
	rm -rf growl-notify;

install-node:
	git clone git://github.com/ry/node.git
	cd node; ./configure; make; sudo make install
	rm -rf node;

### lib dependencies
####################

jsio:
	git clone git://github.com/marcuswestin/js.io.git
	mv js.io lib/

node-couch:
	git clone git://github.com/marcuswestin/node-couch.git
	mv node-couch lib/

node-growl:
	git clone git://github.com/marcuswestin/node-growl.git
	mv node-growl lib/

# Use init-edit for write-access versions of all lib imports
init-edit: jsio-edit node-couch-edit node-growl

jsio-edit:
	git clone git@github.com:marcuswestin/js.io.git
	mv js.io lib/

node-couch-edit:
	git clone git@github.com:marcuswestin/node-couch.git
	mv node-couch lib/

node-growl-edit:
	git clone git@github.com:marcuswestin/node-growl.git
	mv node-growl lib/
