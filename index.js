"use strict";

// ****************** start of settings

// name and version
const packagejson = require("./package.json");
const PLUGIN_NAME = packagejson.name;
const PLATFORM_NAME = packagejson.platformname;
const PLUGIN_VERSION = packagejson.version;

// required node modules
const SamsungRemote = require("samsung-remote"); // https://github.com/natalan/samsung-remote

// used for the remote. Define only once for improved performance
const KEY_LAYER_SUFFIXES = { 0: "", 1: "DoubleTap", 2: "TripleTap" };

// used for the ping power poll
const CURRENT_YEAR = new Date().getFullYear();

// exec spawns child process to run a bash script
const exec = require("child_process").exec;

// to detect dev env
let PLUGIN_ENV = ""; // controls the development environment, appended to UUID to make unique device when developing

// general constants
const NO_INPUT_ID = 999; // default to input 999, no input
const NO_INPUT_NAME = "UNKNOWN"; // an input name that does not exist
const POWER_STATE_DEFAULT_POLLING_INTERVAL_MS = 3000; // default polling interval in millisec
const POWER_STATE_MAX_TRANSITION_TIME_S = 30; // the maximum transition time we allow for a device to come online after a power ON command, default 30 s
const mediaStateName = [
  "PLAY",
  "PAUSE",
  "STOP",
  "UNKNOWN3",
  "LOADING",
  "INTERRUPTED",
];
const powerStateName = ["OFF", "ON"];
Object.freeze(mediaStateName);
Object.freeze(powerStateName);

// global variables (urgh)
let Accessory, Characteristic, Service, Categories, UUID;
let REMOTE_KEY_MAP = null; // initialize lazily, gets populated the first time the remote is used

// ++++++++++++++++++++++++++++++++++++++++++++
// useful functions
// ++++++++++++++++++++++++++++++++++++++++++++

// wait function
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// function to return a unique set of keys from an array
function uniqBy(arr, key) {
  return Object.values(
    [...arr].reverse().reduce((m, i) => {
      m[key.split(".").reduce((a, p) => a?.[p], i)] = i;
      return m;
    }, {}),
  );
}

// function to populate the REMOTE_KEY_MAP the first time the remote is used
function getRemoteKeyMap() {
  if (REMOTE_KEY_MAP) return REMOTE_KEY_MAP; // already built, reuse it

  // remote control key map — one entry per button
  // RemoteKey:	the Apple Remote Control key name, key values are 0-11,15 as of iOS 14-26. Keys 2 & 3 no longer feature in the Apple Remote Control GUI
  // default: 	the default Samsung remote key name that will be used when no homebridge config is found for the button
  // configKey: the homebridge config key name, to which can be appended DoubleTap or TripleTap
  REMOTE_KEY_MAP = {
    [Characteristic.RemoteKey.REWIND]: {
      // key 0
      default: "KEY_REWIND",
      configKey: "rewindButton",
    },
    [Characteristic.RemoteKey.FAST_FORWARD]: {
      // key 1
      default: "KEY_FF",
      configKey: "fastForwardButton",
    },
    [Characteristic.RemoteKey.NEXT_TRACK]: {
      // key 2 legacy Apple button, not selectable on iOS 14 and above, might return in the future
      default: "KEY_LEFT",
      configKey: "nextTrackButton",
    },
    [Characteristic.RemoteKey.PREVIOUS_TRACK]: {
      // key 3 legacy Apple button, not selectable on iOS 14 and above, might return in the future
      default: "KEY_RIGHT",
      configKey: "previousTrackButton",
    },
    [Characteristic.RemoteKey.ARROW_UP]: {
      // key 4
      default: "KEY_UP",
      configKey: "arrowUpButton",
    },
    [Characteristic.RemoteKey.ARROW_DOWN]: {
      // key 5
      default: "KEY_DOWN",
      configKey: "arrowDownButton",
    },
    [Characteristic.RemoteKey.ARROW_LEFT]: {
      // key 6
      default: "KEY_LEFT",
      configKey: "arrowLeftButton",
    },
    [Characteristic.RemoteKey.ARROW_RIGHT]: {
      // key 7
      default: "KEY_RIGHT",
      configKey: "arrowRightButton",
    },
    [Characteristic.RemoteKey.SELECT]: {
      // key 8
      default: "KEY_ENTER",
      configKey: "selectButton",
    },
    [Characteristic.RemoteKey.BACK]: {
      // key 9
      default: "KEY_RETURN",
      configKey: "backButton",
    },
    [Characteristic.RemoteKey.EXIT]: {
      // key 10
      default: "KEY_EXIT",
      configKey: "exitButton",
    },
    [Characteristic.RemoteKey.PLAY_PAUSE]: {
      // key 11
      default: "KEY_PLAY",
      configKey: "playPauseButton",
    },
    [Characteristic.RemoteKey.INFORMATION]: {
      // key 15
      default: "KEY_MENU",
      configKey: "infoButton",
    },
  };
  return REMOTE_KEY_MAP;
}

// ++++++++++++++++++++++++++++++++++++++++++++
// platform setup
// ++++++++++++++++++++++++++++++++++++++++++++
module.exports = (api) => {
  Accessory = api.platformAccessory;
  Characteristic = api.hap.Characteristic;
  Service = api.hap.Service;
  Categories = api.hap.Categories;
  UUID = api.hap.uuid;
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SamsungTvHtPlatform, true);
};

class SamsungTvHtPlatform {
  // build the platform. Runs once on restart
  constructor(log, config, api) {
    // only load if configured
    if (!config) {
      log.warn("WARNING: No configuration found for %s", PLUGIN_NAME);
      return;
    }
    if (!Array.isArray(config.devices)) {
      log.warn(
        "WARNING: No devices configured for %s, please add at least one device",
        PLUGIN_NAME,
      );
      return;
    }

    // abort load if device IP address are not unique
    if (uniqBy(config.devices, "ipAddress").length !== config.devices.length) {
      log.warn(
        "WARNING: IP addresses not unique for %s. Please ensure you use a unique IP address per device",
        PLUGIN_NAME,
      );
      return;
    }

    this.log = log;
    this.config = config;
    this.api = api;
    this.devices = [];
    this.debugLevel = this.config.debugLevel || 0;

    // show some useful version info
    this.log.info(
      "%s v%s, node %s, homebridge v%s",
      packagejson.name,
      packagejson.version,
      process.version,
      this.api.serverVersion,
    );

    this.api.on("didFinishLaunching", () => {
      if (this.debugLevel > 0) {
        this.log.warn("API event: didFinishLaunching");
      }

      // detect if running on development environment
      // Run with: NODE_ENV=development homebridge
      if (process.env.NODE_ENV === "development") {
        PLUGIN_ENV = " DEV";
      }
      if (PLUGIN_ENV) {
        this.log.warn(
          "%s running in %s environment with debugLevel %s",
          PLUGIN_NAME,
          PLUGIN_ENV.trim(),
          this.debugLevel,
        );
      }

      if (this.config.devices.length === 0) {
        this.log.warn("No devices found in config for %s", PLUGIN_NAME);
      } else {
        // check all devices in config
        this.log.debug("Checking devices found in config for %s", PLUGIN_NAME);
        for (let i = 0, len = this.config.devices.length; i < len; i++) {
          this.log(
            "Loading device %s: %s (%s)",
            i + 1,
            this.config.devices[i].name,
            this.config.devices[i].ipAddress,
          );
          const newTvHtDevice = new SamsungTvHtDevice(
            this.log,
            this.config,
            this.api,
            this,
            i,
          );
          this.devices.push(newTvHtDevice);
        }
      }
      // start the regular powerStateMonitor
      this.checkPowerInterval = setInterval(
        this.powerStateMonitor.bind(this),
        this.config.pingInterval * 1000 ||
          POWER_STATE_DEFAULT_POLLING_INTERVAL_MS,
      );
    });
  }

  configureAccessory(platformAccessory) {
    this.log.debug("configurePlatformAccessory");
  }

  removeAccessory(platformAccessory) {
    this.log.debug("removePlatformAccessory");
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      platformAccessory,
    ]);
  }

  powerStateMonitor() {
    // ping the devices regularly to check their power state

    // ping each device separately
    for (const device of this.devices) {
      device.powerStateMonitorCounter++; // increment global counter by 1

      // log the ping command
      if (this.debugLevel > 2) {
        this.log.warn(
          `${device.logPrefix} %s pinging device with %s`,
          device.name,
          device.pingCmd,
        );
      }

      // terminate loop iteration if a ping is still in flight
      if (device.pingInFlight) {
        if (this.debugLevel > 2) {
          this.log.debug(
            `${device.logPrefix} %s ping already in flight, skipping tick`,
            device.name,
          );
        }
        continue; // terminate execution of the statements in the current iteration of the current loop
      }

      let deviceRealPowerState;
      // stderr not used, Destructuring or naming unused params with _ is a good convention to signal intent
      device.pingInFlight = true;
      exec(device.pingCmd, (_error, stdout, _stderr) => {
        device.pingInFlight = false; // always clear, even on error
        const logPrefix = device.logPrefix; // getter fires once here

        const nowMs = Date.now();
        const secondsSinceLastPowerKeyPress =
          (nowMs - device.powerLastKeyPress.getTime()) / 1000;
        // powerLastKeyPress is initialised to year 1900 to signal "never pressed".
        // Comparing years detects this sentinel. Keep the Date object only for this.
        const yearsSinceLastPowerKeyPress =
          CURRENT_YEAR - device.powerLastKeyPress.getFullYear();

        if (this.debugLevel > 2) {
          this.log.warn(
            `${logPrefix} %s ping response: %s`,
            device.name,
            stdout,
          );
          this.log.warn(
            `${logPrefix} %s powerLastKeyPress: %s`,
            device.name,
            device.powerLastKeyPress.toLocaleString(),
          );
          this.log.warn(
            `${logPrefix} %s secondsSinceLastPowerKeyPress: %s`,
            device.name,
            secondsSinceLastPowerKeyPress,
          );
          this.log.warn(
            `${logPrefix} %s yearsSinceLastPowerKeyPress: %s`,
            device.name,
            yearsSinceLastPowerKeyPress,
          );
        }

        // get the current device power state from the ping results
        // win10:	Packets: Sent = 1, Received = 0, Lost = 1 (100% loss),
        // linux: 	1 packets transmitted, 0 received, 100% packet loss, time 0ms
        // reworked to show 100% loss is OFF, anything else is ON
        if (
          device.pingResponseOff !== "" &&
          stdout.includes(device.pingResponseOff)
        ) {
          // user-configured OFF response found which is not empty
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s is not responding to ping, power is currently OFF (using config detection)`,
              device.name,
            );
          }
          deviceRealPowerState = Characteristic.Active.INACTIVE;
        } else if (stdout.includes("100% packet loss")) {
          // Linux: "1 packets transmitted, 0 received, 100% packet loss, time 0ms" detect "100% packet loss"
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s is not responding to ping, power is currently OFF (using Linux detection)`,
              device.name,
            );
          }
          deviceRealPowerState = Characteristic.Active.INACTIVE;
        } else if (stdout.includes("(100% loss)")) {
          // Windows: "Packets: Sent = 1, Received = 0, Lost = 1 (100% loss)", detect "(100% loss)"
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s is not responding to ping, power is currently OFF (using Windows detection)`,
              device.name,
            );
          }
          deviceRealPowerState = Characteristic.Active.INACTIVE;
        } else {
          // any ping where we did not have 100% loss, is considered being ON, as some packets were returned
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s is responding to ping, power is currently ON`,
              device.name,
            );
          }
          deviceRealPowerState = Characteristic.Active.ACTIVE;
        }

        // evaluate the real vs target power states
        if (this.debugLevel > 2) {
          this.log.warn(
            `${logPrefix} %s evaluating power state. deviceRealPowerState %s, currentPowerState %s, targetPowerState %s`,
            device.name,
            deviceRealPowerState,
            device.currentPowerState,
            device.targetPowerState,
          );
        }
        if (
          deviceRealPowerState !== device.currentPowerState &&
          yearsSinceLastPowerKeyPress > 100
        ) {
          // (yearsSinceLastPowerKeyPress > 100) means no HomeKit key presses were made, but a deviceRealPowerState has detected which is different to the currentPowerState. Probably changed through a non-HomeKit method, eg physical remote control
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s power state change detected from device, setting currentPowerState to deviceRealPowerState %s`,
              device.name,
              deviceRealPowerState,
            );
          }
          device.targetPowerState = deviceRealPowerState;
          device.currentPowerState = deviceRealPowerState;
        } else if (
          deviceRealPowerState !== device.targetPowerState &&
          yearsSinceLastPowerKeyPress < 100
        ) {
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s is currently transitioning from %s to %s. Transition time so far: %s seconds`,
              device.name,
              deviceRealPowerState,
              device.targetPowerState,
              secondsSinceLastPowerKeyPress,
            );
          }
          // change in power state was requested. yearsSinceLastPowerKeyPress helps us detect a Homebridge reboot
          if (
            secondsSinceLastPowerKeyPress < POWER_STATE_MAX_TRANSITION_TIME_S
          ) {
            // device is currently undergoing a power state transition to the targetPowerState, set currentPowerState to targetPowerState
            if (this.debugLevel > 2) {
              this.log.warn(
                `${logPrefix} %s is still within the allowed transition time of %s seconds, setting currentPowerState to targetPowerState %s`,
                device.name,
                POWER_STATE_MAX_TRANSITION_TIME_S,
                device.targetPowerState,
              );
            }
            device.currentPowerState = device.targetPowerState;
          } else {
            // transition time has timed out, cancel the targetPowerState, reset current and target to deviceRealPowerState
            if (this.debugLevel > 2) {
              this.log.warn(
                `${logPrefix} %s transition time longer than %s seconds, transition has timed out, no power state change occurred, resetting currentPowerState to %s`,
                device.name,
                POWER_STATE_MAX_TRANSITION_TIME_S,
                deviceRealPowerState,
              );
            }
            device.targetPowerState = deviceRealPowerState;
            device.currentPowerState = deviceRealPowerState;
          }
        } else {
          device.currentPowerState =
            deviceRealPowerState ?? device.currentPowerState; // handle null if a parse error occurred
          if (this.debugLevel > 2) {
            this.log.warn(
              `${logPrefix} %s currentPowerState stays unchanged at %s`,
              device.name,
              device.currentPowerState,
            );
          }
        }

        // update device status
        if (this.debugLevel > 2) {
          this.log.warn(
            `${logPrefix} %s calling device.updateDeviceState with currentPowerState %s`,
            device.name,
            device.currentPowerState,
          );
        }
        device.updateDeviceState(device.currentPowerState).catch((err) => {
          this.log.warn(
            "%s: updateDeviceState error during poll: %s",
            device.name,
            err.message ?? err,
          );
        });
      });
    }
  }
}

class SamsungTvHtDevice {
  // build the device. Runs once on restart
  constructor(log, config, api, platform, deviceIndex) {
    this.log = log;
    this.api = api;
    this.platform = platform; // the entire platform
    this.deviceIndex = deviceIndex; // the current device's index
    this.debugLevel = platform.debugLevel || 0; // debugLevel defaults to 0 (minimum)
    this.deviceConfig = config.devices[deviceIndex]; // the config for the current device
    this.powerStateMonitorCounter = 0; // the power state monitor counter for this device

    this.name = this.deviceConfig.name; // device name from config
    this.ipAddress = this.deviceConfig.ipAddress; // device ip address from config
    if (this.debugLevel > 0) {
      this.log.warn("%s: now in SamsungTvHtDevice", this.name);
    }

    // pingCmd cached once; OS-specific default applied here, reused each poll tick
    // for linux: 	pingCmd = 'ping -c 1 -w 20' + ' ' + ipAddress
    // for win: 	  pingCmd = 'ping -n 1 -w 20' + ' ' + ipAddress
    const baseCmd = (config.pingCommand || "ping -c 1 -w 20").trim();
    this.pingCmd = `${baseCmd} ${this.ipAddress}`;
    this.pingResponseOff = (config.pingResponseOff || "").trim();
    this.pingInFlight = false; // true while an exec ping is running for this device

    // remote control key press times
    this.doublePressTime = config.doublePressTime || 250;
    // this.triplePressTime = config.triplePressTime || 450; // future use
    this.doublePressDelayTime = config.doublePressDelayTime || 300;

    // create the remote once — reused on every remote keypress
    this.remote = new SamsungRemote({ ip: this.deviceConfig.ipAddress });

    // setup arrays
    this.inputServices = []; // loaded input services, used by the accessory, as shown in the Home app. Limited to 96
    // TODO: this.configuredInputs = []; // a list of inputs that have been renamed by the user. EXPERIMENTAL TODO
    this.lastRemoteKeyPressed = -1; // holds the last key pressed, -1 = no key
    // Memory optimisation: using a plain object {} avoids any array overhead for sparse numeric keys
    this.lastRemoteKeyPress0 = {}; // holds the time value of the last remote button press for key index i
    this.lastRemoteKeyPress1 = {}; // holds the time value of the last-1 remote button press for key index i
    this.lastRemoteKeyPress2 = {}; // holds the time value of the last-2 remote button press for key index i
    this.lastVolDownKeyPress = {}; // holds the time value of the last button press for the volume down button

    //setup variables
    this.accessoryConfigured = false; // true when the accessory is configured

    // initial states. Will be updated by code
    this.currentPowerState = undefined; // deliberately leave at undefined to detect a reboot and initial start = Characteristic.Active.INACTIVE;
    this.targetPowerState = this.currentPowerState;
    this.lastKnownPowerState = undefined; // tracks previous power state to detect ON transitions

    // defaultInputId: if set, the tile shows this input when the device powers on.
    // If not set, defaults to NO_INPUT_ID (blank tile) on each power-on.
    this.defaultInputId = this.deviceConfig.defaultInput || NO_INPUT_ID;
    this.currentInputId = this.defaultInputId; // default startup at defaultInputId
    this.currentMediaState = Characteristic.CurrentMediaState.PLAY; // default play
    this.targetMediaState = this.currentMediaState;

    // tracks last value pushed to HAP
    this.lastPushedPowerState = undefined;
    this.lastPushedActiveIdentifier = undefined;
    this.lastPushedMediaState = undefined;

    this.powerLastKeyPress = new Date("1900-01-01T00:00:00Z"); // set a valid date but many years in the past

    // prepare the accessory
    this.prepareAccessory();
  }

  // logPrefix getter — built on demand, not on every poll tick
  get logPrefix() {
    return `powerStateMonitor(${this.powerStateMonitorCounter}): `;
  }

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START of preparing accessory and services
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //Prepare accessory (runs from SamsungTvHtDevice)
  prepareAccessory() {
    if (this.debugLevel > 0) {
      this.log.warn("%s: prepareAccessory", this.name);
    }

    // exit immediately if already configured (runs from session watchdog)
    if (this.accessoryConfigured) {
      return;
    }

    const accessoryName = this.name;

    // generate a constant uuid that will never change over the life of the accessory
    const uuid = UUID.generate(this.ipAddress + PLUGIN_ENV);
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareAccessory: UUID %s", this.name, uuid);
    }

    // default category is TV, allow also RECEIVER (avr)
    const accessoryCategory =
      this.deviceConfig.type === "receiver"
        ? Categories.AUDIO_RECEIVER
        : Categories.TELEVISION;

    this.accessory = new Accessory(accessoryName, uuid, accessoryCategory);

    this.prepareAccessoryInformationService(); // service 1 of 100
    this.prepareTelevisionService(); // service 2 of 100
    this.prepareTelevisionSpeakerService(); // service 3 of 100
    this.prepareInputSourceServices(); // service 4....100

    // set displayOrder
    this.displayOrderBase64 = Buffer.from(this.displayOrder).toString("base64");
    this.televisionService.getCharacteristic(
      Characteristic.DisplayOrder,
    ).value = this.displayOrderBase64; // set HAP once at startup

    this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
    this.accessoryConfigured = true;

    // Push ConfiguredName after publishing so Eve receives the HAP notify event
    // Eve subscribes to event notifications rather than polling GET,
    // so updateValue() is required to populate the name in Eve after the accessory registers.
    this.televisionService
      .getCharacteristic(Characteristic.ConfiguredName)
      .updateValue(this.name);
  }

  //Prepare AccessoryInformation service
  prepareAccessoryInformationService() {
    if (this.debugLevel > 0) {
      this.log.warn("%s: prepareAccessoryInformationService", this.name);
    }

    this.accessory.removeService(
      this.accessory.getService(Service.AccessoryInformation),
    );
    const informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(
        Characteristic.Manufacturer,
        this.deviceConfig.manufacturer || "Samsung",
      )
      .setCharacteristic(
        Characteristic.Model,
        this.deviceConfig.modelName || PLATFORM_NAME,
      )
      .setCharacteristic(
        Characteristic.SerialNumber,
        this.deviceConfig.serialNumber || "unknown",
      )
      .setCharacteristic(
        Characteristic.FirmwareRevision,
        this.deviceConfig.firmwareRevision || PLUGIN_VERSION,
      ) // must be numeric. Non-numeric values are not displayed
      // optional characteristics
      // if ConfiguredName is not supplied, the accessory name and input source names may appear as default names (Input Source, Input Source 2, Input Source 3, etc)
      .setCharacteristic(Characteristic.ConfiguredName, this.name); // required for iOS18

    this.accessory.addService(informationService);
  }

  //Prepare Television service
  prepareTelevisionService() {
    if (this.debugLevel > 0) {
      this.log.warn("%s: prepareTelevisionService", this.name);
    }
    this.televisionService = new Service.Television(
      this.name,
      "televisionService",
    );
    this.televisionService
      .setCharacteristic(Characteristic.ConfiguredName, this.name)
      .setCharacteristic(
        Characteristic.SleepDiscoveryMode,
        Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
      )
      // extra characteristics added here are accessible in Shortcuts and Automations (both personal and home)
      .setCharacteristic(
        Characteristic.StatusFault,
        Characteristic.StatusFault.NO_FAULT,
      ); // NO_FAULT or GENERAL_FAULT

    // power
    this.televisionService
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getPower.bind(this))
      .onSet(this.setPower.bind(this));

    // active input
    this.televisionService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .onGet(this.getActiveIdentifier.bind(this))
      .onSet(this.setActiveIdentifier.bind(this));

    // configured name - added to log the calls to get configured name
    this.televisionService
      .getCharacteristic(Characteristic.ConfiguredName)
      .onGet(this.getConfiguredName.bind(this))
      .onSet(this.setConfiguredName.bind(this));

    // remote control keys in the Apple TV Remote app
    this.televisionService
      .getCharacteristic(Characteristic.RemoteKey)
      .onSet(this.setRemoteKey.bind(this));

    // the View TV Settings menu item
    this.televisionService
      .getCharacteristic(Characteristic.PowerModeSelection)
      .onSet(this.setPowerModeSelection.bind(this));

    // display order of the channels
    this.televisionService
      .getCharacteristic(Characteristic.DisplayOrder)
      .onGet(this.getDisplayOrder.bind(this))
      .onSet(this.setDisplayOrder.bind(this));

    this.accessory.addService(this.televisionService);
  }

  //Prepare TelevisionSpeaker service
  prepareTelevisionSpeakerService() {
    if (this.debugLevel > 0) {
      this.log.warn("%s: prepareTelevisionSpeakerService", this.name);
    }
    this.speakerService = new Service.TelevisionSpeaker(
      this.name + " Speaker",
      "speakerService",
    );
    this.speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(
        Characteristic.VolumeControlType,
        Characteristic.VolumeControlType.RELATIVE,
      ); // only relative is supported for the Apple Remote with Up/Down buttons
    this.speakerService
      .getCharacteristic(Characteristic.VolumeSelector) // the volume selector, increment or decrement, allows the iOS device keys to be used to change volume
      .onSet(this.setVolume.bind(this));
    this.speakerService
      .getCharacteristic(Characteristic.Mute)
      .onSet(this.setMute.bind(this));

    this.accessory.addService(this.speakerService);
    this.televisionService.addLinkedService(this.speakerService);
  }

  //Prepare InputSource services
  prepareInputSourceServices() {
    // This is the input list, each input is a service, max 100 services less the services created so far

    // on the samsung devices, the
    // AVR: HDMI1, HDMI2, Analog
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareInputSourceServices", this.name);
    }

    this.displayOrder = [];

    // For Release 1.0, I'll only support the source by sending the SOURCE key, which just goes to next source
    // so disable HDMI 2 and Analog AUX. these need HDMI CEC support.
    // see https://developers.homebridge.io/#/service/InputSource
    // see https://developers.homebridge.io/#/characteristic/InputSourceType
    // see https://developers.homebridge.io/#/characteristic/InputDeviceType
    // HomeKit gets upset when the number of inputs changes. So configure 20 always, set conf and vis states if a deviceconfig exists
    if (this.deviceConfig.inputs) {
      // i = array index starting at 0; Identifier is set to i+1 (1-based) to match ActiveIdentifier
      // deviceConfig is zero-based, starting at 0
      // fixed size at 20 inputs, the configState and visState controls what is seen by the user
      for (let i = 0; i < 20; i++) {
        this.log.debug(
          "%s: prepareInputSourceServices loading config index %s input %s: %s",
          this.name,
          i,
          i + 1,
          this.deviceConfig.inputs[i] || "no config found",
        );
        // show only if the deviceConfig setting exists using a ternary: condition ? execute when true : execute when false
        const hasInput = Boolean(this.deviceConfig.inputs[i]);
        const inputLabel = `input${i+1}`;
        const configState = hasInput
          ? Characteristic.IsConfigured.CONFIGURED
          : Characteristic.IsConfigured.NOT_CONFIGURED;
        const visState = hasInput
          ? Characteristic.CurrentVisibilityState.SHOWN
          : Characteristic.CurrentVisibilityState.HIDDEN;
        const inputService = new Service.InputSource(inputLabel, inputLabel); // displayName, subtype
        // Capture the name into a variable — used both in setCharacteristic and updateValue below
        const inputName = (this.deviceConfig.inputs[i] || {}).inputName || inputLabel;

        // set Characteristics on the inputService
        inputService
          .setCharacteristic(Characteristic.Identifier, i + 1) // must be 1-based, so that input1 is also Identifier1, and so that CurrentActivIdentifier = same as Input number
          .setCharacteristic(
            Characteristic.ConfiguredName,inputName,
          )
          .setCharacteristic(
            Characteristic.InputSourceType,
            (this.deviceConfig.inputs[i] || {}).inputSourceType ||
              Characteristic.InputSourceType.HDMI,
          )
          .setCharacteristic(
            Characteristic.InputDeviceType,
            (this.deviceConfig.inputs[i] || {}).inputDeviceType ||
              Characteristic.InputDeviceType.TV,
          )
          .setCharacteristic(Characteristic.IsConfigured, configState)
          .setCharacteristic(Characteristic.CurrentVisibilityState, visState)
          .setCharacteristic(Characteristic.TargetVisibilityState, visState);

        this.inputServices.push(inputService);
        this.accessory.addService(inputService);
        this.televisionService.addLinkedService(inputService);

        // Push ConfiguredName via notify so Eve receives it after the accessory registers.
        // setCharacteristic only sets the cached HAP value; Eve subscribes to event notifications
        // and won't see the name unless updateValue() fires the notify event explicitly.
        inputService
          .getCharacteristic(Characteristic.ConfiguredName)
          .updateValue(inputName);

        // add DisplayOrder, see :
        // https://github.com/homebridge/HAP-NodeJS/issues/644
        // https://github.com/ebaauw/homebridge-zp/blob/master/lib/ZpService.js  line 916: this.displayOrder.push(0x01, 0x04, identifier & 0xff, 0x00, 0x00, 0x00)

        // store in a displayOrder[] array with same index number
        // this.displayOrder.push(0x01, 0x04, i & 0xff, 0x00, 0x00, 0x00);
        //                        type  len   inputId  empty empty empty
        // this.displayOrder.push(0x01, 0x04,       i, 0x00, 0x00, 0x00);
        // inputId is the inputIdentifier (not the index), starting index 0 = identifier 1
        // types:
        // 	0x00 end of TLV item
        // 	0x01 identifier...new TLV item for displayOrder
        // length:	Number of following bytes, excluding type and len fields.
        // value:	A number of <len> bytes. Can be empty if length=0
        // 0x01 0x01 xx is a valid TLV8 as it contains only 1 data byte.
        // for displayOrder, the length should be 4 bytes. but short also works, but limited to 255 entries
        // AQQAAAAAAQQBAAAAAQQCAAAAAQQDAAAAAAA= = 010400000000,010401000000,010402000000,010403000000,0000 (including closing 0000)
        // this.displayOrder.push(0x01, 0x04, i & 0xff, 0x00, 0x00, 0x00)
        this.displayOrder.push(0x01, 0x01, (i + 1) & 0xff);
      }
      // close off the TLV8 by sending 0x00 0x00
      this.displayOrder.push(0x00, 0x00); // close off the displayorder array with 0x00 0x00
    }

    // build a lookup map: inputId (1-based) → zero-based array index
    // avoids O(n) findIndex/find scans on every HomeKit poll
    // Map.get() is a hash lookup — it takes the same time whether there are 2 inputs or 200.
    // The old findIndex and find both walk the array from the start until they find a match, doing
    // a characteristic read or string comparison on each element.
    // With 20 inputs the difference is small in absolute terms, but getActiveIdentifier is called by
    // HomeKit repeatedly, so eliminating the scan entirely is the right approach.
    // The Map itself costs a tiny amount of memory — 20 entries of two integers each — and is built exactly once at startup.
    // always assigned here (outside if block) so .get() is safe without ?. at every call site
    this.inputIdIndexMap = new Map(
      this.inputServices.map((svc, idx) => [
        svc.getCharacteristic(Characteristic.Identifier).value,
        idx,
      ]),
    );

    this.log.debug(
      "%s: prepareInputSourceServices loading complete, this.inputServices",
      this.name,
      this.inputServices,
    );
  }
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END of preparing accessory and services
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START state handler
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // send a remote control keypress to the device
  async sendKey(keySequence) {
    if (this.debugLevel > 0) {
      this.log.warn("%s: sendKey: keySequence %s", this.name, keySequence);
    }

    const keyArray = keySequence.trim().split(/\s+/); // split on any whitespace
    const keyArrayLower = keyArray.map((k) => k.toLowerCase());
    if (keyArray.length > 1) {
      this.log("%s: sendKey: processing keySequence", this.name, keySequence);
    }

    // supported key1 key2 key3 wait() wait(100)
    for (let i = 0; i < keyArray.length; i++) {
      const keyName = keyArray[i];
      this.log.debug(
        "%s: sendKey: processing key %s of %s: %s",
        this.name,
        i + 1,
        keyArray.length,
        keyName,
      );

      // if a wait appears, use it
      let waitDelay; // default
      const keyLower = keyArrayLower[i]; // already lowercased
      if (keyLower.startsWith("wait(")) {
        this.log.debug(
          "%s: sendKey: reading delay from %s",
          this.name,
          keyName,
        );
        // use double replace for legibility
        waitDelay = keyLower.replace("wait(", "").replace(")", "");
        if (waitDelay === "") {
          waitDelay = 100;
        } // default 100ms
        this.log.debug("%s: sendKey: delay read as %s", this.name, waitDelay);
      }
      // else if not first key and last key was not wait, and next key is not wait, then set a default delay of 100 ms
      else if (
        i > 0 &&
        i < keyArray.length - 1 &&
        !keyArrayLower[i - 1]?.startsWith("wait(") &&
        !keyArrayLower[i + 1]?.startsWith("wait(")
      ) {
        this.log.debug(
          "%s: sendKey: not first key and neither previous key %s nor next key %s is wait(). Setting default wait of 100 ms",
          this.name,
          keyArray[i - 1],
          keyArray[i + 1],
        );
        waitDelay = 100;
      }

      // add a wait if waitDelay is defined
      if (waitDelay) {
        if (this.debugLevel > 0) {
          this.log("%s: sendKey: wait %s ms", this.name, waitDelay);
        }
        await wait(waitDelay);
        this.log.debug("%s: sendKey: wait %s done", this.name, waitDelay);
      }

      // send the key if not a wait()
      if (!keyLower.startsWith("wait(")) {
        if (this.debugLevel > 0) {
          this.log("%s: sendKey: send %s", this.name, keyName);
        }
        this.remote.send(keyName, (err) => {
          if (err && err !== "Timeout") {
            //  Timeout ignore, this is normal with SamsungRemote, some keys just don't get a response from the TV / AVR
            this.log.warn("%s: sendKey: %s error %s", this.name, keyName, err);
          } else {
            this.log.debug("%s: sendKey: send %s done", this.name, keyName);
          }
        });
      }
    }
  }

  // get the device UI status
  // incomplete, to be completed if I can ever figure out how
  getUiStatus() {
    if (this.debugLevel > 1) {
      this.log.warn("getUiStatus");
    }
  }

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END state handler
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START regular device update polling functions
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // update the device state (async)
  async updateDeviceState(powerState, mediaState, inputId) {
    // doesn't get the data direct from the device, but rather: gets it from the variables
    if (this.debugLevel > 2) {
      this.log.warn(
        "%s: updateDeviceState: powerState %s, mediaState %s, inputId %s",
        this.name,
        powerState,
        mediaState,
        inputId,
      );
    }

    // grab the input variables if provided
    if (powerState !== undefined) {
      this.currentPowerState = powerState;
    }
    if (mediaState !== undefined) {
      this.currentMediaState = mediaState;
    }
    if (inputId !== undefined) {
      this.currentInputId = inputId;
    }

    // debugging, helps a lot to see InputName
    if (this.debugLevel > 2) {
      // get current service (input), ensure we always have a json value
      // O(1) map lookup instead of O(n) find scan
      const curIdx = this.inputIdIndexMap.get(this.currentInputId);
      const curService =
        curIdx !== undefined ? this.inputServices[curIdx] : undefined;
      // ensure we have a name value even for input 999
      const curName = curService
        ? curService.getCharacteristic(Characteristic.ConfiguredName).value
        : NO_INPUT_NAME;

      this.log.warn(
        "%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentInputId %s [%s]",
        this.name,
        this.currentPowerState,
        this.currentMediaState,
        mediaStateName[this.currentMediaState],
        this.currentInputId,
        curName,
      );
    }

    // change only if configured, and update only if changed
    if (this.televisionService) {
      // set power state if changed
      const currentPowerState =
        this.currentPowerState ?? Characteristic.Active.INACTIVE; // ensure never null
      this.log.debug(
        "%s: updateDeviceState: lastPushedPowerState %s, currentPowerState %s",
        this.name,
        this.lastPushedPowerState,
        currentPowerState,
      );
      if (this.lastPushedPowerState !== currentPowerState) {
        const lastPushedPowerStateName =
          this.lastPushedPowerState !== undefined
            ? powerStateName[this.lastPushedPowerState]
            : "unknown (startup)";
        this.log(
          "%s: Power changed from %s %s to %s %s",
          this.name,
          this.lastPushedPowerState ?? "—",
          lastPushedPowerStateName,
          currentPowerState,
          powerStateName[currentPowerState],
        );
        this.televisionService
          .getCharacteristic(Characteristic.Active)
          .updateValue(currentPowerState);
        this.lastPushedPowerState = currentPowerState;
      } else {
        this.log.debug(
          "%s: updateDeviceState: no change to current power, Characteristic.Active not updated",
          this.name,
        );
      }

      // set active input based on power state transitions
      const isPowerOn = currentPowerState === Characteristic.Active.ACTIVE;
      const wasPowerOn =
        this.lastKnownPowerState === Characteristic.Active.ACTIVE;
      const powerJustTurnedOn = isPowerOn && !wasPowerOn;
      // Reset to NO_INPUT_ID when the device just powered on, because we cannot
      // know what input the device is actually on at this point.
      if (powerJustTurnedOn) {
        this.currentInputId = this.defaultInputId;
        this.log.debug(
          "%s: updateDeviceState: device just turned ON, resetting ActiveIdentifier to %s",
          this.name,
          this.defaultInputId,
        );
      }
      // Update lastKnownPowerState now that we have handled the transition
      this.lastKnownPowerState = currentPowerState;
      const oldActiveIdentifier = this.lastPushedActiveIdentifier;

      // When TV is OFF, always show NO_INPUT_ID (blank tile).
      // When TV is ON, show whatever currentInputId is — either NO_INPUT_ID (just
      // powered on, no input selected yet) or the last input the user picked via HomeKit.
      const currentActiveIdentifier = isPowerOn
        ? this.currentInputId
        : NO_INPUT_ID;
      if (oldActiveIdentifier !== currentActiveIdentifier) {
        const oldName =
          oldActiveIdentifier === NO_INPUT_ID ? "UNKNOWN" : oldActiveIdentifier;
        const newName =
          currentActiveIdentifier === NO_INPUT_ID
            ? "UNKNOWN"
            : currentActiveIdentifier;
        if (this.debugLevel > 0) {
          this.log.warn(
            "%s: Input changed from %s to %s",
            this.name,
            oldName,
            newName,
          );
        }
        this.televisionService
          .getCharacteristic(Characteristic.ActiveIdentifier)
          .updateValue(currentActiveIdentifier);
        this.lastPushedActiveIdentifier = currentActiveIdentifier;
      } else {
        if (this.debugLevel > 2) {
          this.log.warn(
            "%s: updateDeviceState: no change to current input, Characteristic.ActiveIdentifier not updated",
            this.name,
          );
        }
      }

      // set current media state if changed
      if (this.lastPushedMediaState !== this.currentMediaState) {
        const lastPushedMediaStateName =
          this.lastPushedMediaState !== undefined
            ? mediaStateName[this.lastPushedMediaState]
            : "unknown (startup)";
        this.log(
          "%s: Media state changed from %s %s to %s %s",
          this.name,
          this.lastPushedMediaState ?? "—",
          lastPushedMediaStateName,
          this.currentMediaState,
          mediaStateName[this.currentMediaState],
        );
        this.televisionService
          .getCharacteristic(Characteristic.CurrentMediaState)
          .updateValue(this.currentMediaState);
        this.lastPushedMediaState = this.currentMediaState;
      }
    }
    return null;
  }

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END regular device update polling functions
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START of accessory get/set state handlers
  // HomeKit polls for status regularly at intervals from 2min to 15min
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // get power state
  async getPower() {
    // fired when the user clicks away from the Remote Control, regardless of which TV was selected
    // fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
    // currentPowerState is updated by the polling mechanism
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getPower returning %s [%s]",
        this.name,
        this.currentPowerState ?? Characteristic.Active.INACTIVE,
        powerStateName[
          this.currentPowerState ?? Characteristic.Active.INACTIVE
        ],
      );
    }
    return this.currentPowerState ?? Characteristic.Active.INACTIVE; // return current state: 0=off, 1=on. Default to OFF if null.
  }

  // set power state
  async setPower(targetPowerState) {
    // fired when the user clicks the power button in the TV accessory in HomeKit
    // fired when the user clicks the TV tile in HomeKit
    // fired when the first key is pressed after opening the Remote Control
    // wantedPowerState is the wanted power state: 0=off, 1=on
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setPower: targetPowerState:",
        this.name,
        targetPowerState,
        powerStateName[targetPowerState],
      );
    }
    this.targetPowerState = targetPowerState;

    // only take action if the target state is different to the current state
    if (this.currentPowerState !== this.targetPowerState) {
      // check what we want to do
      this.powerLastKeyPress = new Date();
      this.log.debug(
        "%s: setPower: reset powerLastKeyPress to %s",
        this.name,
        this.powerLastKeyPress.toLocaleString(),
      );
      this.currentPowerState = this.targetPowerState; // to ensure HomeKit gets the correct state at next poll, regardless
      this.lastPushedPowerState = this.targetPowerState;

      if (this.targetPowerState === Characteristic.Active.INACTIVE) {
        // we want to turn OFF, then we can turn it off with a sendKey
        // avr: BD_KEY_POWER, tv: KEY_POWER
        if (this.deviceConfig.powerOffButton) {
          this.sendKey(this.deviceConfig.powerOffButton);
        }
      } else {
        // we want to turn ON, can turn on only via HDMI-CEC
        this.log(
          "%s: setPower: powerOnCommand: %s",
          this.name,
          this.deviceConfig.powerOnCommand,
        );
        if (this.deviceConfig.powerOnCommand) {
          exec(this.deviceConfig.powerOnCommand, (_error, stdout, stderr) => {
            if (stderr) {
              this.log.warn(
                "%s: setPower: powerOnCommand: %s",
                this.name,
                stderr,
              );
            } // show any error if any generated
            if (stdout) {
              this.log.debug(
                "%s: setPower: powerOnCommand: %s",
                this.name,
                stdout,
              );
            } // show any stdOut in debug mode
          });
        }
      }
    } else {
      // if current is already same as target
      this.log.debug(
        "%s: Current power state is already %s [%s], doing nothing",
        this.name,
        this.currentPowerState,
        powerStateName[this.currentPowerState],
      );
    }
  }

  // get configured name
  async getConfiguredName() {
    // trial to see if this is called during bootup
    if (this.debugLevel > 1) {
      this.log.warn("%s: getConfiguredName called", this.name);
    }
    // TODO: allow user to change the name in HomeKit
    // const currentConfiguredName = this.televisionService.getCharacteristic(
    //  Characteristic.ConfiguredName,
    //).value;
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getConfiguredName returning '%s'",
        this.name,
        this.name, // set once at startup, never changes — no HAP read needed,
      );
    }
    return this.name; // set once at startup, never changes — no HAP read needed;
  }

  // set configured name
  async setConfiguredName(newName) {
    // trial to see if this is called during bootup
    if (this.debugLevel > 1) {
      this.log.warn("%s: setConfiguredName: newName %s", this.name, newName);
    }
  }

  // set mute state
  async setMute(muteState) {
    // sends the mute command
    // works for TVs that accept a mute toggle command
    // muteState = Boolean = True (muted) or false (notMuted)
    if (this.debugLevel > 0) {
      this.log.warn("%s: setMute: muteState:", this.name, muteState);
    }

    // mute state is a boolean, either true or false
    // const NOT_MUTED = 0, MUTED = 1;
    this.log("%s: Set mute: %s", this.name, muteState ? "Muted" : "Not muted");
    // send only if a keycode exists
    const keyCode = this.deviceConfig.muteButton;
    if (keyCode?.length > 0) {
      this.sendKey(keyCode);
    }
  }

  // set volume
  async setVolume(volumeSelectorValue) {
    // sends the volume command
    if (this.debugLevel > 0) {
      this.log.warn(
        "%s: setVolume: volumeSelectorValue:",
        this.name,
        volumeSelectorValue,
      );
    }

    // volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
    this.log.debug(
      "%s: setVolume: Set volume: %s",
      this.name,
      volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT
        ? "Down"
        : "Up",
    );

    // triple rapid VolDown presses triggers setMute
    let tripleVolDownPress = 10000; // default high value to prevent a tripleVolDown detection when no triple key pressed
    if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
      this.lastVolDownKeyPress[2] = this.lastVolDownKeyPress[1] || 0;
      this.lastVolDownKeyPress[1] = this.lastVolDownKeyPress[0] || 0;
      this.lastVolDownKeyPress[0] = Date.now();
      tripleVolDownPress =
        this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2];
      // check time difference between current keyPress and 2 keyPresses ago
      this.log.debug(
        "%s: setVolume: Time diff between lastVolDownKeyPress[0] now and lastVolDownKeyPress[2]: %s ms",
        this.name,
        tripleVolDownPress,
      );
    }

    // check for triple press of volDown, send setmute if tripleVolDownPress less than 1000ms
    let keyCode;
    if (tripleVolDownPress < 1000) {
      this.log.debug("%s: Triple-press of volume down detected", this.name);
      keyCode = this.deviceConfig.voldownButtonTriplePress;
    } else if (
      volumeSelectorValue === Characteristic.VolumeSelector.INCREMENT
    ) {
      keyCode = this.deviceConfig.volupButton;
    } else if (
      volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT
    ) {
      keyCode = this.deviceConfig.voldownButton;
    }
    // send only if a keycode exists
    if (keyCode?.length > 0) {
      this.sendKey(keyCode);
    }
  }

  // get ActiveIdentifier (input)
  // ActiveIdentifier is 1-based: 1=input1, 2=input2, etc
  async getActiveIdentifier() {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in HomeKit and HomeKit requests a refresh
    // returns 1-based active input index; must never return null; currentInputId maintained by poll
    // Input 1 is the first entry in the input list, input 2 the next, and so on
    // Active identifier (as retrieved in Shortcuts)

    // find the currentInputId in the inputs and return the currentActiveInput once found
    // this allows HomeKit to show the selected current input
    // O(1) map lookup using inputIdIndexMap built once at startup in prepareInputSourceServices
    // maps currentInputId (1-based) to its zero-based array index in inputServices
    const foundIdx = this.inputIdIndexMap.get(this.currentInputId);
    const currentActiveIdentifierZeroBased =
      foundIdx !== undefined ? foundIdx : NO_INPUT_ID - 1;
    // if nothing found (undefined), set to NO_INPUT_ID - 1 to clear the name from the Home app tile

    // Add 1 to convert internal zero-based array index to 1-based ActiveIdentifier for HomeKit
    if (this.debugLevel > 0) {
      // get name if currentActiveInput is within bounds of the inputServices array, used only for logging
      // use a ternary: condition ? value when true : value when false
      const currentInputName =
        currentActiveIdentifierZeroBased >= 0 &&
        currentActiveIdentifierZeroBased < this.inputServices.length
          ? this.inputServices[
              currentActiveIdentifierZeroBased
            ].getCharacteristic(Characteristic.ConfiguredName).value
          : undefined;

      this.log.warn(
        "%s: getActiveIdentifier returning currentActiveIdentifier %s = input %s [%s]",
        this.name,
        currentActiveIdentifierZeroBased + 1,
        currentActiveIdentifierZeroBased + 1,
        currentInputName || NO_INPUT_NAME,
      );
    }

    return currentActiveIdentifierZeroBased + 1; // first input has ActiveIdentifier 1, 2nd has 2, and so on
  }

  // set ActiveIdentifier (input, uint32)
  async setActiveIdentifier(newInputId) {
    // newInputId is an integer, 1-based. 1 is the first entry in the input list, input 2 the next, and so on
    if (this.debugLevel > 0) {
      this.log.warn(
        "%s: setActiveIdentifier newInputId:",
        this.name,
        newInputId,
      );
    }

    // Guard 1: validate newInputId is a usable positive integer
    // HomeKit sends uint32 but defensive coding here is cheap insurance
    if (!Number.isInteger(newInputId) || newInputId < 1) {
      this.log.warn(
        '%s: setActiveIdentifier: invalid newInputId %s, ignoring',
        this.name,
        newInputId,
      );
      return;
    }

    // Guard 2: ensure deviceConfig and its inputs array exist before touching them
    // this.deviceConfig may not be ready yet if called during rapid HomeKit reconnects
    if (!this.deviceConfig?.inputs) {
      this.log.warn(
        '%s: setActiveIdentifier: deviceConfig.inputs not available, ignoring',
        this.name,
      );
      return;
    }    

    // get keycode only if we have an input (sometimes not defined)
    // Array is zero-based, newInputId is 1-based
    const inputEntry = this.deviceConfig.inputs[newInputId - 1];

    if (!inputEntry) {
      this.log.warn(
        '%s: setActiveIdentifier: no input config for id %s, ignoring',
        this.name,
        newInputId,
      );
      return;
    }

    const keyCode = inputEntry.inputKeyCode ?? '';

    if (!keyCode) {
      // Nothing to send — not a warn-worthy event, just a no-op input
      if (this.debugLevel > 0) {
        this.log.warn('%s: setActiveIdentifier: no keyCode for id %s, skipping', this.name, newInputId);
      }
      return;
    }

    // Send the key and update state
    this.sendKey(keyCode);

    // Resolve the display name once, reusing the already-retrieved inputEntry
    // Avoids a redundant getCharacteristic() call just for logging
    if (this.debugLevel > 0) {
      const currentInputName = inputEntry.name ?? `Input ${newInputId}`;
      this.log.warn(
        '%s: setActiveIdentifier setting newInputId to: %s [%s]',
        this.name,
        newInputId,
        currentInputName,
      );
    }

    this.currentInputId = newInputId;
    this.televisionService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .updateValue(newInputId);
    this.lastPushedActiveIdentifier = newInputId;
  }

  // set input name
  async setInputName(inputName) {
    // fired by the user changing an input name in Home app accessory setup
    if (this.debugLevel > 0) {
      this.log.warn("%s: setInputName inputName:", this.name, inputName);
    }
  }

  // set power mode selection (View TV Settings menu option)
  async setPowerModeSelection(state) {
    // fired by the View TV Settings command in the HomeKit TV accessory Settings
    if (this.debugLevel > 0) {
      this.log.warn("%s: setPowerModeSelection state:", this.name, state);
    }
    this.log("%s: Menu command: View TV Settings", this.name);
    // only send the keys if the power is on
    if (this.currentPowerState === Characteristic.Active.ACTIVE) {
      this.sendKey(this.deviceConfig.viewTvSettingsCommand || "KEY_MENU");
    } else {
      this.log(
        "%s: Power is Off. View TV Settings command not sent",
        this.name,
      );
    }
  }

  // get current media state
  async getCurrentMediaState() {
    // fired by ??
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    if (this.debugLevel > 0) {
      this.log.warn(
        "%s: getCurrentMediaState returning %s [%s]",
        this.name,
        this.currentMediaState,
        mediaStateName[this.currentMediaState],
      );
    }
    return this.currentMediaState;
  }

  // get target media state
  async getTargetMediaState() {
    // fired by ??
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    // must never return null, so send STOP as default value
    if (this.debugLevel > 0) {
      this.log.warn(
        "%s: getTargetMediaState returning %s [%s]",
        this.name,
        this.targetMediaState,
        mediaStateName[this.targetMediaState],
      );
    }
    return this.currentMediaState;
  }

  // set target media state
  async setTargetMediaState(targetState) {
    // TODO: implement when setMediaState() is built
    // fired by ??
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setTargetMediaState this.targetMediaState:",
        this.name,
        targetState,
        mediaStateName[targetState],
      );
    }
  }

  // get display order
  async getDisplayOrder() {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in HomeKit and HomeKit requests a refresh
    // getDisplayOrder is registered as a onGet handler and is called by HomeKit whenever the remote control opens.
    // It reads the value back from the HAP characteristic every time. But DisplayOrder is set once at startup and never changes.
    // The base64 string is already computed in prepareAccessory — cache it in an instance variable there and return the variable directly.
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getDisplayOrder returning '%s'",
        this.name,
        this.displayOrderBase64,
      );
    }
    return this.displayOrderBase64; // no HAP read — direct instance variable
  }

  // set display order
  async setDisplayOrder(displayOrder) {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in HomeKit and HomeKit requests a refresh
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setDisplayOrder displayOrder",
        this.name,
        displayOrder,
      );
    }
  }

  // resolver function to resolve the remote key and button layer
  resolveKeyName(remoteKey, buttonLayer) {
    const mapping = getRemoteKeyMap()[remoteKey]; // populate the mapping, populates once only

    if (!mapping) {
      this.log(
        "%s: resolveKeyName: Unknown remoteKey: %s",
        this.name,
        remoteKey,
      );
      return null;
    }

    // Keys without a configKey (REWIND, FF, EXIT) always use their default
    if (!mapping.configKey) return mapping.default;

    // Resolve tap layer: triple → double → single, each falling back to default
    const cfg = this.deviceConfig;
    const suffix = KEY_LAYER_SUFFIXES[buttonLayer] ?? "";
    return cfg[mapping.configKey + suffix] ?? mapping.default;
  }

  // set remote key
  async setRemoteKey(remoteKey) {
    // remoteKey is the key pressed on the Apple TV Remote in the Control Center
    // keys 0...15 exist, but keys 12, 13 & 14 are not defined by Apple
    if (this.debugLevel > 1) {
      this.log.warn("%s: setRemoteKey: remoteKey:", this.name, remoteKey);
    }
    const nowMs = Date.now(); // capture once, use a few times

    // ------------- handling of double and triple press ---------------
    // single press: layer 0, double press: layer 1, triple press: layer 2
    // TODO properly implement tripleVolDownPress
    // let tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed

    if (this.debugLevel > 1) {
      const lastKeyPressTime = this.lastRemoteKeyPress0[remoteKey] || 0; // find the time the current key was last pressed
      this.log.warn(
        "%s: setRemoteKey: remoteKey %s, lastKeyPressTime %s",
        this.name,
        remoteKey,
        lastKeyPressTime,
      );
    }

    // bump the array up one level and store now in lastRemoteKeyPress0
    this.lastRemoteKeyPress2[remoteKey] = this.lastRemoteKeyPress1[remoteKey];
    this.lastRemoteKeyPress1[remoteKey] = this.lastRemoteKeyPress0[remoteKey];
    this.lastRemoteKeyPress0[remoteKey] = nowMs;

    // lastPressTime2 only used if we add button layer 2
    //let lastPressTime2 =
    //  this.lastRemoteKeyPress2[remoteKey] || Date.now() - 86400; // default to same time yesterday if empty
    const lastPressTime1 = this.lastRemoteKeyPress1[remoteKey] || nowMs - 86400000; // default to same time yesterday if empty 86400 * 1000
    const lastPressTime0 = nowMs; // stored in this.lastRemoteKeyPress0[remoteKey] as well

    // check if same as previous key pressed, within the limits of the double press time
    const { doublePressTime, doublePressDelayTime } = this;
    let buttonLayer = 0; // default layer 0
    if (this.lastRemoteKeyPressed === remoteKey) {
      this.log.debug(
        "%s: setRemoteKey: current key %s same as last key %s",
        this.name,
        remoteKey,
        this.lastRemoteKeyPressed,
      );

      // if same key, check for double or triple press
      // check timing, activating triple-press then double-press button layers
      // if historical key presses exist in buffer
      if (lastPressTime0 - lastPressTime1 < doublePressTime) {
        this.log.debug(
          "%s: setRemoteKey remoteKey %s, double press detected",
          this.name,
          remoteKey,
        );
        buttonLayer = 1; // layer 1 = double press layer
        this.pendingKeyPress = -1; // clear any pending key press
        this.sendRemoteKeyPressAfterDelay = false; // disable send after delay
        this.readyToSendRemoteKeyPress = true; // enable immediate send
      } else {
        // no historical key presses exist, queue as a pending press
        this.log.debug(
          "%s: setRemoteKey remoteKey %s, no historical key press detected",
          this.name,
          remoteKey,
        );
        this.pendingKeyPress = remoteKey;
        this.sendRemoteKeyPressAfterDelay = true; // enable send after delay
        this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
      }
    } else {
      this.log.debug(
        "%s: setRemoteKey current key %s different to last key %s",
        this.name,
        remoteKey,
        this.lastRemoteKeyPressed,
      );
      // this key is different to last key, send after delay (may be start of another double or triple key press)
      this.pendingKeyPress = remoteKey;
      this.sendRemoteKeyPressAfterDelay = true; // enable send after delay
      this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
    }

    // check time difference between current keyPress and 2 keyPresses ago
    this.log.debug(
      "%s: setRemoteKey remoteKey %s, Time diff between lastRemoteKeyPress0 now and lastRemoteKeyPress1: %s ms",
      this.name,
      remoteKey,
      lastPressTime0 - lastPressTime1,
    );
    this.log.debug(
      "%s: setRemoteKey remoteKey %s, buttonLayer %s, pendingKeyPress %s, sendRemoteKeyPressAfterDelay %s, readyToSendRemoteKeyPress %s",
      this.name,
      remoteKey,
      buttonLayer,
      this.pendingKeyPress,
      this.sendRemoteKeyPressAfterDelay,
      this.readyToSendRemoteKeyPress,
    );

    // resolve the key name for the button layer
    const keyName = this.resolveKeyName(remoteKey, buttonLayer);

    // handle the key code (can be a sequence)
    // send only if keyName is not null
    if (keyName) {
      if (this.readyToSendRemoteKeyPress) {
        // send immediately
        this.log.debug(
          "%s: setRemoteKey: sending key %s immediately",
          this.name,
          keyName,
        );
        this.sendKey(keyName);
      } else {
        // immediate send is not enabled.
        // start a delay equal to doublePressTime, then send only if the readyToSendRemoteKeyPress is true
        this.log.debug(
          "%s: setRemoteKey: sending key %s after delay of %s milliseconds",
          this.name,
          keyName,
          doublePressDelayTime,
        );
        setTimeout(() => {
          // check if can be sent. Only send if sendRemoteKeyPressAfterDelay is still set. It may have been reset by another key press
          this.log.debug(
            "%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s",
            this.name,
            keyName,
          );
          if (this.sendRemoteKeyPressAfterDelay) {
            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, sending %s",
              this.name,
              keyName,
            );
            this.sendKey(keyName);
            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, key %s sent, resetting readyToSendRemoteKeyPress",
              this.name,
              keyName,
            );
            this.readyToSendRemoteKeyPress = true; // reset the enable flag
          } else {
            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s: sendRemoteKeyPressAfterDelay is false, doing nothing",
              this.name,
              keyName,
            );
          }
        }, doublePressDelayTime); // send after doublePressDelayTime
      }
    }
    this.lastRemoteKeyPressed = remoteKey; // store the current key as last key pressed
  }

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END of accessory get/set characteristic handlers
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
}
