#!/bin/bash

# Migration Script: Trigger medication data migration via API
# This script calls the deployed Cloud Function to migrate medications from legacy to unified system

echo "🚀 Starting Medication Migration to Unified System"
echo "=================================================="
echo ""

# Configuration
API_URL="https://us-central1-claritystream-uldp9.cloudfunctions.net/api"
MIGRATION_ENDPOINT="$API_URL/unified-medication/medication-commands/migrate-from-legacy"

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

echo "🔐 Getting authentication token..."
# Get the current user's ID token
TOKEN=$(firebase login:ci --no-localhost 2>/dev/null || firebase auth:export --format=JSON 2>/dev/null | jq -r '.users[0].customAttributes' 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    echo "Please ensure you're logged in with: firebase login"
    exit 1
fi

echo "✅ Authentication token obtained"
echo ""

# Ask for confirmation
read -p "Run migration in DRY RUN mode first? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    DRY_RUN="true"
    echo "🔍 Running in DRY RUN mode (no changes will be made)"
else
    DRY_RUN="false"
    echo "⚠️  Running in PRODUCTION mode (changes will be applied)"
    read -p "Are you sure you want to proceed? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Migration cancelled"
        exit 0
    fi
fi

echo ""
echo "📡 Calling migration endpoint..."
echo "URL: $MIGRATION_ENDPOINT"
echo ""

# Call the migration endpoint
RESPONSE=$(curl -s -X POST "$MIGRATION_ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\": $DRY_RUN}")

# Check if curl succeeded
if [ $? -ne 0 ]; then
    echo "❌ Failed to call migration endpoint"
    exit 1
fi

# Display response
echo "📊 Migration Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Migration script completed"