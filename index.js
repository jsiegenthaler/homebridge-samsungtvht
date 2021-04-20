'use strict';

// ****************** start of settings

// name and version
const packagejson = require('./package.json');
const PLUGIN_NAME = packagejson.name;
const PLATFORM_NAME = packagejson.platformname;
const PLUGIN_VERSION = packagejson.version;

// required node modules
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

//const qs = require('qs')
//const _ = require('underscore');


const SamsungRemote = require('samsung-remote');

// https://github.com/Samfox2/homebridge-cec-tv-platform/blob/main/index.js
//const  CecController = require('cec-controller');

// exec spawns child process to run a bash script
const exec = require("child_process").exec;



// general constants
const NO_INPUT_ID = 999; // an input id that does not exist. Must be > 0 as a uint32 is expected
const NO_INPUT_NAME = 'UNKNOWN'; // an input name that does not exist
const MAX_INPUT_SOURCES = 3; // max input services. Default = 3. Cannot be more than 97 (100 - all other services)
const POWER_STATE_POLLING_INTERVAL_MS = 5000; // pollling interval in millisec. Default = 1000
const mediaStateName = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerStateName = ["OFF", "ON"];
const powerStateTransition = { NOT_TRANSITIONING: 0, TRANSITIONING_ON_TO_OFF: 1, TRANSITIONING_OFF_TO_ON: 2 };
Object.freeze(mediaStateName);
Object.freeze(powerStateName);



// global variables (urgh)


let deviceId;
let currentInputId;
let currentPowerState;
let currentMediaState;
let targetMediaState;
let volDownLastKeyPress;
let Accessory, Characteristic, Service, Categories, UUID;




// wait function
const wait=ms=>new Promise(resolve => setTimeout(resolve, ms)); 


// ++++++++++++++++++++++++++++++++++++++++++++
// config
// ++++++++++++++++++++++++++++++++++++++++++++






// ++++++++++++++++++++++++++++++++++++++++++++
// platform setup
// ++++++++++++++++++++++++++++++++++++++++++++
module.exports = (api) => {
	Accessory = api.platformAccessory;
	Characteristic = api.hap.Characteristic;
	Service = api.hap.Service;
	Categories = api.hap.Categories;
	UUID = api.hap.uuid;
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, samsungTvHtPlatform, true);
};

class samsungTvHtPlatform {
	// build the platform. Runs once on restart
	constructor(log, config, api) {
		// only load if configured
		if (!config || !Array.isArray(config.devices)) {
			log('No configuration found for %s', PLUGIN_NAME);
			return;
		}
		this.log = log;
		this.config = config;
		this.api = api;
		this.devices = [];
		this.debugLevel = this.config.debugLevel;

		this.api.on('didFinishLaunching', () => {
			if (this.debugLevel > 0) {
				this.log.warn('API event: didFinishLaunching');
			}

			if (this.config.devices.length == 0) {
				this.log.warn('No devices found in configuration for %s', PLUGIN_NAME)
			} else {
				// check all devices in config
				this.log.warn('Checking devices found in configuration for %s', PLUGIN_NAME)
				for (let i = 0, len = this.config.devices.length; i < len; i++) {
					this.log("Checking device %s %s", i, this.config.devices[i]);

					this.log("Device %s: %s", i+1, this.config.devices[i].name);
					this.devices[i] = new samsungTvHtDevice(this.log, this.config.devices[i], this.api, this, this.devices[i], i);
					}
				}
				// start the regular ping
				this.checkPowerInterval = setInterval(this.powerStateWatchdog.bind(this), POWER_STATE_POLLING_INTERVAL_MS);
		
		});
	}



	configureAccessory(platformAccessory) {
		this.log.debug('configurePlatformAccessory');
	}

	removeAccessory(platformAccessory) {
		this.log.debug('removePlatformAccessory');
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
	}

	powerStateWatchdog() {
		// ping the devices regularly to check their power state
		this.log("powerStateWatchdog ---START-----------------------------------------")

		// for linux:
		//var pingCmd = 'ping -c 1 -w 1 ' + this.config.devices[0].ipAddress;

		// for win
		// var pingCmd = 'ping -n 1 -w 10 ' + this.config.devices[0].ipAddress;

		// ping all devices in the config
		for (let i = 0; i < this.devices.length; i++) {
			let device = this.devices[i];

			//let lastKeyPress = this.devices[i].powerLastKeyPress;
			//this.log("device powerLastKeyPress: ", this.devices[i].powerLastKeyPress.toLocaleString())

			let secondsSinceLastPowerKeyPress = (Date.now() - this.devices[i].powerLastKeyPress) / 1000;
			this.log("secondsSinceLastPowerKeyPress: ", secondsSinceLastPowerKeyPress)

			const powerStateMaxTransitionTimeSeconds = 20;

			if (secondsSinceLastPowerKeyPress < powerStateMaxTransitionTimeSeconds) {
				this.log("power state is in transition, use target power state. Transition duration:", secondsSinceLastPowerKeyPress)
			} else {
				this.log("power state not in transition, use current power state")
			}

			var pingCmd = this.config.pingCommand || 'ping -c 1 -w 1'; // default linux
			pingCmd = pingCmd.trim() + ' ' + device.config.ipAddress;
			this.log.warn('powerStateWatchdog: Pinging %s with %s', device.name, pingCmd);
	
			var self = this;
			var devicePowerState;
			exec(pingCmd, function (error, stdout, stderr) {

				self.log.warn("powerStateWatchdog: Evaluating ping responce", device.name);
				// get the current device power state from the ping results
				// linux: 	1 packets transmitted, 0 received, 100% packet loss, time 0ms
				// windows: 
				if (stdout.includes('Sent = 1, Received = 1,') || stdout.includes('1 packets transmitted, 1 received')) {
					self.log.warn("powerStateWatchdog: Device %s is responding to ping, power is ON", device.name);
					devicePowerState = Characteristic.Active.ACTIVE;
				} else if (stdout.includes('Sent = 1, Received = 0,') || stdout.includes('1 packets transmitted, 0 received')) {
					self.log.warn("powerStateWatchdog: Device %s is not responding to ping, power is OFF", device.name);
					devicePowerState = Characteristic.Active.INACTIVE;
				} else {
					self.log.warn("powerStateWatchdog: ERROR Ping result cannot be parsed! stdout:", stdout);
					devicePowerState = null;
				}


				// evaluate the current vs target power states
				self.log.warn("powerStateWatchdog: Evaluating device power state", device.name);
				if (device.currentPowerState != device.targetPowerState) {
					self.log.warn("powerStateWatchdog: Device %s is transiitoning from %s to %s", device.name, device.currentPowerState, device.targetPowerState);
					// change in power state was requested
					if (secondsSinceLastPowerKeyPress < powerStateMaxTransitionTimeSeconds) {
						// device is currently undergoing a power state transition
						// check if target power state has been reached, if so, set current power state to target power state
						self.log.warn("powerStateWatchdog: Device %s is still within the allowed transiiton time", device.name);
						if (devicePowerState == device.targetPowerState) {
							device.currentPowerState = device.targetPowerState;
						}
					} else {
						// transition time has timed out, cancel the target power state, leave current power state unchanged
						self.log.warn("powerStateWatchdog: Device %s transiiton time has timed out, no power state change occured, resetting power state to %s", device.name, device.currentPowerState);
						device.targetPowerState = device.currentPowerState;
					}

				} else {
					device.currentPowerState = devicePowerState;
				}

				/*
				self.log.warn("powerStateWatchdog: Device %s is responding to ping, power is ON", device.name);
					if (millisecondsSinceLastPowerKeyPress < powerStateMaxTransitionTime) {
						// device is currently undergoing a power state transition

						// device is ON, check if it is transitioning
						if (device.currentPowerTransitionState == powerStateTransition.TRANSITIONING_ON_TO_OFF) {
							// device is transitioning from ON to OFF, but is not yet OFF, so return OFF
							self.log("Power state is ON in transition from ON to OFF, setting to OFF")
							device.currentPowerState = Characteristic.Active.INACTIVE;
							// but do not change the transitioning state

						} else if (device.currentPowerTransitionState == powerStateTransition.TRANSITIONING_OFF_TO_ON) {
							// device is transitioning from OFF to ON, must have just turned ON, so return ON
							self.log("Power state is ON in transition from OFF to ON, setting to ON")
							device.currentPowerState = Characteristic.Active.ACTIVE;
							// and set the transitioning state to not transitioning
							device.currentPowerTransitionState = powerStateTransition.NOT_TRANSITIONING;
						} else {
							// device is not transitioning, so return ON
							self.log("Power state not in transition, setting to ON")
							device.currentPowerState = Characteristic.Active.ACTIVE;
						}

					} else {
						// device is not transitioning, so return ON
						self.log("Power state not in transition, setting to ON")
						device.currentPowerState = Characteristic.Active.ACTIVE;
					};

					self.log.warn("powerStateWatchdog: Device %s is not responding to ping, power is OFF", device.name);
					if (millisecondsSinceLastPowerKeyPress < powerStateMaxTransitionTime) {
						// device is currently undergoing a power state transition

						// device is OFF, check if it is transitioning
						if (device.currentPowerTransitionState == powerStateTransition.TRANSITIONING_ON_TO_OFF) {
							// device is transitioning from ON to OFF, and has just turned OFF, so return OFF
							self.log("Power state is OFF in transition from ON to OFF, setting to OFF")
							device.currentPowerState = Characteristic.Active.INACTIVE;
							// and set the transitioning state to not transitioning
							device.currentPowerTransitionState = powerStateTransition.NOT_TRANSITIONING;

						} else if (device.currentPowerTransitionState == powerStateTransition.TRANSITIONING_OFF_TO_ON) {
							// device is transitioning from OFF to ON, but is not yet ON, so return ON
							self.log("Power state is OFF in transition from OFF to ON, setting to ON")
							device.currentPowerState = Characteristic.Active.ACTIVE;
							// but do not change the transitioning state

						} else {
							// device is not transitioning, so return OFF
							self.log("Power state not in transition, setting to OFF")
							device.currentPowerState = Characteristic.Active.INACTIVE;
						}

					} else {
						// device is not transitioning, so return OFF
						self.log("Power state not in transition, setting to OFF")
						device.currentPowerState = Characteristic.Active.INACTIVE;
					}
					*/

			});

			this.log("Calling device.updateDeviceState with %s currentPowerState %s", device.name, device.currentPowerState);
			device.updateDeviceState(device.currentPowerState);

			// or update it directly... but then we cannot log the change
			//device.televisionService.getCharacteristic(Characteristic.Active).updateValue(device.currentPowerState);


		}
		this.log("powerStateWatchdog ---END-------------------------------------------")

	}
	



}



class samsungTvHtDevice {
	// build the device. Runs once on restart
	constructor(log, config, api, parent, device, deviceIndex) {
		this.log = log;
		this.api = api;
		this.config = config;
		this.parent = parent;
		this.device = device;
		this.deviceIndex = deviceIndex;
		this.debugLevel = this.parent.config.debugLevel;

		// setup arrays
		this.name = this.config.name 	// device name from config
		this.debugLevel = this.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 96
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL
		this.volDownLastKeyPress = [];	// holds the values of the last vol down button presses

		this.inputList = [
			{inputId: "HDMI1", inputName: "HDMI 1"},
			{inputId: "HDMI2", inputName: "HDMI 2"},
			{inputId: "AUX", inputName: "AUX"},
		];

		//setup variables
		this.accessoryConfigured = false;	// true when the accessory is configured
		this.currentPowerTransitionState = powerStateTransition.NOT_TRANSITIONING;


		// initial states. Will be updated by code
		this.currentPowerState = Characteristic.Active.INACTIVE;
		this.targetPowerState = this.currentPowerState;
		this.currentInputId = NO_INPUT_ID;
		this.currentMediaState = Characteristic.CurrentMediaState.STOP;
		this.targetMediaState = this.currentMediaState;
		this.powerLastKeyPress = 0;

		// use defaults of plugin/platform name & version
		// until device is discovered
		this.manufacturer = this.config.manufacturer || PLUGIN_NAME;
		this.modelName = this.config.modelName || PLATFORM_NAME;
		this.serialNumber = this.config.serialNumber || 'unknown';
		this.firmwareRevision = this.config.firmwareRevision || PLUGIN_VERSION; // must be numeric. Non-numeric values are not displayed

		// prepare the accessory
		this.prepareAccessory();
		
		// update device state regularly
		// Check & Update Accessory Status every POWER_STATE_POLLING_INTERVAL_MS (Default: 5000 ms)
		// this is the last step in the setup. From now on polling will occur every 5 seconds
		//this.checkStateInterval = setInterval(this.updateDeviceState.bind(this),POWER_STATE_POLLING_INTERVAL_MS);

	}



  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	//Prepare accessory (runs from session watchdog)
	prepareAccessory() {
		if (this.debugLevel > 0) {
			this.log.warn('prepareAccessory');
		}

		// exit immediately if already configured (runs from session watchdog)
		if (this.accessoryConfigured) { return }

		this.log("prepareAccessory", this.name, PLUGIN_NAME);

		const accessoryName = this.name;
		const accessoryUUID = UUID.generate(this.name + PLUGIN_NAME);

		// default category is TV, allow also RECEIVER (avr)
		let accessoryCategory = Categories.TELEVISION;
		if (this.config.type == "receiver") { accessoryCategory = Categories.AUDIO_RECEIVER; }

		this.accessory = new Accessory(accessoryName, accessoryUUID, accessoryCategory);

		this.prepareAccessoryInformationService();	// service 1 of 100
		this.prepareTelevisionService();			// service 2 of 100
		this.prepareTelevisionSpeakerService();		// service 3 of 100
		this.prepareInputSourceServices();			// service 4...10

		this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
		this.accessoryConfigured = true;
	}


	//Prepare AccessoryInformation service
	prepareAccessoryInformationService() {
		if (this.debugLevel > 0) {
			this.log.warn('prepareAccessoryInformationService');
		}

		this.accessory.removeService(this.accessory.getService(Service.AccessoryInformation));
		const informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.modelName)
			.setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
			.setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision)

		this.accessory.addService(informationService);
	}

	//Prepare Television service
	prepareTelevisionService() {
		if (this.debugLevel > 0) {
			this.log.warn('prepareTelevisionService');
		}
		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService
			.setCharacteristic(Characteristic.ConfiguredName, this.name)
			.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
		
		/* // not yet working
		this.televisionService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', this.getDeviceName.bind(this))
			.on('set', (newName, callback) => { this.setDeviceName(newName, callback); });
		*/

		this.televisionService.getCharacteristic(Characteristic.Active)
			.on('get', this.getPower.bind(this))
			.on('set', this.setPower.bind(this));

		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInput.bind(this))
			.on('set', (newInputIdentifier, callback) => { this.setInput(this.InputListHomeKit[newInputIdentifier], callback); });

		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));

		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		this.televisionService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (newMediaState, callback) => { this.setTargetMediaState(newMediaState, callback); });

		this.accessory.addService(this.televisionService);
	}

	//Prepare TelevisionSpeaker service
	prepareTelevisionSpeakerService() {
		if (this.debugLevel > 0) {
			this.log.warn('prepareTelevisionSpeakerService');
		}
		this.speakerService = new Service.TelevisionSpeaker(this.name + ' Speaker', 'speakerService');
		this.speakerService
			.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
		this.speakerService.getCharacteristic(Characteristic.VolumeSelector)  // the volume selector allows the iOS device keys to be used to change volume
			.on('set', (direction, callback) => { this.setVolume(direction, callback); });
		this.speakerService.getCharacteristic(Characteristic.Volume)
			.on('set', this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
			.on('set', this.setMute.bind(this));

		this.accessory.addService(this.speakerService);
		this.televisionService.addLinkedService(this.speakerService);
	}
	

	//Prepare InputSource services
	prepareInputSourceServices() {
		// This is the input list, each input is a service, max 100 services less the services created so far

		// on the samsung devices, the
		// AVR: HDMI1, HDMI2, Analog
		if (this.debugLevel > 1) {
			this.log.warn('prepareInputSourceServices');
		}

		let inputService;

		// HDMI 1
		inputService = new Service.InputSource(1, "input_1");
		inputService
			.setCharacteristic(Characteristic.Identifier, 1)
			.setCharacteristic(Characteristic.ConfiguredName, "HDMI 1")
			.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI)
			.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
			.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
			.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
			.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			/*
		inputService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', (callback) => { this.getInputName(1, callback); })
			.on('set', (value, callback) => { this.setInputName(1, value, callback); });
			*/

		this.inputServices.push(inputService);
		this.accessory.addService(inputService);
		this.televisionService.addLinkedService(inputService);


		// HDMI 2
		inputService = new Service.InputSource(2, "input_2");
		inputService
			.setCharacteristic(Characteristic.Identifier, 1)
			.setCharacteristic(Characteristic.ConfiguredName, "HDMI 2")
			.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI)
			.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
			.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
			.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
			.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			/*
		inputService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', (callback) => { this.getInputName(2, callback); })
			.on('set', (value, callback) => { this.setInputName(2, value, callback); });
			*/

		this.inputServices.push(inputService);
		this.accessory.addService(inputService);
		this.televisionService.addLinkedService(inputService);

		// Analog / AUX-IN
		inputService = new Service.InputSource(3, "input_3");
		inputService
			.setCharacteristic(Characteristic.Identifier, 1)
			.setCharacteristic(Characteristic.ConfiguredName, "Analog AUX IN")
			.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.OTHER)
			.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.AUDIO_SYSTEM)
			.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
			.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
			.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			/*
		inputService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', (callback) => { this.getInputName(3, callback); })
			.on('set', (value, callback) => { this.setInputName(3, value, callback); });
*/

		this.inputServices.push(inputService);
		this.accessory.addService(inputService);
		this.televisionService.addLinkedService(inputService);

	}
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++




  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START state handler
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// send a remote control keypress to the settopbox
	sendKey(keyName) {
		if (this.debugLevel >= 0) {
			this.log.warn('%s: sendKey %s', this.name, keyName);
		}

		// make a new remote
		const remote = new SamsungRemote({
			ip: this.config.ipAddress
		});
		
		// remote reports timeouts as errors
		remote.send(keyName, (err) => {
			if (err) {
				if (err == "Timeout") {
					// ignore, this is normal with SamsungRemote, some keys just do get a responce from the TV / AVR
				} else {
					this.log.warn("%s: sendKey: error %s", this.name, err);
					// throw new Error(err);
				}
			}
		});
	}


	// get the device UI status
	getUiStatus() {
		if (this.debugLevel > 1) {
			this.log.warn('getUiStatus');
		}
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++





	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state changed to async
	async updateDeviceState(powerState, mediaState, inputId, sourceType, callback) {
		// doesn't get the data direct from the device box, but rather: gets it from the variables

		// grab the input variables
		if (powerState != null) { this.currentPowerState = powerState }
		if (mediaState != null) { this.currentMediaState = mediaState }
		if (inputId != null) 	{ this.currentInputId = inputId }
		if (sourceType != null) { this.currentSourceType = sourceType }

		// debugging, helps a lot to see InputName
		if (this.debugLevel > 0) {
			let currentInputName; // let is scopt to the current {} block
			let curInput = this.inputList.find(Input => Input.inputId === this.currentInputId); 
			if (curInput) { currentInputName = curInput.InputName; }
			this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentInputId %s [%s], currentSourceType %s', 
				this.name, 
				this.currentPowerState, 
				this.currentMediaState, mediaStateName[this.currentMediaState], 
				this.currentInputId, currentInputName,
				this.currentSourceType
			);
		}



		// change only if configured, and update only if changed
		if (this.televisionService) {

			// set power state if changed
			var oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
			if (oldPowerState !== this.currentPowerState) {
				this.log('%s: Power changed from %s %s to %s %s', 
					this.name,
					oldPowerState, powerStateName[oldPowerState],
					this.currentPowerState, powerStateName[this.currentPowerState]);
				this.televisionService.getCharacteristic(Characteristic.Active).updateValue(this.currentPowerState);
			}
			
			// set active input if changed
			var oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
			var currentActiveIdentifier = this.inputList.findIndex(input => input.inputId === currentInputId);
			if (currentActiveIdentifier == -1) { currentActiveIdentifier = NO_INPUT_ID } // if nothing found, set to NO_INPUT to clear the name from the Home app tile
			if (oldActiveIdentifier !== currentActiveIdentifier) {
				// get names from loaded input list. Using SOURCE button on the remote rolls around the input list
				var oldName, newName;
				if (oldActiveIdentifier == NO_INPUT_ID) {
					oldName = 'UNKNOWN';
				}
				if (currentActiveIdentifier == NO_INPUT_ID) {
					newName = 'UNKNOWN';
				}
				this.log('%s: Input changed from %s %s to %s %s', 
					this.name,
					oldActiveIdentifier + 1, oldName,
					currentActiveIdentifier + 1, newName);
				this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
			}

			// set current media state if changed
			var oldMediaState = this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).value;
			if (oldMediaState !== this.currentMediaState) {
				this.log('%s: Media state changed from %s %s to %s %s', 
					this.name,
					oldMediaState, mediaStateName[oldMediaState],
					this.currentMediaState, mediaStateName[this.currentMediaState]);
				this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.currentMediaState);
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
	async getPower(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		if (this.debugLevel > 1) { 
			this.log.warn('%s: getPower returning %s [%s]', this.name, this.currentPowerState, powerStateName[this.currentPowerState]); 
		}
		callback(null, this.currentPowerState); // return current state: 0=off, 1=on
	}

	// set power state
	async setPower(targetPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in HomeKit
		// fired when the user clicks the TV tile in HomeKit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.debugLevel > 1) { this.log.warn('%s: setPower targetPowerState:', this.name, targetPowerState, powerStateName[targetPowerState]); }
		callback(null); // for rapid response
		this.targetPowerState = targetPowerState;

		// only take action if the target state is different to the current state
		if (this.currentPowerState != this.targetPowerState) {
			// check what we want to do
			this.powerLastKeyPress = Date.now();
			if (this.targetPowerState == Characteristic.Active.INACTIVE){
				// we want to turn OFF, then we can turn it off with a sendKey
				// avr: BD_KEY_POWER, tv: KEY_POWER
				let keyName = 'KEY_POWEROFF';
				if (this.config.type == 'avr') {keyName='BD_KEY_POWER'}
				this.sendKey(keyName);
				this.currentPowerTransitionState = powerStateTransition.TRANSITIONING_ON_TO_OFF;
			} else {
				// we want to turn ON, can turn on only via HDMI-CEC
				this.log("%s: Request to turn ON: we can only do this with HDMI-CEC", this.name);
				this.currentPowerTransitionState = powerStateTransition.TRANSITIONING_OFF_TO_ON;
			}

		} else {
			// if OFF, can turn on only via HDMI-CEC
			this.log("%s: Current power state is already %s [%s], doing nothing", this.name, this.currentPowerState, powerStateName[this.currentPowerState]);
		}

	}

	// set mute state
	async setMute(muteState, callbackMute) {
		// sends the mute command
		// works for TVs that accept a mute toggle command
		if (this.debugLevel > 0) {
			this.log.warn('setMute muteState:', muteState);
		}

		if (callbackMute && typoeof(callbackMute) === 'function') { 
			callbackMute();
		}
 
		// mute state is a boolean, either true or false
		// const NOT_MUTED = 0, MUTED = 1;
		this.log('Set mute: %s', (muteState) ? 'Muted' : 'Not muted');
		this.sendKey('KEY_MUTE');
	}


	// set volume
	async setVolume(volumeSelectorValue, callback) {
		// set the volume of the TV using bash scripts
		// so volume must be handled over a different method
		// here we send execute a bash command on the raspberry pi using the samsungctl command
		// to control the authors samsung stereo at 192.168.0.152
		if (this.debugLevel > 0) { this.log.warn('setVolume volumeSelectorValue:',volumeSelectorValue); }
		callback(null); // for rapid response

		// volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
		this.log.debug('Set volume: %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 10000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.volDownLastKeyPress[2] = this.volDownLastKeyPress[1] || 0;
			this.volDownLastKeyPress[1] = this.volDownLastKeyPress[0] || 0;
			this.volDownLastKeyPress[0] = Date.now();
			tripleVolDownPress = this.volDownLastKeyPress[0] - this.volDownLastKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('setVolume: Timediff between volDownKeyPress[0] now and volDownKeyPress[2]: %s ms', this.volDownLastKeyPress[0] - this.volDownLastKeyPress[2]);
		}
			
		// check for triple press of volDown, send setmute if tripleVolDownPress less than 1000ms
		if (tripleVolDownPress < 1000) {
			this.log('Triple-press of volume down detected. Sending Mute');
			this.sendKey('KEY_MUTE');
		} else if (volumeSelectorValue === Characteristic.VolumeSelector.INCREMENT) {
			this.sendKey('KEY_VOLUP');
		} else if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.sendKey('KEY_VOLDOWN');
		}
	}

	// get input
	async getInput(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// currentInputId is updated by the polling mechanisn
		// must return a valid index, and must never return null

		// find the currentInputId in the inputs and return the currentActiveInput once found
		// this allows HomeKit to show the selected current input
		
		var currentInputName = NO_INPUT_NAME;
		var currentActiveInput = this.inputServices.findIndex(input => input.inputId === currentInputId);
		if (currentActiveInput == -1) { currentActiveInput = NO_INPUT_ID } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
		if ((currentActiveInput > -1) && (currentActiveInput != NO_INPUT_ID)) { 
			currentInputName = this.inputServices[currentActiveInput].getCharacteristic(Characteristic.ConfiguredName).value; 
		}
		
		currentActiveInput = NO_INPUT_ID; // just for now
		currentInputName = NO_INPUT_NAME;

		if (this.debugLevel > 0) { 
			this.log.warn('%s: getInput returning input %s [%s]', this.name, currentActiveInput, currentInputName);
		}

		callback(null, currentActiveInput);
	}

	// set input
	async setInput(input, callback) {
		if (this.debugLevel > 0) {
			this.log.warn('setInput input:',input.inputId, input.InputName);
		}
		callback(null); // for rapid response
		var currentInputName = 'UNKNOWN';
		var foundIndex = this.inputList.findIndex(input => input.inputId === currentInputId);
		if (foundIndex > -1) { currentInputName = this.inputList[foundIndex].InputName; }
		this.log('Change input from %s %s to %s %s', currentInputId, currentInputName, input.inputId, input.InputName);
		//this.switchInput(input.inputId);
	}

	// set input name
	async setInputName(inputName, callback) {
		// fired by the user changing an input name in Home app accessory setup
		if (this.debugLevel > 0) {
			this.log.warn('setInputName inputName:',inputName);
		}
		callback(null);
	};

	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state, callback) {
		// fired by the View TV Settings command in the HomeKit TV accessory Settings
		if (this.debugLevel > 0) {
			this.log.warn('setPowerModeSelection state:',state);
		}
		callback(null); // for rapid response
		this.log('Menu command: View TV Settings');
		// only send the keys if the power is on
		if (this.currentPowerState == Characteristic.Active.ACTIVE) {
			this.sendKey('KEY_MENU');
		} else {
			this.log('Power is Off. View TV Settings command not sent');
		}
	}

	// get current media state
	async getCurrentMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.debugLevel > 0) {
			this.log.warn('%s: getCurrentMediaState returning %s [%s]', this.name, this.currentMediaState, mediaStateName[this.currentMediaState]);
		}
		callback(null, this.currentMediaState);
	}

	// get target media state
	async getTargetMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// must never return null, so send STOP as default value
		if (this.debugLevel > 0) {
			this.log.warn('%s: getTargetMediaState returning %s [%s]', this.name, this.targetMediaState, mediaStateName[this.targetMediaState]);
		}
		callback(null, this.currentMediaState);
	}

	// set target media state
	async setTargetMediaState(targetState, callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.debugLevel > 1) { this.log.warn('%s: setTargetMediaState this.targetMediaState:',this.name, targetState, mediaStateName[targetState]); }
		callback(null); // for rapid response
		switch (targetState) {
			case Characteristic.TargetMediaState.PLAY:
				this.log('setTargetMediaState: Set media to PLAY for', this.currentInputId);
				this.setMediaState(this.currentInputId, 1)
				break;
			case Characteristic.TargetMediaState.PAUSE:
				this.log('setTargetMediaState: Set media to PAUSE for', this.currentInputId);
				this.setMediaState(this.currentInputId, 0)
				break;
			case Characteristic.TargetMediaState.STOP:
				this.log('setTargetMediaState: Set media to STOP for', this.currentInputId);
				this.setMediaState(this.currentInputId, 0)
				break;
			}
	}

	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.debugLevel > 1) { this.log.warn('%s: setRemoteKey remoteKey:',this.name, remoteKey); }
		callback(null); // for rapid response

		let keyName;
		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 12, 13 & 14 are not defined by Apple
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				keyName = 'KEY_REWIND'; break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				keyName = 'KEY_FF'; break;
			/* // these keys are unknown for the AVR, so ignore them
			case Characteristic.RemoteKey.NEXT_TRACK: // 2
				keyName = 'DisplaySwap'; break;
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				keyName = 'DisplaySwap'; break;
				*/
			case Characteristic.RemoteKey.ARROW_UP: // 4
				keyName = 'KEY_UP'; break;
			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				keyName = 'KEY_DOWN'; break;
			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyName = 'KEY_LEFT'; break;
			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyName = 'KEY_RIGHT'; break;
			case Characteristic.RemoteKey.SELECT: // 8
				keyName = 'KEY_ENTER'; break;
			case Characteristic.RemoteKey.BACK: // 9
				keyName = 'KEY_RETURN'; break;
			case Characteristic.RemoteKey.EXIT: // 10
				keyName = 'KEY_EXIT'; break;
			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				keyName = 'KEY_PAUSE'; break; // KEY_PLAY
			case Characteristic.RemoteKey.INFORMATION: // 15
				keyName = 'KEY_MENU'; break; // KEY_INFO
			}

		if (keyName) {
			this.sendKey(keyName);
		}
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};