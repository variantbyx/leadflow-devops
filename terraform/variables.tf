variable "kubeconfig_path" {
  type        = string
  default     = "~/.kube/config"
  description = "Path to the kubeconfig file"
}

variable "namespace" {
  type        = string
  default     = "leadflow"
  description = "Kubernetes namespace for LeadFlow"
}

variable "db_password" {
  type        = string
  default     = "postgres"
  sensitive   = true
  description = "PostgreSQL password"
}

variable "backend_image" {
  type        = string
  default     = "leadflow-backend:latest"
  description = "Docker image for backend"
}

variable "frontend_image" {
  type        = string
  default     = "leadflow-frontend:latest"
  description = "Docker image for frontend"
}

variable "app_version" {
  type        = string
  default     = "v1.0.0"
  description = "Release version"
}