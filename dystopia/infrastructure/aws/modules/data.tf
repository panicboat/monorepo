data "aws_vpc" "eks_production" {
  tags = {
    Name = "vpc-production"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.eks_production.id]
  }
  tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

data "aws_subnet" "private_details" {
  for_each = toset(data.aws_subnets.private.ids)
  id       = each.value
}

data "aws_eks_cluster" "this" {
  name = "eks-${var.environment}"
}
