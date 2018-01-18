#!/bin/bash
echo "DEPLOYING larrys-register-user LAMBDA FUNCTION"
#remove zip
echo "removing previous zip file (I hope you're using git)"

rm larrys-register-user.zip

#make new zip
echo "zipping delpoyment package"

pushd /home/kyle/Documents/code/larrys/lambda/larrys-register-user
zip -r ../larrys-register-user.zip *
popd

#delpoy
echo "deploying to aws lambda"
aws lambda update-function-code --function-name larrys-register-user --zip-file fileb:///home/kyle/Documents/code/larrys/lambda/larrys-register-user.zip
