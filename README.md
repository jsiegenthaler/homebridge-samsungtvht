# homebridge-samsunghttv

`homebridge-samsunghttv` is a Homebridge plugin allowing you to control your Samsung D-series TV and Home Theater with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your Samsung devie as a TV or Audio Receiver Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

Supports multiple devices, allowing you to create an accessory for each TV or Home Theater system (should you have more than one).

[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

## Made in Switzerland
This plugin was written and tested on the author's Samsung D-series TV and D-series Home Theater system in Switzerland.

## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...14.4, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.2.5 (or later). Developed on Homebridge 1.1.116....1.2.5, earlier versions not tested.
* A Samsung TV or Home Theater system from around 2011

## Decode your Samsung TV model Number
https://www.samsung.com/uk/support/tv-audio-video/what-do-samsung-tv-model-numbers-actually-mean-why-are-they-so-long/

## Remote Control KeyCodes
https://wiki.samygo.tv/index.php?title=Key_codes


## Installation
Homebridge UI: the easiest way to install is seach for "samsung tv" or "samsung ht" in the Homebridge UI, and then click INSTALL.

Manual install:
```sh
sudo npm install -g homebridge-samsungtvht
```
After installing, make sure you restart Homebridge.

## Adding your Samsung TV or HT to the Home app
Each  Samsung devices is exposed as aseparate external accessory and each device needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap **+** in the top right corner of the screen to start the process of adding a new accessory or scene.
3. Tap **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **I Don't Have a Code or Cannot Scan**.
5. **Select an Accessory to Add to (Home Name)**: Select the accessory you want to add. You should see your Samsung device here. If not, check your Homebridge config.
6. Accept the **Uncertified Accesory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge.
8. **Set-Top Box Location**: Select a room for your Samsung accessory and tap **Continue**.
9. **Set-Top Box Name**: Give your Samsung device a different name if you wish (you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **Set-Top Box Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **Set-Top Box Added to (Home Name)**: Tap **Done** to finish the setup.

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

REMOTE CONTROL DOUBLE-TAP AND TRIPLE-TAP ARE VERY MUCH WORK IN PROGRESS. TRIPLE-TAP IS EXPERIMENTAL.

## Accessory Supported Functions
### Inputs
WORK IN PROGRESS
The plugin cannot read the current source, it can only send the SOURCE or HDMI commands. Two inputs are provided for each command, to allow you to send another SOURCE or another HDMI command as required.
* SOURCE, NEXT SOURCE - same as the SOURCE button on the TV remote. Each press cycles to the next source.
* HDMI, NEXT HDMI - same as the HDMI button on the TV remote. Each press cycles to the next HDMI source.

NOTE:
Currently the plugin only knows the remote key comand for the TV SOURCE button. Unfortunately, I do not know the remote command for the Home Theater SOURCE button. If you know the command, please let me know.

### View TV Settings
The Accessory settings icon command **View TV Settings** will open the TV of Home Theater's menu.


## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum (mandatory) configuration:

```js
    "platforms": [
        {
            "platform": "samsungtvht",
            "name": "samsungtvht",
            "pingCommand": "ping -n 1 -w 10",
            "pingResponseOn": "(0% loss)",
            "pingResponseOff": "(100% loss)",
            "devices": [
                {
                    "name": "Samsung TV",
                    "ipAddress": "192.168.0.x",
                    "type": "television",
                    "manufacturer": "Samsung",
                    "modelName": "UE40D5000",
                    "serialNumber": "T-MSV4DEUC-1005.0",
                    "firmwareRevision": "1005.0"
                }
            ]
        }
    ]
```


Example extended configuration as used on the author's Samsung TV (where 192.168.0.x is the IP address of the TV):

```js
    "platforms": [
        {
            "platform": "samsunghttv",
            "name": "samsungtvht",
            "pingCommand": "ping -n 1 -w 10",
            "pingResponseOn": "(0% loss)",
            "pingResponseOff": "(100% loss)",
            "doublePressTime": 250,
            "triplePressTime": 400,            
            "devices": [
                {
                    "name": "Samsung TV",
                    "type": "television",
                    "ipAddress": "192.168.0.x",
                    "manufacturer": "Samsung",
                    "modelName": "UE40D5000",
                    "serialNumber": "T-MSV4DEUC-1005.0",
                    "firmwareRevision": "1005.0"
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
                    "infoButtonTripleTap": "KEY_TOOLS"
                }
            ]
        }
    ]
```

### Configuration Items:

#### Mandatory

* **platform**: the name of your platform. Mandatory, must be samsungtvht.

* **pingCommand**: the ping command to be used to ping the device to determine it's power state. For Linux, use "ping -c 1 -w 1" (the default>). For Windows, use "ping -n 1 -w 10". The ping options used are: Linux: -c 1 = ping once only; -w 1 = wait 1 millisecond before timing out.  Windows: -w 10 = wait 10 milliseconds before timing out.

* **pingResponseOn**: the ping response that corresponds to a successfuly ping response, indicating that the device is turned on. For Linux, use ", 0% packet loss". For Windows use "(0% loss)"

* **pingResponseOff**: the ping response that corresponds to no ping response, indicating that the device is turned off. For Linux, use "100% packet loss". For Windows use "(100% loss)"

* **devices**: an array for each device's config

* **name**: The displayed name of your device. Default is the plugin name. Mandatory.

* **type**: The device type, which sets the Home tile icon. Either Television ("television") or Audio Receiver ("receiver"). Default is television. Mandatory.

* **ipAddress**: the ip address of the device. Mandatory.

#### Optional

* **manufacturer**: You can set a manufacturer of your choice. Default = Samsung

* **modelName**: You can set a firmware revision of your choice. Default = platform name

* **serialNumber**: You can set a serial number of your choice. Default = unknown

* **firmwareRevision**: You can set a firmware revision of your choice. Must be numeric, ie 1.2.3. Default = plugin version

* **xxxButton**: The key to send when button xxx is tapped in the iOS remote control. See supported button names below.

* **xxxButtonDoubleTap**: The key to send when button xxx is tapped in the iOS remote control. See supported button names below.

* **xxxButtonTripleTap**: The key to send when button xxx is tapped in the iOS remote control. See supported button names below.

#### Supported Remote Control Button Names

The following button names are supported in the config:

* arrowUpButton
* arrowDownButton
* arrowLeftButton
* arrowRightButton
* selectButton
* playPauseButton
* backButton
* infoButton

#### Supported Key Code Names

See the [samsung-tvht wiki](https://github.com/jsiegenthaler/homebridge-samsungtvht/wiki) for a list of websites where you can find key code names.




## Thanks to
* All the people that documented the Samsung key code names

* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation


