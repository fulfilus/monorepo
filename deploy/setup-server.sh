#!/usr/bin/env bash
# Run once on a fresh Hetzner CX21 Ubuntu 24.04 server as root.
# Usage: ssh root@<server-ip> "bash -s" < deploy/setup-server.sh

set -euo pipefail

# Docker
apt-get update -q
apt-get install -y -q ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin

# PostgreSQL client (for migration restore)
apt-get install -y -q postgresql-client

# App directory
mkdir -p /opt/fulfilus
echo "==> Server ready. Next: clone repo, add .env, run docker compose up -d"
