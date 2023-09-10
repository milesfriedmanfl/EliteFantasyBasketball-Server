#!/bin/bash

# Define default value for variables. DEFAULT_HOST_AWS_CONFIG_PATH is meant to be replaced, but DEFAULT_TERRAFORM_VERSION
# can be left as is, since that is the version that was used to develop this application, but can be changed if desired.
# The DEFAULT_HOST_CERTIFICATES_PATH can point to the default location for generated certificates already specified
# in this project when running the generate-certificates.sh script or docker container in that directory,
# but must be replaced with the absolute path, which is required by docker. All of these may also be passed as explicit
# args instead.
DEFAULT_TERRAFORM_VERSION="1.5.5"
DEFAULT_HOST_AWS_CONFIG_PATH="/default/path/to/host/aws/config"
DEFAULT_HOST_CERTIFICATES_PATH="../generate-certificates/certificates"
D

# Initialize variables with default values
TERRAFORM_VERSION="$DEFAULT_TERRAFORM_VERSION"
HOST_AWS_CONFIG_PATH="$DEFAULT_HOST_AWS_CONFIG_PATH"
HOST_CERTIFICATES_PATH="$DEFAULT_HOST_CERTIFICATES_PATH"
ACTION=""

# Function to display usage
function echo-proper-usage() {
  echo "----"
  echo "Proper usage: $0 [-t HOST_TERRAFORM_CONFIG_PATH] [-a HOST_AWS_CONFIG_PATH] --create"
  echo "Options:"
  echo "  -t <TERRAFORM_VERSION>: [Optional] Specify the version of terraform that should be downloaded and used by the docker container to create resources."
  echo "  -a <HOST_AWS_CONFIG_PATH>: [Optional] Specify the path to AWS config on your machine."
  echo "  -c <HOST_CERTIFICATES_PATH>: [Optional] Specify the path to generated server and client certificates on your machine as a result of running scripts in the generated-certificates folder of this project."
  echo "  --create: Create terraform resources in aws. Must pass either the --create argument or the --destroy argument. If both are passed the first argument will be executed."
  echo "  --destroy: Destroy terraform resources in aws. Must pass either the --create argument or the --destroy argument. If both are passed the first argument will be executed."
  echo "----"
}

# Parse command-line arguments
echo "Parsing command arguments..."
while [[ $# -gt 0 ]]; do # While args > 0
  case "$1" in # Handle each arg
    -t)
      TERRAFORM_VERSION="$2"
      shift 2
      ;;
    -a)
      HOST_AWS_CONFIG_PATH="$2"
      shift 2
      ;;
    -c)
      HOST_CERTIFICATES_PATH="$2"
      shift 2
      ;;
    --create)
      ACTION="--create"
      shift
      ;;
    --destroy)
      ACTION="--destroy"
      shift
      ;;
    \?) # arg = something else that is not valid
      echo "Error - Invalid option: $2" >&2
      echo-proper-usage
      exit 1
      ;;
    :) # arg = -t, -c, -a without values specified. Output to stderr
      echo "Error - Option $2 requires an argument." >&2
      echo-proper-usage
      exit 1
      ;;
  esac
done

# Check for --create or --destroy
if [[ "$ACTION" != "--create" && "$ACTION" != "--destroy" ]]; then
  echo-proper-usage
  exit 1
fi

# Navigate to the directory where the script is located
echo "Navigate to directory of script..."
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
CURRENT_DIRECTORY=$(pwd)
echo "CURRENT_DIRECTORY = $CURRENT_DIRECTORY"

# Build the Docker image
echo "Building Docker image..."
docker build --build-arg TERRAFORM_VERSION="$TERRAFORM_VERSION" -t create-or-destroy-network-resources ./ || exit 1

# Run the docker container using necessary mounted paths:
echo "Running Docker container..."
docker run -e ACTION="$ACTION" -v "$HOST_AWS_CONFIG_PATH":/root/.aws -v "$HOST_CERTIFICATES_PATH":/generated-certificates -v "$CURRENT_DIRECTORY/terraform-config":/terraform-config create-or-destroy-network-resources
