#!/bin/bash

REGION=`aws configure get region`
read -p "Stack base name (lowercase, letters, numbers, hyphen only): [$1] " BASE_NAME
BASE_NAME=${BASE_NAME:-$1}
read -p "Environment [$2]: " ENVIRONMENT
ENVIRONMENT=${ENVIRONMENT:-$2}
set -a
source ./.env.$ENVIRONMENT
set +a

# check if vpc stack created
if ! aws cloudformation describe-stacks --stack-name ${BASE_NAME}-vpc >/dev/null 2>&1; then
  # if not, create the stack
  echo "Creating ${BASE_NAME}-vpc stack"
  aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-vpc --template-body file://./basic/vpc.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME ParameterKey=Domain,ParameterValue=$DOMAIN
  # wait for completion
  aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-vpc --output text
  # print the IP address
  echo "Elastic IP:"
  aws cloudformation describe-stacks --stack-name ${BASE_NAME}-vpc --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP0PublicIP`].OutputValue' --output text
  echo
  echo "Assign DNS A records for your domain and wildcard subdomains before continuing:"
  echo
  echo $DOMAIN
  echo "*.$DOMAIN"
  echo "*.staging.$DOMAIN"
  echo
  read -p "Continue? [y/N]: " CONT
  if [[ "$CONT" != "y" ]]; then
      exit 1
  fi
fi

# check if ses stack created
if ! aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses >/dev/null 2>&1; then
  # create the stack
  echo "Creating ${BASE_NAME}-ses stack"
  aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-ses --template-body file://./ses.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME
  # wait for completion
  aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-ses --output text
  echo "Assign DNS records for the following:"
  echo
  echo "TXT ses.$DOMAIN \"v=spf1 include:amazonses.com ~all\""
  echo "MX ses.$DOMAIN 10 feedback-smtp.$REGION.amazonaws.com"
  NAME1=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenName1\`].OutputValue' --output text`
  VALUE1=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenValue1\`].OutputValue' --output text`
  NAME2=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenName2\`].OutputValue' --output text`
  VALUE2=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenValue2\`].OutputValue' --output text`
  NAME3=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenName3\`].OutputValue' --output text`
  VALUE3=`aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ses --query 'Stacks[0].Outputs[?OutputKey==\`DkimDNSTokenValue3\`].OutputValue' --output text`
  echo "CNAME $NAME1 $VALUE1"
  echo "CNAME $NAME2 $VALUE2"
  echo "CNAME $NAME3 $VALUE3"
  echo
  read -p "Continue? [y/N]: " CONT
  if [[ "$CONT" != "y" ]]; then
      exit 1
  fi
fi

# check if cdn stack created
if ! aws cloudformation describe-stacks --stack-name ${BASE_NAME}-cdn >/dev/null 2>&1; then
  # create the key pair for CDN signing
  openssl genrsa -out private_key.pem 2048
  openssl rsa -pubout -in private_key.pem -out public_key.pem
  PUBLIC_KEY=`cat public_key.pem`
  PRIVATE_KEY=`cat private_key.pem`
  PRIVATE_KEY=${PRIVATE_KEY//
/"\\n"}
  # create the stack
  echo "Creating ${BASE_NAME}-cdn stack"
  aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-cdn --template-body file://./cdn.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME ParameterKey=CDNSigningPrivateKey,ParameterValue="$PRIVATE_KEY" ParameterKey=CDNSigningPublicKey,ParameterValue="$PUBLIC_KEY"
  # wait for completion
  aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-cdn --output text
fi

# check if rds stack created
if ! aws cloudformation describe-stacks --stack-name ${BASE_NAME}-rds >/dev/null 2>&1; then
  # create the stack
  echo "Creating ${BASE_NAME}-rds stack"
  aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-rds --template-body file://./basic/rds.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME
  # wait for completion
  aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-rds --output text
fi

# finally, create the ec2 stack
if ! aws cloudformation describe-stacks --stack-name ${BASE_NAME}-ec2 >/dev/null 2>&1; then
  # get the appropriate Debian 13 (Trixie) AMI for the current region and architecture
  TARGET_ARCH=arm64
  IMAGE_ID=`aws ssm get-parameters-by-path --path /aws/service/debian/release/trixie/latest --output text | grep -m 1 -oP "${TARGET_ARCH}[[:blank:]]+String[[:blank:]]+\K(ami-[^[:blank:]]+)"`
  # create the stack
  echo "Creating ${BASE_NAME}-ec2 stack"
  aws cloudformation create-stack --capabilities CAPABILITY_NAMED_IAM --stack-name ${BASE_NAME}-ec2 --template-body file://./basic/ec2.json --parameters ParameterKey=BaseName,ParameterValue=$BASE_NAME ParameterKey=InstanceImageId,ParameterValue="$IMAGE_ID"
  # wait for completion
  aws cloudformation wait stack-create-complete --stack-name ${BASE_NAME}-ec2 --output text
fi

echo "Done...!"
