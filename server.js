"use strict";

var util = require('util');
var bleno = require('bleno');
var logger = require('./logger');

var PrimaryService = bleno.PrimaryService;
var Characteristic = bleno.Characteristic;

function BLECommContext() {
};

BLECommContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function BLEListner(sUID, rUID, tUID) {
	this.conf = {
		serviceName: "BLEComm",
		staticData: new Buffer("BLEComm"),
		sUID: sUID,
		rUID: rUID,
		tUID: tUID,
		maxLength: 100,
		connected: false
	};
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleCommService = null;
	this.onDataCallBack = null;
	this.onConnected = null;
	this.onDisconnected = null;
	this.onReady = null;
};

BLEListner.prototype.log = function (msg) {
	if (null != BLECommContext.logger) {
		BLECommContext.logger.log(msg);
	}
};

BLEListner.prototype.init = function () {
	this.log('in init');
	this.writeCharacteristic = new Characteristic({
		uuid: this.conf.tUID,
		properties: ['notify'],
		value: this.conf.staticData,
		onSubscribe: this.onSubscribe.bind(this)
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
		if (null != this.onReady) {
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
		bleno.setServices([this.bleCommService], function (serviceError) {
			this.log('Starting services: ')
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
	if (null != this.onDisconnected) {
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
	this.writeCharacteristic.updateValueCallback = updateValueCallback;
	this.onDeviceConnected();
};

BLEListner.prototype.disconnect = function () {
	this.log('bleno.disconnect()');
	bleno.disconnect();
};

BLEListner.prototype.onDeviceConnected = function () {
	if (null != this.onConnect) {
		this.onConnect();
	}
};

BLEListner.prototype.sendRaw = function (buffer) {
	this.log('To send ' + buffer.toString());
	if (this.writeCharacteristic && this.writeCharacteristic.updateValueCallback) {
		this.log('Sent ' + buffer.toString());
		this.writeCharacteristic.updateValueCallback(buffer);
	}
};

BLEListner.prototype.send = function (buffer) {
	if (buffer.length > this.conf.maxLength) {
		for (var index = 0; index < buffer.length; index = index + this.conf.maxLength) {
			this.log('Going to send part from ' + index + ' to ' + Math.min(index + this.conf.maxLength, buffer.length));
			this.sendRaw(buffer.slice(index, Math.min(index + this.conf.maxLength, buffer.length)));
		}
	} else {
		this.sendRaw(buffer);
	}
};

function SimpleBLEListner(sUID, rUID, tUID) {
	SimpleBLEListner.super_.call(this);
	this.conf.sUID = sUID;
	this.conf.rUID = rUID;
	this.conf.tUID = tUID;
};

util.inherits(SimpleBLEListner, BLEListner);

function ProtocolBLEListner(sUID, rUID, tUID) {
	ProtocolBLEListner.super_.call(this);
	this.conf.sUID = sUID;
	this.conf.rUID = rUID;
	this.conf.tUID = tUID;
	this.conf.protocol = {
		inSync: false,
		COMMAND: {
			PING_IN: 0xCC, PING_OUT: 0xDD, DATA: 0xEE, CHUNKED_DATA_START: 0xEB, CHUNKED_DATA: 0xEC, CHUNKED_DATA_END: 0xED, EOM_FIRST: 0xFE, EOM_SECOND: 0xFF
		},
		pingTimer: 1000,
		dataBuffer: null
	}
	this.conf.protocol.DATA = new Buffer([this.conf.protocol.COMMAND.DATA]);
	this.conf.protocol.CHUNKED_START = new Buffer([this.conf.protocol.COMMAND.CHUNKED_DATA_START]);
	this.conf.protocol.CHUNKED = new Buffer([this.conf.protocol.COMMAND.CHUNKED_DATA]);
	this.conf.protocol.CHUNKED_END = new Buffer([this.conf.protocol.COMMAND.CHUNKED_DATA_END]);
	this.conf.protocol.EOM = new Buffer([this.conf.protocol.COMMAND.EOM_FIRST, this.conf.protocol.COMMAND.EOM_SECOND]);
	this.conf.protocol.PING_IN = Buffer.concat([new Buffer([this.conf.protocol.COMMAND.PING_IN]), this.conf.protocol.EOM]);
	this.conf.protocol.PING_OUT = Buffer.concat([new Buffer([this.conf.protocol.COMMAND.PING_OUT]), this.conf.protocol.EOM]);
	this.onSync = null;
};

util.inherits(ProtocolBLEListner, BLEListner);

ProtocolBLEListner.prototype.onDeviceConnected = function () {
	this.conf.protocol.inSync = false;
	if (null != this.onConnect) {
		this.onConnect();
	}
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
	if (null != this.onSync) {
		this.onSync();
	}
};

ProtocolBLEListner.prototype.onData = function (data) {
	this.log('got on data ' + data);
	if (null != this.onDataCallBack) {
		this.onDataCallBack(data);
	}
};

ProtocolBLEListner.prototype.send = function (data) {
	if (data.length > this.conf.maxLength) {
		var toIndex = 0;
		var dataMarker = this.conf.protocol.CHUNKED;
		for (var index = 0; index < data.length; index = index + this.conf.maxLength) {
			toIndex = Math.min(index + this.conf.maxLength, data.length);
			this.log('Going to send part from ' + index + ' to ' + toIndex);
			dataMarker = (index == 0) ? this.conf.protocol.CHUNKED_START : (toIndex == data.length ? this.conf.protocol.CHUNKED_END : this.conf.protocol.CHUNKED);
			this.sendRaw(Buffer.concat([dataMarker, data.slice(index, toIndex), this.conf.protocol.EOM]));
		}
	} else {
		this.sendRaw(Buffer.concat([this.conf.protocol.DATA, data, this.conf.protocol.EOM]));
	}
};

module.exports.BLECommContext = BLECommContext;
module.exports.BLEListner = BLEListner;
module.exports.SimpleBLEListner = SimpleBLEListner;
module.exports.ProtocolBLEListner = ProtocolBLEListner;
