# Changelog

All notable changes to this project will be documented in this file.

### Bug Fixes and Improvements

### Initial Release

## 0.0.13 (2020-09-21)
* Fixed wrong default keycode for Volume Up

## 0.0.12 (2020-09-21)
* Reset POWER_STATE_POLLING_INTERVAL_MS to a sensible value

## 0.0.11 (2020-09-21)
* Improved power state detection when TV & HT devices are controlled by physical remotes
* Improved power state detection after Homebridge restart
* Tuned ping command defaults for Windows environments


## 0.0.10 (2020-09-21)
* Improved power state detection during power state transition time
* Removed powerOnStartupTime from config, was superfluous
* Disabled polling of device state, was superfluous


## 0.0.10 (2020-09-20)
* Re-enabled power status polling (was turned off some time back)
* Adapted current input to keep reverting back to 999 no input, so as to clear the Tile display


## 0.0.9 (2020-09-20)
* Added support of default wait(). If no wait time is specified, it defaults to 100ms
* Added support of multi-key without wait(). If no wait is specified, a default wait of 100ms is used


## 0.0.8 (2020-09-19)
* Added support of multiple keys sent in sequence, with a wait(ms) command. Lots of log entries for testing.
* Cleaned up some log info
* Tidied up some code


## 0.0.7 (2020-09-19)
* Improved UUID generation. Please remove and re-add the accessory. UUID should be stable now
* Cleaned up some log info


## 0.0.6 (2020-09-18)
* Fixed a powerstate undefined issue and made more robust


## 0.0.5 (2020-09-18)
* Fixed input sources not sending the configured key codes


## 0.0.4 (2020-09-16)
* Fixed config.json bugs & typos
* Added View TV Settings as configurable key code


## 0.0.3 (2020-09-15)
* Released as 0.0.3

## 0.0.2-beta.1 (2020-09-15)
* Added vol up, vol down and mute as configurable buttons
* Improved robustness of inputs to avoid HomeKit getting upset when quantity changes
* Fixed bug with volume buttons
* Added mute button to config.json

## 0.0.2-beta.0 (2020-09-14)
* Added fully configurable input lists


## 0.0.2-beta.0 (2020-09-07)
* Bumped dependencies
* Removed unused dependencies
* Added kofi funding to package.json

## 0.0.1-beta.18 (2020-09-04)
* Fixed a debug bug

## 0.0.1-beta.17 (2020-09-04)
* Got the channel list working, still not as flexible as I want, but you can select sources

## 0.0.1-beta.16 (2020-09-04)
* Added powerOffButton

## 0.0.1-beta.15 (2020-09-03)
* Added powerOnStartupTime, not yet implemented in code
* Tuned logging for power state

## 0.0.1-beta.14 (2020-09-03)
* Added powerOnCommand, recommended is cec-client

## 0.0.1-beta.13 (2020-09-02)
* Added config.json doublePressDelayTime to help fine tune doublePress
* Added ddefault values for doublePressTime and triplePressTime to config.json

## 0.0.1-beta.12 (2020-09-02)
* Improved robustness if a user did not set a doublePressTime
* Disabled remote control triplePress for now

## 0.0.1-beta.11 (2020-09-01)
* Improved generation of UUID, now based on ip address, and not on device name. You will have to remove and re-add your device

## 0.0.1-beta.11 (2020-09-01)
* Fixed bug setting accesory icon for Home Theater
* Fixed some more config.schema typos

## 0.0.1-beta.10 (2020-09-01)
* Improved some logging text
* Fixed some typos in the Readme
* Fixed some copy-paste errors in the config.schema
* Added extra keywords to package.json

## 0.0.1-beta.9 (2020-09-01)
* Added remote control layers
* Improved config schema
* Improved ping code
* Bumped dependencies
* Updated Readme

## 0.0.1-beta.x (2020-04-21)
* Alpha release for experimentation
