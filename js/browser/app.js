jsio.path.common = 'js';
jsio.path.browser = 'js';

jsio('from common.javascript import bind');
jsio('import net, logging');
jsio('import common.itemFactory');

jsio('import browser.dimensions as dimensions');
jsio('import browser.events as events');
jsio('import browser.css as css');

jsio('import browser.Client');
jsio('import browser.Drawer');
jsio('import browser.PanelManager');
jsio('import browser.resizeManager');
jsio('import browser.LabelCreator');

jsio('import browser.overlay');

jsio('import browser.Meebo as Meebo');

css.loadStyles('browser.app');

gClient = new browser.Client();
gPanelManager = new browser.PanelManager();
gDrawer = new browser.Drawer();
gCreateLabelFn = function() {
	var labelCreator = new browser.LabelCreator(function(labelName){
		gDrawer.addLabel(labelName);
		browser.overlay.hide();
	});
	browser.overlay.show(labelCreator.getElement());
}

gPanelManager.subscribe('PanelFocused', function(panel) {
	var item = panel.getItem();
	document.location.hash = '#/panel/' + item.getType() + '/' + item.getId();
})

gClient.connect('csp', "http://" + (document.domain || "127.0.0.1") + ":5555", function(){

	document.body.appendChild(gPanelManager.getElement());
	document.body.appendChild(gDrawer.getElement());
	
	gDrawer.subscribe('LabelClick', bind(gPanelManager, 'showLabel'));
	browser.resizeManager.onWindowResize(function(size) {
		var drawerSize = gDrawer.layout();
		gPanelManager.setOffset(drawerSize.width + 50);
		gPanelManager.layout({ width: size.width, height: size.height - 100 });
	});
	
	Meebo('addButton', { label: 'Create item', onClick: function() {
		var type = prompt('What type of item should I create? (user, bug)');
		gClient.createItem(type, bind(gPanelManager, 'showItem'));
	} });

	Meebo('addButton', { label: 'Create label', onClick: gCreateLabelFn });
	
	(function(){
		var parts = document.location.hash.substr(2).split('/')
		if (parts[0] == 'panel') {
			var item = common.itemFactory.getItem(parts[2]);
			item.setType(parts[1]);
			gPanelManager.showItem(item);
		} else {
			gDrawer.focus();
		}
	})()
});

