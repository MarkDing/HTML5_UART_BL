var fs = require('fs');

function handleFiles(files) {
	fs.readFile(files[0].name, 'utf8', function(err,data) {
		if (err) throw err;
		console.log(data);
	});
}

function openFileOption() {
	document.getElementById("openFile").click();
}

