var Buffer = require('buffer').Buffer,
	util = require('./util'),
	create = util.create

var data = {},
	pubsub = {}

/* Get a store
 *************/
exports.getStore = function() {
	return create(storeAPI)
}

/* The store's API
 *****************/
var storeAPI = {
	/* Setup/teardown
	 ****************/
	initialize: function() {
		this._subscriptions = []
	},
	
	close: function() {
		for (var i=0, signal; signal = this._subscriptions[i]; i++) {
			var subscribers = pubsub[signal]
			for (var j=0, subscriber; subscriber = subscribers[j]; j++) {
				if (subscriber[1] != this) { continue }
				subscribers.splice(j, 1)
				break
			}
		}
	},

	/* Pubsub
	 ********/
	subscribe: function(channel, callback) {
		if (!pubsub[channel]) { pubsub[channel] = [] }
		pubsub[channel].push([callback, this])
	},
	
	publish: function(channel, message) {
		if (!pubsub[channel]) { return }
		var messageBuffer = new Buffer(message),
			subscribers = pubsub[channel]
		for (var i=0, subscriber; subscriber = subscribers[i]; i++) {
			subscriber[0](channel, messageBuffer)
		}
	},
	
	/* Getters
	 *********/
	getBytes: function(key, callback) {
		if (typeof data[key] == 'undefined') {
			callback(null, null)
		} else if (typeof data[key] == 'string' || typeof data[key] == 'number') {
			callback(null, data[key])
		} else {
			callback(typeError('getBytes', 'string or number', key))
		}
	},
	
	getListItems: function(key, from, to, callback) {
		if (typeof data[key] == 'undefined') {
			callback(null, [])
		} else if (!(data[key] instanceof Array)) {
			callback(typeError('getListItems', 'list', key))
		} else {
			if (to < 0) { to = data[key].length + to + 1 }
			from = Math.max(from, 0)
			to = Math.min(to, data[key].length)
			callback(null, data[key].slice(from, to - from))
		}
	},
	
	getMembers: function(key, callback) {
		if (typeof data[key] == 'undefined') {
			callback(null, [])
		} else if (!(data[key] instanceof Array)) {
			callback(typeError('getMembers', 'set', key))
		} else {
			callback(null, data[key].members)
		}
	},
	
	/* Mutation handlers
	 *******************/
	handleMutation: function(operation, args) {
		storeAPI[operation].apply(this, args)
	},
	
	setIfNull: function(key, value, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = value
			callback(null, true)
		} else {
			callback(null, false)
		}
	},
	
	set: function(key, value, callback) {
		if (typeof data[key] == 'undefined' || typeof data[key] == 'string' || typeof data[key] == 'number') {
			data[key] = value
			callback(null, data[key])
		} else {
			callback(typeError('set', 'string or number', key), null)
		}
	},
	
	push: function(key, values, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = values
			callback(null, null)
		} else if (data[key] instanceof Array) {
			data[key] = data[key].concat(values)
			callback(null, null)
		} else {
			callback(typeError('push', 'list', key), null)
		}
	},
	
	unshift: function(key, values, callback) {
		var values = Array.prototype.slice.call(arguments, 1)
		if (typeof data[key] == 'undefined') {
			data[key] = values
			callback(null, null)
		} else if (data[key] instanceof Array) {
			data[key] = values.concat(data[key])
			callback(null, null)
		} else {
			callback(typeError('push', 'list', key), null)
		}
	},
	
	increment: function(key, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = 1
			callback(null, data[key])
		} else if (typeof data[key] == 'number') {
			data[key] += 1
			callback(null, data[key])
		} else {
			callback(typeError('increment', 'number', key), null)
		}
	},
	
	decrement: function(key, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = -1
			callback(null, data[key])
		} else if (typeof data[key] == 'number') {
			data[key] -= 1
			callback(null, data[key])
		} else {
			callback(typeError('decrement', 'number', key), null)
		}
	},
	
	add: function(key, value, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = value
			callback(null, data[key])
		} else if (typeof data[key] == 'number') {
			data[key] += value
			callback(null, data[key])
		} else {
			callback(typeError('add', 'number', key), null)
		}
	},
	
	subtract: function(key, value, callback) {
		if (typeof data[key] == 'undefined') {
			data[key] = -value
			callback(null, data[key])
		} else if (typeof data[key] == 'number') {
			data[key] -= value
			callback(null, data[key])
		} else {
			callback(typeError('subtract', 'number', key), null)
		}
	},
	
	sadd: function() { throw new Error('sadd not yet implemented') },
	srem: function() { throw new Error('srem not yet implemented') }	
}


function typeError(operation, type, key) {
	return '"'+operation+'" expected a '+type+' at key "'+key+'" but found a '+typeof data[key]
}
