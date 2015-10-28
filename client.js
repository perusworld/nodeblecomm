"use strict";

var util = require('util');
var noble = require('noble');
var logger = require('./logger');

function BLEConnContext() {
};

BLEConnContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function BLEConnector(sUID, tUID, rUID) {
	this.conf = {
		sUID: sUID,
		rUID: rUID,
		tUID: tUID
	};
	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
	this.onDataCallBack = null;
	this.onConnected = null;
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

BLEConnector.prototype.stop = function (error) {
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
		if (null != this.readCharacteristic && null != this.writeCharacteristic && null != this.onConnected) {
			this.onConnected();
		}
	}
};

BLEConnector.prototype.onReadData = function (data, isNotification) {
	this.log('got data ' + data.toString() + ', ' + isNotification);
};

BLEConnector.prototype.send = function (buffer) {
	this.log('To send ' + buffer.toString());
	if (this.writeCharacteristic) {
		this.writeCharacteristic.write(buffer, true);
		this.log('Sent ' + buffer.toString());
	}
};

function SimpleBLEConnector(sUID, tUID, rUID) {
	SimpleBLEConnector.super_.call(this);
	this.conf.sUID = sUID;
	this.conf.rUID = rUID;
	this.conf.tUID = tUID;
};

util.inherits(SimpleBLEConnector, BLEConnector);

function ProtocolBLEConnector() {
	SimpleBLEConnector.super_.call(this);
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

util.inherits(ProtocolBLEConnector, BLEConnector);

module.exports.BLEConnContext = BLEConnContext;
module.exports.BLEConnector = BLEConnector;
module.exports.SimpleBLEConnector = SimpleBLEConnector;
module.exports.ProtocolBLEConnector = ProtocolBLEConnector;
