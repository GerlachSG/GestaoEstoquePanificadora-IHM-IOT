import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from config import SERVICE_ACCOUNT_FILE, SCOPES, FIRESTORE_BASE_URL


def get_access_token():
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=SCOPES,
    )
    credentials.refresh(Request())
    return credentials.token


def auth_headers():
    token = get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def to_firestore_value(value):
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if value is None:
        return {"nullValue": None}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in value.items()}}}
    if isinstance(value, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in value]}}
    return {"stringValue": str(value)}


def to_firestore_fields(data):
    return {"fields": {k: to_firestore_value(v) for k, v in data.items()}}


def parse_firestore_value(value_obj):
    if "stringValue" in value_obj:
        return value_obj["stringValue"]
    if "integerValue" in value_obj:
        raw = value_obj["integerValue"]
        try:
            return int(raw)
        except Exception:
            return raw
    if "doubleValue" in value_obj:
        return float(value_obj["doubleValue"])
    if "booleanValue" in value_obj:
        return value_obj["booleanValue"]
    if "nullValue" in value_obj:
        return None
    if "timestampValue" in value_obj:
        return value_obj["timestampValue"]
    if "mapValue" in value_obj:
        fields = value_obj.get("mapValue", {}).get("fields", {})
        return {k: parse_firestore_value(v) for k, v in fields.items()}
    if "arrayValue" in value_obj:
        values = value_obj.get("arrayValue", {}).get("values", [])
        return [parse_firestore_value(v) for v in values]
    return value_obj


def parse_firestore_document(doc):
    fields = doc.get("fields", {})
    parsed = {k: parse_firestore_value(v) for k, v in fields.items()}
    parsed["name"] = doc.get("name")
    parsed["createTime"] = doc.get("createTime")
    parsed["updateTime"] = doc.get("updateTime")
    parsed["docId"] = doc.get("name", "").split("/")[-1]
    return parsed


def list_documents(collection_name, page_size=100):
    url = f"{FIRESTORE_BASE_URL}/{collection_name}?pageSize={page_size}"
    response = requests.get(url, headers=auth_headers(), timeout=20)
    response.raise_for_status()
    documents = response.json().get("documents", [])
    return [parse_firestore_document(doc) for doc in documents]


def get_document(collection_name, doc_id):
    url = f"{FIRESTORE_BASE_URL}/{collection_name}/{doc_id}"
    response = requests.get(url, headers=auth_headers(), timeout=20)
    response.raise_for_status()
    return parse_firestore_document(response.json())


def create_alert(documento):
    url = f"{FIRESTORE_BASE_URL}/alertas"
    payload = to_firestore_fields(documento)
    response = requests.post(url, headers=auth_headers(), json=payload, timeout=20)
    response.raise_for_status()
    return response.json()
