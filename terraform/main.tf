terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">=2.31.0"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

# Isolated namespace
resource "kubernetes_namespace" "leadflow" {
  metadata {
    name = var.namespace
  }
}

# Kubernetes Secret (never committed to git)
resource "kubernetes_secret" "leadflow_secrets" {
  metadata {
    name      = "leadflow-secrets"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }

  data = {
    DATABASE_URL = "postgres://postgres:${var.db_password}@leadflow-db:5432/leadflow"
    POSTGRES_PASSWORD = var.db_password
  }

  type = "Opaque"
}