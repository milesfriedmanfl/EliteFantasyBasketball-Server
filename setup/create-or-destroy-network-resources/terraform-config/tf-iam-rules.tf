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

resource "aws_iam_role" "ec2_role" {
  name = "ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com",
        },
      },
    ],
  })

  tags = {
    Name = "NLB EC2 Role",
  }
}

resource "aws_iam_role_policy_attachment" "nlb_dynamodb_access_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
  role       = aws_iam_role.ec2_role.name
}