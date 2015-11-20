"use strict";

module.exports = {

	server: {
		user: process.env.DEVICE_NAME || 'postmaster@sandbox697fcddc09814c6b83718b9fd5d4e5dc.mailgun.org',
		password: process.env.MAILGUN_PASSWORD || '29eldds1uri6'
	},

	client: {
		user: process.env.MANDRILL_USER || 'hackathonstarterdemo',
		password: process.env.MANDRILL_PASSWORD || 'E1K950_ydLR4mHw12a0ldA'
	}

};