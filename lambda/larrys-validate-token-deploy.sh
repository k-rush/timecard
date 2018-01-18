#!/bin/bash
echo "DEPLOYING larrys-validate-token LAMBDA FUNCTION"
#remove zip
echo "removing previous zip file (I hope you're using git)"

rm larrys-validate-token.zip

#make new zip
echo "zipping delpoyment package"

pushd /home/kyle/Documents/code/larrys/lambda/larrys-validate-token
zip -r ../larrys-validate-token.zip *
popd

#delpoy
echo "deploying to aws lambda"
aws lambda update-function-code --function-name larrys-validate-token --zip-file fileb:///home/kyle/Documents/code/larrys/lambda/larrys-validate-token.zip
