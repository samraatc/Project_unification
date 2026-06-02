terraform {
  required_providers {
    mongodbatlas = { source = "mongodb/mongodbatlas", version = "~> 1.18" }
  }
}

variable "org_id"         { type = string }
variable "project_name"   { type = string }
variable "cluster_name"   { type = string }
variable "cluster_tier"   { type = string }
variable "region"         { type = string }
variable "cloud"          { type = string, default = "AWS" }
variable "backup_enabled" { type = bool, default = true }

resource "mongodbatlas_project" "this" {
  org_id = var.org_id
  name   = var.project_name
}

resource "mongodbatlas_advanced_cluster" "this" {
  project_id   = mongodbatlas_project.this.id
  name         = var.cluster_name
  cluster_type = "REPLICASET"

  backup_enabled = var.backup_enabled

  replication_specs {
    region_configs {
      provider_name = var.cloud
      region_name   = var.region
      priority      = 7

      electable_specs {
        instance_size = var.cluster_tier
        node_count    = 3
      }
    }
  }
}

output "connection_string" {
  value     = mongodbatlas_advanced_cluster.this.connection_strings[0].standard_srv
  sensitive = true
}
