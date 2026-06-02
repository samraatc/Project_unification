# Remote backend — bootstrap the bucket + table once via the manual root module
# before running `terraform init` here.
terraform {
  backend "s3" {
    bucket         = "terraform-state-unified-platform"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks-unified-platform"
    encrypt        = true
  }
}
