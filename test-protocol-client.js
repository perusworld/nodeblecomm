var debug = require('debug')('nodeblecomm:test');
var logger = require("./logger")
var nodeblecomm = require("./nodeblecomm").client()
var readline = require('readline');

var bleConnector = new nodeblecomm.SimpleBLEConnector({
	sUID: 'fff1',
	rUID: 'fff2',
	tUID: 'fff1'
});
var simpleLogger = new logger.SimpleLogger();

simpleLogger.init(300);
nodeblecomm.BLEConnContext.init(simpleLogger, bleConnector);

bleConnector.onReady = function () {
	bleConnector.start();
};
bleConnector.onDataCallBack = function (data) {
	simpleLogger.log('onDataCallBack ' + data);
};
bleConnector.onConnected = function () {
	simpleLogger.log('onConnected');
	simpleLogger.log('in sync now sending welcome message');
	bleConnector.send(new Buffer("Welcome Message"));
};
bleConnector.onDisconnected = function () {
	simpleLogger.log('onDisconnected');
};
bleConnector.init();

var rl = readline.createInterface(process.stdin, process.stdout);
rl.on('line', function (input) {
	if (input == 'start') {
		bleConnector.start();
	} else if (input == 'stop') {
		bleConnector.stop();
	} else if (input == 'exit') {
		bleConnector.stop();
		rl.close();
		process.exit(0);
	} else {
		bleConnector.send(new Buffer(input));
	}
});
rl.setPrompt('>');
rl.prompt();

