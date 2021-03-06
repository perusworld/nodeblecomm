var debug = require('debug')('nodeblecomm:test');
var logger = require("./logger")
var nodeblecomm = require("./nodeblecomm").server()
var readline = require('readline');

var bleListner = new nodeblecomm.SimpleBLEListner({});
var simpleLogger = new logger.SimpleLogger();

simpleLogger.init(300);
nodeblecomm.BLECommContext.init(simpleLogger, bleListner);

bleListner.onReady = function () {
	simpleLogger.log('onReady');
	bleListner.start();
};
bleListner.onDataCallBack = function (data) {
	bleListner.send(new Buffer('Got your data ' + data.toString()));
	bleListner.send(new Buffer('data length ' + data.length));
};
bleListner.onConnected = function () {
	simpleLogger.log('onConnected');
};
bleListner.onDisconnected = function () {
	simpleLogger.log('onDisconnected');
};
bleListner.init();

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('>');
rl.prompt();
