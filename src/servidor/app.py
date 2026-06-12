from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import socket
import subprocess
import os
from config import HOST, PORT
from state import update_telemetry, get_telemetry, push_alert, get_alerts, utc_now_iso
from firestore_client import list_documents, get_document, create_alert

app = Flask(__name__)
CORS(app)



def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def print_server_info():
    local_ip = get_local_ip()
    print("=" * 58)
    print("SERVIDOR ORQUESTRADOR INICIADO")
    print("=" * 58)
    print(f"Localhost      -> http://127.0.0.1:{PORT}")
    print(f"IP da rede     -> http://{local_ip}:{PORT}")
    print(f"Health check   -> http://{local_ip}:{PORT}/health")
    print(f"Medidas (T/H)  -> http://{local_ip}:{PORT}/api/medidas")
    print(f"Alertas        -> http://{local_ip}:{PORT}/api/alertas")
    print(f"ESP32 Telemetria -> http://{local_ip}:{PORT}/api/esp32/telemetria")
    print(f"ESP32 Alertas    -> http://{local_ip}:{PORT}/api/esp32/alertas")
    print("=" * 58)


@app.get("/")
def home():
    return "Servidor orquestrador online!"


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "servico": "orquestrador-iot",
        "timestamp": utc_now_iso(),
    })


@app.get("/api/medidas")
@app.get("/api/temperaturas")
@app.get("/api/umidades")
@app.get("/api/umidade")
@app.get("/api/humidade")
def api_get_medidas():
    return jsonify(get_telemetry())


@app.get("/api/alertas")
def api_get_alertas():
    return jsonify(get_alerts())


@app.post("/api/esp32/telemetria")
def esp32_post_telemetria():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"erro": "JSON invalido ou ausente"}), 400

        atualizada = update_telemetry(data)
        return jsonify({
            "ok": True,
            "mensagem": "Telemetria recebida com sucesso",
            "dados": atualizada,
        }), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.post("/api/esp32/alertas")
def esp32_post_alertas():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"erro": "JSON invalido ou ausente"}), 400

        alerta = {
            "sensorId": data.get("sensorId", "esp32-tres-sensores"),
            "descricao": data.get("descricao", "Alerta recebido do ESP32"),
            "tipoAlerta": data.get("tipoAlerta", "Leitura Anomala"),
            "severidade": data.get("severidade", "ALTA"),
            "status": data.get("status", "PENDENTE"),
            "dataHora": utc_now_iso(),
            "sensorComProblema": data.get("sensorComProblema"),
            "temperaturaMedia": data.get("temperaturaMedia"),
            "umidadeMedia": data.get("umidadeMedia"),
            "temperaturaSensor": data.get("temperaturaSensor"),
            "umidadeSensor": data.get("umidadeSensor"),
        }

        firestore_response = create_alert(alerta)
        alerta_local = dict(alerta)
        alerta_local["firestoreDoc"] = firestore_response.get("name")
        push_alert(alerta_local)

        return jsonify({
            "ok": True,
            "mensagem": "Alerta salvo no Firestore",
            "alerta": alerta_local,
        }), 200
    except requests.HTTPError as e:
        detalhe = e.response.text if e.response is not None else str(e)
        return jsonify({
            "erro": "Erro HTTP no Firestore",
            "detalhe": detalhe,
        }), 500
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.get("/api/firebase/lotes")
def get_lotes():
    try:
        page_size = int(request.args.get("pageSize", 100))
        docs = list_documents("lotes", page_size)
        return jsonify({"total": len(docs), "itens": docs}), 200
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        detalhe = e.response.text if e.response is not None else str(e)
        return jsonify({"erro": "Erro ao buscar lotes", "detalhe": detalhe}), status
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.get("/api/firebase/lotes/<doc_id>")
def get_lote_por_id(doc_id):
    try:
        doc = get_document("lotes", doc_id)
        return jsonify(doc), 200
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        detalhe = e.response.text if e.response is not None else str(e)
        return jsonify({"erro": "Erro ao buscar lote", "detalhe": detalhe}), status
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.get("/api/firebase/limites")
def get_limites():
    try:
        page_size = int(request.args.get("pageSize", 100))
        docs = list_documents("limites", page_size)
        return jsonify({"total": len(docs), "itens": docs}), 200
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        detalhe = e.response.text if e.response is not None else str(e)
        return jsonify({"erro": "Erro ao buscar limites", "detalhe": detalhe}), status
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.get("/api/firebase/limites/<doc_id>")
def get_limite_por_id(doc_id):
    try:
        doc = get_document("limites", doc_id)
        return jsonify(doc), 200
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        detalhe = e.response.text if e.response is not None else str(e)
        return jsonify({"erro": "Erro ao buscar limite", "detalhe": detalhe}), status
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


if __name__ == "__main__":
    print_server_info()
    
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        print("\n==========================================================")
        print("🌍 Iniciando LocalTunnel...")
        print("URL Publica: https://temperaturas-api-igor.loca.lt")
        print("==========================================================\n")
        subprocess.Popen(
            f"npx localtunnel --port {PORT} --subdomain temperaturas-api-igor",
            shell=True
        )
        
    app.run(host=HOST, port=PORT, debug=True)
