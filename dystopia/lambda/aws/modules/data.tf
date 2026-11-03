data "aws_vpc" "this" {
  tags = {
    Name = "vpc"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.this.id]
  }
  tags = { Tier = "private" }
}

data "aws_security_group" "internal" {
  vpc_id = data.aws_vpc.this.id

  tags = {
    Name = "internal"
  }
}
