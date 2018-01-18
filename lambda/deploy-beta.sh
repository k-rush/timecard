#!/bin/bash


#remove zip
echo "REMOVING PERVIOUS DEPLOYMENT PACKAGES"

rm larrys-users.zip

#make new zip
echo "zipping delpoyment package"

pushd /home/kyle/Documents/code/larrys/lambda/larrys-users
zip -r ../larrys-users.zip *
popd

#delpoy
echo "deploying to aws lambda"
aws lambda update-function-code --function-name larrys-users --zip-file fileb:///home/kyle/Documents/code/larrys/lambda/larrys-users.zip
