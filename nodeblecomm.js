"use strict";

var util = require('util');
var bleno = require('bleno');

var PrimaryService = bleno.PrimaryService;
var Characteristic = bleno.Characteristic;

function BLECommContext() {

};

BLECommContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

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

function BLECommLogger() {
	this.logBuffer = null;
};

BLECommLogger.prototype.init = function (size) {
	this.logBuffer = new CircularArray(size);
};

BLECommLogger.prototype.log = function (msg) {
	this.logBuffer.push({ ts: new Date(), msg: msg });
	console.log(msg);
};

function BLEAdapter(sUID, rUID, tUID) {
	this.conf = {
		serviceName: "BLEComm",
		staticData: new Buffer("BLEComm"),
		sUID: sUID,
		rUID: rUID,
		tUID: tUID
	};
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleCommService = null;
	this.onDataCallBack = null;
};

BLEAdapter.prototype.log = function (msg) {
	if (null != BLECommContext.logger) {
		BLECommContext.logger.log(msg);
	}
};

BLEAdapter.prototype.init = function () {
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

BLEAdapter.prototype.onBleStateChange = function (state) {
	this.log('on -> stateChange: ' + state);
	if (state === 'poweredOn') {
		bleno.startAdvertising(this.conf.serviceName, [this.bleCommService.uuid]);
		this.log('advertising ' + this.conf.serviceName);
	} else {
		bleno.stopAdvertising();
	}
};

BLEAdapter.prototype.onBleAdvertisingStart = function (error) {
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

BLEAdapter.prototype.onBleConnect = function (clientaddress) {
	this.log('Got a connection');
	if (clientaddress) {
		this.log('from clientaddress ' + clientaddress);
	}
};

BLEAdapter.prototype.onBleDisconnect = function (clientaddress) {
	this.log('Disconnected connection');
	if (clientaddress) {
		this.log('from clientaddress ' + clientaddress);
	}
};

BLEAdapter.prototype.onDataFromMobile = function (data, offset, withoutResponse, callback) {
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

BLEAdapter.prototype.onSubscribe = function (maxValueSize, updateValueCallback) {
	this.log('Got subscribe call');
	this.writeCharacteristic.maxValueSize = maxValueSize;
	this.writeCharacteristic.updateValueCallback = updateValueCallback;
	this.onConnected();
};

BLEAdapter.prototype.disconnect = function () {
	this.log('bleno.disconnect()');
	bleno.disconnect();
};

BLEAdapter.prototype.onConnected = function () {
};

BLEAdapter.prototype.sendToMobile = function (buffer) {
	this.log('To send ' + buffer.toString());
	if (this.writeCharacteristic && this.writeCharacteristic.updateValueCallback) {
		this.log('Sent ' + buffer.toString());
		this.writeCharacteristic.updateValueCallback(buffer);
	}
};

function SimpleBLEAdapter(sUID, rUID, tUID) {
	SimpleBLEAdapter.super_.call(this);
	this.conf.sUID = sUID;
	this.conf.rUID = rUID;
	this.conf.tUID = tUID;
};

util.inherits(SimpleBLEAdapter, BLEAdapter);

function ProtocolBLEAdapter() {
	SimpleBLEAdapter.super_.call(this);
	this.conf.protocol = {
		inSync: false,
		COMMAND: {
			PING_IN: 0xCC, PING_OUT: 0xDD, DATA: 0xEE, EOM_FIRST: 0xFE, EOM_SECOND: 0xFF
		}
	}
	this.conf.protocol.DATA = new Buffer([this.conf.protocol.COMMAND.DATA]);
	this.conf.protocol.EOM = new Buffer([this.conf.protocol.COMMAND.EOM_FIRST, this.conf.protocol.COMMAND.EOM_SECOND]);
	this.conf.protocol.PING_IN = Buffer.concat([new Buffer([this.conf.protocol.COMMAND.PING_IN]), this.conf.protocol.EOM]);
	this.conf.protocol.PING_OUT = Buffer.concat([new Buffer([this.conf.protocol.COMMAND.PING_OUT]), this.conf.protocol.EOM]);
};

util.inherits(ProtocolBLEAdapter, BLEAdapter);

ProtocolBLEAdapter.prototype.onConnected = function () {
	if (!this.conf.protocol.inSync) {
		this.sendToMobile(this.conf.protocol.PING_IN);
	}
};

ProtocolBLEAdapter.prototype.onDataFromMobile = function (data, offset, withoutResponse, callback) {
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

ProtocolBLEAdapter.prototype.pingIn = function () {
	this.log('got ping in');
	this.sendToMobile(this.conf.protocol.PING_OUT);
	this.sendToMobile(this.conf.protocol.PING_IN);
};

ProtocolBLEAdapter.prototype.pingOut = function () {
	this.log('got ping out');
	this.conf.protocol.inSync = true;
};

ProtocolBLEAdapter.prototype.onData = function (data) {
	this.log('got on data ' + data);
};

ProtocolBLEAdapter.prototype.sendData = function (data) {
	this.log('to send data ' + data);
	this.sendToMobile(Buffer.concat([this.conf.DATA, data, this.conf.EOM]));
};

module.exports.BLECommContext = BLECommContext;
module.exports.BLECommLogger = BLECommLogger;
module.exports.BLEAdapter = BLEAdapter;
module.exports.SimpleBLEAdapter = SimpleBLEAdapter;
module.exports.ProtocolBLEAdapter = ProtocolBLEAdapter;
