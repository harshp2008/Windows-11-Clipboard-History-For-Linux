#!/bin/bash
set -e

# Change to repository root
cd "$(dirname "$0")/.."

echo "Building test Docker image..."
docker build -t win11-clipboard-history-test -f Dockerfile.test .

echo "Running test container..."
# Run the container and grab the output
docker run --rm win11-clipboard-history-test

echo "Test completed successfully!"
