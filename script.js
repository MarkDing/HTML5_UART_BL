var gui = require('nw.gui');
var fs = require('fs');
var clipboard = gui.Clipboard.get();

function openFileOption() {
	document.getElementById("openFile").click();
}

// onload = function() {
// 	openButton = document.getElementById('openHexFile');
// 	openButton.onClick(openFileOption());

// //	openButton.addEventListener('click', openFileOption);
// };

//onclick=openFileOption()