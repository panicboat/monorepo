data "aws_caller_identity" "current" {}

data "aws_vpc" "this" {
  tags = {
    Name = "vpc"
  }
}

data "aws_db_subnet_group" "vpc" {
  name = "vpc"
}

data "aws_security_group" "internal" {
  vpc_id = data.aws_vpc.this.id

  tags = {
    Name = "internal"
  }
}
