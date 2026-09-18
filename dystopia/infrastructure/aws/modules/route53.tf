resource "aws_route53_zone" "dystopia_local" {
  name = "dystopia.local"

  vpc {
    vpc_id = data.aws_vpc.eks_production.id
  }

  tags = var.common_tags
}

resource "aws_route53_record" "monolith_db" {
  zone_id = aws_route53_zone.dystopia_local.zone_id
  name    = "monolith-db.dystopia.local"
  type    = "CNAME"
  ttl     = 300
  records = [aws_db_instance.monolith.address]
}
