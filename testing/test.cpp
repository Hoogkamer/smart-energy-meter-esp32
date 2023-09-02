#include <WiFi.h>

#include <WiFiClient.h>

#include <WebServer.h> //copiedota
#include <ESPmDNS.h> //copiedota
#include <Update.h> //copiedota


#include <WiFiManager.h>   
#include <ArduinoJson.h>          // https://github.com/bblanchon/ArduinoJson


#include <BlynkSimpleEsp32.h>
BlynkTimer timer;

#define DEBUG_SW 1

// By default the mode is with_internet
int MODE = 0;
bool connected_once = false;

char auth[] = "***";

// Your WiFi credentials.
const char* host = "shariqESP"; //copiedota
// Set password to "" for open networks.

char ssid[] = "rm7pro";

//char ssid[] = "";

char pass[] = <"*****">;

void setup()
{
  // put your setup code here, to run once:
  Serial.begin(9600);
  
  //WiFiManager
  //Local intialization. Once its business is done, there is no need to keep it around
  WiFiManager wm;

  wm.setConfigPortalTimeout(40);
  
   //wm.setDebugOutput(true);
  
Serial.printf("SSID0: %s\n", wm.getWiFiSSID().c_str());
String saved_ssid_old =wm.getWiFiSSID().c_str();

  if(!wm.autoConnect("AutoConnectAP")) {
    Serial.println("failed to connect and hit timeout");
    delay(3000);
    //reset and try again, or maybe put it to deep sleep
    //ESP.restart();
    //delay(5000);
  } 
   Serial.printf("SSID1: %s\n", WiFi.SSID().c_str());
   Serial.println("SSID00: " + (String)wm.getWiFiSSID());
   Serial.println( wm.getWiFiIsSaved() );


if(WiFi.SSID().c_str() == ""){

int str_len = saved_ssid_old.length() + 1; 
char char_array[str_len];
// Copy it over 
saved_ssid_old.toCharArray(char_array, str_len);
Serial.println( ssid);

strcpy(ssid , char_array);

}
  
if(WiFi.SSID().c_str() != ""){
    Serial.println("not blank");

  String saved_ssid =WiFi.SSID().c_str();
  String saved_ssid_old =wm.getWiFiSSID().c_str();
  Serial.println(saved_ssid);
  Serial.println( saved_ssid_old );

    //if( !saved_ssid_old.equals(saved_ssid)  ){
      // Length (with one extra character for the null terminator)
      int str_len = saved_ssid.length() + 1; 
  // Prepare the character array (the buffer)
  char char_array[str_len];
   
  // Copy it over 
  saved_ssid.toCharArray(char_array, str_len);
  Serial.println( ssid);
  Serial.println( "different ssid");
  

  memset( ssid,0, sizeof(ssid)) ;
  //char ssid[str_len];
  strcpy(ssid , char_array);


char ssid2[] ="rm7pro";
if ( strcmp(ssid2, ssid) == 0 ) {
  Serial.println( "same ssid"); 

}
else if ( strcmp(ssid2, ssid)  > 0 ){
  Serial.println( "rm7pro is great same ssid"); 

}
else{
   Serial.println( "rm7pro is less same ssid"); 

  }
       
   // }
        
}
Serial.print("Now printing SSID:");
  Serial.println( ssid);

wm.disconnect();
delay(1000);  

   WiFi.begin(ssid, pass);
    Serial.print("main begin ssid:");
    Serial.println(ssid);
    int ct= 0;
      Serial.print("before while ssid:");
    Serial.println(ssid);
    
    while(WiFi.status() != WL_CONNECTED ){
      delay(1000);
      ct=ct+1000;
      if(ct>5000){
        Serial.println("not able to connect to wifi");        
        break;
        }
      }

    Serial.print("after while bfore if ssid:");
    Serial.println(ssid);
    
   if (WiFi.status() == WL_CONNECTED)
  {
     Serial.println( "connected once");
   connected_once = true;
  }
  Serial.print("before while after if ssid:");
    Serial.println(ssid);
  
  //setOTA(); //custom

   Serial.print("End ssid:");
    Serial.println(ssid);
}


void loop()
{
  Serial.println("Loop started");
  Serial.print("Wifi status: ");
  Serial.println(WiFi.status());
   Serial.print("Start ssid:");
    Serial.println(ssid);
  
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.print(ssid);
    Serial.println(WiFi.SSID().c_str() );
    if (DEBUG_SW) Serial.println("Not Connected");
    
   /* if( connected_once == true){
      Serial.println("Reconnecting");
        WiFi.disconnect();
        delay(1100); //custom

        WiFi.begin(ssid, pass);
    //WiFi.reconnect();
    }
    else{*/
      Serial.println("Re-attempting to connect");
      //WiFi.reconnect();
       WiFi.disconnect();
        delay(500); //custom
        WiFi.begin(ssid, pass);
         delay(1200); //custom
    //  }
  }
  else
  {
    if (DEBUG_SW) Serial.println(" Connected");
    //Blynk.run();
  }
 delay(400); //custom

}