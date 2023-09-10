resource "aws_api_gateway_account" "account_with_logging" {
  cloudwatch_role_arn = aws_iam_role.iam_for_api_gateway.arn
}

resource "aws_cloudwatch_log_group" "api_gateway_log_group" {
  name = "/tf/fb/log/api-gateway"
#  retention_in_days = 14
}

resource "aws_api_gateway_rest_api" "fb_rest_api" {
  name = "tf-EliteFantasyBasketballApi"
}

resource "aws_api_gateway_resource" "fb_league_commands" {
  rest_api_id      = aws_api_gateway_rest_api.fb_rest_api.id
  parent_id        = aws_api_gateway_rest_api.fb_rest_api.root_resource_id
  path_part        = var.api_gateway_path_part
}

resource "aws_api_gateway_method" "fb_league_commands_post" {
  rest_api_id   = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id   = aws_api_gateway_resource.fb_league_commands.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "fb_league_commands_post_integration_for_prod" {
  rest_api_id             = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id             = aws_api_gateway_resource.fb_league_commands.id
  http_method             = aws_api_gateway_method.fb_league_commands_post.http_method
  integration_http_method = "POST"
  type                    = "HTTP"
  uri                     = "https://${aws_api_gateway_rest_api.fb_rest_api.id}.execute-api.${var.aws_region}.amazonaws.com/prod"

  depends_on = [
    aws_vpc_endpoint.api_gateway_endpoint,
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post,
#    aws_api_gateway_deployment.deployment_prod,
#    aws_api_gateway_stage.stage_prod,
#    aws_api_gateway_method_settings.fb_league_commands_post_settings_for_prod
  ]

  ##  See http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
  ##  This template will pass through all parameters including path, querystring, header, stage variables,
  ##  and context through to the integration endpoint via the body/payload
  ##  'rawBody' allows pass through of the raw request body
  request_templates = {
    "application/json" = <<EOF
    #set($allParams = $input.params())
    {
    "rawBody": "$util.escapeJavaScript($input.body).replace("\'", "'")",
    "body-json" : $input.json('$'),
    "params" : {
    #foreach($type in $allParams.keySet())
        #set($params = $allParams.get($type))
    "$type" : {
        #foreach($paramName in $params.keySet())
        "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
            #if($foreach.hasNext),#end
        #end
    }
        #if($foreach.hasNext),#end
    #end
    },
    "stage-variables" : {
    #foreach($key in $stageVariables.keySet())
    "$key" : "$util.escapeJavaScript($stageVariables.get($key))"
        #if($foreach.hasNext),#end
    #end
    },
    "context" : {
        "account-id" : "$context.identity.accountId",
        "api-id" : "$context.apiId",
        "api-key" : "$context.identity.apiKey",
        "authorizer-principal-id" : "$context.authorizer.principalId",
        "caller" : "$context.identity.caller",
        "cognito-authentication-provider" : "$context.identity.cognitoAuthenticationProvider",
        "cognito-authentication-type" : "$context.identity.cognitoAuthenticationType",
        "cognito-identity-id" : "$context.identity.cognitoIdentityId",
        "cognito-identity-pool-id" : "$context.identity.cognitoIdentityPoolId",
        "http-method" : "$context.httpMethod",
        "stage" : "$context.stage",
        "source-ip" : "$context.identity.sourceIp",
        "user" : "$context.identity.user",
        "user-agent" : "$context.identity.userAgent",
        "user-arn" : "$context.identity.userArn",
        "request-id" : "$context.requestId",
        "resource-id" : "$context.resourceId",
        "resource-path" : "$context.resourcePath"
        }
    }
    EOF
  }
}

resource "aws_api_gateway_integration" "fb_league_commands_post_integration_for_dev" {
  rest_api_id             = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id             = aws_api_gateway_resource.fb_league_commands.id
  http_method             = aws_api_gateway_method.fb_league_commands_post.http_method
  integration_http_method = "POST"
  type                    = "HTTP"
  uri                     = "https://${aws_api_gateway_rest_api.fb_rest_api.id}.execute-api.${var.aws_region}.amazonaws.com/dev"

  depends_on = [
    aws_vpc_endpoint.api_gateway_endpoint,
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post,
#    aws_api_gateway_deployment.deployment_dev,
#    aws_api_gateway_stage.stage_dev,
#    aws_api_gateway_method_settings.fb_league_commands_post_settings_for_dev
  ]

  ##  See http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
  ##  This template will pass through all parameters including path, querystring, header, stage variables,
  ##  and context through to the integration endpoint via the body/payload
  ##  'rawBody' allows pass through of the raw request body
  request_templates = {
    "application/json" = <<EOF
    #set($allParams = $input.params())
    {
    "rawBody": "$util.escapeJavaScript($input.body).replace("\'", "'")",
    "body-json" : $input.json('$'),
    "params" : {
    #foreach($type in $allParams.keySet())
        #set($params = $allParams.get($type))
    "$type" : {
        #foreach($paramName in $params.keySet())
        "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
            #if($foreach.hasNext),#end
        #end
    }
        #if($foreach.hasNext),#end
    #end
    },
    "stage-variables" : {
    #foreach($key in $stageVariables.keySet())
    "$key" : "$util.escapeJavaScript($stageVariables.get($key))"
        #if($foreach.hasNext),#end
    #end
    },
    "context" : {
        "account-id" : "$context.identity.accountId",
        "api-id" : "$context.apiId",
        "api-key" : "$context.identity.apiKey",
        "authorizer-principal-id" : "$context.authorizer.principalId",
        "caller" : "$context.identity.caller",
        "cognito-authentication-provider" : "$context.identity.cognitoAuthenticationProvider",
        "cognito-authentication-type" : "$context.identity.cognitoAuthenticationType",
        "cognito-identity-id" : "$context.identity.cognitoIdentityId",
        "cognito-identity-pool-id" : "$context.identity.cognitoIdentityPoolId",
        "http-method" : "$context.httpMethod",
        "stage" : "$context.stage",
        "source-ip" : "$context.identity.sourceIp",
        "user" : "$context.identity.user",
        "user-agent" : "$context.identity.userAgent",
        "user-arn" : "$context.identity.userArn",
        "request-id" : "$context.requestId",
        "resource-id" : "$context.resourceId",
        "resource-path" : "$context.resourcePath"
        }
    }
    EOF
  }
}

resource "aws_api_gateway_method_response" "fb_league_commands_method_response_200" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id = aws_api_gateway_resource.fb_league_commands.id
  http_method = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code = "200"

  depends_on = [
    aws_vpc_endpoint.api_gateway_endpoint,
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post
  ]
}

resource "aws_api_gateway_method_response" "fb_league_commands_method_response_401" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id = aws_api_gateway_resource.fb_league_commands.id
  http_method = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code = "401"

  depends_on = [
    aws_vpc_endpoint.api_gateway_endpoint,
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post
  ]
}

resource "aws_api_gateway_method_response" "fb_league_commands_method_response_500" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id = aws_api_gateway_resource.fb_league_commands.id
  http_method = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code = "500"

  depends_on = [
    aws_vpc_endpoint.api_gateway_endpoint,
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post
  ]
}

resource "aws_api_gateway_integration_response" "fb_league_commands_integration_response_401" {
  rest_api_id           = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id           = aws_api_gateway_resource.fb_league_commands.id
  http_method           = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code           = "401"
  selection_pattern     = ".*[UNAUTHORIZED].*"
  response_templates = {
    "application/json" = "{ \"error\": \"Unauthorized\" }"
  }

  depends_on = [
    aws_api_gateway_integration.fb_league_commands_post_integration_for_dev,
    aws_api_gateway_integration.fb_league_commands_post_integration_for_prod
  ]
}

resource "aws_api_gateway_integration_response" "fb_league_commands_integration_response_500" {
  rest_api_id           = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id           = aws_api_gateway_resource.fb_league_commands.id
  http_method           = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code           = "500"
  selection_pattern     = ".*[ERROR].*"
  response_templates = {
    "application/json" = "{ \"error\": \"Server Error\" }"
  }

  depends_on = [
    aws_api_gateway_integration.fb_league_commands_post_integration_for_dev,
    aws_api_gateway_integration.fb_league_commands_post_integration_for_prod
  ]
}

resource "aws_api_gateway_integration_response" "fb_league_commands_integration_response_200" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  resource_id = aws_api_gateway_resource.fb_league_commands.id
  http_method = aws_api_gateway_method.fb_league_commands_post.http_method
  status_code = "200"

  depends_on = [
    aws_api_gateway_integration.fb_league_commands_post_integration_for_dev,
    aws_api_gateway_integration.fb_league_commands_post_integration_for_prod
  ]
}

resource "aws_api_gateway_deployment" "deployment_prod" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id

  lifecycle {
    create_before_destroy = true
  }

  triggers = {
    # TAKEN FROM DOCS --v
    # NOTE: The configuration below will satisfy ordering considerations,
    #       but not pick up all future REST API changes. More advanced patterns
    #       are possible, such as using the filesha1() function against the
    #       Terraform configuration file(s) or removing the .id references to
    #       calculate a hash against whole resources. Be aware that using whole
    #       resources will show a difference after the initial implementation.
    #       It will stabilize to only change when resources change afterwards.
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.fb_rest_api,
      aws_api_gateway_resource.fb_league_commands.id,
      aws_api_gateway_method.fb_league_commands_post.id,
      aws_api_gateway_integration.fb_league_commands_post_integration_for_prod.id,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_200,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_401,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_500
    ]))
  }

  #  depends_on = [
  #    aws_api_gateway_rest_api.fb_rest_api,
  #    aws_api_gateway_resource.fb_league_commands,
  #    aws_api_gateway_method.fb_league_commands_post
  #  ]
}

resource "aws_api_gateway_deployment" "deployment_dev" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id

  lifecycle {
    create_before_destroy = true
  }

  triggers = {
    # TAKEN FROM DOCS --v
    # NOTE: The configuration below will satisfy ordering considerations,
    #       but not pick up all future REST API changes. More advanced patterns
    #       are possible, such as using the filesha1() function against the
    #       Terraform configuration file(s) or removing the .id references to
    #       calculate a hash against whole resources. Be aware that using whole
    #       resources will show a difference after the initial implementation.
    #       It will stabilize to only change when resources change afterwards.
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.fb_rest_api,
      aws_api_gateway_resource.fb_league_commands.id,
      aws_api_gateway_method.fb_league_commands_post.id,
      aws_api_gateway_integration.fb_league_commands_post_integration_for_dev.id,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_200,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_401,
      aws_api_gateway_integration_response.fb_league_commands_integration_response_500
    ]))
  }

  #  depends_on = [
  #    aws_api_gateway_rest_api.fb_rest_api,
  #    aws_api_gateway_resource.fb_league_commands,
  #    aws_api_gateway_method.fb_league_commands_post
  #  ]
}

resource "aws_api_gateway_stage" "stage_prod" {
  deployment_id = aws_api_gateway_deployment.deployment_prod.id
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  stage_name = "prod"
}

resource "aws_api_gateway_stage" "stage_dev" {
  deployment_id = aws_api_gateway_deployment.deployment_dev.id
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  stage_name = "dev"
}

resource "aws_api_gateway_method_settings" "fb_league_commands_post_settings_for_prod" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  stage_name  = aws_api_gateway_stage.stage_prod.stage_name
  method_path = trimprefix("${aws_api_gateway_resource.fb_league_commands.path_part}/POST", "/")

  settings {
    logging_level = "INFO"
    metrics_enabled    = true
    data_trace_enabled = true
  }

  depends_on = [
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post
  ]
}

resource "aws_api_gateway_method_settings" "fb_league_commands_post_settings_for_dev" {
  rest_api_id = aws_api_gateway_rest_api.fb_rest_api.id
  stage_name  = aws_api_gateway_stage.stage_dev.stage_name
  method_path = trimprefix("${aws_api_gateway_resource.fb_league_commands.path_part}/POST", "/")

  settings {
    logging_level = "INFO"
    metrics_enabled    = true
    data_trace_enabled = true
  }

  depends_on = [
    aws_api_gateway_rest_api.fb_rest_api,
    aws_api_gateway_resource.fb_league_commands,
    aws_api_gateway_method.fb_league_commands_post
  ]
}