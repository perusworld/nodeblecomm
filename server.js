"use strict";

var util = require('util');
var bleno = require('bleno');
var merge = require("merge");

var logger = require('./logger');
var protocol = require('./protocol');
var appConfig = require('./config');

var PrimaryService = bleno.PrimaryService;
var Characteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;

function BLECommContext() {
}

BLECommContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function DelayedSender(sender) {
	this.sender = sender;
	this.buf = [];
	this.maxLength = null;
	this.sleepTime = null;
	this.index = 0;
	this.loc = 0;
	this.timerId = null;
}

DelayedSender.prototype.doSend = function (buffer, index, loc) {
	this.sender.sendRaw(buffer.slice(index, loc));
};

DelayedSender.prototype.delayedSend = function () {
	var buffer = this.buf[0];
	this.loc = Math.min(this.index + this.maxLength, buffer.length);
	this.sender.log('Going to send part from ' + this.index + ' to ' + this.loc);
	this.doSend(buffer, this.index, this.loc);
	if (this.loc == buffer.length) {
		this.buf.shift();
		this.index = 0;
		this.loc = 0;
		if (0 < this.buf.length) {
			this.timerId = setTimeout(this.delayedSend.bind(this), this.sleepTime);
		} else {
			this.timerId = null;
		}
	} else {
		this.index = this.loc;
		this.timerId = setTimeout(this.delayedSend.bind(this), this.sleepTime);
	}
};

DelayedSender.prototype.send = function (buffer, maxLength, sleepTime) {
	this.buf.push(buffer);
	if (null === this.timerId) {
		this.maxLength = maxLength;
		this.sleepTime = sleepTime;
		this.index = 0;
		this.loc = 0;
		this.delayedSend();
	}
};

function ProtocolDelayedSender(sender) {
	ProtocolDelayedSender.super_.call(this, sender);
};

util.inherits(ProtocolDelayedSender, DelayedSender);

ProtocolDelayedSender.prototype.doSend = function (buffer, index, loc) {
	this.sender.sendRaw(buffer.slice(index, loc));
	var dataMarker = (index === 0) ? this.sender.conf.protocol.CHUNKED_START : (loc == buffer.length ? this.sender.conf.protocol.CHUNKED_END : this.sender.conf.protocol.CHUNKED);
	this.sender.sendRaw(Buffer.concat([dataMarker, buffer.slice(index, loc), this.sender.conf.protocol.EOM]));
};

function BLEListner(config) {
	this.conf = merge(
		{
			connected: false
		}, appConfig.server.default, config);
	this.conf.staticData = new Buffer(this.conf.desc);

	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleCommService = null;
	this.infoService = null;
	this.onDataCallBack = null;
	this.onConnected = null;
	this.onDisconnected = null;
	this.onReady = null;
};

BLEListner.prototype.log = function (msg) {
	if (null !== BLECommContext.logger) {
		BLECommContext.logger.log(msg);
	}
};

BLEListner.prototype.init = function () {
	this.log('in init');
	this.infoService = appConfig.infoService(this.conf);
	this.writeCharacteristic = new Characteristic({
		uuid: this.conf.tUID,
		properties: ['notify'],
		value: this.conf.staticData,
		onSubscribe: this.onSubscribe.bind(this),
		descriptors: [
			new BlenoDescriptor({
				uuid: this.conf.fUID,
				value: this.conf.features
			})
		]
	});
	this.readCharacteristic = new Characteristic({
		uuid: this.conf.rUID,
		properties: ['writeWithoutResponse'],
		value: this.conf.staticData,
		onWriteRequest: this.onDataFromMobile.bind(this)
	});
	this.bleCommService = new PrimaryService({
		uuid: this.conf.sUID,
		characteristics: [this.readCharacteristic, this.writeCharacteristic]
	});
	bleno.on('stateChange', this.onBleStateChange.bind(this));
	bleno.on('advertisingStart', this.onBleAdvertisingStart.bind(this));
	bleno.on('accept', this.onBleConnect.bind(this));
	bleno.on('disconnect', this.onBleDisconnect.bind(this));
};

BLEListner.prototype.onBleStateChange = function (state) {
	this.log('on -> stateChange: ' + state);
	if (state === 'poweredOn') {
		if (null !== this.onReady) {
			this.onReady();
		}
	} else {
		bleno.stopAdvertising();
	}
};

BLEListner.prototype.start = function () {
	bleno.startAdvertising(this.conf.serviceName, [this.bleCommService.uuid]);
	this.log('advertising ' + this.conf.serviceName);
};

BLEListner.prototype.stop = function (error) {
	bleno.stopAdvertising();
};

BLEListner.prototype.onBleAdvertisingStart = function (error) {
	this.log('Bluetooth on. advertisingStart: ');
	if (error) {
		this.log('error ' + error);
	} else {
		this.log('success');
		bleno.setServices([this.bleCommService, this.infoService], function (serviceError) {
			this.log('Starting services: ');
			if (serviceError) {
				this.log('error ' + serviceError);
			} else {
				this.log('service set.');
			}
		}.bind(this));
	}
};

BLEListner.prototype.onBleConnect = function (clientaddress) {
	this.conf.connected = true;
	this.log('Got a connection');
	if (clientaddress) {
		this.log('from clientaddress ' + clientaddress);
	}
};

BLEListner.prototype.onBleDisconnect = function (clientaddress) {
	this.conf.connected = false;
	this.log('Disconnected connection');
	if (clientaddress) {
		this.log('from clientaddress ' + clientaddress);
	}
	if (null !== this.onDisconnected) {
		this.onDisconnected();
	}
};

BLEListner.prototype.onDataFromMobile = function (data, offset, withoutResponse, callback) {
	if (offset) {
		callback(this.RESULT_ATTR_NOT_LONG);
	} else {
		this.log('Got ' + data.toString());
		if (this.onDataCallBack) {
			this.onDataCallBack(data);
		}
		callback(this.RESULT_SUCCESS);
	}
};

BLEListner.prototype.onSubscribe = function (maxValueSize, updateValueCallback) {
	this.log('Got subscribe call with maxValueSize ' + maxValueSize);
	this.writeCharacteristic.maxValueSize = maxValueSize;
	this.conf.maxLength = maxValueSize;
	this.writeCharacteristic.updateValueCallback = updateValueCallback;
	this.onDeviceConnected();
};

BLEListner.prototype.disconnect = function () {
	this.log('bleno.disconnect()');
	bleno.disconnect();
};

BLEListner.prototype.onDeviceConnected = function () {
	if (null != this.onConnected) {
		this.onConnected();
	}
};

BLEListner.prototype.sendRaw = function (buffer) {
	if (this.conf.connected) {
		this.log('To send ' + buffer.toString());
		if (this.writeCharacteristic && this.writeCharacteristic.updateValueCallback) {
			this.log('Sent ' + buffer.toString());
			this.writeCharacteristic.updateValueCallback(buffer);
		}
	} else {
		this.log('BLE Not Connected, not sending');
	}
};

BLEListner.prototype.send = function (buffer) {
	if (this.conf.connected) {
		if (buffer.length > this.conf.maxLength) {
			new DelayedSender(this).send(buffer, this.conf.maxLength, this.conf.sendDelay);
		} else {
			this.sendRaw(buffer);
		}
	} else {
		this.log('BLE Not Connected, not sending');
	}
};

function SimpleBLEListner(config) {
	SimpleBLEListner.super_.call(this, config);
}

util.inherits(SimpleBLEListner, BLEListner);

function ProtocolBLEListner(config) {
	ProtocolBLEListner.super_.call(this, merge({}, appConfig.server.protocol, config));
	merge(this.conf.protocol, {
		inSync: false,
		dataBuffer: null
	});
	protocol.mergeCommands(this.conf.protocol);
}

util.inherits(ProtocolBLEListner, BLEListner);

ProtocolBLEListner.prototype.onDeviceConnected = function () {
	this.conf.protocol.inSync = false;
	setTimeout(this.doPing.bind(this), this.conf.protocol.pingTimer);
};

ProtocolBLEListner.prototype.doPing = function () {
	this.log('Is in sync ' + this.conf.protocol.inSync);
	if (this.conf.connected) {
		if (!this.conf.protocol.inSync) {
			this.sendRaw(this.conf.protocol.PING_IN);
			setTimeout(this.doPing.bind(this), this.conf.protocol.pingTimer);
		}
	}
};

ProtocolBLEListner.prototype.onDataFromMobile = function (data, offset, withoutResponse, callback) {
	if (offset) {
		callback(this.RESULT_ATTR_NOT_LONG);
	} else {
		this.log('Got ' + data.toString() + " of length " + data.length);
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
					this.log('Got chunk start');
					this.conf.protocol.dataBuffer = data.slice(1, data.length - 2);
					break;
				case this.conf.protocol.COMMAND.CHUNKED_DATA:
					this.log('Got chunk');
					this.conf.protocol.dataBuffer = Buffer.concat([this.conf.protocol.dataBuffer, data.slice(1, data.length - 2)]);
					break;
				case this.conf.protocol.COMMAND.CHUNKED_DATA_END:
					this.log('Got chunk end');
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
		callback(this.RESULT_SUCCESS);
	}
};

ProtocolBLEListner.prototype.pingIn = function () {
	this.log('got ping in');
	this.sendRaw(this.conf.protocol.PING_OUT);
	this.sendRaw(this.conf.protocol.PING_IN);
};

ProtocolBLEListner.prototype.pingOut = function () {
	this.log('got ping out');
	this.conf.protocol.inSync = true;
	if (null !== this.onConnected) {
		this.onConnected();
	}
};

ProtocolBLEListner.prototype.onData = function (data) {
	this.log('got on data ' + data);
	if (null !== this.onDataCallBack) {
		this.onDataCallBack(data);
	}
};

ProtocolBLEListner.prototype.send = function (data) {
	if (this.conf.connected) {
		var len = this.conf.maxLength - 3;
		if (data.length > len) {
			new ProtocolDelayedSender(this).send(data, len, this.conf.sendDelay);
		} else {
			this.sendRaw(Buffer.concat([this.conf.protocol.DATA, data, this.conf.protocol.EOM]));
		}
	} else {
		this.log('BLE Not Connected, not sending');
	}
};

module.exports.BLECommContext = BLECommContext;
module.exports.BLEListner = BLEListner;
module.exports.SimpleBLEListner = SimpleBLEListner;
module.exports.ProtocolBLEListner = ProtocolBLEListner;
module.exports.getBLENO = function () {
	return bleno;
};

module.exports.getLogger = function () {
	return logger;
};
