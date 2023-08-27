
#include <Arduino.h>
#include "SPIFFS.h"
#include <ArduinoOTA.h>

#include <WiFi.h>
#include <sstream>
#include <WiFiManager.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

#define DEBUG

#define UPDATE_INTERVAL 1000 // 1 second
// #define UPDATE_INTERVAL 10000 // 10 seconds
// #define UPDATE_INTERVAL 60000  // 1 minute
// #define UPDATE_INTERVAL 300000 // 5 minutes

#define KW_1_TOT 0
#define KW_2_TOT 1
#define KW_1_ACT 2
#define KW_2_ACT 3
#define GAS_TOT 4

#define HOSTNAME "p1meter"
#define OTA_PASSWORD "admin"

#define BAUD_RATE 115200
#define RXD2 16
#define TXD2 17
#define P1_MAXLINELENGTH 1050

void setupOTA();