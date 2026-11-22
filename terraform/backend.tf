resource "kubernetes_deployment" "backend" {
  depends_on = [kubernetes_deployment.postgres]
  metadata {
    name      = "leadflow-backend"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
    labels = {
      app = "leadflow-backend"
    }
  }

  spec {
    replicas = 2 # 2 replicas for high availability and zero downtime

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0" # Zero downtime: always keep pods serving
      }
    }

    selector {
      match_labels = {
        app = "leadflow-backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "leadflow-backend"
        }
      }

      spec {
        container {
          name              = "backend"
          image             = var.backend_image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 3001
          }

          env {
            name  = "PORT"
            value = "3001"
          }
          env {
            name  = "APP_VERSION"
            value = var.app_version
          }
          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.leadflow_secrets.metadata[0].name
                key  = "DATABASE_URL"
              }
            }
          }

          # Traps handled: /healthz for liveness, /readyz for DB readiness
          liveness_probe {
            http_get {
              path = "/healthz"
              port = 3001
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/readyz"
              port = 3001
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# Backend Service
resource "kubernetes_service" "backend_service" {
  metadata {
    name      = "leadflow-backend"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }

  spec {
    selector = {
      app = "leadflow-backend"
    }

    port {
      port        = 3001
      target_port = 3001
    }
  }
}