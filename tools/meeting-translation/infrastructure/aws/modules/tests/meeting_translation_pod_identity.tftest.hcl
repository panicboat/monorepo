mock_provider "aws" {
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

override_data {
  target = data.aws_eks_cluster.this
}

variables {
  environment = "production"
  aws_region  = "ap-northeast-1"
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
      aws_eks_pod_identity_association.meeting_translation.namespace == "tools" &&
      aws_eks_pod_identity_association.meeting_translation.service_account == "meeting-translation" &&
      aws_eks_pod_identity_association.meeting_translation.role_arn == aws_iam_role.meeting_translation.arn
    )
    error_message = "Meeting translation Pod Identity must bind the tools service account to its role."
  }
}
