resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "leadflow-frontend"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
    labels = {
      app = "leadflow-frontend"
    }
  }

  spec {
    replicas = 2

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0"
      }
    }

    selector {
      match_labels = {
        app = "leadflow-frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "leadflow-frontend"
        }
      }

      spec {
        container {
          name              = "frontend"
          image             = var.frontend_image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 3000
          }

          env {
            name  = "DEV_API_URL"
            value = "http://leadflow-backend:3001"
          }
        }
      }
    }
  }
}

# Frontend Service
resource "kubernetes_service" "frontend_service" {
  metadata {
    name      = "leadflow-frontend"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
  }

  spec {
    selector = {
      app = "leadflow-frontend"
    }

    port {
      port        = 3000
      target_port = 3000
    }
  }
}