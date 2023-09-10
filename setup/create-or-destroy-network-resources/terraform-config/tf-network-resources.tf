## VPC
resource "aws_vpc" "vpc-1" {
  cidr_block = var.vpc_cidr_block_range

  tags = {
    Name = "tf-fb-vpc"
  }
}

## Subnets
resource "aws_subnet" "public-subnet-2a" {
  vpc_id     = aws_vpc.vpc-1.id
  cidr_block = var.vpc_public_subnet_cidr_block_range
  map_public_ip_on_launch = true

  tags = {
    Name = "tf-fb-vpc-public-subnet"
  }
}

resource "aws_subnet" "private-subnet-2a" {
  vpc_id     = aws_vpc.vpc-1.id
  cidr_block = var.vpc_private_subnet_cidr_block_range
  map_public_ip_on_launch = false

  tags = {
    Name = "tf-fb-vpc-private-subnet"
  }
}

## EC2 Instances
resource "aws_instance" "ec2-2a" {
  ami           = "ami-024e6efaf93d85776"
  instance_type = "t2.micro"
  subnet_id = aws_subnet.private-subnet-2a.id
  vpc_security_group_ids = [aws_security_group.api_gateway_access.id]

  tags = {
    Name = "tf-fb-ec2-server"
  }
}

resource "aws_instance" "ec2-for-eip" {
  ami           = "ami-024e6efaf93d85776"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public-subnet-2a.id

  tags = {
    Name = "tf-fb-ec2-for-eip"
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
}

resource "aws_vpc_endpoint" "dynamodb_endpoint" {
  vpc_id             = aws_vpc.vpc-1.id
  service_name       = "com.amazonaws.${var.aws_region}.dynamodb"
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

## VPN Gateway
resource "aws_vpn_gateway" "client_vpn_gateway" {
  vpc_id = aws_vpc.vpc-1.id

  tags = {
    name = "tf-fb-private-subnet-client-vpn"
  }

  depends_on = [aws_subnet.private-subnet-2a]
}

## VPN Endpoint
resource "aws_ec2_client_vpn_endpoint" "client_vpn_endpoint" {
  description = "EC2 Client VPN endpoint"
  server_certificate_arn = var.client_vpn_endpoint_server_certificate_arn

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
  split_tunnel = true

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_vpc.vpc-1,
    aws_cloudwatch_log_group.vpn_log_group,
    aws_cloudwatch_log_stream.vpn_log_stream,
  ]
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
  subnet_id      = aws_subnet.private-subnet-2a.id
  route_table_id = aws_route_table.private-subnet-route-table.id
}