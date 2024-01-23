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

resource "aws_iam_role" "nlb_ec2_role" {
  name = "nlb-ec2-role"

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

data "aws_iam_policy_document" "nlb_access_logs_policy_doc" {
  statement {
    effect = "Allow"

    actions = [
      "s3:*"
    ]

    resources = ["arn:aws:s3:::tf-nlb-access-logs-bucket/*"]
  }
}

resource "aws_iam_policy" "nlb_access_logs_policy" {
  name        = "nlb_access_logs_policy"
  description = "Policy for NLB Access Logs"
  policy      = data.aws_iam_policy_document.nlb_access_logs_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "nlb_access_logs_attachment" {
  policy_arn = aws_iam_policy.nlb_access_logs_policy.arn
  role       = aws_iam_role.nlb_ec2_role.name
}

resource "aws_iam_role_policy_attachment" "nlb_dynamodb_access_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
  role       = aws_iam_role.nlb_ec2_role.name
}

resource "aws_s3_bucket_policy" "nlb_access_logs_bucket_policy" {
  bucket = aws_s3_bucket.nlb_access_logs_bucket.bucket
  depends_on=[aws_s3_bucket.nlb_access_logs_bucket]

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          AWS: [
            "arn:aws:iam::188323148095:user/terraform-local-user",
            "arn:aws:iam::${var.aws_lb_region_code}:root"
          ],
          Service: "delivery.logs.amazonaws.com"
        }
        Action = ["s3:*"],
        Resource = [
          "${aws_s3_bucket.nlb_access_logs_bucket.arn}/*",
        ],
      },
    ],
  })
}