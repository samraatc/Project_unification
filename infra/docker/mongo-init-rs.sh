#!/usr/bin/env bash
# Initialises the local Mongo replica set so Mongoose transactions work.
set -euo pipefail

echo "Waiting for mongo to accept connections..."
until mongosh --host mongo:27017 --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
  sleep 1
done

echo "Initiating replica set rs0..."
mongosh --host mongo:27017 --quiet <<'EOF'
try {
  rs.status();
  print("Replica set already initiated");
} catch (e) {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }]
  });
  print("Replica set rs0 initiated");
}
EOF
