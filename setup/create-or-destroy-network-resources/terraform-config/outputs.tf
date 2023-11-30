output "aws_region" {
  value = var.aws_region
}

output "client_vpn_endpoint_id" {
  value = aws_ec2_client_vpn_endpoint.client_vpn_endpoint.id
}

output "public_subnet_2a_id" {
  value = aws_subnet.public-subnet-2a.id
}

output "private_subnet_2b_id" {
  value = aws_subnet.private-subnet-2b.id
}