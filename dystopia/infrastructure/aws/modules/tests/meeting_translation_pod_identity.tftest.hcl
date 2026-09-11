mock_provider "aws" {
  mock_data "aws_security_group" {
    defaults = {
      id = "sg-private-trust"
    }
  }

  mock_resource "aws_iam_policy" {
    defaults = {
      arn = "arn:aws:iam::337169763788:policy/test"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/test"
    }
  }
}
mock_provider "random" {}

override_data {
  target = data.aws_vpc.eks_production
  values = {
    id = "vpc-test"
  }
}

override_data {
  target = data.aws_subnets.private
  values = {
    ids = ["subnet-a", "subnet-b"]
  }
}

override_data {
  target = data.aws_security_group.private_trust
}

override_resource {
  target = random_password.monolith_db_master
  values = {
    result = "TestPassword-0123456789"
  }
}

override_resource {
  target = aws_iam_role.meeting_translation
  values = {
    arn = "arn:aws:iam::337169763788:role/meeting-translation-production"
  }
}

variables {
  project_name         = "services"
  environment          = "production"
  user_pool_name       = "services-production"
  aws_region           = "ap-northeast-1"
  db_identifier        = "monolith-production"
  db_subnet_group_name = "monolith-production"
  common_tags = {
    Environment = "production"
  }
}

run "grants_only_streaming_transcription_and_configured_model_invocation" {
  command = apply

  assert {
    condition = jsondecode(aws_iam_policy.meeting_translation.policy).Statement == [
      {
        Effect   = "Allow"
        Action   = ["transcribe:StartStreamTranscription"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-lite-v1:0"
      },
    ]
    error_message = "Meeting translation must receive only the required Transcribe and Bedrock permissions."
  }

  assert {
    condition = (
      aws_eks_pod_identity_association.meeting_translation.namespace == "dystopia" &&
      aws_eks_pod_identity_association.meeting_translation.service_account == "meeting-translation" &&
      aws_eks_pod_identity_association.meeting_translation.role_arn == aws_iam_role.meeting_translation.arn
    )
    error_message = "Meeting translation Pod Identity must bind the dystopia service account to its role."
  }
}
