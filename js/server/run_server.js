require('../../lib/js.io/packages/jsio')

jsio.path.shared = '../'
jsio.path.server = '../'

jsio('import server.Server')
jsio('import server.Connection')

var redis = require('../../lib/redis-node-client/lib/redis-client')
var finServer = new server.Server(redis, server.Connection)

// for browser clients
finServer.listen('csp', { port: 5555 }) 

// for robots
finServer.listen('tcp', { port: 5556, timeout: 0 }) 
