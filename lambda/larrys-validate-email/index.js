'use strict';
var crypto = require('crypto');
const doc = require('dynamodb-doc');
const dynamo = new doc.DynamoDB();

const key = 'hANtBs3yjrwkgK9g'; //TODO CHANGE THIS IN PRODUCTION SO IT CAN'T BE SCRUBBED FROM GITHUB
const table = "larrys-user";
/**
 * Validates authentication token from client.
 */
exports.handler = (event, context, callback) => {

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
    

    switch (event.httpMethod) {
        case 'GET':
            const token = event.queryStringParameters.token;
            console.log("Token: " + token);
            const decipher = crypto.createDecipher('aes192',key);
            var decipheredToken = decipher.update(token, 'hex', 'utf8');
            decipheredToken += decipher.final('utf8');
            console.log('DECIPHERED TOKEN:' + decipheredToken);
            var parsedToken = JSON.parse(decipheredToken);
            
            
            var params = {
                TableName:table,
                Key:{
                    "username":parsedToken.username
                },
                UpdateExpression: "set verified = :v",
                ExpressionAttributeValues:{
                    ":v":true
                },
                ReturnValues:"UPDATED_NEW"
            };

            dynamo.updateItem(params, function(err, data) {
                if (err) {
                    console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                    done(null,"Email succesfully validated.");
                }
            });
            
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
