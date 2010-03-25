
exports.bind = function(context, method/*, args... */) {
	var args = Array.prototype.slice.call(arguments, 2)
	return function() {
		fn = (typeof method == 'string' ? context[method] : method)
		return fn.apply(context, args.concat(Array.prototype.slice.call(arguments, 0)))
	}
}

exports.forEach = function(items, fn) {
	for (var i=0, item; item = items[i]; i++) { fn(item) }
}

exports.map = function(items, fn) {
	var results = []
	exports.forEach(items, function(item) { results.push(fn(item)) })
	return results
}

exports.Class = function(parent, proto) {
	if(!proto) { proto = parent }
	proto.prototype = parent.prototype
	
	var cls = function() { if(this.init) { this.init.apply(this, arguments) }}
	cls.prototype = new proto(function(context, method, args) {
		var target = parent
		while(target = target.prototype) {
			if(target[method]) {
				return target[method].apply(context, args || [])
			}
		}
		throw new Error('supr: parent method ' + method + ' does not exist')
	})
	
	// Sometimes you want a method that renders UI to only execute once if it's called 
	// multiple times within a short time period. Delayed methods do just that
	cls.prototype.createDelayedMethod = function(methodName, fn) {
		var delayedExecution
		this[methodName] = function() {
			clearTimeout(delayedExecution)
			delayedExecution = setTimeout(bind(this, fn), 10)
		}
	}
	
	cls.prototype.constructor = cls
	return cls
}

exports.Singleton = function(parent, proto) {
	return new (exports.Class(parent, proto))()
}

var stripRegexp = /^\s*(.*?)\s*$/
exports.strip = function(str) {
	return str.match(stripRegexp)[1]
}

exports.isArray = function(obj) {
	return Object.prototype.toString.call(obj) === '[object Array]'
}