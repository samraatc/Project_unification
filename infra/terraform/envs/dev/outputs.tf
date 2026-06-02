output "vpc_id"             { value = module.vpc.vpc_id }
output "eks_cluster_name"   { value = module.eks.cluster_name }
output "eks_cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}
output "redis_endpoint"     { value = module.redis.endpoint }
output "s3_bucket"          { value = module.s3.bucket_name }
output "acm_certificate_arn" { value = module.acm.certificate_arn }
output "atlas_primary_uri"  {
  value     = module.atlas_primary.connection_string
  sensitive = true
}
output "atlas_audit_uri" {
  value     = module.atlas_audit.connection_string
  sensitive = true
}
output "ci_role_arn" { value = module.ci_oidc.role_arn }
