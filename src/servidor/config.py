PROJECT_ID = "tresirmaos-cloud"
SERVICE_ACCOUNT_FILE = "serviceAccountKey.json"
SCOPES = ["https://www.googleapis.com/auth/datastore"]
HOST = "0.0.0.0"
PORT = 8081
FIRESTORE_BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"
MAX_ALERTS_CACHE = 100