var fs = require('fs');
var hexParse = require('./intel-hex');
const FLASH_SIZE = 32768;
const FLASH_PAGE_SIZE = 512; // 1024
const FLASH_PAGE_NUM = (FLASH_SIZE / FLASH_PAGE_SIZE);

function handleFiles(files) {
	fs.readFile(files[0].name, 'utf8', function(err,data) {
		if (err) throw err;
		//console.log(data);
		var hex = hexParse.parse(data);
		for (i = 0; i < FLASH_PAGE_NUM; i++) {
			if (hex.pageInUse[i] == 1) {
				var addr = i * FLASH_PAGE_SIZE;
				var tmp = new Buffer(FLASH_PAGE_SIZE);
				//var tmp = new Array(FLASH_PAGE_SIZE);
				hex.data.copy(tmp, 0, addr, addr + FLASH_PAGE_SIZE);
				console.log(tmp);
			}
		}
	});
}

function openFileOption() {
	document.getElementById("openFile").click();
}

