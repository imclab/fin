// nothing here yet :)
var models = module.exports = {
	process: process
}

function process(modelDescriptions) {
	for (var modelName in modelDescriptions) {
		_validateModel(modelName, modelDescriptions[modelName])
		_createModel(modelName)
	}
	for (var modelName in modelDescriptions) {
		_createModelProperties(modelName, modelDescriptions[modelName])
	}
}

var _validateModel = function(modelName, properties) {
	var firstLetterCode = modelName.charCodeAt(0)
	assert(65 <= firstLetterCode && firstLetterCode <= 90, 'Model names should start with an upper case letter. "'+modelName+'" does not.')
	assert(!models[modelName], 'Model "'+modelName+'" already exists')
	var propertyIDs = {}
	for (propertyName in properties) {
		firstLetterCode = propertyName.charCodeAt(0)
		var property = properties[propertyName]
		assert(97 <= firstLetterCode && firstLetterCode <= 122, 'Property names should start with a lowercase letter. "'+propertyName+'" does not.')
		assert(typeof property.id == 'number', 'Properties need an id. "'+propertyName+'" does not')
		assert(!propertyIDs[property.id], 'Property IDs need to be unique. "'+modelName+'" has two properties with the id '+property.id+'')
	}
}

var _createModel = function(modelName) {
	models[modelName] = function modelInstantiator() { this._instantiate.apply(this, arguments) }
}

var _createModelProperties = function(modelName, modelProperties) {
	models[modelName].prototype._instantiate = function instantiateModel(instanceProperties) {
		for (var propertyName in modelProperties) {
			var modelProperty = modelProperties[propertyName],
				valueModel = instanceProperties[propertyName]
			if (typeof valueModel == 'object') {
				this[propertyName] = valueModel
			} else {
				this[propertyName] = new rootModels[modelProperty.type](propertyName, modelName, modelProperty.id, modelProperty.type, this, valueModel)
			}
		}
	}
}

// UTILS
function assert(isOK, msg) {
	if (isOK) { return }
	throw new Error(msg)
}

var RootModel = function(propertyName, modelName, propertyID, propertyType, parentModel, value) {
	console.log('Instantiate', propertyType, propertyName, '('+propertyID+')', value, 'for', modelName, parentModel)
	this._value = value
}

var rootModels = {
	"Text": RootModel,
	"Number": RootModel
}
