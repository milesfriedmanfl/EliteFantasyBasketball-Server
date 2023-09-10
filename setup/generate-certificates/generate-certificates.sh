#!/bin/bash

# Define default values for CERTS_PATH and AWS_CONFIG_PATH and AWS_REGION. AWS_CONFIG_PATH and AWS_REGION are meant to be replaced.
# CERTS_PATH can be replaced if you wish, otherwise generated certificates will be stored in a /certificates directory in the same directory this script is located
DEFAULT_HOST_CERTS_PATH="./certificates"
DEFAULT_HOST_AWS_CONFIG_PATH="/default/path/to/host/aws/config"
DEFAULT_AWS_REGION="us-west-1"

# Initialize variables with default values
AWS_REGION="$DEFAULT_AWS_REGION"
HOST_CERTS_PATH="$DEFAULT_HOST_CERTS_PATH"
HOST_AWS_CONFIG_PATH="$DEFAULT_HOST_AWS_CONFIG_PATH"

# Function to display usage
function echo-proper-usage() {
  echo "----"
  echo "Proper usage: $0 [-c HOST_CERTS_PATH] [-a HOST_AWS_CONFIG_PATH] [-r AWS_REGION]"
  echo "Options:"
  echo "  -c <HOST_CERTS_PATH>: Specify the path to save certificates to on your machine."
  echo "  -a <HOST_AWS_CONFIG_PATH>: Specify the path to AWS config on your machine."
  echo "  -r <AWS_REGION>: Specify the AWS_REGION to deploy the created certificates to in ACM"
  echo "----"
}

# Parse command-line arguments
echo "Parsing command arguments..."
while getopts ":r:c:a:" arg; do
  case $arg in
    r) # arg = -r
      AWS_REGION="$OPTARG"
      ;;
    c) # arg = -c
      HOST_CERTS_PATH="$OPTARG"
      ;;
    a) # arg = -a
      HOST_AWS_CONFIG_PATH="$OPTARG"
      ;;
    \?) # arg = something else that is not valid
      echo "Error - Invalid option: -$OPTARG" >&2
      echo-proper-usage
      exit 1
      ;;
    :) # arg = -c or -a without a path specified, or -r without a region specified. Output to stderr
      echo "Error - Option -$OPTARG requires an argument." >&2
      echo-proper-usage
      exit 1
      ;;
  esac
done

# Navigate to the directory where the script is located
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

# Build the Docker image
echo "Building Docker image..."
docker build -t create-client-vpn-certificates ./ || exit 1

# Using the following docker run command:
echo "Running Docker container..."
docker run -e AWS_REGION="$AWS_REGION" -v "$HOST_CERTS_PATH":/certs -v "$HOST_AWS_CONFIG_PATH":/root/.aws create-client-vpn-certificates
