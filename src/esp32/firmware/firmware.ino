#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

#define DHTTYPE DHT11
#define DHTPIN1 4
#define DHTPIN2 5
#define DHTPIN3 21

const char* WIFI_SSID = "Blue Whale Storm"; // "WIFI_IOT_CFP301";
const char* WIFI_PASSWORD = "Sesi2020"; // "Ac3sn0cfp1@iot";

const char* PYTHON_TELEMETRIA_URL = "http://10.108.34.106:8081/api/esp32/telemetria";
const char* PYTHON_ALERTA_URL     = "http://10.108.34.106:8081/api/esp32/alertas";

// =========================
// LIMITES E CONFIGURAÇÕES
// =========================
const float LIMITE_TEMP = 5.0;
const float LIMITE_UMID = 35.0;
const unsigned long COOLDOWN_ALERTA = 30000;
const unsigned long INTERVALO_LEITURA = 2500;

DHT dht1(DHTPIN1, DHTTYPE);
DHT dht2(DHTPIN2, DHTTYPE);
DHT dht3(DHTPIN3, DHTTYPE);

unsigned long ultimoAlertaTemp[3] = {0, 0, 0};
unsigned long ultimoAlertaUmid[3] = {0, 0, 0};
unsigned long ultimaLeitura = 0;

void conectarWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando no Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWi-Fi conectado!");
  Serial.print("IP do ESP32: ");
  Serial.println(WiFi.localIP());
}

void garantirWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("Wi-Fi caiu. Tentando reconectar...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi reconectado!");
    Serial.print("IP do ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha ao reconectar Wi-Fi.");
  }
}

bool podeEnviar(unsigned long ultimoEnvio) {
  return millis() - ultimoEnvio >= COOLDOWN_ALERTA;
}

bool enviarJson(const char* url, String json) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi desconectado. Nao foi possivel enviar requisicao.");
    return false;
  }

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  Serial.println("Enviando JSON:");
  Serial.println(json);

  int code = http.POST(json);

  Serial.print("HTTP code: ");
  Serial.println(code);

  if (code > 0) {
    String resposta = http.getString();
    Serial.println("Resposta do servidor:");
    Serial.println(resposta);
    http.end();
    return true;
  } else {
    Serial.print("Erro na requisicao: ");
    Serial.println(http.errorToString(code));
    http.end();
    return false;
  }
}

void enviarTelemetria(float t1, float h1, float t2, float h2, float t3, float h3, float mediaTemp, float mediaUmid) {
  String json = "{";
  json += "\"sensorId\":\"esp32-tres-sensores\",";
  json += "\"t1\":" + String(t1, 2) + ",";
  json += "\"h1\":" + String(h1, 2) + ",";
  json += "\"t2\":" + String(t2, 2) + ",";
  json += "\"h2\":" + String(h2, 2) + ",";
  json += "\"t3\":" + String(t3, 2) + ",";
  json += "\"h3\":" + String(h3, 2) + ",";
  json += "\"mediaTemp\":" + String(mediaTemp, 2) + ",";
  json += "\"mediaUmid\":" + String(mediaUmid, 2);
  json += "}";

  Serial.println("Enviando telemetria...");
  enviarJson(PYTHON_TELEMETRIA_URL, json);
}

void enviarAlerta(String descricao, String tipoAlerta, int sensor, float mediaTemp, float mediaUmid, float tempSensor, float umidSensor) {
  String json = "{";
  json += "\"sensorId\":\"esp32-tres-sensores\",";
  json += "\"descricao\":\"" + descricao + "\",";
  json += "\"tipoAlerta\":\"" + tipoAlerta + "\",";
  json += "\"severidade\":\"ALTA\",";
  json += "\"status\":\"PENDENTE\",";
  json += "\"sensorComProblema\":" + String(sensor) + ",";
  json += "\"temperaturaMedia\":" + String(mediaTemp, 2) + ",";
  json += "\"umidadeMedia\":" + String(mediaUmid, 2) + ",";
  json += "\"temperaturaSensor\":" + String(tempSensor, 2) + ",";
  json += "\"umidadeSensor\":" + String(umidSensor, 2);
  json += "}";

  Serial.println("Enviando alerta...");
  enviarJson(PYTHON_ALERTA_URL, json);
}

void lerSensor1(float &t, float &h) {
  t = dht1.readTemperature();
  h = dht1.readHumidity();
}

void lerSensor2(float &t, float &h) {
  t = dht2.readTemperature();
  h = dht2.readHumidity();
}

void lerSensor3(float &t, float &h) {
  t = dht3.readTemperature();
  h = dht3.readHumidity();
}

void imprimirLeituraSensor(const char* nome, float t, float h) {
  Serial.print(nome);
  Serial.print(" -> Temp: ");
  if (isnan(t)) Serial.print("ERRO");
  else Serial.print(t);

  Serial.print(" C | Umidade: ");
  if (isnan(h)) Serial.println("ERRO");
  else {
    Serial.print(h);
    Serial.println(" %");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("Sistema de monitoramento com 3 DHT11 (PRODUÇÃO)");

  dht1.begin();
  dht2.begin();
  dht3.begin();

  conectarWiFi();
}

void loop() {
  garantirWiFi();

  if (millis() - ultimaLeitura < INTERVALO_LEITURA) {
    return;
  }

  ultimaLeitura = millis();

  float t1, h1, t2, h2, t3, h3;

  lerSensor1(t1, h1);
  lerSensor2(t2, h2);
  lerSensor3(t3, h3);

  int validosTemp = 0;
  int validosUmid = 0;
  float somaTemp = 0;
  float somaUmid = 0;

  if (!isnan(t1)) { somaTemp += t1; validosTemp++; }
  if (!isnan(t2)) { somaTemp += t2; validosTemp++; }
  if (!isnan(t3)) { somaTemp += t3; validosTemp++; }

  if (!isnan(h1)) { somaUmid += h1; validosUmid++; }
  if (!isnan(h2)) { somaUmid += h2; validosUmid++; }
  if (!isnan(h3)) { somaUmid += h3; validosUmid++; }

  if (validosTemp == 0 || validosUmid == 0) {
    Serial.println("ERRO: nenhum valor valido suficiente para calcular media.");
    Serial.println("--------------------------------------------------");
    return;
  }

  float mediaTemp = somaTemp / validosTemp;
  float mediaUmid = somaUmid / validosUmid;

  Serial.println("===== LEITURA DOS SENSORES =====");
  imprimirLeituraSensor("Sensor 1", t1, h1);
  imprimirLeituraSensor("Sensor 2", t2, h2);
  imprimirLeituraSensor("Sensor 3", t3, h3);

  Serial.println("----------------------------------");
  Serial.print("Media Temperatura: ");
  Serial.print(mediaTemp);
  Serial.println(" C");

  Serial.print("Media Umidade: ");
  Serial.print(mediaUmid);
  Serial.println(" %");

  enviarTelemetria(t1, h1, t2, h2, t3, h3, mediaTemp, mediaUmid);

  if (!isnan(t1) && abs(t1 - mediaTemp) > LIMITE_TEMP && podeEnviar(ultimoAlertaTemp[0])) {
    Serial.println("ALERTA: Sensor 1 com temperatura muito diferente da media!");
    enviarAlerta("Sensor 1 com temperatura muito diferente da media", "Temperatura Alta", 1, mediaTemp, mediaUmid, t1, h1);
    ultimoAlertaTemp[0] = millis();
  }

  if (!isnan(t2) && abs(t2 - mediaTemp) > LIMITE_TEMP && podeEnviar(ultimoAlertaTemp[1])) {
    Serial.println("ALERTA: Sensor 2 com temperatura muito diferente da media!");
    enviarAlerta("Sensor 2 com temperatura muito diferente da media", "Temperatura Alta", 2, mediaTemp, mediaUmid, t2, h2);
    ultimoAlertaTemp[1] = millis();
  }

  if (!isnan(t3) && abs(t3 - mediaTemp) > LIMITE_TEMP && podeEnviar(ultimoAlertaTemp[2])) {
    Serial.println("ALERTA: Sensor 3 com temperatura muito diferente da media!");
    enviarAlerta("Sensor 3 com temperatura muito diferente da media", "Temperatura Alta", 3, mediaTemp, mediaUmid, t3, h3);
    ultimoAlertaTemp[2] = millis();
  }

  if (!isnan(h1) && abs(h1 - mediaUmid) > LIMITE_UMID && podeEnviar(ultimoAlertaUmid[0])) {
    Serial.println("ALERTA: Sensor 1 com umidade muito diferente da media!");
    enviarAlerta("Sensor 1 com umidade muito diferente da media", "Umidade Alta", 1, mediaTemp, mediaUmid, t1, h1);
    ultimoAlertaUmid[0] = millis();
  }

  if (!isnan(h2) && abs(h2 - mediaUmid) > LIMITE_UMID && podeEnviar(ultimoAlertaUmid[1])) {
    Serial.println("ALERTA: Sensor 2 com umidade muito diferente da media!");
    enviarAlerta("Sensor 2 com umidade muito diferente da media", "Umidade Alta", 2, mediaTemp, mediaUmid, t2, h2);
    ultimoAlertaUmid[1] = millis();
  }

  if (!isnan(h3) && abs(h3 - mediaUmid) > LIMITE_UMID && podeEnviar(ultimoAlertaUmid[2])) {
    Serial.println("ALERTA: Sensor 3 com umidade muito diferente da media!");
    enviarAlerta("Sensor 3 com umidade muito diferente da media", "Umidade Alta", 3, mediaTemp, mediaUmid, t3, h3);
    ultimoAlertaUmid[2] = millis();
  }

  Serial.println("==================================================");
}
