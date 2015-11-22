"use strict";

var util = require('util');
var merge = require("merge");

var protocol = require('./protocol');
var appConfig = require('./config');

function ClientDataHandler(connector) {
	this.connector = connector;
};

ClientDataHandler.prototype.log = function (msg) {
	this.connector.log(msg);
};

ClientDataHandler.prototype.notificationsSet = function () {
	if (null != this.connector.onConnected) {
		this.connector.onConnected();
	}
};

ClientDataHandler.prototype.onReadData = function (data, isNotification) {
	this.log('got data ' + data.toString() + ', ' + isNotification);
	if (null != this.connector.onDataCallBack) {
		this.connector.onDataCallBack(data);
	}
};

ClientDataHandler.prototype.send = function (buffer) {
	if (buffer.length > this.connector.conf.maxLength) {
		for (var index = 0; index < buffer.length; index = index + this.connector.conf.maxLength) {
			this.log('Going to send part from ' + index + ' to ' + Math.min(index + this.connector.conf.maxLength, buffer.length));
			this.connector.sendRaw(buffer.slice(index, Math.min(index + this.connector.conf.maxLength, buffer.length)));
		}
	} else {
		this.connector.sendRaw(buffer);
	}
};

function SimpleClientDataHandler(connector) {
	SimpleClientDataHandler.super_.call(this, connector);
};

util.inherits(SimpleClientDataHandler, ClientDataHandler);

function ProtocolClientDataHandler(connector) {
	ProtocolClientDataHandler.super_.call(this, connector);
	this.conf = merge({}, appConfig.server.protocol);
	merge(this.conf.protocol, {
		inSync: false,
		dataBuffer: null
	});
	protocol.mergeCommands(this.conf.protocol);
};

util.inherits(ProtocolClientDataHandler, ClientDataHandler);

ProtocolClientDataHandler.prototype.notificationsSet = function () {
};

ProtocolClientDataHandler.prototype.onReadData = function (data, isNotification) {
	this.log('got data ' + data.toString() + ', ' + isNotification);
	if (this.conf.protocol.COMMAND.EOM_FIRST == data[data.length - 2] &&
		this.conf.protocol.COMMAND.EOM_SECOND == data[data.length - 1]) {
		switch (data[0]) {
			case this.conf.protocol.COMMAND.PING_IN:
				this.pingIn();
				break;
			case this.conf.protocol.COMMAND.PING_OUT:
				this.pingOut();
				break;
			case this.conf.protocol.COMMAND.DATA:
				this.onData(data.slice(1, data.length - 2));
				break;
			case this.conf.protocol.COMMAND.CHUNKED_DATA_START:
				this.conf.protocol.dataBuffer = data.slice(1, data.length - 2);
				break;
			case this.conf.protocol.COMMAND.CHUNKED_DATA:
				this.conf.protocol.dataBuffer = Buffer.concat([this.conf.protocol.dataBuffer, data.slice(1, data.length - 2)]);
				break;
			case this.conf.protocol.COMMAND.CHUNKED_DATA_END:
				this.conf.protocol.dataBuffer = Buffer.concat([this.conf.protocol.dataBuffer, data.slice(1, data.length - 2)]);
				this.onData(this.conf.protocol.dataBuffer);
				this.conf.protocol.dataBuffer = null;
				break;
			default:
				this.log('unknown ' + data[0].toString(16));
				break;
		}
	} else {
		this.log('invalid protocol markers');
	}
};

ProtocolClientDataHandler.prototype.pingIn = function () {
	this.log('got ping in');
	this.connector.sendRaw(this.conf.protocol.PING_OUT);
	if (null != this.connector.onConnected) {
		this.connector.onConnected();
	}
};

ProtocolClientDataHandler.prototype.pingOut = function () {
	this.log('got ping out');
	//noop
};

ProtocolClientDataHandler.prototype.onData = function (data) {
	this.log('got on data ' + data);
	if (null != this.connector.onDataCallBack) {
		this.connector.onDataCallBack(data);
	}
};

ProtocolClientDataHandler.prototype.send = function (data) {
	if (data.length > this.connector.conf.maxLength) {
		var toIndex = 0;
		var dataMarker = this.conf.protocol.CHUNKED;
		for (var index = 0; index < data.length; index = index + this.connector.conf.maxLength) {
			toIndex = Math.min(index + this.connector.conf.maxLength, data.length);
			this.log('Going to send part from ' + index + ' to ' + toIndex);
			dataMarker = (index == 0) ? this.conf.protocol.CHUNKED_START : (toIndex == data.length ? this.conf.protocol.CHUNKED_END : this.conf.protocol.CHUNKED);
			this.connector.sendRaw(Buffer.concat([dataMarker, data.slice(index, toIndex), this.conf.protocol.EOM]));
		}
	} else {
		this.connector.sendRaw(Buffer.concat([this.conf.protocol.DATA, data, this.conf.protocol.EOM]));
	}
};

module.exports.ClientDataHandlerMode = {
	simple: 'simple',
	protocol: 'protocol'
};
module.exports.ClientDataHandler = ClientDataHandler;
module.exports.SimpleClientDataHandler = SimpleClientDataHandler;
module.exports.ProtocolClientDataHandler = ProtocolClientDataHandler;
