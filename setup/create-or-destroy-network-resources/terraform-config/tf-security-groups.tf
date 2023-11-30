resource "aws_security_group" "ec2-public-traffic" {
  name        = "ec2-public-traffic"
  description = "setting up the public ec2 instance to be able to be used as a bastion host for the private ec2"
  vpc_id = aws_vpc.vpc-1.id

  ingress {
    description      = "ICMP (Ping) from VPN connected devices"
    from_port        = 8
    to_port          = -1
    protocol         = "icmp"
    security_groups = [aws_vpc.vpc-1.default_security_group_id]
  }

  ingress {
    description      = "SSH from VPN connected devices"
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    security_groups = [aws_vpc.vpc-1.default_security_group_id]
  }

  egress {
    description = "Allow outbound internet traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ec2-private-traffic" {
  name        = "ec2-private-traffic"
  description = "Allow inbound and outbound traffic from VPC interface endpoint for APIGateway, VPC gateway endpoint for dynamoDB, inbound traffic from VPN for ssh, and outbound traffic to NAT gateway for internet"
  vpc_id      = aws_vpc.vpc-1.id

  ingress {
    description      = "ICMP (Ping) from VPN connected devices"
    from_port        = 8
    to_port          = -1
    protocol         = "icmp"
    security_groups  = [aws_security_group.ec2-public-traffic.id]
  }

  ingress {
    description      = "SSH from Bastion Host"
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    security_groups  = [aws_security_group.ec2-public-traffic.id]
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

  ingress {
    description = "Allow health checks and other http traffic"
    from_port = 3000
    to_port = 3000
    protocol = "tcp"
    cidr_blocks = [aws_vpc.vpc-1.cidr_block]
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