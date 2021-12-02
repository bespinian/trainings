provider "google" {
  project = "<project-id>"
  region  = "europe-west6"
  zone    = "europe-west6-a"
}

data "google_compute_network" "def" {
  name = "default"
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = data.google_compute_network.def.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = data.google_compute_network.def.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

resource "random_id" "db_name_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "instance" {
  name             = "private-instance-${random_id.db_name_suffix.hex}"
  region           = "europe-west6"
  database_version = "MYSQL_5_7"

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled    = false
      private_network = data.google_compute_network.def.id
    }
  }
}
