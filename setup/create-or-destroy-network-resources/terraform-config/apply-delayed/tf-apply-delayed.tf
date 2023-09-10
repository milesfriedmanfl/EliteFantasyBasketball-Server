data "terraform_remote_state" "results_of_first_apply" {
  backend = "local"
  config = {
    path = "./terraform.tfstate"
  }
}

# This resource cannot find aws_vpn_gateway even with a dependency, which may be a result of the resource not having been
# finished or made available. If we run in a second terraform apply we can check for the resource so as to avoid the error.
resource "aws_ec2_client_vpn_network_association" "client_vpn_subnet_association" {
  client_vpn_endpoint_id = data.terraform_remote_state.results_of_first_apply.outputs.client_vpn_endpoint_id
  subnet_id              = data.terraform_remote_state.results_of_first_apply.outputs.private_subnet_2a_id
}