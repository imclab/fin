jsio('from shared.javascript import Singleton, bind')

jsio('import shared.Pool')
jsio('import shared.keys')

jsio('import client.Client')
jsio('import client.TemplateFactory')
jsio('import client.ViewFactory')

// expose fin to global namespace
fin = Singleton(function(){
	
	// Make sure you have a connection with the server before using fin
	this.connect = function(callback) {
		var transport, connectParams = {}
		switch(jsio.__env.name) {
			case 'node':
				transport = 'tcp'
				connectParams.host = '127.0.0.1'
				connectParams.port = 5556
				connectParams.timeout = 0
				break;
			case 'browser':
				transport = location.hash.match(/fin-postmessage/) ? 'postmessage' : 'csp'
				connectParams.url = 'http://' + (document.domain || '127.0.0.1') + ':5555'
				break;
		}
		this._client.connect(transport, connectParams, callback)
	}
	
	/* 
	 * Create an item with the given data as properties, 
	 * and get notified of the new item id when it's been created
	 */
	this.create = function(data, callback) {
		if (typeof callback != 'function') { throw logger.error('Second argument to fin.create should be a callback') }
		this.requestResponse('FIN_REQUEST_CREATE_ITEM', { data: data }, callback)
	}
	
	/* 
	 * Make a request with an associated requestId, 
	 * and call the callback upon response
	 */
	this.requestResponse = function(frameName, args, callback) {
		var requestId = this._scheduleCallback(callback)
		args._requestId = requestId
		this.send(frameName, args)
	}
	
	/* 
	 * Send a frame to the server
	 */
	this.send = function(frameName, args) {
		this._client.sendFrame(frameName, args)
	}
	
	/*
	 * Register a handler for a type of event from the server
	 */
	this.registerEventHandler = function(frameName, callback) {
		this._client.registerEventHandler(frameName, callback)
	}
	
	
	
	/*
	 * Observe an item property, and get notified any time it changes
	 */
	this._subIdToChannel = {}
	this._subscriptionPool = new shared.Pool()
	this.observe = function(itemId, propName, callback) {
		if (!itemId || !propName || !callback) { logger.error("subscribe requires three arguments", itemId, propName, callback); }
		
		var channel = shared.keys.getItemPropertyChannel(itemId, propName)
			subId = this._subscriptionPool.add(channel, callback)
		
		if (this._subscriptionPool.count(channel) == 1) {
			this.send('FIN_REQUEST_SUBSCRIBE', { id: itemId, prop: propName })
		} else if (this._mutationCache[channel]) {
			setTimeout(bind(this, '_handleItemMutation', this._mutationCache[channel]))
		}
		
		this._subIdToChannel[subId] = channel
		return subId
	}
	
	/*
	 * Query fin for items matching a set of properties, and get notified
	 * any time an item enters or leaves the matching set
	 */
	this.query = function(query, callback) {
		if (!query || !callback) { logger.error("query requires two arguments", query, callback); debugger }
		
		var queryJSON = JSON.stringify(query),
			queryChannel = shared.keys.getQueryChannel(queryJSON),
			subId = this._subscriptionPool.add(queryChannel, callback)

		if (this._subscriptionPool.count(queryChannel) == 1) {
			this.send('FIN_REQUEST_QUERY', queryJSON)
		} else if (this._mutationCache[queryChannel]) {
			setTimeout(bind(this, '_handleQueryMutation', this._mutationCache[queryChannel], true))
		}
		
		return subId
	}
	
	/*
	 * Monitor any changes to a given property. 
	 * This should probably not be used except by query robot clients
	 */
	this.monitorProperty = function() { throw logger.error("Unimplemented method monitorProperty") }
	
	/* 
	 * Release a subscription, query, or property monitoring
	 */
	this.release = function(subId) {
		if (typeof subId == 'string') {
			var channel = this._subIdToChannel[subId]
			this._subscriptionPool.remove(channel)

			if (this._subscriptionPool.count() == 0) {
				this.send('FIN_REQUEST_UNSUBSCRIBE', channel)
			}

			delete this._subIdToChannel[subId]
		} else { // it's a fin template element
			this._templateFactory.releaseTemplate(subId)
		}
	}
	
	/*
	 * Mutate a fin item with the given operation
	 */
	this.set = function(itemId, properties) {
		var args = [],
			props = []
		
		if (arguments.length == 3) {
			var propName = properties
			properties = {}
			properties[propName] = arguments[2]
		}
		
		for (var propName in properties) {
			var key = shared.keys.getItemPropertyKey(itemId, propName),
				value = properties[propName]
			
			props.push(propName)
			args.push(key)
			args.push(JSON.stringify(value))
		}
		
		this._mutate({ id: itemId, op: 'mset', props: props, args: args })
	}

	this._mutate = function(mutation) {
		this.send('FIN_REQUEST_MUTATE_ITEM', mutation)
		this._handleItemMutation(mutation)
	}
	/*
	 * Apply a template to a fin item (or multiple items)
	 */
	this.applyTemplate = function(templateString, itemIds) {
		return this._templateFactory.applyTemplate(templateString, itemIds)
	}
	
	/*
	 * Create a view directly, and get a reference to the javascript object. Make sure you release it correctly!
	 */
	this.createView = function(viewName) {
		var args = Array.prototype.slice.call(arguments, 1)
		return this._viewFactory.createView(viewName, args)
	}
	
	/*
	 * Register a template view
	 */
	this.registerView = function(viewName, viewCtor) {
		this._viewFactory.registerView(viewName, viewCtor)
	}
	
	var uniqueRequestId = 0
	this._scheduleCallback = function(callback) {
		if (!callback) { return }
		var requestId = 'r' + uniqueRequestId++
		this._requestCallbacks[requestId] = callback
		return requestId
	}
	
	this._executeCallback = function(requestId, response) {
		if (!requestId) { return }
		var callback = this._requestCallbacks[requestId]
		delete this._requestCallbacks[requestId]
		callback(response)
	}
	
	this._mutationCache = {}
	this._handleItemMutation = function(mutation) {
		var mutationArgs = Array.prototype.slice.call(mutation.args, 0)
		
		switch(mutation.op) {
			case 'mset':
				for (var iValue=1, setValue; setValue = mutationArgs[iValue]; iValue+=2) {
					mutationArgs[iValue] = JSON.parse(setValue)
				}
				break;
			default:
				throw logger.error("Unkown operation "+ operation)
		}
		
		for (var i=0, propName; propName = mutation.props[i]; i++) {
			var channel = shared.keys.getItemPropertyChannel(mutation.id, propName)
				subs = this._subscriptionPool.get(channel)
			
			for (var subId in subs) {
				// TODO remove dependency on second argument
				if (subs[subId]) { subs[subId](mutation, mutationArgs[i * 2 + 1]) }
			}
			this._mutationCache[channel] = mutation
		}
	}
	
	this._handleQueryMutation = function(mutation, dontCache) {
		var channel = mutation.id,
			subs = this._subscriptionPool.get(channel)
		
		if (!dontCache) {
			if (mutation.op == 'sadd') {
				if (!this._mutationCache[channel]) { 
					this._mutationCache[channel] = mutation
				} else {
					var args = this._mutationCache[channel].args
					for (var i=0, itemId; itemId = mutation.args[i]; i++) {
						if (args.indexOf(itemId) == -1) { continue }
						args.push(itemId)
					}
				}
			} else if (mutation.op == 'srem') {
				var args = this._mutationCache[channel].args
				for (var i=0, itemId; itemId = mutation.args[i]; i++) {
					args.splice(args.indexOf(itemId), 1)
				}
			}
		}

		for (var subId in subs) {
			// TODO store local values and apply mutations other than just "set"
			subs[subId](mutation, mutation.args[0])
		}
	}
	
	// Private method - hook up all internals
	this.init = function() {
		this._requestCallbacks = {}
		
		this._viewFactory = new client.ViewFactory()
		this._templateFactory = new client.TemplateFactory(this._viewFactory)
		
		this._client = new client.Client()
		
		this._client.registerEventHandler('FIN_RESPONSE', bind(this, function(response) {
			this._executeCallback(response._requestId, response.data)
		}))
		
		this._client.registerEventHandler('FIN_EVENT_ITEM_MUTATED', bind(this, function(mutationJSON) {
			this._handleItemMutation(JSON.parse(mutationJSON))
		}))
		
		this._client.registerEventHandler('FIN_EVENT_QUERY_MUTATED', bind(this, function(mutationJSON) {
			this._handleQueryMutation(JSON.parse(mutationJSON))
		}))
	}
})
