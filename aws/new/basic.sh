#!/bin/bash

read -p "Stack base name (lowercase, letters, numbers, hyphen only): " BASE_NAME
read -p "Domain to configure: " DOMAIN

# create the stack
aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-vpc --template-body file://./basic/vpc.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME

# wait for completion
aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-vpc --output text

# print the IP address
echo "Elastic IP:"
aws cloudformation describe-stacks --stack-name ${BASE_NAME}-vpc --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP0PublicIP`].OutputValue' --output text

echo "Assign DNS A records for your domain and wildcard subdomains before continuing:"
echo $DOMAIN
echo "*.$DOMAIN"
echo "*.staging.$DOMAIN"

read -p "Continue? [y/N]: " CONT
if [[ "$CONT" != "y" ]]; then
    exit 1
fi
