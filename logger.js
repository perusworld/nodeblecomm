"use strict";

function CircularArray(size) {
	this.buffer = [];
	this.maxSize = size;
};

CircularArray.prototype.push = function (data) {
	if (this.maxSize <= this.buffer.length) {
		this.buffer.shift();
	}
	this.buffer.push(data);
};

CircularArray.prototype.clear = function (data) {
	this.buffer = [];
};

CircularArray.prototype.length = function (data) {
	return this.buffer.length;
};

function SimpleLogger() {
	this.logBuffer = null;
};

SimpleLogger.prototype.init = function (size) {
	this.logBuffer = new CircularArray(size);
};

SimpleLogger.prototype.log = function (msg) {
	this.logBuffer.push({ ts: new Date(), msg: msg });
	console.log(msg);
};

module.exports.CircularArray = CircularArray;
module.exports.SimpleLogger = SimpleLogger;
