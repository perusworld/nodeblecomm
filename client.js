"use strict";

var util = require('util');
var noble = require('noble');
var merge = require("merge");

var logger = require('./logger');
var protocol = require('./protocol');

function BLEConnContext() {
};

BLEConnContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function BLEConnector(config) {
	this.conf = merge(
		{
			sUID: 'fff0',
			rUID: 'fff2',
			tUID: 'fff1',
			maxLength: 100
		}, config);

	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
	this.onDataCallBack = null;
	this.onConnected = null;
	this.onDisconnected = null;
	this.onReady = null;
};

BLEConnector.prototype.log = function (msg) {
	if (null != BLEConnContext.logger) {
		BLEConnContext.logger.log(msg);
	}
};

BLEConnector.prototype.init = function () {
	this.log('in init');
	noble.on('stateChange', this.onBleStateChange.bind(this));
	noble.on('discover', this.onDiscovered.bind(this));
};

BLEConnector.prototype.onBleStateChange = function (state) {
	this.log('on -> stateChange: ' + state);
	if (state === 'poweredOn') {
		if (null != this.onReady) {
			this.onReady();
		}
	} else {
		noble.stopScanning();
	}
};

BLEConnector.prototype.start = function () {
	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
	noble.startScanning([this.conf.sUID], false, this.onStartScanning.bind(this));
};

BLEConnector.prototype.stop = function () {
	try {
		this.pheripheral.disconnect();
	} catch (error) {
		//could be already disconnected
	}
	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
};

BLEConnector.prototype.onStartScanning = function (error) {
	if (error) {
		this.log('error scanning ' + error);
	} else {
		this.log('scanning ' + this.conf.sUID);
	}
};

BLEConnector.prototype.onDiscovered = function (pheri) {
	if (pheri) {
		noble.stopScanning();
		this.pheripheral = pheri;
		this.log('found a device ' + pheri);
		this.pheripheral.connect(this.onPheripheralConnected.bind(this));
		this.pheripheral.once('disconnect', this.onPheripheralDisconnected.bind(this));
	} else {
		this.log('error');
	}
};

BLEConnector.prototype.onPheripheralConnected = function (error) {
	if (error) {
		this.log('error connecting to ' + this.pheripheral + ', ' + error);
	} else {
		this.log('connected to ' + this.pheripheral);
		this.pheripheral.discoverServices([this.conf.sUID], this.onDiscoveredServices.bind(this));
	}
};

BLEConnector.prototype.onPheripheralDisconnected = function (error) {
	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
	if (error) {
		this.log('error during disconnection ' + error);
	} else {
		this.log('disconnected');
	}
	if (this.onDisconnected) {
		this.onDisconnected();
	}
};

BLEConnector.prototype.onDiscoveredServices = function (error, services) {
	if (error) {
		this.log('error discovering services from ' + this.pheripheral + ', ' + error);
	} else {
		this.log('found services from ' + this.pheripheral);
		for (var index = 0; index < services.length; index++) {
			if (this.conf.sUID == services[index].uuid) {
				this.bleConnService = services[index];
				this.log('found service ' + services[index]);
				this.bleConnService.discoverCharacteristics([this.conf.rUID, this.conf.tUID], this.onDiscoveredCharacteristics.bind(this));
			}
		}
	}
};

BLEConnector.prototype.onDiscoveredCharacteristics = function (error, characteristics) {
	if (error) {
		this.log('error discovering characteristics from ' + this.bleConnService + ', ' + error);
	} else {
		this.log('found services from ' + this.pheripheral);
		for (var index = 0; index < characteristics.length; index++) {
			if (this.conf.rUID == characteristics[index].uuid) {
				this.readCharacteristic = characteristics[index];
				this.log('found read characteristic ' + characteristics[index]);
			} else if (this.conf.tUID == characteristics[index].uuid) {
				this.writeCharacteristic = characteristics[index];
				this.log('found write characteristic ' + characteristics[index]);
			}
		}
		if (null != this.readCharacteristic && null != this.writeCharacteristic) {
			this.log('registering for notification');
			this.readCharacteristic.on('data', this.onReadData.bind(this));
			this.readCharacteristic.notify(true, this.onNotifyStateChange.bind(this));
		}
	}
};

BLEConnector.prototype.onNotifyStateChange = function (error) {
	if (error) {
		this.log('error setting notification on ' + this.readCharacteristic + ', ' + error);
	} else {
		this.log('notification set for ' + this.readCharacteristic);
		if (null != this.readCharacteristic && null != this.writeCharacteristic) {
			this.notificationsSet();
		}
	}
};

BLEConnector.prototype.notificationsSet = function () {
	if (null != this.onConnected) {
		this.onConnected();
	}
};

BLEConnector.prototype.onReadData = function (data, isNotification) {
	this.log('got data ' + data.toString() + ', ' + isNotification);
	if (null != this.onDataCallBack) {
		this.onDataCallBack(data);
	}
};

BLEConnector.prototype.sendRaw = function (buffer) {
	this.log('To send ' + buffer.toString());
	if (this.writeCharacteristic) {
		this.writeCharacteristic.write(buffer, true);
		this.log('Sent ' + buffer.toString());
	}
};

BLEConnector.prototype.send = function (buffer) {
	if (buffer.length > this.conf.maxLength) {
		for (var index = 0; index < buffer.length; index = index + this.conf.maxLength) {
			this.log('Going to send part from ' + index + ' to ' + Math.min(index + this.conf.maxLength, buffer.length));
			this.sendRaw(buffer.slice(index, Math.min(index + this.conf.maxLength, buffer.length)));
		}
	} else {
		this.sendRaw(buffer);
	}
};

function SimpleBLEConnector(config) {
	SimpleBLEConnector.super_.call(this);
	this.conf = merge(this.conf, config);
};

util.inherits(SimpleBLEConnector, BLEConnector);

function ProtocolBLEConnector(config) {
	ProtocolBLEConnector.super_.call(this);
	this.conf = merge(this.conf, config);
	this.conf = merge(this.conf, {
		protocol: {
			inSync: false,
			COMMAND: protocol.command,
			pingTimer: 1000,
			dataBuffer: null
		}
	});
	protocol.mergeCommands(this.conf.protocol);
	console.log(JSON.stringify(this.conf));
};

util.inherits(ProtocolBLEConnector, BLEConnector);

ProtocolBLEConnector.prototype.onReadData = function (data, isNotification) {
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

ProtocolBLEConnector.prototype.notificationsSet = function () {
};

ProtocolBLEConnector.prototype.pingIn = function () {
	this.log('got ping in');
	this.sendRaw(this.conf.protocol.PING_OUT);
	if (null != this.onConnected) {
		this.onConnected();
	}
};

ProtocolBLEConnector.prototype.pingOut = function () {
	this.log('got ping out');
	//noop
};

ProtocolBLEConnector.prototype.onData = function (data) {
	this.log('got on data ' + data);
	if (null != this.onDataCallBack) {
		this.onDataCallBack(data);
	}
};

ProtocolBLEConnector.prototype.send = function (data) {
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


module.exports.BLEConnContext = BLEConnContext;
module.exports.BLEConnector = BLEConnector;
module.exports.SimpleBLEConnector = SimpleBLEConnector;
module.exports.ProtocolBLEConnector = ProtocolBLEConnector;
