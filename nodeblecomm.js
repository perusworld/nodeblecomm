"use strict";

module.exports = {
	server: function () {
		return require('./server');
	},
	client: function () {
		return require('./client');
	},
	logger: function () {
		return require('./logger');
	}
}


