variable "api_gateway_path_part" {
  description = "Your desired root path name of your api gateway."
}

variable "aws_region" {
  description = "The AWS region which your provisioned resources will be deployed to."
}

variable "security_group_client_vpn_access_cidr_block" {
  description = "The cidr block defining the IP address allowed to access the provisioned client vpn endpoint."
}

variable "client_vpn_endpoint_server_certificate_arn" {
  description = "The arn of the server certificate used by your provisioned client vpn endpoint when establishing connection with a client."
}

variable "client_vpn_endpoint_root_certificate_arn" {
  description = "The arn of the root certificate that will be used to verify client certs like the one you may use from your host machine to ssh into the server."
}

variable "dynamo_db_yahoo_oauth_table_name" {
  description = "The name of a table that you should create in aws prior to your running the terraform config containing your current oauth credentials for your yahoo account for api access"
}

variable "vpc_cidr_block_range" {
  description = "The cidr block range used by your VPC."
}

variable "vpc_public_subnet_cidr_block_range" {
  description = "The cidr block range used by your VPC public subnet. This must lie within the range of your VPC and not overlap with the private subnet range or client vpn endpoint cidr_block range. If unsure, please use the .tfvarexamples file as a starting point."
}

variable "vpc_private_subnet_cidr_block_range" {
  description = "The cidr block range used by your VPC private subnet. This must lie within the range of your VPC and not overlap with the public subnet range or client vpn endpoint cidr_block range. If unsure, please use the .tfvarexamples file as a starting point."
}

variable "vpc_client_vpn_endpoint_cidr_block_range" {
  description = "The cidr block range used by your client vpn endpoint. This must lie within the range of your VPC and not overlap with the private subnet range or private subnet range. If unsure, please use the .tfvarexamples file as a starting point."
}