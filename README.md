<p align="center">
    <img src="https://github.com/jsiegenthaler/homebridge-samsungtvht/blob/master/pics/Samsung-D5000.jpg" alt="TV D-5000" height="200" align="center">
    <img src="https://github.com/jsiegenthaler/homebridge-samsungtvht/blob/master/pics/Samsung-HT-D5500.jpg" alt="HT HT-D5500" height="200" align="center">

  </a>
</p>

# homebridge-samsungtvht

[![npm](https://badgen.net/npm/dt/homebridge-samsungtvht)](https://www.npmjs.com/package/homebridge-samsungtvht)
[![npm](https://badgen.net/npm/dm/homebridge-samsungtvht)](https://www.npmjs.com/package/homebridge-samsungtvht)
[![npm](https://img.shields.io/npm/v/homebridge-samsungtvht)](https://www.npmjs.com/package/homebridge-samsungtvht)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub issues](https://img.shields.io/github/issues/jsiegenthaler/homebridge-samsungtvht)](https://github.com/jsiegenthaler/homebridge-samsungtvht/issues)
[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

`homebridge-samsungtvht` is a Homebridge plugin allowing you to control your Samsung TV and Home Theater (with Orsay OS) with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.
Supported TVs and HTs are:
* C-series from 2010
* D-series from 2011 (as used by the author on his UE40D5000 TV and HT-D5500 Home Theater)
* ES-series and EH-series from 2012
* F-series from 2013

<img src="https://github.com/jsiegenthaler/homebridge-samsungtvht/blob/master/pics/AccessoryTilesTVHT.png" alt="AccessoryTilesTVHT" height="80" align="left">

This plugin displays your Samsung device as a TV or Audio Receiver Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

Supports multiple devices, allowing you to create an accessory for each TV or Home Theater system (should you have more than one).
Supports HT devices such as HT-D5500, HT-D5530, HT-D5550, HT-D6500.

Probably does not work with Samsung TVs using the Tizen OS. Tizen = TVs made from 2015!

If you like this plugin, consider making a donation or buying me a coffee!<br>
<a target="blank" href="https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468"><img src="https://img.shields.io/badge/PayPal-Donate-blue.svg?logo=paypal"/></a>  <a target="blank" href="https://ko-fi.com/jsiegenthaler"><img src="https://img.shields.io/badge/Ko--Fi-Buy%20me%20a%20coffee-29abe0.svg?logo=ko-fi"/></a>

## Made in Switzerland
This plugin was written and tested on the author's Samsung D-series TV and D-series Home Theater system in Switzerland.

## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...16.0, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.5.0 (or later). Developed on Homebridge 1.1.116....1.5.0, earlier versions not tested.
* A non-Tizen Samsung TV or Home Theater system. Tizen started in 2015, so TVs and HTs before 2015 generally work with this plugin.
* The TV or Home Theater system must be connected to your home network via Ethernet LAN cable, or WiFi.
* The TV or Home Theater system must have Network Remote Control turned on.

## Decode your Samsung TV Model Number
https://www.samsung.com/levant/support/tv-audio-video/what-do-samsung-tv-model-number-means-and-why-they-are-long/



## Installation
Homebridge UI: the easiest way to install is to search for "samsung tv" or "samsung ht" in the Homebridge UI, and then click INSTALL.

Manual install:
```sh
sudo npm install -g homebridge-samsungtvht
```
After installing, make sure you restart Homebridge.

## Adding your Samsung TV or HT to the Home app
Each Samsung TV or HT device is exposed as a separate external accessory and each device needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap **+** in the top right corner of the screen and then **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **More options...** to add the accessory manually.
5. **Select an Accessory to Add to \<HomeName\>**: Select the accessory you want to add. You should see your Samsung device here. If not, check your Homebridge config.
6. Accept the **Uncertified Accessory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge and tap **Continue**.
8. **TV Location**: Select a room for your Samsung accessory and tap **Continue**.
9. **TV Name**: Give your Samsung device a different name if you wish (you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **TV Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **TV Added to \<HomeName\>**: Tap **Done** to finish the setup.

If adding a Home Theater, the icon displayed will be an Audio Receiver and some text in the setup screens will show Audio Receiver instead of TV.

Your new accessory will appear shortly in the room that you selected. It may show **Updating...** for a while. You can force a Home app refresh by displaying a different room and then going back again to the previous room.

## Remote Control Supported Keys
To access the **Apple TV Remote**, open your **Control Center** by swiping down from the top (newer iPhones) or up from the bottom of the screen (older iPhones). If you do not see the remote control icon, you will need to activate it in **Settings > Control Centre** and ensure that the **Apple TV Remote** is in the list of **INCLUDED CONTROLS**.

The following keys are supported by in the **Apple TV Remote** in the Control Center:
<img src="https://github.com/jsiegenthaler/homebridge-samsungtvht/blob/master/pics/RemoteControl.png" alt="RemoteControl" height="300" align="right">

* Navigation (Up/Down/Left/Right)	
* OK
* Play/Pause
* Back
* Info (i) (Menu)
* Volume Up
* Volume Down (triple-press for Mute)

All remote control buttons are fully configurable and can send any [key code](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Key-Codes).

## Accessory Supported Functions
### Power
You can turn the device power on via HDMI-CEC, and off via remote control commands. Current power state is detected by pinging the device. See the [Power Control](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Power-Control) wiki page for full details.

### Inputs
<img src="https://github.com/jsiegenthaler/homebridge-samsungtvht/blob/master/pics/TvInputSelector.png" alt="TvInputSelector" height="300" align="right">

You can configure up to 20 inputs in the plugin config. The inputs can send any key code (see the [Key Codes](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Key-Codes) wiki page). Note that the plugin cannot currently read the current TV or HT source, it can only send the key codes.

### View TV Settings
The Accessory settings icon command **View TV Settings** will open the TV or Home Theater's menu.

### Multi Key Sequences (Macros) Supported
The plugin can send multiple key codes, separate the key codes with spaces. Keys are sent at intervals of 100ms, but can be changed by inserting a wait(ms) in the key code sequence. To select TV channel 12 by sending TV, waiting 200ms, then sending keys 1, 2 and Enter, use: `KEY_TV wait(200) KEY_1 KEY_2 KEY_ENTER`

## Configuration
### Config via Settings
It is easiest to configure the plugin via Homebridge: Plugins > Homebridge Samsung TV HT > SETTINGS.

### Manual Config
You can also configure manually. 
Add a new platform to the platforms section of your homebridge `config.json`.

Example configuration as used on the author's Samsung TV and Samsung HT:

```js
    "platforms": [
        {
            "name": "Samsung TV HT",
            "pingCommand": "ping -c 1 -w 20",
            "pingInterval": 3,
            "pingResponseOn": ", 0% packet loss",
            "pingResponseOff": ", 100% packet loss",
            "doublePressTime": 250,
            "triplePressTime": 450,
            "doublePressDelayTime": 300,            
            "debugLevel": 0,
            "devices": [
                {
                    "name": "Samsung TV DEV",
                    "ipAddress": "192.168.0.x",
                    "type": "television",
                    "manufacturer": "Samsung",
                    "modelName": "UE40D5000",
                    "serialNumber": "T-MSV4DEUC-1005.0",
                    "firmwareRevision": "1005.0",
                    "powerOnCommand": "echo 'on 0' | cec-client -s -d 1",
                    "powerOffButton": "KEY_POWEROFF",
                    "viewTvSettingsCommand": "KEY_MENU",
                    "inputs": [
                    "inputs": [
                        {
                            "inputName": "HDMI1 (Cable STB)",
                            "inputKeyCode": "KEY_EXT20",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "HDMI2 (Blu-ray)",
                            "inputKeyCode": "KEY_AUTO_ARC_PIP_WIDE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "HDMI3 PC",
                            "inputKeyCode": "KEY_AUTO_ARC_PIP_RIGHT_BOTTOM",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Mute",
                            "inputKeyCode": "KEY_MUTE",
                            "inputSourceType": "0",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "Volume Up",
                            "inputKeyCode": "KEY_VOLUP wait(200) KEY_VOLUP wait(200) KEY_VOLUP",
                            "inputSourceType": "0",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "Volume Down",
                            "inputKeyCode": "KEY_VOLDOWN wait(200) KEY_VOLDOWN wait(200) KEY_VOLDOWN",
                            "inputSourceType": "0",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "Source",
                            "inputKeyCode": "KEY_SOURCE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Up",
                            "inputKeyCode": "KEY_UP",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Down",
                            "inputKeyCode": "KEY_DOWN",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Enter",
                            "inputKeyCode": "KEY_ENTER",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Energy Saving High",
                            "inputKeyCode": "KEY_TOOLS KEY_DOWN KEY_DOWN KEY_RIGHT KEY_RIGHT KEY_ENTER",
                            "inputSourceType": "0",
                            "inputDeviceType": "0"
                        }
                    ],
                    "arrowUpButton": "KEY_UP",
                    "arrowUpButtonDoubleTap": "KEY_CHUP",
                    "arrowUpButtonTripleTap": "KEY_UP",
                    "arrowDownButton": "KEY_DOWN",
                    "arrowDownButtonDoubleTap": "KEY_CHDOWN",
                    "arrowDownButtonTripleTap": "KEY_DOWN",
                    "arrowLeftButton": "KEY_LEFT",
                    "arrowLeftButtonDoubleTap": "KEY_REWIND",
                    "arrowLeftButtonTripleTap": "KEY_LEFT",
                    "arrowRightButton": "KEY_RIGHT",
                    "arrowRightButtonDoubleTap": "KEY_FF",
                    "arrowRightButtonTripleTap": "KEY_RIGHT",
                    "selectButton": "KEY_ENTER",
                    "selectButtonDoubleTap": "KEY_SOURCE",
                    "selectButtonTripleTap": "KEY_HDMI",
                    "playPauseButton": "KEY_PLAY",
                    "playPauseButtonDoubleTap": "KEY_PAUSE",
                    "playPauseButtonTripleTap": "KEY_STOP",
                    "backButton": "KEY_RETURN",
                    "backButtonDoubleTap": "KEY_EXIT",
                    "backButtonTripleTap": "KEY_RETURN",
                    "infoButton": "KEY_MENU",
                    "infoButtonDoubleTap": "KEY_INFO",
                    "infoButtonTripleTap": "KEY_TOOLS",
                    "volupButton": "KEY_VOLUP",
                    "voldownButton": "KEY_VOLDOWN",
                    "voldownButtonTriplePress": "KEY_MUTE",
                    "muteButton": "KEY_MUTE"
                },
                {
                    "name": "Home Theater DEV",
                    "ipAddress": "192.168.0.x",
                    "type": "receiver",
                    "manufacturer": "Samsung",
                    "modelName": "HT-D5500",
                    "serialNumber": "HTB-D6500EUB-1023.1",
                    "firmwareRevision": "1023.1",
                    "powerOnCommand": "echo 'on 5' | cec-client -s -d 1 RPI",
                    "powerOffButton": "BD_KEY_POWER",
                    "viewTvSettingsCommand": "KEY_MENU",
                    "inputs": [
                        {
                            "inputName": "Volume Up",
                            "inputKeyCode": "KEY_VOLUP",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Volume Down",
                            "inputKeyCode": "KEY_VOLDOWN",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Mute",
                            "inputKeyCode": "KEY_MUTE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Left",
                            "inputKeyCode": "KEY_LEFT",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Right",
                            "inputKeyCode": "KEY_RIGHT",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Up",
                            "inputKeyCode": "KEY_UP",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Down",
                            "inputKeyCode": "KEY_DOWN",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Enter",
                            "inputKeyCode": "KEY_ENTER",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Sub Level",
                            "inputKeyCode": "KEY_VCHIP",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Dolby PLII",
                            "inputKeyCode": "KEY_LIVE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "KEY_CH_LIST",
                            "inputKeyCode": "KEY_CH_LIST",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "KEY_SUB_TITLE",
                            "inputKeyCode": "KEY_SUB_TITLE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        },
                        {
                            "inputName": "Interactive",
                            "inputKeyCode": "KEY_INTERACTIVE",
                            "inputSourceType": "3",
                            "inputDeviceType": "1"
                        }
                    ],
                    "arrowUpButton": "KEY_UP",
                    "arrowUpButtonDoubleTap": "KEY_CHUP",
                    "arrowUpButtonTripleTap": "KEY_UP",
                    "arrowDownButton": "KEY_DOWN",
                    "arrowDownButtonDoubleTap": "KEY_CHDOWN",
                    "arrowDownButtonTripleTap": "KEY_DOWN",
                    "arrowLeftButton": "KEY_LEFT",
                    "arrowLeftButtonDoubleTap": "KEY_REWIND",
                    "arrowLeftButtonTripleTap": "KEY_LEFT",
                    "arrowRightButton": "KEY_RIGHT",
                    "arrowRightButtonDoubleTap": "KEY_FF",
                    "arrowRightButtonTripleTap": "KEY_RIGHT",
                    "selectButton": "KEY_ENTER",
                    "selectButtonDoubleTap": "KEY_SOURCE",
                    "selectButtonTripleTap": "KEY_HDMI",
                    "playPauseButton": "KEY_PLAY",
                    "playPauseButtonDoubleTap": "KEY_PAUSE",
                    "playPauseButtonTripleTap": "KEY_STOP",
                    "backButton": "KEY_RETURN",
                    "backButtonDoubleTap": "KEY_EXIT",
                    "backButtonTripleTap": "KEY_RETURN",
                    "infoButton": "KEY_MENU",
                    "infoButtonDoubleTap": "KEY_INFO",
                    "infoButtonTripleTap": "KEY_TOOLS",
                    "volupButton": "KEY_VOLUP",
                    "voldownButton": "KEY_VOLDOWN",
                    "voldownButtonTriplePress": "KEY_MUTE",
                    "muteButton": "KEY_MUTE"
                }
            ],
            "platform": "samsungtvht"
        }    
    ]
```

### Configuration Items:

#### Platform Config

* **platform**: the name of your platform. Mandatory, must be samsungtvht.

* **name**: The displayed name of your device. Default is the plugin name. Mandatory.

* **pingCommand**: the ping command to be used to ping the device to determine it's power state. For Linux, use "ping -c 2 -w 10" (the default>). For Windows, use "ping -n 2 -w 20". The ping options used are: Linux: -c 2 = ping twice only; -w 10 = wait 10 milliseconds before timing out.  Windows: -w 20 = wait 20 milliseconds before timing out. . See the [Power-Control](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Power-Control) wiki page for more information.

* **pingInterval**: the interval in seconds between each ping. Shorter intervals generate more network traffic but show a more responsive tile in the Home app. 3 seconds is a good balance between traffic and responsiveness. Default 3. Mandatory.

* **pingResponseOn**: the ping response that corresponds to a successfully ping response, indicating that the device is turned on. For Linux, use ", 0% packet loss". For Windows use "(0% loss)". See the [Power-Control](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Power-Control) wiki page for more information.

* **pingResponseOff**: the ping response that corresponds to no ping response, indicating that the device is turned off. For Linux, use "100% packet loss". For Windows use "(100% loss)". See the [Power-Control](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Power-Control) wiki page for more information.

* **doublePressTime**: the time in ms to detect a double key press (or tap). Default 250 ms. Mandatory.

* **triplePressTime**: the time in ms to detect a triple key press (or tap). Default 450 ms. Optional, for future use.

* **doublePressDelayTime**: the time in ms to wait for another key press to detect a double key press. Must be greater than doublePressTime. Default 300 ms. Mandatory.

* **debugLevel**: the level of debug info displayed by this plugin, integer, one of 0 (none), 1 (Minimum), 2 (Enhanced), 3 (Verbose). Default 0. Optional.

* **devices**: an array for each device's config, see below.

#### Device Config (array)

* **name**: The name of the device to display on the Home app tile. Mandatory.

* **ipAddress**: the ip address of the device. Mandatory.

* **type**: The device type, which sets the Home tile icon. Either Television ("television") or Audio Receiver ("receiver"). Default is television. Mandatory.

* **manufacturer**: You can set a manufacturer of your choice. Default = Samsung. Optional.

* **modelName**: You can set a firmware revision of your choice. Default = platform name. Optional.

* **serialNumber**: You can set a serial number of your choice. Default = unknown. Optional.

* **firmwareRevision**: You can set a firmware revision of your choice. Must be numeric, ie 1.2.3. Default = plugin version. Optional.

* **powerOnCommand**: the command to execute on your Homebridge system to turn the power on. HDMI-CEC commands work well here. Optional.

* **powerOffButton**: the key code to send to turn the device off. Optional.

* **viewTvSettingsCommand**: the key code to send when the View TV Settings option is selected in the Accessory setup. Optional.

* **inputs**: an array for each device's inputs, see below.

* **xxxButton**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

* **xxxButtonDoubleTap**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

* **xxxButtonTripleTap**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

#### Input Config (array per device)

* **inputName**: the input name to display in the Home app. Optional.

* **inputKeyCode**: the key code to send for this input. Can be a sequence of key codes separated by spaces. Optional.

* **inputSourceType**: the input device type, as defined in the [Homebridge API Input Source Type](https://developers.homebridge.io/#/characteristic/InputSourceType). Default 3 (HDMI). Optional.

* **inputDeviceType**: the input device type, as defined in the [Homebridge API Input Device Type](https://developers.homebridge.io/#/characteristic/InputDeviceType). Default 1 (TV). Optional.

                            

#### Supported Key Codes
Commonly used remote control key codes are supplied as defaults, but you can customise the key codes as you wish. See the [samsung-tvht wiki](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki) for full details of all key codes.




## Thanks to
* [samsung-remote](https://github.com/natalan/samsung-remote), the inspiration for this project

* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* All the people that documented the Samsung key codes

