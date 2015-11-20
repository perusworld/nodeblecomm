var debug = require('debug')('nodeblecomm:test');
var logger = require("./logger")
var nodeblecomm = require("./nodeblecomm").server()
var readline = require('readline');

var bleListner = new nodeblecomm.SimpleBLEListner({
	sUID: 'fff0',
	rUID: 'fff1',
	tUID: 'fff2'
});
var simpleLogger = new logger.SimpleLogger();

simpleLogger.init(300);
nodeblecomm.BLECommContext.init(simpleLogger, bleListner);

bleListner.onReady = function () {
	simpleLogger.log('onReady');
	bleListner.start();
};
bleListner.onDataCallBack = function (data) {
	simpleLogger.log('onDataCallBack' + data);
};
bleListner.onConnected = function () {
	simpleLogger.log('onConnected');
};
bleListner.onDisconnected = function () {
	simpleLogger.log('onDisconnected');
};
bleListner.init();

var rl = readline.createInterface(process.stdin, process.stdout);
rl.on('line', function (input) {
	if (input == 'start') {
		bleListner.start();
	} else if (input == 'stop') {
		bleListner.disconnect();
		bleListner.stop();
	} else if (input == 'exit') {
		bleListner.stop();
		rl.close();
		process.exit(0);
	} else {
		bleListner.send(new Buffer(input));
	}
});
rl.setPrompt('>');
rl.prompt();

