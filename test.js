var debug = require('debug')('nodeblecomm:test');
var nodeblecomm = require("./nodeblecomm.js")
var readline = require('readline');

var bleAdapter = new nodeblecomm.SimpleBLEAdapter();
var bleCommLogger = new nodeblecomm.BLECommLogger();

bleCommLogger.init(300);
nodeblecomm.BLECommContext.init(bleCommLogger, bleAdapter);

bleAdapter.init();

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('>');
rl.prompt();
