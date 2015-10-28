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

function BLEConnector(sUID, rUID, tUID) {
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
		noble.startScanning([this.conf.sUID], false, this.onStartScanning.bind(this)); 
	} else {
		noble.stopScanning();
	}
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
		this.log('found a device ' + pheri);
	} else {
		this.log('error');
	}
};

function SimpleBLEConnector(sUID, rUID, tUID) {
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
