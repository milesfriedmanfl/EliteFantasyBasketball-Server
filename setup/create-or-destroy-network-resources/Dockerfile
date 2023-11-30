FROM centos

# Set a default value for TERRAFORM_VERSION, which can be overridden by a --build-arg if necessary
ARG TERRAFORM_VERSION=1.5.5

# Create the /working directory
RUN mkdir /working

# Update to latest CentOS mirror, download and install required tools (AWS CLI and the latest Terraform binary)
# Then copy tf files from the mounted directory, along with JSON files containing arns for generated certificates into a working directory
RUN cd /etc/yum.repos.d/ && \
    sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-* && \
    sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-* && \
    yum -y update && \
    yum -y install unzip jq && \
    curl -o "awscliv2.zip" "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    curl -o "terraform.zip" "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" && \
    unzip terraform.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform.zip && \
    terraform --version

# Create a script to deploy terraform resources from the /working directory
# TODO -- should probably move this to it's own file since it's grown larger than expected
RUN echo '#!/bin/bash' > /working/create-or-destroy-network-resources.sh && \
    echo 'cp -r /terraform-config/. /working' >> /working/create-or-destroy-network-resources.sh && \
    echo 'cp /generated-certificates/fb-vpn-server-arn.json /working' >> /working/create-or-destroy-network-resources.sh && \
    echo 'cp /generated-certificates/fb-vpn-ca-arn.json /working' >> /working/create-or-destroy-network-resources.sh && \
    echo 'cd /working' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking current directory: ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'pwd' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking contents of current directory: ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'ls -a ./' >> /working/create-or-destroy-network-resources.sh && \
    # Parse mounted json files containing output from certificate generation to get the arns of the uploaded certificates
    echo 'client_vpn_endpoint_server_certificate_arn="$(jq -r ".CertificateArn" "./fb-vpn-server-arn.json")"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'client_vpn_endpoint_root_certificate_arn="$(jq -r ".CertificateArn" "./fb-vpn-ca-arn.json")"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking variables parsed from JSON correctly: ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "Certificate ARN for server: $client_vpn_endpoint_server_certificate_arn"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "Certificate ARN for client: $client_vpn_endpoint_root_certificate_arn"' >> /working/create-or-destroy-network-resources.sh && \
    # Replace the proper variables within the terraform variables.tfvars file in the working directory so that the
    # client vpn endpoint can be set up using the certificates residing in the users aws acm at runtime.
    echo 'sed -i "s|client_vpn_endpoint_server_certificate_arn = .*|client_vpn_endpoint_server_certificate_arn = \"$client_vpn_endpoint_server_certificate_arn\"|" ./variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    echo 'sed -i "s|client_vpn_endpoint_root_certificate_arn = .*|client_vpn_endpoint_root_certificate_arn = \"$client_vpn_endpoint_root_certificate_arn\"|" ./variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    # Test that the sed commands worked properly by displaying the updated tfvars file \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking contents of updated variables.tfvars: ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'cat ./variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    # Run terraform commands to either create or destroy resources specified by the terraform config files in the working directory
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Running terraform init... ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'terraform init' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking contents of current directory: ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'ls -a ./' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Running terraform plan... ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'terraform plan -var-file=variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    # Create or destroy based on the argument passed \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo "---- Checking for desired action... ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo 'echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'if [[ "$1" == "--create" ]]; then' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo "---- Received --create. Running Terraform apply... ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo "yes" | terraform apply -var-file=variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    echo '    cp -R ./*.tfstate /terraform-config' >> /working/create-or-destroy-network-resources.sh && \
    echo 'elif [[ "$1" == "--destroy" ]]; then' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo "---- Received --destroy. Running Terraform destroy... ----v"' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo "yes" | terraform destroy -var-file=variables.tfvars' >> /working/create-or-destroy-network-resources.sh && \
    echo '    cp -R ./*.tfstate /terraform-config/' >> /working/create-or-destroy-network-resources.sh && \
    echo 'else' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo "Invalid option "$1". Use --create or --destroy."' >> /working/create-or-destroy-network-resources.sh && \
    echo '    echo ""' >> /working/create-or-destroy-network-resources.sh && \
    echo 'fi' >> /working/create-or-destroy-network-resources.sh && \
    chmod +x /working/create-or-destroy-network-resources.sh

# Set the above script as the entry point, passing ACTION as an arg
ENTRYPOINT ./working/create-or-destroy-network-resources.sh "$ACTION"
