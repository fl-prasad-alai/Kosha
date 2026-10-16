#!/usr/bin/env bash
# Deploys Kosha to Cloud Run with Gemini on Vertex AI and passports in Firestore.
# Usage: PROJECT_ID=my-project ./deploy.sh     (needs gcloud, logged in, billing enabled)
set -euo pipefail
: "${PROJECT_ID:?Set PROJECT_ID to your Google Cloud project id}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-kosha}"
SA="kosha-run@${PROJECT_ID}.iam.gserviceaccount.com"
# Signs session cookies. Keep the same value across deploys, or everyone is signed out.
KOSHA_SECRET="${KOSHA_SECRET:-$(openssl rand -hex 32)}"
echo "Session secret (save it and pass KOSHA_SECRET=... next time to keep sessions): ${KOSHA_SECRET}"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com aiplatform.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Firestore (Native mode) for passports. Ignore the error if it already exists.
gcloud firestore databases create --location="$REGION" --type=firestore-native 2>/dev/null || true

# A service account that may call Vertex AI and use Firestore, and nothing else.
gcloud iam service-accounts create kosha-run --display-name="Kosha Cloud Run" 2>/dev/null || true
for role in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA}" --role="$role" --condition=None >/dev/null
done

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --service-account "$SA" \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 300 --max-instances 3 --concurrency 40 \
  --set-env-vars "^@^GOOGLE_GENAI_USE_VERTEXAI=true@GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@GOOGLE_CLOUD_LOCATION=global@KOSHA_STORE=firestore@KOSHA_MAPS_GROUNDING=1@GEMINI_MODELS=gemini-3-flash-preview,gemini-2.5-flash@KOSHA_HOURLY_BUDGET=80@KOSHA_SECRET=${KOSHA_SECRET}"

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
