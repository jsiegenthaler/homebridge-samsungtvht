# homebridge-samsungtvht

`homebridge-samsungtvht` is a Homebridge plugin allowing you to control your non-Tizen Samsung TV and Home Theater with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.
Suported TVs and HTs are:
* A-series to C-series from 2008 to 2010 (probably working, needs confirmation)
* D-series from 2011 (confirmed working, as used by the author on his UE40D5000 TV and HT-D5500 HT)
* E-series from 2012 (confirmed working)
* F-series from 2013 (probably working, needs confirmation)
* H-series from 2014 (probably working, needs confirmation)

This plugin displays your Samsung device as a TV or Audio Receiver Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

Supports multiple devices, allowing you to create an accessory for each TV or Home Theater system (should you have more than one).
supports HT from HT-D5500, HT-D5530, HT-D5550, HT-D6500

[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

## Made in Switzerland
This plugin was written and tested on the author's Samsung D-series TV and D-series Home Theater system in Switzerland.

## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...14.8, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.2.5 (or later). Developed on Homebridge 1.1.116....1.3.4, earlier versions not tested.
* A non-Tizen Samsung TV or Home Theater system. Tizen started in 2015, so TVs and HTs before 2015 generally work with this plugin.
* The TV or Home Theater system must be connected to your home network via Ethernet LAN cable, or WiFi.

## Decode your Samsung TV Model Number
https://www.samsung.com/uk/support/tv-audio-video/what-do-samsung-tv-model-numbers-actually-mean-why-are-they-so-long/



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
2. Tap **+** in the top right corner of the screen to start the process of adding a new accessory or scene.
3. Tap **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **I Don't Have a Code or Cannot Scan**.
5. **Select an Accessory to Add to (Home Name)**: Select the accessory you want to add. You should see your Samsung device here. If not, check your Homebridge config.
6. Accept the **Uncertified Accesory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge and tap **Continue**.
8. **TV Location**: Select a room for your Samsung accessory and tap **Continue**.
9. **TV Name**: Give your Samsung device a different name if you wish (you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **TV Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **TV Added to (Home Name)**: Tap **Done** to finish the setup.

If adding a Home Theater, the icon displayed will be an Audio Receiver and some text in the setup screens will show Audio Receiver instead of TV.

Your new accessory will appear shortly in the room that you selected. It may show **Updating...** for a while. You can force a Home app refresh by displaying a different room and then going back again to the previous room.

## Remote Control Supported Keys
To access the **Apple TV Remote**, open your **Control Center** by swiping down from the top (newer iPhones) or up from the bottom of the screen (older iPhones). If you do not see the remote control icon, you will need to activate it in **Settings > Control Centre** and ensure that the **Apple TV Remote** is in the list of **INCLUDED CONTROLS**.

The following keys are supported by in the **Apple TV Remote** in the Control Center:

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
You can configure up to 20 inputs in the plugin config. The inputs can send any key code (see the [Key Codes](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki/Key-Codes) wiki page). Note that the plugin cannot currently read the current TV or HT source, it can only send the key codes.

### View TV Settings
The Accessory settings icon command **View TV Settings** will open the TV or Home Theater's menu.

## Configuration
### Config via Settings
It is easiest to configure the plugin via Homebridge: Plugins > Homebridge Samsung TV HT > SETTINGS.

### Manual Config
You can also configure manually. 
Add a new platform to the platforms section of your homebridge `config.json`.

Example configuration as used on the author's Samsung TV (where 192.168.0.x is the IP address of the TV):

```js
    "platforms": [
        {
            "name": "Samsung TV HT",
            "pingCommand": "ping -n 1 -w 10",
            "pingResponseOn": "(0% loss)",
            "pingResponseOff": "(100% loss)",
            "doublePressTime": 250,
            "triplePressTime": 500,
            "doublePressDelayTime": 300,
            "debugLevel": 2,
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
                    "powerOnStartupTime": 4,
                    "powerOffButton": "KEY_POWEROFF",
                    "viewTvSettingsCommand": "KEY_MENU",
                    "inputs": [
                        {
                            "inputName": "Source",
                            "inputKeyCode": "KEY_SOURCE",
                            "inputSourceType": "3",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "HDMI",
                            "inputKeyCode": "KEY_HDMI",
                            "inputSourceType": "3",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "Ext AV1",
                            "inputKeyCode": "KEY_AV1",
                            "inputSourceType": "3",
                            "inputDeviceType": "0"
                        },
                        {
                            "inputName": "PC",
                            "inputKeyCode": "KEY_PCMODE",
                            "inputSourceType": "3",
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

* **pingCommand**: the ping command to be used to ping the device to determine it's power state. For Linux, use "ping -c 1 -w 1" (the default>). For Windows, use "ping -n 1 -w 10". The ping options used are: Linux: -c 1 = ping once only; -w 1 = wait 1 millisecond before timing out.  Windows: -w 10 = wait 10 milliseconds before timing out.

* **pingResponseOn**: the ping response that corresponds to a successfuly ping response, indicating that the device is turned on. For Linux, use ", 0% packet loss". For Windows use "(0% loss)"

* **pingResponseOff**: the ping response that corresponds to no ping response, indicating that the device is turned off. For Linux, use "100% packet loss". For Windows use "(100% loss)"

* **doublePressTime**: the time in ms to detect a double key press (or tap). Default 250 ms. Mandatory.

* **triplePressTime**: the time in ms to detect a triple key press (or tap). Default 450 ms. Mandatory.

* **doublePressDelayTime**: the time in ms to wait for another key press to detect a double key press. Must be greater than doublePressTime. Default 300 ms. Mandatory.

* **debugLevel**: the level of debug info displayed by this plugin, from 0 (none) to 3 (Verbose). Default 0. Mandatory.

* **devices**: an array for each device's config, See below.

#### Device Config (array)

* **name**: The name of the device to display on the Home app tile. Mandatory.

* **ipAddress**: the ip address of the device. Mandatory.

* **type**: The device type, which sets the Home tile icon. Either Television ("television") or Audio Receiver ("receiver"). Default is television. Mandatory.

* **manufacturer**: You can set a manufacturer of your choice. Default = Samsung. Optional.

* **modelName**: You can set a firmware revision of your choice. Default = platform name. Optional.

* **serialNumber**: You can set a serial number of your choice. Default = unknown. Optional.

* **firmwareRevision**: You can set a firmware revision of your choice. Must be numeric, ie 1.2.3. Default = plugin version. Optional.

* **powerOnCommand**: the command to execute on your Homebridge system to turn the power on. HDMI-CEC commands work well here. Optional.

* **powerOnStartupTime**: the amount of time in ms to wait for the device to power up. Pings are asuppressed during this wait time. Default 4000 ms. Optional.

* **powerOffButton**: the key code to send to turn the device off. Optional.

* **xxxButton**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

* **xxxButtonDoubleTap**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

* **xxxButtonTripleTap**: The key code to send when button xxx is tapped in the iOS remote control. See the example for supported button names.

#### Input Config (array per device)

* **inputName**: the input name to display in the Home app. Optional.

* **inputKeyCode**: the key code to send for this input. Optional.

* **inputSourceType**: the input device type, as defined in the [Homebridge API Input Source Type](https://developers.homebridge.io/#/characteristic/InputSourceType). Default 3 (HDMI). Optional.

* **inputDeviceType**: the input device type, as defined in the [Homebridge API Input Device Type](https://developers.homebridge.io/#/characteristic/InputDeviceType). Default 1 (TV). Optional.

                            

#### Supported Key Codes
Commonly used remote control key codes are supplied as defaults, but you can customise the key codes as you wish. See the [samsung-tvht wiki](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki) for full details of all key codes.




## Thanks to
* [samsung-remote](https://github.com/natalan/samsung-remote), the inspiration for this project

* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* All the people that documented the Samsung key codes

