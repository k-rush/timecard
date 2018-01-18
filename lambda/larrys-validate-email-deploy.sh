#!/bin/bash

#remove zip
echo "removing previous zip file (I hope you're using git)"

rm larrys-login.zip

#make new zip
echo "zipping delpoyment package"

pushd /home/kyle/Documents/code/larrys/lambda/larrys-validate-email
zip -r ../larrys-validate-email.zip *
popd

#delpoy
echo "deploying to aws lambda"
aws lambda update-function-code --function-name larrys-validate-email --zip-file fileb:///home/kyle/Documents/code/larrys/lambda/larrys-validate-email.zip
