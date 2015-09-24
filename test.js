var debug = require('debug')('nodeblecomm:test');
var nodeblecomm = require("./nodeblecomm.js")
var readline = require('readline');

var bleAdapter = new nodeblecomm.SimpleBLEAdapter('00000000-0000-1000-8000-00805F9B34FB', '00000001-0000-1000-8000-00805F9B34FB', '00000002-0000-1000-8000-00805F9B34FB');
var bleCommLogger = new nodeblecomm.BLECommLogger();

bleCommLogger.init(300);
nodeblecomm.BLECommContext.init(bleCommLogger, bleAdapter);

bleAdapter.init();
bleAdapter.onDataCallBack = function(data) {
	bleAdapter.sendToMobile(new Buffer('Got your data ' + data.toString()));
};

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('>');
rl.prompt();
