data "aws_eks_cluster" "this" {
  name = "eks-${var.environment}"
}
