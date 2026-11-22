# PVC for persistent database storage
resource "kubernetes_persistent_volume_claim" "postgres_pvc" {
  metadata {
    name      = "leadflow-db-pvc"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "1Gi"
      }
    }
  }
  wait_until_bound = false
}

# PostgreSQL Deployment
resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "leadflow-db"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }

  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "leadflow-db"
      }
    }

    template {
      metadata {
        labels = {
          app = "leadflow-db"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:16-alpine"

          port {
            container_port = 5432
          }

          env {
            name  = "POSTGRES_USER"
            value = "postgres"
          }
          env {
            name  = "POSTGRES_DB"
            value = "leadflow"
          }
          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.leadflow_secrets.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          volume_mount {
            name       = "postgres-storage"
            mount_path = "/var/lib/postgresql/data"
          }
        }

        volume {
          name = "postgres-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres_pvc.metadata[0].name
          }
        }
      }
    }
  }
}

# Database Service
resource "kubernetes_service" "postgres_service" {
  metadata {
    name      = "leadflow-db"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }

  spec {
    selector = {
      app = "leadflow-db"
    }

    port {
      port        = 5432
      target_port = 5432
    }
  }
}