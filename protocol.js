"use strict";

var commandDef = {
	PING_IN: 0xCC, PING_OUT: 0xDD, DATA: 0xEE, CHUNKED_DATA_START: 0xEB, CHUNKED_DATA: 0xEC, CHUNKED_DATA_END: 0xED, EOM_FIRST: 0xFE, EOM_SECOND: 0xFF
}

var eom = new Buffer([commandDef.EOM_FIRST, commandDef.EOM_SECOND]);

module.exports = {

	command: commandDef,

	mergeCommands: function (obj) {
		obj.DATA = new Buffer([commandDef.DATA]);
		obj.CHUNKED_START = new Buffer([commandDef.CHUNKED_DATA_START]);
		obj.CHUNKED = new Buffer([commandDef.CHUNKED_DATA]);
		obj.CHUNKED_END = new Buffer([commandDef.CHUNKED_DATA_END]);
		obj.EOM = eom;
		obj.PING_IN = Buffer.concat([new Buffer([commandDef.PING_IN]), eom]);
		obj.PING_OUT = Buffer.concat([new Buffer([commandDef.PING_OUT]), eom]);
	}

};