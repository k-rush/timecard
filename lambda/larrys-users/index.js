'use sctrict';
var crypto = require('crypto');
var async = require('async');
var AWS = require('aws-sdk');
var validator = require('validator');
const uuid = require('uuid/v1');
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
			// Validate
			// Sanitize
			// Query DB
			// salt&hash
			// put

			async.waterfall([
				async.apply(setConfig, event),
				validateUserFields,
				sanitizeFields,
				queryUserDB,
				saltAndHashPW,
				putNewUser
				],
				done);

			break;
		case 'GET':
			//Get user(s)

			// If a username is provided, will get that particular user,  otherwise gets all users

			//Waterfall
			// set configuration
			var queryFunction = null;
			if(event.queryStringParameters.username)
				queryFunction = queryUserDB;
			else queryFunction = scanUserDB;

			async.waterfall([
				async.apply(setConfig, event),
				queryFunction
				],
				done);
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
	var body = {};
	console.log(event.httpMethod);

	// POST method has paramters in the http body, need to parse. Else are url encoded and parsed by API gateway
	switch(event.httpMethod) {
		case 'POST':
			try {
				body = JSON.parse(event.body);
			} catch(e) { callback({message:"Could not parse input body"}); }
			break;
		default:
			body = event.queryStringParameters;
	}
	

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
			console.log("Configutaion Item: " + JSON.stringify(data.Item));
			data.Item.httpMethod = event.httpMethod;
			callback(null, body, data.Item);
		}
	});


}


/** Validates all of the user registration fields */
function validateUserFields(body, configuration, callback) {
	console.log('validating fields: ' + JSON.stringify(body));
    if(isString(body.username) && isString(body.firstname) && isString(body.lastname) && validator.isEmail(body.email) && validatePassword(body.password)) {
    	console.log("Inputs validated.");
        callback(null, body, configuration);
    }
    else {
    	console.log('Invalid registration inputs');
    	callback({message: 'Invalid registration inputs', code:'400'});
    }                         
}

/** Sanitize inputs for html */
function sanitizeFields(body, configuration, callback) {
    body.username = validator.escape(validator.trim(body.username));
    body.firstname = validator.escape(body.firstname);
    body.lastname = validator.escape(body.lastname);
    body.email = validator.normalizeEmail(validator.escape(body.email));
    callback(null, body, configuration);
}


/** Validates password */
function validatePassword(password) {
    return (isString(password) && password.length > 5)
}

/** Tests typeof data is string */
function isString(data) {
    return (typeof data === 'string');
}

function scanUserDB(body, configuration, callback) {
	var queryParams = {
		TableName : configuration.usersTable
	}

	dynamo.scan(queryParams, function(err, data) {
		if(err) {
			callback({message:'Unable to retrieve user data', code:'500'});
		}
		else {
			data.Items.forEach(function(item) {
				delete item.password;
				delete item.salt;
				delete item.searchField
				delete item.UserId;
			});
			callback(null, data.Items);
		}
	});
}

function queryUserDB(body, configuration, callback) {
    var queryParams = {
        TableName : configuration.usersTable,
        IndexName : configuration.usersIndex,
        KeyConditionExpression: "#s = :user",
        ExpressionAttributeNames:{
            "#s": "searchField"
        },
        ExpressionAttributeValues: {
            ":user":body.username.toLowerCase()
        }
    };
	



    //Need query here, because we do not have UserID... How can we make this faster?
    dynamo.query(queryParams, function(err,data) {
        if(err) {
            console.log(err);
            callback(err,data);
        }

        else {
            console.log("QUERY RESULT:" + JSON.stringify(data.Items));

            // CAN WE USE FUNCTION POINTERS HERE?
            if(data.Items.length === 0) {
            	console.log("Username not found");
            	switch(configuration.httpMethod) {
            		case 'POST':
            			callback(null, body, configuration);
            			break;
            		case 'GET':
            			callback({message: "Username not found", code:'400'});
            			break;
            		default:
            	}

            }
            else {
            	switch(configuration.httpMethod) {
            		case 'POST':
            			callback({message: 'Username already exists'});
            			break;
            		case 'GET':
            			data.Items.forEach(function(item) {
            				delete item.password;
            				delete item.salt;
            				delete item.searchField
            				delete item.UserId;
            			});
            			callback(null, data.Items);
            			break;
            		default:
            	}
                
            }
        }
    });
}

//Salt and hash PW.
function saltAndHashPW(body, configuration, callback) {
    const hash = crypto.createHash('sha256');
    const salt = crypto.randomBytes(16).toString('hex');
    hash.update(body.password + salt);
    const hashedPass = hash.digest('hex');

    //console.log("USERNAME: " + body.username + "HASHED PASSWORD:" + hashedPass + " SALT: " + salt);
    callback(null, body, configuration, hashedPass, salt);                      
}

function putNewUser(body, configuration, hashedPass, salt, callback) {
    //Params used to put new user into database
    //console.log("Putting user into DB");
    var params = {
        TableName : configuration['usersTable'],
        Item : {"UserId": uuid(), "username":body.username, "password":hashedPass, "salt":salt, "email":body.email, "firstname":body.firstname, "lastname":body.lastname, "verified":false, "searchField":body.username.toLowerCase()}
    };
    dynamo.putItem(params, function(err, data) {
        if(!err) {
            console.log("User put into DB\n" + data);
            callback(null, body, configuration);
        }
        else {
            console.log(err + "\n" + data);
            callback({code:'500', message:"Error putting user into database."});
        }
    });
}

/** Generates a verificaiton URL to be sent in a verification email.
 *  form: http://<API ENDPOINT>?token=<VERIFICAITON TOKEN>
 */
function generateVerificationURL(body, configuration, callback) {
    var exptime = new Date(new Date().setFullYear(new Date().getFullYear() + 1)); //Set expiration time to current year + 1
    var cipher = crypto.createCipher('aes192',configuration['key']); 

    var token = cipher.update(JSON.stringify({"username":body.username,"expiration":exptime}), 'utf8', 'hex');
    token += cipher.final('hex');
    var emailBody = configuration['API'] + "verify-email?token=" + token;
    emailBody += "\n\n" + body.username + "\n" + body.firstname + "\n" + body.lastname + "\n" + body.email + "\n";
    callback(null, body, configuration, emailBody);
}


function sendVerificationEmail(body, configuration, emailBody, callback) {
    var SES = new AWS.SES({apiVersion: '2010-12-01'});
    SES.sendEmail( { 
       Source: configuration['senderEmail'], //TODO: CHANGE THIS
       Destination: { ToAddresses: [configuration['senderEmail']] },
       Message: {
           Subject: {
              Data: body.firstname + " requests validaiton",
           },
           Body: {
               Text: {
                   Data: emailBody,
               }
            }
       }
    }
    , function(err, data) {
            if(!err) {
                console.log('Email sent:');
                console.log(data);
                callback(null, body);
            }
            else {
                console.log(err);
                callback({code:500, message:'Error while sending verification email.'});
            }
     });
} 