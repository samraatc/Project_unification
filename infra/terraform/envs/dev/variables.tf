variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Primary AWS region. us-east-1 by default; Phase 7 splits to ap-south-1 + us-east-1 for residency."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the dev VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "eks_cluster_version" {
  description = "Kubernetes version."
  type        = string
  default     = "1.30"
}

variable "atlas_org_id" {
  description = "MongoDB Atlas organisation ID."
  type        = string
}

variable "atlas_project_name" {
  description = "Atlas project name."
  type        = string
  default     = "unified-platform-dev"
}

variable "atlas_public_key" {
  description = "Atlas API public key. Provide via TF_VAR_ or CI secret."
  type        = string
  sensitive   = true
}

variable "atlas_private_key" {
  description = "Atlas API private key."
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the CI deploy role."
  type        = string
  default     = "samraatc/Project_unification"
}

variable "domain_name" {
  description = "Apex domain that will host dev staging URLs (e.g. dev.unified.example.com)."
  type        = string
  default     = "dev.unified.example.com"
}
