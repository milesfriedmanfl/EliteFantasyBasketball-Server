data "aws_iam_policy_document" "iam_for_api_gateway_document" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "iam_for_api_gateway" {
  name               = "tf-api-gateway-cloudwatch-global"
  assume_role_policy = data.aws_iam_policy_document.iam_for_api_gateway_document.json
  path = "/"
}

data "aws_iam_policy_document" "cloudwatch_document" {
  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
    ]

    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_policy" "api_gateway_logging" {
  name   = "tf-iam-role-policy-cloudwatch"
  path   = "/"
  policy = data.aws_iam_policy_document.cloudwatch_document.json
}

resource "aws_iam_role_policy_attachment" "gateway_logs" {
  role       = aws_iam_role.iam_for_api_gateway.id
  policy_arn = aws_iam_policy.api_gateway_logging.arn
}