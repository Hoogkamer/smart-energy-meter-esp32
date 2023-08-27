#include "settings.h"

WiFiClient espClient;

int dataArray[5];
int secondEntry = 0;
int temperature = 0;
AsyncWebServer server(80);
AsyncEventSource events("/events");
WiFiManager manager;

#define TRIGGER_PIN 0
int timeout = 120;
bool needReboot = false;

char static_ip[16] = AP_STATIP;
char static_gw[16] = AP_GATEWAY;
char static_sn[16] = "255.255.255.0";

void startWebServer()
{

    //  Route for root / web page https://raphaelpralat.medium.com/example-of-json-rest-api-for-esp32-4a5f64774a05
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(SPIFFS, "/index.html", "text/html"); });
    server.serveStatic("/", SPIFFS, "/");
    events.onConnect([](AsyncEventSourceClient *client)
                     {
  if(client->lastId()){
    Serial.printf("Client reconnected! Last message ID that it got is: %u\n", client->lastId());
  }
  // send event with message "hello!", id current millis
  // and set reconnect delay to 1 second
  client->send("hello!", NULL, millis(), 10000); });
    server.addHandler(&events);

#ifdef CORS_DEBUG
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "*");
#endif

    server.begin();
}
void processCode(char readit[], const std::string &code, int pos)

{

    std::string readitStr(readit); // Convert char array to std::string

    size_t startPos = readitStr.find('(');
    size_t endPos = readitStr.find('*');
    size_t endPosTS = readitStr.find('S');

    if (startPos < 0 || endPos < 1)
    {
        return;
    }

    std::string extracted;
    if (pos == POS_TIMESTAMP)
    {
        // 0-0:1.0.0(230826174135S)
        extracted = readitStr.substr(startPos + 1, endPosTS - startPos - 1);
    }
    else if (pos == POS_GAS_TOT)
    {
        // 0-1:24.2.1(230826174001S)(00414.955*m3)
        std::string extracted1 = readitStr.substr(startPos + 1);
        size_t startPos1 = extracted1.find('(');
        extracted = extracted1.substr(startPos1 + 1, endPos - startPos1 - 1);
    }
    else
    {
        // 1-0:1.8.1(001483.717*kWh)
        extracted = readitStr.substr(startPos + 1, endPos - startPos - 1);
    }

    std::string codepart = readitStr.substr(0, startPos);

    if (strncmp(code.c_str(), codepart.c_str(), strlen(code.c_str())) == 0)
    {
        double floatValue;
        std::istringstream iss(extracted);
        iss >> floatValue;
        int result = static_cast<int>(floatValue * 1000);
        dataArray[pos] = result;
    }
}
void loopSerial2()
{
    char readit[P1_MAXLINELENGTH];
    int len = Serial2.readBytesUntil('\n', readit, P1_MAXLINELENGTH);

    readit[len] = '\n';
    readit[len + 1] = 0;

    processCode(readit, "1-0:1.8.1", POS_KW_1_TOT);
    processCode(readit, "1-0:1.8.2", POS_KW_2_TOT);
    processCode(readit, "1-0:21.7.0", POS_KW_1_ACT);
    processCode(readit, "1-0:22.7.0", POS_KW_2_ACT);
    processCode(readit, "0-1:24.2.1", POS_GAS_TOT);
    processCode(readit, "0-0:1.0.0", POS_TIMESTAMP);
    if (readit[0] == '!')
    {
        secondEntry++;
        if (readit[0] == '!')
        {
            // send live event for actual power watt draw
            int watt_live = dataArray[POS_KW_1_ACT] + dataArray[POS_KW_2_ACT];
            events.send(String(watt_live).c_str(), "watt_live", millis());
            secondEntry++;
        }
    }
}

// readp1

void blinkLed(int numberOfBlinks, int msBetweenBlinks)
{
    for (int i = 0; i < numberOfBlinks; i++)
    {
        digitalWrite(LED_BUILTIN, HIGH);
        delay(msBetweenBlinks);
        digitalWrite(LED_BUILTIN, LOW);
        if (i != numberOfBlinks - 1)
        {
            delay(msBetweenBlinks);
        }
    }
}

void warnNotConnected(WiFiManager *myWiFiManager)
{

    log_i("Could not connect. Connect your computer/phone to 'WIFI_RADIO' to configure wifi.");
    blinkLed(3, 200);
    needReboot = true;
}

void connectWiFi()

{

    if (SPIFFS.exists("/config.json"))
    {
        File configFile = SPIFFS.open("/config.json", "r");
        if (configFile)
        {
            size_t size = configFile.size();
            std::unique_ptr<char[]> buf(new char[size]);
            configFile.readBytes(buf.get(), size);
            DynamicJsonDocument json(1024);
            auto deserializeError = deserializeJson(json, buf.get());
            serializeJson(json, Serial);
            if (!deserializeError)
            {
                if (json["ip"])
                {
                    strcpy(static_ip, json["ip"]);
                    strcpy(static_gw, json["gateway"]);
                    strcpy(static_sn, json["subnet"]);
                }
            }
        }
    }

    // set static ip

#ifdef AP_STATIP

    IPAddress _ip, _gw, _sn;
    _ip.fromString(static_ip);
    _gw.fromString(static_gw);
    _sn.fromString(static_sn);
    manager.setSTAStaticIPConfig(_ip, _gw, _sn);
    manager.setShowStaticFields(true);
#endif
    manager.setAPCallback(warnNotConnected);
    bool success = manager.autoConnect("WIFI_RADIO");
    if (!success)
    {
        log_w("Failed to connect");
    }
    else
    {
        log_i("Connected");
    }
    if (needReboot)
    {
        DynamicJsonDocument json(1024);
        json["ip"] = WiFi.localIP().toString();
        json["gateway"] = WiFi.gatewayIP().toString();
        json["subnet"] = WiFi.subnetMask().toString();
        File configFile = SPIFFS.open("/config.json", "w");
        serializeJson(json, Serial);
        serializeJson(json, configFile);
        configFile.close();
        delay(500);
        ESP.restart();
    }
    Serial.print("Connect your device to:");
    Serial.println(WiFi.localIP().toString());
}

/***********************************
            Main Setup
 ***********************************/
void setup()
{
    // Initialize pins
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);
    Serial.begin(BAUD_RATE);
    Serial2.begin(BAUD_RATE, SERIAL_8N1, RXD2, TXD2, true);
    if (!SPIFFS.begin(true))
    {
        log_e("An Error has occurred while mounting SPIFFS");
        return;
    }
    connectWiFi();
    startWebServer();
    //      delay(3000);
    //      setupOTA();
}

void getWifiManagerLoop()
{
    if (digitalRead(TRIGGER_PIN) == LOW)
    {
        // reset settings - for testing
        manager.resetSettings();
        ESP.restart();
    }
}
/***********************************
            Main Loop
 ***********************************/
void loop()
{

    getWifiManagerLoop();
    loopSerial2();

    // ArduinoOTA.handle();
}

/***********************************
            Setup Methods
 ***********************************/

/**
   Over the Air update setup
*/
void setupOTA()
{
    ArduinoOTA
        .onStart([]()
                 {
            String type;
            if (ArduinoOTA.getCommand() == U_FLASH)
                type = "sketch";
            else // U_SPIFFS
                type = "filesystem";

            // NOTE: if updating SPIFFS this would be the place to unmount SPIFFS using SPIFFS.end()
            Serial.println("Start updating " + type); })
        .onEnd([]()
               { Serial.println("\nEnd"); })
        .onProgress([](unsigned int progress, unsigned int total)
                    { Serial.printf("Progress: %u%%\r", (progress / (total / 100))); })
        .onError([](ota_error_t error)
                 {
            Serial.printf("Error[%u]: ", error);
            if (error == OTA_AUTH_ERROR)
                Serial.println("Auth Failed");
            else if (error == OTA_BEGIN_ERROR)
                Serial.println("Begin Failed");
            else if (error == OTA_CONNECT_ERROR)
                Serial.println("Connect Failed");
            else if (error == OTA_RECEIVE_ERROR)
                Serial.println("Receive Failed");
            else if (error == OTA_END_ERROR)
                Serial.println("End Failed"); });

    ArduinoOTA.begin();
}
