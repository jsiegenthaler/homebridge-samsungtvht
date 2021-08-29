# homebridge-samsunghttv

`homebridge-samsunghttv` is a Homebridge plugin allowing you to control your Samsung D-series TV and Home Theater with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your Samsung devie as a TV or Audio Receiver Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

Supports multiple devices, allowing you to create an accessory for each TV or Home Theater system (should you have more than one).

[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

## Made in Switzerland
This plugin was written and tested on the author's Samsung D-series TV and D-series Home Theater system in Switzerland.

## Requirements
 An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...14.4, earlier versions not tested.
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
* Info (i)
* Volume Up
* Volume Down

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu, which is the default.

## Limitations
Due to HomeKit limitations, the maximum services for a single accessory is 100. Over this value the Home app will no longer respond. 
Services used in this EOS box accessory are:
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilise one service per input. The maximum possible channels (inputs) are thus 100 - 3 = 97.
However, the more services you have, the slower the plugin loads. So I have limited the inputs to maximum 50, but you can override this in the config.


## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum (mandatory) configuration:

```js
    "platforms": [
        {
            "platform": "samsungtvht",
            "devices": [
                {
                    "name": "Samsung TV HT"
                }
            ]
        }
    ]
```

Example extended configuration as used on the author's Samsung TV (where x.x.x.x is the IP address of the TV):

```js
    "platforms": [
        {
            "platform": "samsunghttv",
            "devices": [
                {
                    "name": "samsunghttv",

                    "manufacturer": "Samsung",
                    "modelName": "xxx",
                    "serialNumber": "xxx",
                    "firmwareRevision": "v1.0.0",
                    "debugLevel": 0
                }
            ]
        }
    ]
```

### Configuration Items:

#### Mandatory

* **platform**: the name of your platform. Mandatory, must be samsungtvht.

* **name**: The displayed name of your device. Default is ???. Mandatory.




## Thanks to
* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation


