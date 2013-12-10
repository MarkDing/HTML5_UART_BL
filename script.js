var fs = require('fs');
var hexParse = require('./intel-hex');
var serialport = require('serialport');

var hex;
var textArea = document.getElementById('textArea');
var infoTable = document.getElementById('infoBlock');
var serialPort;

var firmwareStartAddress = 0,
	firmwareEndAddress = 0;

var FLASH_SIZE = 8192;
var FLASH_PAGE_SIZE = 512; // 1024
var FLASH_PAGE_NUM = (FLASH_SIZE / FLASH_PAGE_SIZE);

/* Record page address which store firmware */
var pageAddress = [];
var pageIdx = 0;
var pageEnd = 0;
/**
 * It display hex file info block into table.
 * @param  {[Buffer]} tmp [The flash page which contains info block]
 * @return none
 */
function infoBlockDisplay(tmp) {
	// MCU code
	infoTable.rows[1].cells[1].innerHTML = '0x' + tmp[FLASH_PAGE_SIZE - 6].toString(16);
	// BL type
	if (tmp[FLASH_PAGE_SIZE - 7] == 1) {
		infoTable.rows[2].cells[1].innerHTML = 'UART';
	}
	// Flash page size
	if (tmp[FLASH_PAGE_SIZE - 8] == 2) {
		infoTable.rows[3].cells[1].innerHTML = '1024';
	} else if (tmp[FLASH_PAGE_SIZE - 8] == 1) {
		infoTable.rows[3].cells[1].innerHTML = '512';
	}
	// App FW Version
	var ver_high = tmp[FLASH_PAGE_SIZE - 10].toString();
	var ver_low = tmp[FLASH_PAGE_SIZE - 9].toString();
	infoTable.rows[4].cells[1].innerHTML = ver_high + '.' + ver_low;
	// Reserved
	infoTable.rows[5].cells[1].innerHTML = '0x' + tmp[FLASH_PAGE_SIZE - 11].toString(16);
	// App Start Addr
	infoTable.rows[6].cells[1].innerHTML = firmwareStartAddress;
	// App End Addr
	infoTable.rows[7].cells[1].innerHTML = firmwareEndAddress;
}

/**
 * it read hex file and call hexParse to parse it. It get firmware start address
 * and end address from return messages.
 * @param  files: selected file name
 * @return none
 */
function handleFiles(files) {
	fs.readFile(files[0].name, 'utf8', function (err, data) {
		if (err) throw err;
		hex = hexParse.parse(data);

		var tmp = new Buffer(FLASH_PAGE_SIZE);
		for (i = 0; i < FLASH_PAGE_NUM; i++) {
			if (hex.pageInUse[i] == 1) {
				var addr = i * FLASH_PAGE_SIZE;
				pageAddress[pageEnd++] = addr;
				if (firmwareStartAddress === 0) {
					firmwareStartAddress = '0x' + addr.toString(16);
				}
				firmwareEndAddress = '0x' + (addr + FLASH_PAGE_SIZE - 1).toString(16);
				hex.data.copy(tmp, 0, addr, addr + FLASH_PAGE_SIZE);
			}
		}
		/* We got correct firmware image from hex file */
		infoBlockDisplay(tmp);
	});
}

function openFileOption() {
	document.getElementById("openFile").click();
}


/**
 * It list all COM port in system, and add them in dropdown list as new option.
 * @return none
 */
function serialPortList() {
	serialport.list(function (err, ports) {
		var coms = [];
		var cnt = 0;
		ports.forEach(function (port) {
			coms[cnt++] = port.comName;
		});
		coms.sort();

		var comPortInput = document.getElementById('comPort');
		coms.forEach(function (com) {
			var option = document.createElement('option');
			option.text = com;
			comPortInput.add(option, null);
		});
	});
}

/**
 * It checks dropdown list, get selected COM port, open the COM port, it output error message
 * to text area when error occupied.
 * @return none
 */
function serialPortOpen() {
	var comPortInput = document.getElementById('comPort');
	var comSelected = comPortInput.options[comPortInput.selectedIndex].text;
	var tmp = textArea.value;

	console.log(comSelected);
	/* We should open the hex file before open serial port*/
	if (firmwareEndAddress === 0) {
		textArea.value = tmp + 'Please open Hex file before open COM port\n';
		return;
	}

	var SerialPort = serialport.SerialPort;

	serialPort = new SerialPort(comSelected, {
		baudrate: 115200,
		dataBits: 8,
		parity: 'none',
		stopBits: 1,
		flowControl: false
	}, false);

	serialPort.open(function (err) {
		if (err) {
			tmp = textArea.value + err + '\n';
			textArea.value = tmp;
			return;
		}
		tmp = tmp + 'Port opened: ' + comSelected + '\n';
		tmp = tmp + 'Waiting for commands from the Master MCU...\n';
		textArea.value = tmp;
	});

	serialPort.on('data', function (data) {
		serialListener(data);
	});
}

/* Data Source Commands */
var SRC_CMD_GET_INFO = 0x80;
var SRC_CMD_GET_PAGE_INFO = 0x81;
var SRC_CMD_GET_PAGE = 0x82;
var SRC_CMD_DISP_TGT_INFO = 0x83;
var SRC_CMD_DISP_INFO_CODE = 0x84;

/* Data Source Response Codes */
var SRC_RSP_OK = 0x70;
var SRC_RSP_ERROR = 0x71;
var SRC_RSP_DATA_END = 0x72;
var SRC_RSP_UNKNOWN_CMD = 0x73;

function serialListener(data) {
	console.log('CMD:', data[0].toString(16));
	switch (data[0]) {
	case SRC_CMD_DISP_TGT_INFO:
		// console.log('SRC_CMD_DISP_TGT_INFO');
		targetInfoHandle(data);
		break;
	case SRC_CMD_GET_INFO:
		// console.log('SRC_CMD_GET_INFO');
		srcInfoHandle();
		break;
	case SRC_CMD_GET_PAGE_INFO:
		srcGetPageInfo();
		break;
	case SRC_CMD_GET_PAGE:
		srcGetPage();
		break;
	default:
		console.log('I cannot understand the message');
		break;
	}
}

function srcGetPage() {
	var SRC_CMD_GET_PAGE_RX_SZ = FLASH_PAGE_SIZE;
	var tmp = new Buffer(FLASH_PAGE_SIZE);
	var addr = pageAddress[pageIdx++];
	hex.data.copy(tmp, 0, addr, addr + FLASH_PAGE_SIZE);

	textArea.value += 'Received Command "GetPage" [0x82]\n';
	var txBuffer = [SRC_RSP_OK];
	serialPort.write(txBuffer);
	serialPort.write(tmp);
	serialPort.write(txBuffer);
}


/**
 * It send page address to target
 * @return none
 */
function srcGetPageInfo() {
	var SRC_CMD_GET_PAGE_INFO_RX_SZ = 6;
	var txBuffer = [SRC_RSP_OK, 0, 0, 0, 0, 0];
	txBuffer[1] = pageAddress[pageIdx] % 256;
	txBuffer[2] = pageAddress[pageIdx] / 256;

	textArea.value += 'Received Command "GetPageInfo" [0x81]\n';

	if (pageIdx == pageEnd) {
		pageIdx = 0;
		txBuffer[0] = SRC_RSP_DATA_END;
		textArea.value += 'Bootload process completed successfully!\n';
		textArea.value += 'Waiting for commands from the Master MCU...\n\n';
	}
	serialPort.write(txBuffer);
}

/**
 * It send flash key to target
 * @return None
 */
function srcInfoHandle() {
	var SRC_CMD_GET_INFO_RX_SZ = 14;
	/* Target only handle response code and flash key0 and key1*/
	var txBuffer = [SRC_RSP_OK, 0, 0, 0, 0, 0xA5, 0xF1, 0, 0, 0, 0, 0, 0, 0];
	textArea.value += 'Starting the bootload process...\nReceived Command "GetHexImageInfo" [0x80]\n';
	serialPort.write(txBuffer);
}

/**
 * Get target information and display it on table
 * @param  data received from uart.
 * @return none
 */
function targetInfoHandle(data) {
	var TGT_BL_FW_INFOBLOCK_LENGTH = 19;
	// console.log(data.length);
	/* MCU code */
	infoTable.rows[1].cells[2].innerHTML = '0x' + data[4].toString(16);
	/* BL type */
	if (data[5] == 1) {
		infoTable.rows[2].cells[2].innerHTML = 'UART';
	}
	/* Flash page size */
	if (data[6] == 2) {
		infoTable.rows[3].cells[2].innerHTML = '1024';
	} else if (data[6] == 1) {
		infoTable.rows[3].cells[2].innerHTML = '512';
	}
	/* App FW Version */
	infoTable.rows[4].cells[2].innerHTML = data[3].toString() + '.' + data[2].toString();
	/* Reserved */
	infoTable.rows[5].cells[2].innerHTML = '0x' + data[16].toString(16);
	/* App Start Addr */
	infoTable.rows[6].cells[2].innerHTML = '0x' + (data[12] * 65536 + data[11] * 256 + data[10]).toString(16);
	/* App End Addr */
	infoTable.rows[7].cells[2].innerHTML = '0x' + (data[15] * 65536 + data[14] * 256 + data[13]).toString(16);
	/* BL FW Version */
	infoTable.rows[8].cells[2].innerHTML = data[3].toString() + '.' + data[2].toString();
	/* BL Buffer Size */
	infoTable.rows[9].cells[2].innerHTML = 512;
	/* CRC Type */
	infoTable.rows[10].cells[2].innerHTML = 'CRC-16';

	/* Send back response ok to target */
	var txBuffer = [SRC_RSP_OK];
	serialPort.write(txBuffer);

	/* Output message to text area*/
	var tmp = textArea.value;
	tmp += 'Received Command "Display TargetInfo" [0x83]\n';
	tmp += 'Received Target MCU Information\nSee table for details.\n\n';
	tmp += 'Click the "Update Application Firmware" button to continue\n\n';
	textArea.value = tmp;
}


/*
Starting the bootload process...

Received Command 'GetHexImageInfo' [0x80]
Received Command 'GetPageInfo' [0x81]
Received Command 'GetPage' [0x82]
Received Command 'GetPageInfo' [0x81]
Received Command 'GetPage' [0x82]
Received Command 'GetPageInfo' [0x81]

Bootload process completed successfully!

Waiting for commands from the Master MCU...
*/

window.onload = main();

/**
 * main entry of javascript, initialize nessary stuffs
 * @return none
 */
function main() {
	var textArea = document.getElementById('textArea');
	textArea.value = 'Silicon Labs MCU Serial Bootloader DataSource v0.1.textarea\nPlease select a Hex file and then open the COM port.\n';
	serialPortList();
}