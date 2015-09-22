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

function BLEAdapter() {
	this.conf = {
		serviceName: "BLEComm",
		staticData: new Buffer("BLEComm")
	};
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleCommService = null;
};

BLEAdapter.prototype.log = function (msg) {
	if (null != BLECommContext.logger) {
		BLECommContext.logger.log(msg);
	}
};

BLEAdapter.prototype.init = function () {
	this.log('in init');
	this.writeCharacteristic = new Characteristic({
		uuid: 'ffe1',
		properties: ['notify'],
		value: this.conf.staticData,
		onSubscribe: this.onSubscribe.bind(this)
	});
	this.readCharacteristic = new Characteristic({
		uuid: 'ffe2',
		properties: ['writeWithoutResponse'],
		value: this.conf.staticData,
		onWriteRequest: this.onDataFromMobile.bind(this)
	});
	this.bleCommService = new PrimaryService({
		uuid: 'ffe0',
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
		this.sendToMobile('Got ' + data.toString());
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

function SimpleBLEAdapter() {
	SimpleBLEAdapter.super_.call(this);
};

util.inherits(SimpleBLEAdapter, BLEAdapter);

SimpleBLEAdapter.prototype.onDataFromMobile = function (data, offset, withoutResponse, callback) {
	if (offset) {
		callback(this.RESULT_ATTR_NOT_LONG);
	} else {
		this.log('Got ' + data.toString());
		this.sendToMobile('Got ' + data.toString());
		callback(this.RESULT_SUCCESS);
	}
};

module.exports.BLECommContext = BLECommContext;
module.exports.BLECommLogger = BLECommLogger;
module.exports.BLEAdapter = BLEAdapter;
module.exports.SimpleBLEAdapter = SimpleBLEAdapter;
