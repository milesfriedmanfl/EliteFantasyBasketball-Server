## VPC
resource "aws_vpc" "vpc-1" {
  cidr_block = var.vpc_cidr_block_range
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = {
    Name = "tf-fb-vpc"
  }
}

## Subnets
resource "aws_subnet" "public-subnet-2a" {
  vpc_id     = aws_vpc.vpc-1.id
  availability_zone = "${var.aws_region}a"
  cidr_block = var.vpc_public_subnet_cidr_block_range
  map_public_ip_on_launch = true

  tags = {
    Name = "tf-fb-vpc-public-subnet"
  }
}

resource "aws_subnet" "private-subnet-2b" {
  vpc_id     = aws_vpc.vpc-1.id
  availability_zone = "${var.aws_region}b"
  cidr_block = var.vpc_private_subnet_cidr_block_range
  map_public_ip_on_launch = false

  tags = {
    Name = "tf-fb-vpc-private-subnet"
  }
}

## EC2 Instances
resource "aws_iam_instance_profile" "nlb_ec2_profile" {
  name = "nlb-ec2-profile"

  role = aws_iam_role.nlb_ec2_role.name
}

resource "aws_instance" "ec2-2a-private" {
  ami           = "ami-024e6efaf93d85776"
  instance_type = "t2.micro"
  subnet_id = aws_subnet.private-subnet-2b.id
  vpc_security_group_ids = [
    aws_security_group.ec2-private-traffic.id
  ]

  iam_instance_profile = aws_iam_instance_profile.nlb_ec2_profile.name

  user_data = <<-EOF
    #!/bin/bash
    # Define the SSH username and password
    SSH_USER="${var.ec2_ssh_user}"
    SSH_PASS="${var.ec2_ssh_pass}"

    # Enable password authentication
    sudo sed -i 's|PasswordAuthentication no|PasswordAuthentication yes|' /etc/ssh/sshd_config

    # Create the SSH_USER
    sudo useradd -m "$SSH_USER"

    # Set the password for the SSH_USER
    echo "$SSH_USER:$SSH_PASS" | sudo chpasswd

    # Add the SSH_USER to the sudo group
    sudo usermod -aG sudo "$SSH_USER"

    # Add the SSH_USER to the SSH configuration
    echo "AllowUsers $SSH_USER" | sudo tee -a /etc/ssh/sshd_config

    # Restart the SSH service to apply the changes
    sudo service ssh restart

    # Update the package list
    sudo apt-get update -y

    # Install NVM
    sudo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash

    # Source NVM to make it available in this script
    source ~/.nvm/nvm.sh

    # Install latest stable version of node
    nvm install --lts

    # Install NPM
    sudo apt-get install npm -y

    # Install OpenSSH SFTP server
    sudo apt-get install openssh-sftp-server -y

    # Install zip and unzip
    sudo apt-get install zip unzip -y
  EOF

  tags = {
    Name = "tf-fb-ec2-server"
  }
}

data "aws_instance" "ec2-2a-private" {
  instance_id = aws_instance.ec2-2a-private.id
}

resource "aws_instance" "ec2-2a-public" {
  ami           = "ami-024e6efaf93d85776"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public-subnet-2a.id
  associate_public_ip_address = true
  security_groups = [aws_security_group.ec2-public-traffic.id]

  user_data = <<-EOF
    #!/bin/bash
    # Install OpenSSH SFTP server
    sudo apt-get install openssh-sftp-server -y

    # Define the SSH username and password
    SSH_USER="${var.ec2_ssh_user}"
    SSH_PASS="${var.ec2_ssh_pass}"

    # Enable password authentication
    sudo sed -i 's|PasswordAuthentication no|PasswordAuthentication yes|' /etc/ssh/sshd_config

    # Create the SSH_USER
    sudo useradd -m "$SSH_USER"

    # Set the password for the SSH_USER
    echo "$SSH_USER:$SSH_PASS" | sudo chpasswd

    # Add the SSH_USER to the SSH configuration
    echo "AllowUsers $SSH_USER" | sudo tee -a /etc/ssh/sshd_config

    # Restart the SSH service to apply the changes
    sudo service ssh restart
  EOF

  tags = {
    Name = "tf-fb-ec2-bastion"
  }
}

## DynamoDB Tables
data "aws_dynamodb_table" "yahoo-oauth-table" {
  name = var.dynamo_db_yahoo_oauth_table_name
}

## VPC Endpoints
resource "aws_vpc_endpoint" "api_gateway_endpoint" {
  vpc_id       = aws_vpc.vpc-1.id
  service_name = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type = "Interface"
  subnet_ids = [aws_subnet.private-subnet-2b.id]
}

resource "aws_vpc_endpoint" "dynamodb_endpoint" {
  vpc_id             = aws_vpc.vpc-1.id
  service_name       = "com.amazonaws.${var.aws_region}.dynamodb"
#  vpc_endpoint_type = "Interface"
#  subnet_ids = [aws_subnet.private-subnet-2b.id]
}

## Internet Gateway
resource "aws_internet_gateway" "internet-gateway" {
  vpc_id = aws_vpc.vpc-1.id

  tags = {
    Name = "tf-fb-internet-gateway"
  }
}

## NAT Gateway
resource "aws_eip" "nat_gateway" {
  domain = "vpc"

  depends_on = [aws_internet_gateway.internet-gateway]

  tags = {
    Name = "tf-fb-vpc-eip"
  }
}

resource "aws_nat_gateway" "nat_gateway" {
  allocation_id = aws_eip.nat_gateway.id
  subnet_id     = aws_subnet.public-subnet-2a.id

  tags = {
    Name = "tf-fb-vpc-nat-gateway"
  }

  depends_on = [aws_internet_gateway.internet-gateway]
}

## S3 Bucket for NLB Access Logs
resource "aws_s3_bucket" "nlb_access_logs_bucket" {
  bucket = "tf-nlb-access-log-bucket"
#  region = var.aws_region

  tags = {
    Name = "tf-nlb-access-logs-bucket"
  }
}

resource "aws_s3_bucket_ownership_controls" "nlb_bucket_ownership_controls" {
  bucket = aws_s3_bucket.nlb_access_logs_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
  depends_on = [aws_s3_bucket_public_access_block.nlb_bucket_public_access_block]
}

resource "aws_s3_bucket_public_access_block" "nlb_bucket_public_access_block" {
  bucket = aws_s3_bucket.nlb_access_logs_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_acl" "nlb_access_bucket_acl" {
  depends_on = [aws_s3_bucket_ownership_controls.nlb_bucket_ownership_controls]

  bucket = aws_s3_bucket.nlb_access_logs_bucket.id
  acl    = "private"
}

## Load Balancer
resource "aws_lb_target_group" "lb_target_group" {
  name = "tf-fb-lb-target-group"
  port = 3000
  protocol = "TCP"
  vpc_id = aws_vpc.vpc-1.id

  health_check {
    enabled = true
    protocol = "HTTP"
    path = "/health"
  }

  tags = {
    Name = "tf-fb-lb-target-group"
  }
}

resource "aws_lb_target_group_attachment" "lb_target_group_attachment" {
  target_group_arn = aws_lb_target_group.lb_target_group.arn
  target_id        = aws_instance.ec2-2a-private.id
  port             = 3000
}

resource "aws_lb" "private_ec2_lb" {
  name = "tf-fb-private-ec2-lb"
  internal = true
  load_balancer_type = "network"

  subnets = [
    aws_subnet.private-subnet-2b.id
  ]

  access_logs {
    bucket  = aws_s3_bucket.nlb_access_logs_bucket.id
    enabled = true
  }

  tags = {
    Name = "tf-fb-lb"
  }

  depends_on = [aws_s3_bucket_policy.nlb_access_logs_bucket_policy]
}

resource "aws_lb_listener" "private_ec2_lb_listener" {
  load_balancer_arn = aws_lb.private_ec2_lb.arn
  port = 3000
  protocol = "TCP"

  default_action {
    type = "forward"
    target_group_arn = aws_lb_target_group.lb_target_group.arn
  }
}

## VPN Endpoint
resource "aws_ec2_client_vpn_endpoint" "client_vpn_endpoint" {
  description = "EC2 Client VPN endpoint"
  server_certificate_arn = var.client_vpn_endpoint_server_certificate_arn
  vpc_id = aws_vpc.vpc-1.id

  authentication_options {
    type = "certificate-authentication"
    root_certificate_chain_arn = var.client_vpn_endpoint_root_certificate_arn
  }

  connection_log_options {
    cloudwatch_log_group = aws_cloudwatch_log_group.vpn_log_group.name
    cloudwatch_log_stream = aws_cloudwatch_log_stream.vpn_log_stream.name
    enabled               = true
  }

  client_cidr_block = var.vpc_client_vpn_endpoint_cidr_block_range
  dns_servers = ["11.1.0.2"]
#  split_tunnel = true

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_vpc.vpc-1,
    aws_cloudwatch_log_group.vpn_log_group,
    aws_cloudwatch_log_stream.vpn_log_stream,
  ]
}

resource "aws_ec2_client_vpn_authorization_rule" "allow_all_traffic_once_connected" {
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.client_vpn_endpoint.id
  target_network_cidr   = "0.0.0.0/0"
  authorize_all_groups   = true
  description            = "Allow all traffic"
}

## VPN Endpoint Logging
resource "aws_cloudwatch_log_group" "vpn_log_group" {
  name = "/tf/fb/log/client_vpn_endpoint"
}

resource "aws_cloudwatch_log_stream" "vpn_log_stream" {
  name           = "vpn_stream"
  log_group_name = aws_cloudwatch_log_group.vpn_log_group.name
}

## Route Tables
# -- Public Subnet Route Table
resource "aws_route_table" "public-subnet-route-table" {
  vpc_id = aws_vpc.vpc-1.id

  route {
    cidr_block = "0.0.0.0/0" # route all IPV4 traffic to the internet gateway
    gateway_id = aws_internet_gateway.internet-gateway.id
  }

  tags = {
    Name = "tf-fb-public-subnet-route-table"
  }
}

resource "aws_route_table_association" "public-subnet-route-table-association" {
  subnet_id      = aws_subnet.public-subnet-2a.id
  route_table_id = aws_route_table.public-subnet-route-table.id
}

# -- Private Subnet Route Table
resource "aws_route_table" "private-subnet-route-table" {
  vpc_id = aws_vpc.vpc-1.id

  route {
    cidr_block = "0.0.0.0/0" # route all IPV4 traffic to the NAT gateway
    nat_gateway_id = aws_nat_gateway.nat_gateway.id
  }

  tags = {
    Name = "tf-fb-private-subnet-route-table"
  }
}

resource "aws_route_table_association" "private-subnet-route-table-association" {
  subnet_id      = aws_subnet.private-subnet-2b.id
  route_table_id = aws_route_table.private-subnet-route-table.id
}

resource "aws_ec2_client_vpn_network_association" "client_vpn_public_subnet_association" {
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.client_vpn_endpoint.id
  subnet_id              = aws_subnet.public-subnet-2a.id
}

resource "aws_ec2_client_vpn_route" "internet_traffic" {
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.client_vpn_endpoint.id
  destination_cidr_block = "0.0.0.0/0"
  target_vpc_subnet_id   = aws_ec2_client_vpn_network_association.client_vpn_public_subnet_association.subnet_id
}