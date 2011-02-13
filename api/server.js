var events = require('events'),
	io = require('../lib/socket.io'),
	data = require('./fin/data'),
	requests = require('./fin/requests'),
	log = require('./fin/logger').log,
	util = require('./fin/util')

module.exports = {
	start: start,
	handleRequest: handleRequest,
	on: on
}

/* State
 *******/
var	requestHandlers = {},
	emitter = new events.EventEmitter(),
	engine

/* Exported API
 **************/
function start(theEngine, httpServer) {
	engine = theEngine
	data.setEngine(engine)
	
	if (!httpServer) {
		httpServer = require('http').createServer(function(){})
		httpServer.listen(8080, '127.0.0.1')
	}
	var socket = io.listen(httpServer)
	socket.on('connection', _handleConnection)
	
	handleRequest
		('observe', requests.observeHandler)
		('unsubscribe', requests.unsubscribeHandler)
		('create', requests.createHandler)
		('mutate', requests.mutateHandler)
		('extend_list', requests.extendListHandler)
}

function handleRequest(messageType, handler) {
	requestHandlers[messageType] = handler
	return handleRequest
}

function on(event, handler) {
	emitter(event, handler)
}

/* Handler functions
 *******************/
function _handleConnection(client) {
	log('new connection', client.sessionId)
	client.on('message', util.curry(_handleMessage, client))
	client.on('disconnect', util.curry(_handleDisconnect, client))
	client.pubsub = engine.getPubSub()
	emitter.emit('client_connect', client)
}

function _handleMessage(client, message) {
	if (!requestHandlers[message.request]) {
		log('unknown request type', message.request)
		return
	}
	requestHandlers[message.request](client, message)
}

function _handleDisconnect(client) {
	emitter.emit('client_disconnect', client)
}
