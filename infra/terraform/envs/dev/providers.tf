provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "unified-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "elskov-platform"
    }
  }
}

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}
