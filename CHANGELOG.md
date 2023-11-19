# Changelog

All notable changes to this project will be documented in this file.


### Bug Fixes and Improvements


## 1.0.7 (2023-11-19)
* Added warning message to detect if non-unique device IP addresses exist
* Improved display of power state logging directly after a homebridge restart
* Bumped dependencies: "homebridge": "^1.7.0"


## 1.0.6 (2023-11-18)
* Improved config schema header
* Improved config schema layout for devices
* Fixed small error in sample config in README.md
* Bumped dependencies: "node": "^20.9.0"


## 1.0.5 (2023-09-26)
* Updated iOS and iPadOS version references in README.md


## 1.0.4 (2023-08-19)
* Improved warning messages on startup when config is incomplete
* Bumped dependencies: "node": "^18.17.1"


## 1.0.3 (2023-08-04)
* Updated iOS and iPadOS version references in README.md


## 1.0.2 (2023-08-04)
* Bumped dependencies: "node": "^18.17.0"


## 1.0.1 (2023-05-19)
* Added logging of version info
* Updated iOS and iPadOS and Homebridge version references in README.md
* Bumped dependencies: "homebridge": "^1.6.1", "node": ">=18.16.0"


## 1.0.0 (2023-02-20)
* Improved power state monitoring for better power state detection 
* Removed pingResponseOff config item, as no longer needed
* Bumped dependencies: "homebridge": ">=1.6.0", "node": ">=18.14.0"
* Bumped dependencies: "samsung-remote": "^1.6.2"
* Code optimisation and clean-ups, finally created v1.0.0


## 0.1.24-beta.2 (2022-11-19)
* Improved power state monitoring for better power state detection 
* Removed pingResponseOff config item, as no longer needed
* Bumped dependencies: "node": ">=18.12.1"
* Code optimisation and clean-ups


## 0.1.23 (2022-10-26)
* Bumped dependencies: "node": ">=18.12.0"


## 0.1.22 (2022-10-26)
* Updated iOS and iPadOS and Homebridge version references in README.md
* Bumped dependencies: "homebridge": ">=1.5.1"


## 0.1.21 (2022-10-11)
* Adapted log levels of remote key presses to avoid flooding logs


## 0.1.20 (2022-09-25)
* Updated iOS version references in README.md
* Fixed log flooding when ping results are not 0% or 100% (causing many "cannot determine power state from ping result" messages)
* Bumped dependencies: "node": ">=16.17.1"


## 0.1.18 (2022-07-24)
* Updated iOS version references in README.md


## 0.1.17 (2022-07-18)
* Fixed broken link in README.md (thanks jamesanderson9182)
* Bumped dependencies: "node": ">=16.16.0"


## 0.1.15 (2022-07-08)
* Fixed bug in Readme PayPal donate url (thanks albinmedoc)


## 0.1.14 (2022-07-05)
* Fixed typo bug in mute function (thanks albinmedoc)


## 0.1.13 (2022-06-25)
* Bumped dependencies: "homebridge": ">=1.5.0", "node": ">=16.15.1"


## 0.1.12 (2022-03-22)
* Bumped dependencies: "node": ">=16.14.2"


## 0.1.11 (2022-03-15)
* Updated README.md


## 0.1.10 (2022-01-23)
* Bumped dependencies: "homebridge": ">=1.4.0", "node": ">=16.13.2"


## 0.1.9 (2022-01-21)
* Bumped dependencies: "homebridge": ">=1.3.9"


## 0.1.8 (2021-12-04)
* Bumped dependencies: "node": ">=16.13.1"


## 0.1.7 (2021-11-26)
* Bumped dependencies: "homebridge": ">=1.3.8"
* Added Homebridge verification


## 0.1.5 (2021-10-31)
* Bumped dependencies: "node": ">=16.13.0"


## 0.1.4 (2021-10-11)
* Added DisplayOrder to ensure correct display on Mac and iOS devices


## 0.1.3 (2021-10-09)
* Bumped dependencies: "homebridge": ">=1.3.5"


## 0.1.2 (2021-10-02)
* Bumped dependencies


## 0.1.1 (2021-09-23)
* Fixed display of Manufacturer, Serial Number, Model and Firmware in the accessory settings
* Cleaned up more logging


## 0.1.0 (2021-09-23)
* Cleaned up logging and code
* Made initial startup sequence more robust
* Preparing for Release 1.0.0


## 0.0.14 (2021-09-21)
* Made Ping Interval configurable with default 3s


## 0.0.13 (2021-09-21)
* Fixed wrong default keycode for Volume Up

## 0.0.12 (2021-09-21)
* Reset POWER_STATE_POLLING_INTERVAL_MS to a sensible value

## 0.0.11 (2021-09-21)
* Improved power state detection when TV & HT devices are controlled by physical remotes
* Improved power state detection after Homebridge restart
* Tuned ping command defaults for Windows environments


## 0.0.10 (2021-09-21)
* Improved power state detection during power state transition time
* Removed powerOnStartupTime from config, was superfluous
* Disabled polling of device state, was superfluous


## 0.0.10 (2021-09-20)
* Re-enabled power status polling (was turned off some time back)
* Adapted current input to keep reverting back to 999 no input, so as to clear the Tile display


## 0.0.9 (2021-09-20)
* Added support of default wait(). If no wait time is specified, it defaults to 100ms
* Added support of multi-key without wait(). If no wait is specified, a default wait of 100ms is used


## 0.0.8 (2021-09-19)
* Added support of multiple keys sent in sequence, with a wait(ms) command. Lots of log entries for testing.
* Cleaned up some log info
* Tidied up some code


## 0.0.7 (2021-09-19)
* Improved UUID generation. Please remove and re-add the accessory. UUID should be stable now
* Cleaned up some log info


## 0.0.6 (2021-09-18)
* Fixed a powerstate undefined issue and made more robust


## 0.0.5 (2021-09-18)
* Fixed input sources not sending the configured key codes


## 0.0.4 (2021-09-16)
* Fixed config.json bugs & typos
* Added View TV Settings as configurable key code


### Initial Release

## 0.0.3 (2021-09-15)
* Released as 0.0.3

