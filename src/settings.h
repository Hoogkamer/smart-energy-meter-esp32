
#include <Arduino.h>
#include "SPIFFS.h"
#include <ArduinoOTA.h>

#include <WiFi.h>
#include <sstream>
#include <WiFiManager.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

#include <ArduinoJson.h>

// ------------------- user settings
#define DEBUG

// comment below 2 lines if you want a dynamic ip address
// The APGATEWAY you can find by pasting in the windows powershell: ipconfig
#define AP_GATEWAY "192.168.2.254"
#define AP_STATIP "192.168.2.68"

// --------------------- end user settings

#define UPDATE_INTERVAL 1000 // 1 second
// #define UPDATE_INTERVAL 10000 // 10 seconds
// #define UPDATE_INTERVAL 60000  // 1 minute
// #define UPDATE_INTERVAL 300000 // 5 minutes

#define POS_KW_1_TOT 0
#define POS_KW_2_TOT 1
#define POS_KW_1_ACT 2
#define POS_KW_2_ACT 3
#define POS_GAS_TOT 4
#define POS_TIMESTAMP 5

#define HOSTNAME "p1meter"
#define OTA_PASSWORD "admin"

#define BAUD_RATE 115200
#define RXD2 16
#define TXD2 17
#define P1_MAXLINELENGTH 1050

void setupOTA();