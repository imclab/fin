.PHONY: run run-couchdbx clean

################
### Commands ###
################

deps: lib/js.io lib/redis-node-client

run:
	cd js/server; node run_server.js

clean:
	rm -rf lib/*
	touch lib/empty.txt



#####################
### Dependencies ####
#####################

lib/js.io:
	git clone git://github.com/mcarter/js.io.git
	mv js.io lib/
	cd lib/js.io/; git checkout 7ce67c5f5299c6b005333f8e267d53f803ac4dfd

lib/redis-node-client:
	git clone git://github.com/fictorial/redis-node-client.git 
	mv redis-node-client lib/
	# Checks out "works with just-released node v0.1.90"
	cd lib/redis-node-client/; git checkout abf4c4bf4c3f13873fe65b45ddee664066e442dd

##################
### Utilities ####
##################

.PHONY: install-node

install-node:
	rm -rf /tmp/fin-node
	git clone git://github.com/ry/node.git /tmp/fin-node
	# installs node version 0.1.90
	cd /tmp/fin-node; git checkout 07e64d45ffa1856e824c4fa6afd0442ba61d6fd8; ./configure; make; sudo make install
