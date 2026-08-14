#!/usr/bin/env sh
# Manual OSRM prepare (alternative to docker-compose osrm-download / osrm-prepare).
# Requires: curl, docker
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DATA_DIR="${ROOT}/data/osrm"
PBF_NAME="rio-grande-do-sul-latest.osm.pbf"
PBF_URL="https://download.openstreetmap.fr/extracts/south-america/brazil/south/${PBF_NAME}"
IMAGE="osrm/osrm-backend:latest"

mkdir -p "${DATA_DIR}"

if [ ! -f "${DATA_DIR}/${PBF_NAME}" ]; then
  echo "Downloading ${PBF_NAME}..."
  curl -fL --retry 5 --retry-delay 5 -o "${DATA_DIR}/${PBF_NAME}" "${PBF_URL}"
fi

if [ ! -f "${DATA_DIR}/rio-grande-do-sul-latest.osrm.partition" ]; then
  echo "Extracting motorcycle graph..."
  docker run --rm -t \
    -v "${DATA_DIR}:/data" \
    -v "${ROOT}/osrm/profiles/motorcycle.lua:/opt/motorcycle.lua:ro" \
    "${IMAGE}" osrm-extract -p /opt/motorcycle.lua "/data/${PBF_NAME}"

  docker run --rm -t -v "${DATA_DIR}:/data" "${IMAGE}" \
    osrm-partition /data/rio-grande-do-sul-latest.osrm

  docker run --rm -t -v "${DATA_DIR}:/data" "${IMAGE}" \
    osrm-customize /data/rio-grande-do-sul-latest.osrm
fi

echo "OSRM data ready in ${DATA_DIR}"
