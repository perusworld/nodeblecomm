"use strict";

var util = require('util');
var noble = require('noble');
var merge = require("merge");

var logger = require('./logger');
var protocol = require('./protocol');
var appConfig = require('./config');
var clientDataHandler = require('./clientdatahandler');

function BLEConnContext() {
};

BLEConnContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function BLEConnector(config) {
	this.conf = merge({}, appConfig.client, config);

	this.pheripheral = null;
	this.readCharacteristic = null;
	this.writeCharacteristic = null;
	this.bleConnService = null;
	this.onDataCallBack = null;
	this.onConnected = null;
	this.onDisconnected = null;
	this.onReady = null;
	this.features = [];
	this.dataHandler = null;
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
		this.log('found ' + services.length + ' services from ' + this.pheripheral);
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
		this.log('found characteristics from ' + this.pheripheral);
		for (var index = 0; index < characteristics.length; index++) {
			if (this.conf.rUID == characteristics[index].uuid) {
				this.readCharacteristic = characteristics[index];
				this.log('found read characteristic ' + characteristics[index]);
				this.readCharacteristic.discoverDescriptors(this.onDiscoverDescriptors.bind(this));
			} else if (this.conf.tUID == characteristics[index].uuid) {
				this.writeCharacteristic = characteristics[index];
				this.log('found write characteristic ' + characteristics[index]);
			}
		}
	}
};

BLEConnector.prototype.registerNotifications = function () {
	if (null != this.readCharacteristic && null != this.writeCharacteristic) {
		this.log('registering for notification, with features ' + this.features);
		this.readCharacteristic.on('data', this.onReadData.bind(this));
		this.readCharacteristic.notify(true, this.onNotifyStateChange.bind(this));
	}
};

BLEConnector.prototype.onDiscoverDescriptors = function (error, descriptors) {
	if (error) {
		this.log('error discovering descriptors' + error);
	} else {
		this.log('found ' + descriptors.length + ' descriptors');
		var found = false;
		for (var index = 0; index < descriptors.length; index++) {
			if (this.conf.fUID == descriptors[index].uuid) {
				found = true;
				this.log('found features descriptor ' + descriptors[index]);
				descriptors[index].readValue(this.onFeatureReadValue.bind(this));
			}
		}
		if (!found) {
			this.features = [];
			this.postFeatureDetection();
		}
	}
};

BLEConnector.prototype.onFeatureReadValue = function (error, data) {
	if (error) {
		this.log('error reading feature value');
		this.features = [];
		this.postFeatureDetection();
	} else {
		this.features = data.toString().split(',');
		this.postFeatureDetection();
	}
};

BLEConnector.prototype.postFeatureDetection = function () {
	if (-1 != this.features.indexOf(clientDataHandler.ClientDataHandlerMode.protocol)) {
		this.dataHandler = new clientDataHandler.ProtocolClientDataHandler(this);
	} else {
		this.dataHandler = new clientDataHandler.SimpleClientDataHandler(this);
	}
	this.registerNotifications();
};

BLEConnector.prototype.onNotifyStateChange = function (error) {
	if (error) {
		this.log('error setting notification on ' + this.readCharacteristic + ', ' + error);
	} else {
		this.log('notification set for ' + this.readCharacteristic);
		if (null != this.readCharacteristic && null != this.writeCharacteristic) {
			this.dataHandler.notificationsSet();
		}
	}
};

BLEConnector.prototype.onReadData = function (data, isNotification) {
	this.dataHandler.onReadData(data, isNotification);
};

BLEConnector.prototype.sendRaw = function (buffer) {
	this.log('To send ' + buffer.toString());
	if (this.writeCharacteristic) {
		this.writeCharacteristic.write(buffer, true);
		this.log('Sent ' + buffer.toString());
	}
};

BLEConnector.prototype.send = function (buffer) {
	this.dataHandler.send(buffer);
};

function SimpleBLEConnector(config) {
	SimpleBLEConnector.super_.call(this, config);
};

util.inherits(SimpleBLEConnector, BLEConnector);

module.exports.BLEConnContext = BLEConnContext;
module.exports.BLEConnector = BLEConnector;
module.exports.SimpleBLEConnector = SimpleBLEConnector;
