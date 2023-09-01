
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

// how many 5min, hours, days to store
#define MIN5_HISTORY_LENGTH 10
#define HOUR_HISTORY_LENGTH 20
#define DAY_HISTORY_LENGTH 366

#define POS_KW_1_TOT 0
#define POS_KW_2_TOT 1
#define POS_GAS_TOT 2
#define WATER_DIFF 3
#define POS_DATESTAMP 4
#define POS_TIMESTAMP 5
#define POS_KW_1_ACT 6
#define POS_KW_2_ACT 7

#define HOSTNAME "p1meter"
#define OTA_PASSWORD "admin"

#define BAUD_RATE 115200
#define RXD2 16
#define TXD2 17
#define P1_MAXLINELENGTH 1050

void setupOTA();