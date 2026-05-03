#!/usr/bin/env bash
export NODE_INSTALLATION_VERSION=$(sed 's/^v//' "$(dirname "${BASH_SOURCE[0]}")/../.nvmrc")
export REPOSITORY_RID=ri.stemma.main.repository.41227c2b-ac07-48cc-b2bf-d55ca449fd52
export REQUESTS_CA_BUNDLE=${SSL_CERT_FILE} # Used by the Python requests module
