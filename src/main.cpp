#include "settings.h"

WiFiClient espClient;

int dataArray[8];
int fiveMinHistory[MIN5_HISTORY_LENGTH][6];
int hourHistory[HOUR_HISTORY_LENGTH][6];
int dayHistory[DAY_HISTORY_LENGTH][6];

AsyncWebServer server(80);
AsyncEventSource events("/events");
WiFiManager manager;

#define TRIGGER_PIN 0
int timeout = 120;
bool needReboot = false;

char static_ip[16] = AP_STATIP;
char static_gw[16] = AP_GATEWAY;
char static_sn[16] = "255.255.255.0";
void printIntArray(const int dataArray[], int size)
{
    for (int i = 0; i < size; i++)
    {
        Serial.print(dataArray[i]);
        Serial.print(":");
    }
    Serial.println();
}

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
        // read string without seconds and S (-3)
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

        if (pos == POS_DATESTAMP)
        {
            int intValue;
            std::string ext_date = extracted.substr(0, 6);
            std::string ext_time = extracted.substr(6);
            dataArray[POS_DATESTAMP] = std::stoi(ext_date.c_str());
            dataArray[POS_TIMESTAMP] = std::stoi(ext_time.c_str());
        }
        else
        {
            double floatValue;
            std::istringstream iss(extracted);
            iss >> floatValue;
            int result = static_cast<int>(floatValue * 1000);
            dataArray[pos] = result;
        }
    }
}
void printTable(int table[][6], int tableLength)
{
    Serial.println("P------------->");
    for (int i = 0; i < tableLength; i++)
    {
        if (table[i][POS_DATESTAMP] == 0)
        {
            continue;
        }
        for (int j = 0; j < 6; j++)
        {
            Serial.print(table[i][j]);
            Serial.print(":");
        }
        Serial.println();
    }
    Serial.println("<--------------");
}
int getIndexForTable(int table[][6], int tableLength)
{
    // calculate the index for this circular table based on max date and max time

    int maxDate = 0;
    int maxTime = 0;
    int index = -1;
    for (int i = 0; i < tableLength; i++)
    {
        // if found a later date or time
        if ((maxDate < table[i][POS_DATESTAMP]) || (maxDate == table[i][POS_DATESTAMP] && maxTime < table[i][POS_TIMESTAMP]))
        {
            maxDate = table[i][POS_DATESTAMP];
            maxTime = table[i][POS_TIMESTAMP];
            index = i;
        }
    }
    Serial.print("found index");
    index++;
    Serial.println(index);
    return index;
}

void addValueToHourHistory()
{
    static int index = -1;
    if (index == -1)
    {
        index = getIndexForTable(hourHistory, HOUR_HISTORY_LENGTH);
    }
    for (int i = 0; i < 6; i++)
    {
        hourHistory[index][i] = dataArray[i];
    }

    index = (index + 1) % HOUR_HISTORY_LENGTH;
    printTable(hourHistory, HOUR_HISTORY_LENGTH);
}
void addValueToDayHistory()
{
    static int index = -1;
    if (index == -1)
    {
        index = getIndexForTable(fiveMinHistory, MIN5_HISTORY_LENGTH);
    }
    for (int i = 0; i < 6; i++)
    {
        dayHistory[index][i] = dataArray[i];
    }

    index = (index + 1) % DAY_HISTORY_LENGTH;
    printTable(dayHistory, DAY_HISTORY_LENGTH);
}
void addValueToFiveMinHistory()
{
    static int index = -1;
    if (index == -1)
    {
        index = getIndexForTable(fiveMinHistory, MIN5_HISTORY_LENGTH);
    }
    for (int i = 0; i < 6; i++)
    {
        fiveMinHistory[index][i] = dataArray[i];
    }

    index = (index + 1) % MIN5_HISTORY_LENGTH;
    printTable(fiveMinHistory, MIN5_HISTORY_LENGTH);
}

// void printTable1()
// {
//     static int hourNumEntries = std::min(hourNumEntries + 1, HOUR_HISTORY_LENGTH);

//     int start = hourIndex;
//     Serial.println("-------------->");
//     for (int i = 0; i < hourNumEntries; i++)
//     {
//         for (int j = 0; j < 6; j++)
//         {
//             Serial.print(hourHistory[start][j]);
//             Serial.print(":");
//         }
//         Serial.println();

//         start = (start + 1) % HOUR_HISTORY_LENGTH; // Move to the next index, wrapping around
//     }
//     Serial.println("<--------------");
// }

void loadTableFromStorage(std::string tableName, int historyTable[][6], int tableLength)
{
    File historyFile = SPIFFS.open(tableName.c_str(), "r");
    int i = 0;
    int j = 0;
    int value = -1;
    char valbuffer[12] = "";
    int valpos = 0;
    char ch = '0';
    while (historyFile.available())
    {
        ch = historyFile.read();
        if (isDigit(ch))
        {
            valbuffer[valpos] = ch; // save digit in buffer
            valpos++;               // increment position for the next character
        }
        if (ch == ' ' && j < 6)
        {
            valbuffer[valpos] = 0;
            value = atoi(valbuffer);
            historyTable[i][j] = value;
            j++;

            valpos = 0;
            continue;
        }
        if (ch == '\n')
        {
            j = 0;
            i++;
            valpos = 0;
            continue;
        }
        if (i > tableLength)
            break;
    }
}

void saveTableToStorage(std::string tableName, int historyTable[][6], int tableLength)
{
    File historyFile = SPIFFS.open(tableName.c_str(), "w");
    if (historyFile)
    {

        for (int i = 0; i < tableLength; i++)
        {
            for (int j = 0; j < 6; j++)
            {
                historyFile.print(historyTable[i][j]);
                historyFile.print(' ');
            }
            historyFile.print('\n');
        }
    }
}
void saveAllHistoryTablesToStorage()
{
    saveTableToStorage("/minutehistory.txt", fiveMinHistory, MIN5_HISTORY_LENGTH);
    saveTableToStorage("/dayhistory.txt", dayHistory, DAY_HISTORY_LENGTH);
    saveTableToStorage("/hourhistory.txt", hourHistory, HOUR_HISTORY_LENGTH);
}
void readAllHistoryTablesFromStorage()
{
    loadTableFromStorage("/minutehistory.txt", fiveMinHistory, MIN5_HISTORY_LENGTH);
    loadTableFromStorage("/dayhistory.txt", dayHistory, DAY_HISTORY_LENGTH);
    loadTableFromStorage("/hourhistory.txt", hourHistory, HOUR_HISTORY_LENGTH);
    Serial.println("Read in tables:");
    printTable(fiveMinHistory, MIN5_HISTORY_LENGTH);
    printTable(hourHistory, HOUR_HISTORY_LENGTH);
    printTable(dayHistory, DAY_HISTORY_LENGTH);
}
void sendLiveData()
{
    int watt_live = dataArray[POS_KW_1_ACT] + dataArray[POS_KW_2_ACT];
    events.send(String(watt_live).c_str(), "watt_live", millis());
}
void saveMinuteData()
{
    static int prevMeasureTime = 0;
    if (!prevMeasureTime)
    {
        prevMeasureTime = dataArray[POS_TIMESTAMP];
        return;
    }
    int currentMin = dataArray[POS_TIMESTAMP] / 100;
    int previousMin = prevMeasureTime / 100;
    if (std::abs(currentMin - previousMin) >= 5) // add entry every 5 minutes
    {
        addValueToFiveMinHistory();
        prevMeasureTime = dataArray[POS_TIMESTAMP];
        // saveAllHistoryTablesToStorage();
    }
}

void saveHourData()
{
    static int prevMeasureTime = 0;
    if (!prevMeasureTime)
    {
        prevMeasureTime = dataArray[POS_TIMESTAMP];
        return;
    }

    int currentHour = dataArray[POS_TIMESTAMP] / 10000;
    int previousHour = prevMeasureTime / 10000;
    if (std::abs(currentHour - previousHour) >= 1)
    {
        addValueToHourHistory();
        prevMeasureTime = dataArray[POS_TIMESTAMP];
        saveAllHistoryTablesToStorage(); // todo delete hourly save
    }
}
void saveDayData()
{
    static int prevMeasureDate = 0;
    if (!prevMeasureDate)
    {
        prevMeasureDate = dataArray[POS_DATESTAMP];
        return;
    }

    int currentMeasureDate = dataArray[POS_DATESTAMP];

    if ((currentMeasureDate - prevMeasureDate) >= 1) // add entry every 1 day
    {
        addValueToDayHistory();
        saveAllHistoryTablesToStorage();
        prevMeasureDate = dataArray[POS_DATESTAMP];
    }
}

void processResults(char readit[P1_MAXLINELENGTH])
{
    if (readit[0] == '!') // whole telegram has been processed
    {
        sendLiveData();
        saveMinuteData();
        saveHourData();
        saveDayData();
    }
}
void getMeasurement()
{
    // read one line of the telegram (result from smart meter)
    char readit[P1_MAXLINELENGTH];
    int len = Serial2.readBytesUntil('\n', readit, P1_MAXLINELENGTH);
    readit[len] = '\n';
    readit[len + 1] = 0;

    // decode and put it in dataArray
    processCode(readit, "1-0:1.8.1", POS_KW_1_TOT);
    processCode(readit, "1-0:1.8.2", POS_KW_2_TOT);
    processCode(readit, "1-0:21.7.0", POS_KW_1_ACT);
    processCode(readit, "1-0:22.7.0", POS_KW_2_ACT);
    processCode(readit, "0-1:24.2.1", POS_GAS_TOT);
    processCode(readit, "0-0:1.0.0", POS_DATESTAMP);

    processResults(readit);
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
    log_i("Could not connect. Connect your computer/phone to 'ENERGY_METER' to configure wifi.");
    blinkLed(3, 200);
    digitalWrite(LED_BUILTIN, HIGH);
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
    if (manager.getWiFiIsSaved())
        manager.setEnableConfigPortal(false);
    manager.setAPCallback(warnNotConnected);
    bool success = manager.autoConnect("ENERGY_METER");
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
void initialize()
{
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);
    Serial.begin(BAUD_RATE);
    Serial2.begin(BAUD_RATE, SERIAL_8N1, RXD2, TXD2, true);
    if (!SPIFFS.begin(true))
    {
        log_e("An Error has occurred while mounting SPIFFS");
        return;
    }
}
/***********************************
            Main Setup
 ***********************************/
void setup()
{
    initialize();
    readAllHistoryTablesFromStorage();

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
void showWiFiConnectStatus()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        digitalWrite(LED_BUILTIN, HIGH);
    }
    else
    {
        digitalWrite(LED_BUILTIN, LOW);
    }
}
/***********************************
            Main Loop
 ***********************************/
void loop()
{

    getWifiManagerLoop();
    getMeasurement();
    showWiFiConnectStatus();

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
