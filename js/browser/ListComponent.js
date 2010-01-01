jsio('from common.javascript import Class, bind');

jsio('import browser.css as css');
jsio('import browser.events as events');

jsio('import browser.keystrokeManager');
jsio('import browser.itemFocus');

exports = Class(function(supr){
	
	this.init = function(itemSelectedCallback) {
		this._itemSelectedCallback = itemSelectedCallback;
		this._items = [];
		this._focusIndex = 0;
		this._keyMap = { 
			'j': bind(this, '_moveFocus', 1), 
			'k': bind(this, '_moveFocus', -1),
			'up arrow': bind(this, '_moveFocus', 1), 
			'down arrow': bind(this, '_moveFocus', -1),
			'enter': bind(this, '_selectFocusedItem')
		}
	}
	
	this.focus = function() { 
		this._keystrokeHandle = browser.keystrokeManager.handleKeys(this._keyMap); 
	}
	
	this.blur = function() { 
		browser.itemFocus.removeFrom(this._items[this._focusIndex]);
	}
	
	this.addItem = function(item) {
		this._items.push(item);
		var el = item.getElement();
		if (this._items.length == 1) { this._focusOn(item); }
		events.add(el, 'click', bind(this, '_selectItem', item));
	}
	
	this.getFocusedItem = function() { return this._items[this._focusIndex]; }
	
	this._moveFocus = function(steps) {
		var newFocusIndex = this._focusIndex + steps;
		if (newFocusIndex < 0 || newFocusIndex >= this._items.length) { return; }
		this._focusIndex = newFocusIndex;
		this._focusOn(this._items[this._focusIndex]);
	}
	
	this._focusOn = function(item) {
		browser.itemFocus.showAt(item);
	}
	
	this._selectFocusedItem = function() { this._selectItem(this._items[this._focusIndex]); }
	this._selectItem = function(item) { 
		if (this._selectedItem) { this._selectedItem.removeClassName('selected'); }
		this._selectedItem = item;
		item.addClassName('selected');
		this._itemSelectedCallback(item);
	}
})