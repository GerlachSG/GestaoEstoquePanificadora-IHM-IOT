from collections import deque
from datetime import datetime, timezone
from config import MAX_ALERTS_CACHE

LATEST_TELEMETRY = {
    "sensorId": "esp32-tres-sensores",
    "timestamp": None,
    "origem": "nenhuma",
    "temperaturaMedia": None,
    "umidadeMedia": None,
    "temperaturas": {
        "sensor1": None,
        "sensor2": None,
        "sensor3": None,
    },
    "umidades": {
        "sensor1": None,
        "sensor2": None,
        "sensor3": None,
    },
}

LATEST_ALERTS = deque(maxlen=MAX_ALERTS_CACHE)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def update_telemetry(payload):
    LATEST_TELEMETRY["sensorId"] = payload.get("sensorId", "esp32-tres-sensores")
    LATEST_TELEMETRY["timestamp"] = utc_now_iso()
    LATEST_TELEMETRY["origem"] = "esp32"
    LATEST_TELEMETRY["temperaturaMedia"] = payload.get("mediaTemp")
    LATEST_TELEMETRY["umidadeMedia"] = payload.get("mediaUmid")
    LATEST_TELEMETRY["temperaturas"] = {
        "sensor1": payload.get("t1"),
        "sensor2": payload.get("t2"),
        "sensor3": payload.get("t3"),
    }
    LATEST_TELEMETRY["umidades"] = {
        "sensor1": payload.get("h1"),
        "sensor2": payload.get("h2"),
        "sensor3": payload.get("h3"),
    }
    return LATEST_TELEMETRY


def get_telemetry():
    return LATEST_TELEMETRY


def push_alert(alert):
    LATEST_ALERTS.appendleft(alert)
    return alert


def get_alerts():
    return {
        "total": len(LATEST_ALERTS),
        "itens": list(LATEST_ALERTS),
    }
