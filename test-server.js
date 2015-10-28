var debug = require('debug')('nodeblecomm:test');
var logger = require("./logger")
var nodeblecomm = require("./nodeblecomm").server
var readline = require('readline');

var bleListner = new nodeblecomm.SimpleBLEListner('fff0', 'fff1', 'fff2');
var simpleLogger = new logger.SimpleLogger();

simpleLogger.init(300);
nodeblecomm.BLECommContext.init(simpleLogger, bleListner);

bleListner.init();
bleListner.onDataCallBack = function(data) {
	bleListner.sendToMobile(new Buffer('Got your data ' + data.toString()));
	bleListner.sendToMobile(new Buffer('data length ' + data.length));
};

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('>');
rl.prompt();
