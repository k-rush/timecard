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
			// Validate
			// Sanitize
			//

			async.waterfall([
				async.apply(setConfig, event),
				validateFields,
				sanitizeFields,
				queryUserDB,


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
	var body = {};
	try {
		body = JSON.parse(event.body);
	} catch(e) { callback({message:"Could not parse input body"}); }

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
			callback(body, data.Item);
		}
	});


}


/** Validates all of the user registration fields */
function validateFields(body, configuration, callback) {
    if(isString(body.username) && isString(body.firstname) && isString(body.lastname) && validator.isEmail(body.email) && validatePassword(body.password))
        callback(null, body, configuration);
    else callback({message: 'Invalid registration inputs', code:'400'});                         
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

function queryUserDB(body, configuration, callback) {
    var queryParams = {
        TableName : configuration['user-table'],
        KeyConditionExpression: "#s = :user",
        ExpressionAttributeNames:{
            "#s": "SearchField"
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
            if(data.Items.length === 0) {
                callback(null, body, configuration);

            }
            else {
                callback({message: 'Username already exists'});
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
        Item : {"username":body.username, "password":hashedPass, "salt":salt, "email":body.email, "firstname":body.firstname, "lastname":body.lastname, "verified":false, "searchField":body.username.toLowerCase()}
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