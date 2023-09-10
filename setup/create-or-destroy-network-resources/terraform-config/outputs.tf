output "aws_region" {
  value = var.aws_region
}

output "client_vpn_endpoint_id" {
  value = aws_ec2_client_vpn_endpoint.client_vpn_endpoint.id
}

output "private_subnet_2a_id" {
  value = aws_subnet.private-subnet-2a.id
}

output "vpn_gateway_id" {
  value = aws_vpn_gateway.client_vpn_gateway.id
}
