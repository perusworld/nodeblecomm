var debug = require('debug')('nodeblecomm:test');
var logger = require("./logger")
var nodeblecomm = require("./nodeblecomm").client()
var readline = require('readline');

var bleConnector = new nodeblecomm.SimpleBLEConnector('fff0', 'fff1', 'fff2');
var simpleLogger = new logger.SimpleLogger();

simpleLogger.init(300);
nodeblecomm.BLEConnContext.init(simpleLogger, bleConnector);

bleConnector.onReady = function () {
	bleConnector.start();
};
bleConnector.onDataCallBack = function (data) {
};
bleConnector.onConnected = function (data) {
	bleConnector.send(new Buffer("Welcome Message"));
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

