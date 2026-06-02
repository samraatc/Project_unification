# -----------------------------------------------------------------------------
# Unified Platform — dev environment.
# Sprint 0 decisions:
#   * AWS primary (EKS + ElastiCache + S3 + ACM)
#   * Mongo Atlas dedicated audit cluster (separate from the primary)
# -----------------------------------------------------------------------------

module "vpc" {
  source = "../../modules/vpc"

  name = "unified-${var.environment}"
  cidr = var.vpc_cidr
}

module "eks" {
  source = "../../modules/eks"

  cluster_name       = "unified-${var.environment}"
  cluster_version    = var.eks_cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = "t3.medium"
  node_min_size      = 2
  node_max_size      = 4
  node_desired_size  = 2
}

module "redis" {
  source = "../../modules/redis"

  name               = "unified-${var.environment}"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  node_type          = "cache.t4g.small"
  allowed_cidr_block = var.vpc_cidr
}

module "s3" {
  source = "../../modules/s3"

  bucket_prefix = "unified-${var.environment}"
  versioning    = true
  lifecycle_glacier_days = 90
}

module "acm" {
  source = "../../modules/acm"

  domain_name = var.domain_name
}

# Primary Atlas cluster — application data.
module "atlas_primary" {
  source = "../../modules/atlas"

  org_id        = var.atlas_org_id
  project_name  = var.atlas_project_name
  cluster_name  = "unified-${var.environment}-primary"
  cluster_tier  = "M10"
  region        = "US_EAST_1"
  cloud         = "AWS"
  backup_enabled = true
}

# Dedicated audit cluster (Sprint 0 decision). WORM-mounted object shards land
# in Phase 6 once Atlas tier supports it — placeholder until then.
module "atlas_audit" {
  source = "../../modules/atlas"

  org_id        = var.atlas_org_id
  project_name  = var.atlas_project_name
  cluster_name  = "unified-${var.environment}-audit"
  cluster_tier  = "M10"
  region        = "US_EAST_1"
  cloud         = "AWS"
  backup_enabled = true
}

# CI deploy role — federated to GitHub Actions via OIDC.
module "ci_oidc" {
  source = "../../modules/ci-oidc"

  github_repo = var.github_repo
  role_name   = "unified-${var.environment}-ci-deploy"
}
