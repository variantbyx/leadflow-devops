resource "kubernetes_ingress_v1" "leadflow_ingress" {
  metadata {
    name      = "leadflow-ingress"
    namespace = kubernetes_namespace.leadflow.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"              = "nginx"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
    }
  }

  spec {
    rule {
      http {
        # 1. Route /api to Backend
        path {
          path      = "/api"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.backend_service.metadata[0].name
              port {
                number = 3001
              }
            }
          }
        }

        # 2. Route health & version endpoints to Backend
        path {
          path      = "/healthz"
          path_type = "Exact"
          backend {
            service {
              name = kubernetes_service.backend_service.metadata[0].name
              port {
                number = 3001
              }
            }
          }
        }

        path {
          path      = "/readyz"
          path_type = "Exact"
          backend {
            service {
              name = kubernetes_service.backend_service.metadata[0].name
              port {
                number = 3001
              }
            }
          }
        }

        path {
          path      = "/version"
          path_type = "Exact"
          backend {
            service {
              name = kubernetes_service.backend_service.metadata[0].name
              port {
                number = 3001
              }
            }
          }
        }

        # 3. Route everything else to Frontend UI
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.frontend_service.metadata[0].name
              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }
}