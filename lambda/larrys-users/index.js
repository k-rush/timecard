'use sctrict';
var crypto = require('crypto');
var async = require('async');
var AWS = require('aws-sdk');
var validator = require('validator');
const doc = require('dynamodb-doc');
const dynamo = new doc.DynamoDB();

AWS.config.update({region: 'us-west-2'});

/** Register, update, get users */
exports.handler = function(event, context, callback) {
	const done = (err, res) => callback(null, {
		statusCode: err ? (err.code ? err.code : '400') : '200',
		body: err ? err.message : JSON.stringify(res),
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		}
	});

	switch (event.httpMethod) {
		case 'POST':
			//Register new user

			//Waterfall
			// set configuration

			async.waterfall([
				async.apply(setConfig, event)
			]);
			break;
		case 'GET':
			//Get user(s)

			// If a username is provided, will get that particular user,  otherwise gets all users

			//Waterfall
			// set configuration

			async.waterfall([
				async.apply(setConfig, event)
			]);
			break;
		case 'UPDATE':
			//Update user

			//Waterfall
			// set configuration

			async.waterfall([
				async.apply(setConfig, event)
			]);
			break;
		case 'DELETE':
			//Delete user

			//Waterfall
			// set configuration

			async.waterfall([
				async.apply(setConfig, event)
			]);
			break;
		default:
			done({code:'400', message:`Unsupported HTTP Method "${event.httpMethod}"`});
	}
};

function setConfig(event, callback) {
	var config = {};
	var queryParams = {
		Key: {
			"stage": event.requestContext.stage
		},
		TableName: "larrys-config"
	};

	dynamo.getItem(queryParams, function(err, data) {
		if(err || data.Item.length === 0) {
			console.log(err);
			callback({code:'500', message:'Internal server error'}, data);
		}
		else {
			console.log("Configutaion Item: " + data.Item);
		}
	});


}