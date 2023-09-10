resource "aws_security_group" "ec2-traffic" {
  name        = "ec2-traffic"
  description = "Allow inbound and outbound traffic from VPC interface endpoint for APIGateway, VPC gateway endpoint for dynamoDB, inbound traffic from VPN for ssh, and outbound traffic to NAT gateway for internet"
  vpc_id      = aws_vpc.vpc-1.id

  ingress {
    description      = "SSH from VPN connected devices"
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    cidr_blocks      = [aws_vpc.vpc-1.cidr_block]
  }

  ingress {
    description      = "Allow traffic from API gateway VPC endpoint"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    security_groups = aws_vpc_endpoint.api_gateway_endpoint.security_group_ids
  }

  ingress {
    description      = "Allow traffic from DynamoDB VPC endpoint"
    from_port        = 0
    to_port          = 65535
    protocol         = "tcp"
    security_groups  = aws_vpc_endpoint.dynamodb_endpoint.security_group_ids
  }

  egress {
    description = "Allow traffic to DynamoDB VPC endpoint"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    security_groups = aws_vpc_endpoint.dynamodb_endpoint.security_group_ids
  }

  egress {
    description = "Allow outbound internet traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "EC2 Traffic"
  }
}

resource "aws_security_group" "api_gateway_access" {
  name = "api-gateway-access"
  description = "Allows traffic from and to the API gateway VPC endpoint"
  vpc_id      = aws_vpc.vpc-1.id

  ingress {
    description = "Allow traffic from API Gateway VPC Endpoint"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_subnet.private-subnet-2a.cidr_block]  # Use the CIDR block of the private subnet where the EC2 instance resides
  }

  egress {
    description = "Allow traffic to API Gateway VPC Endpoint"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = aws_vpc_endpoint.api_gateway_endpoint.security_group_ids
  }

  tags = {
    Name = "API Gateway Access"
  }
}

resource "aws_security_group" "client_vpn_access" {
  name        = "client-vpn-access"
  description = "Allows connections to the Client VPN"
  vpc_id      = aws_vpc.vpc-1.id

  ingress {
    description      = "Allow SSH from client"
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    cidr_blocks     = [var.security_group_client_vpn_access_cidr_block]
  }
}