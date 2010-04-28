jsio('from shared.javascript import Class, bind, bytesToString, blockCallback, map')
jsio('import shared.keys')
jsio('import shared.mutations')

var _redis = null,
	_queries = [],
	_redisLockClient = null,
	_redisRequestClient = null

exports.init = function(redis) {
	_redis = redis
	_redisLockClient = _redis.createClient()
	_redisLockClient.stream.setTimeout(0)
	
	_redisRequestClient = _redis.createClient()
	_redisRequestClient.stream.setTimeout(0)
	_redisRequestClient.stream.addListener('connect', function() {
		_redisRequestClient.subscribeTo(shared.keys.queryRequestChannel, function(channel, queryJSONBytes) {
			_monitorQuery(bytesToString(queryJSONBytes))
		})
	})
}

exports.release = function() {
	logger.log("Releasing queries...", _queries.length)
	for (var i=0, query; query = _queries[i]; i++) {
		query.release()
	}
	logger.log("Done releasing queries")
}

function _monitorQuery(queryJSON) {
	var lockKey = shared.keys.getQueryLockKey(queryJSON)
	
	logger.log('Attempt to grab lock for', lockKey)
	_redisLockClient.setnx(lockKey, 1, function(err, iGotTheLock) {
		if (err) { throw logger.error('Could not attempt to grab a query lock', lockKey, err) }
		if (!iGotTheLock) { 
			logger.log('I did not get the lock')
			return 
		}
		logger.log('I got the lock - create query object and start monitoring for query changes', queryJSON)
		try { 
			var query = new _Query(lockKey, queryJSON)
			_queries.push(query)
		} catch (e) { 
			logger.error('Could not parse queryJSON. Releasing query key', queryJSON, e)
			_redisLockClient.del(lockKey)
		}
	})
}

_Query = Class(function() {
	
	this.init = function(lockKey, queryJSON) {
		this._queryKey = shared.keys.getQueryKey(queryJSON)
		this._queryChannel = shared.keys.getQueryChannel(queryJSON)
		this._query = JSON.parse(queryJSON)
		this._properties = map(this._query, function(key, val){ return key })
		this._lockKey = lockKey

		this._redisSubClient = _redis.createClient()
		this._redisCommandClient = _redis.createClient()
		this._redisSubClient.stream.setTimeout(0)
		this._redisCommandClient.stream.setTimeout(0)
		
		var redisReadyCallback = blockCallback(bind(this, '_onRedisReady'))
		
		this._redisSubClient.stream.addListener('connect', redisReadyCallback.addBlock())
		this._redisCommandClient.stream.addListener('connect', redisReadyCallback.addBlock())
	}
	
	this._onRedisReady = function() {
		for (var propName in this._query) {
			var propChannel = shared.keys.getPropertyChannel(propName),
				propKeyPattern = shared.keys.getPropertyKeyPattern(propName)

			this._redisSubClient.subscribeTo(propChannel, bind(this, '_onMutation'))

			logger.warn('About to process all the keys matching property', propName, 'This can get really really expensive!');
			this._redisCommandClient.keys(propKeyPattern, bind(this, function(err, keysBytes) {
				if (err) { throw logger.error('Could not retrieve keys for processing', propKeyPattern, err) }
				if (!keysBytes) { return }
				this._processKeys(propName, keysBytes.toString().split(','))
			}))
		}
	}
	
	this._processKeys = function(propName, itemPropKeys) {
		for (var i=0, itemPropKey; itemPropKey = itemPropKeys[i]; i++) {
			var itemId = shared.keys.getKeyInfo(itemPropKey).id
			
			this._processItem(itemId)
		}
	}
	
	this._onMutation = function(channel, mutationBytes) {
		var mutationInfo = shared.mutations.parseMutationBytes(mutationBytes),
			mutation = JSON.parse(mutationInfo.json),
			itemId = mutation.id
		
		this._processItem(itemId)
	}
		
	this._processItem = function(itemId) {
		var query = this._query,
			queryKey = this._queryKey,
			properties = this._properties,
			isInSet = null,
			self = this
		
		logger.log('Check membership for:', itemId)
		
		function processProperty(propIndex) {
			var propName = properties[propIndex],
				itemPropKey = shared.keys.getItemPropertyKey(itemId, propName)
			
			self._redisCommandClient.get(itemPropKey, function(err, valueBytes) {
				var value = valueBytes ? bytesToString(valueBytes) : null,
					propCondition = query[propName],
					isLiteral = (typeof propCondition != 'object'),
					compareOperator = isLiteral ? '=' : propCondition[0],
					compareValue = isLiteral ? propCondition : propCondition[1]
				
				var couldBeInSet = (compareOperator == '=') ? (value == compareValue)
							: (compareOperator == '<') ? (value < compareValue)
							: (compareOperator == '>') ? (value > compareValue)
							: logger.error('Unknown compare operator', compareOperator, queryKey, query, propName)
				
				logger.log("Check if ", propName, ':', value, compareOperator, compareValue, '[is/should]BeInSet', isInSet, couldBeInSet)
				if (!couldBeInSet) {
					if (!isInSet) { return }
					self._mutate('srem', itemId)
				} else {
					if (propIndex == 0) {
						if (isInSet) { return }
						self._mutate('sadd', itemId)
					} else {
						processProperty(propIndex - 1)
					}
				}
			})
		}
		
		this._redisCommandClient.sismember(this._queryKey, itemId, bind(this, function(err, isMember) {
			isInSet = !!isMember
			processProperty(properties.length - 1)
		}))
	}
	
	this._mutate = function(redisOp, itemId) {
		logger.log('Determined that item membership changed', redisOp, itemId)
		this._redisCommandClient[redisOp](this._queryKey, itemId, bind(this, function(err, opChangedSet) {
			if (err) { throw logger.error('Could not modify query set', redisOp, queryKey, err) }
			var mutation = { op: redisOp, id: this._queryChannel, args: [itemId] }
			this._redisCommandClient.publish(this._queryChannel, JSON.stringify(mutation))
		}))
	}
	
	this.release = function() {
		this._redisCommandClient.del(this._lockKey)
	}
})
