"use strict";

var bleno = require('bleno');

var protocol = require('./protocol');

var PrimaryService = bleno.PrimaryService;
var Characteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;

module.exports = {

	server: {
		default: {
			deviceName: process.env.DEVICE_NAME || 'DeviceName',
			serviceName: process.env.SERVICE_NAME || 'ServiceName',
			hardwareRevision: process.env.HARDWARE_REVISION || 'h/w',
			firmwareRevision: process.env.FIRMWARE_REVISION || 'f/w',
			softwareRevision: process.env.SOFTWARE_REVISION || 's/w',
			serialNumber: process.env.SERIAL_NUMBER || 's/n',
			modelNumber: process.env.MODEL_NUMBER || 'm/n',
			manufacturerName: process.env.MANUFACTURER_NAME || 'manu',
			features: process.env.FEATURES || '',
			sUID: process.env.SUID || 'fff0',
			rUID: process.env.RUID || 'fff1',
			tUID: process.env.TUID || 'fff2',
			iUID: process.env.IUID || '180a',
			fUID: process.env.fUID || 'fff3',
			maxLength: process.env.MAX_LENGTH || 100,
			desc: process.env.DESC || 'BLEComm',
			sendDelay: process.env.SEND_DELAY || 50
		},
		protocol: {
			protocol: {
				COMMAND: protocol.command,
				pingTimer: 1000
			}
		}
	},

	client: {
		sUID: process.env.SUID || 'fff0',
		rUID: process.env.RUID || 'fff2',
		tUID: process.env.TUID || 'fff1',
		fUID: process.env.fUID || 'fff3',
		maxLength: process.env.MAX_LENGTH || 100,
		dataHandler: null
	},

	infoService: function (config) {
		return new PrimaryService({
			uuid: config.iUID,
			characteristics: [
				new Characteristic({
					uuid: '2a00',
					properties: ['read'],
					value: new Buffer(config.deviceName),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'device name'
						})
					]
				}),
				new Characteristic({
					uuid: '2a27',
					properties: ['read'],
					value: new Buffer(config.hardwareRevision),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'hardware revision'
						})
					]
				}),
				new Characteristic({
					uuid: '2a26',
					properties: ['read'],
					value: new Buffer(config.firmwareRevision),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'firmware revision'
						})
					]
				}),
				new Characteristic({
					uuid: '2a28',
					properties: ['read'],
					value: new Buffer(config.softwareRevision),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'software revision'
						})
					]
				}),
				new Characteristic({
					uuid: '2a25',
					properties: ['read'],
					value: new Buffer(config.serialNumber),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'serial number'
						})
					]
				}),
				new Characteristic({
					uuid: '2a24',
					properties: ['read'],
					value: new Buffer(config.modelNumber),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'model number'
						})
					]
				}),
				new Characteristic({
					uuid: '2a29',
					properties: ['read'],
					value: new Buffer(config.manufacturerName),
					descriptors: [
						new BlenoDescriptor({
							uuid: '2901',
							value: 'manufacturer name'
						})
					]
				})
			]
		});
	}

};