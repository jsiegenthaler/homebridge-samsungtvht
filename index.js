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

// to detect dev env
var PLUGIN_ENV = ''; // controls the development environment, appended to UUID to make unique device when developing



// general constants
const NO_INPUT_ID = 999; // default to input 999, no input
const NO_INPUT_NAME = 'UNKNOWN'; // an input name that does not exist
const POWER_STATE_POLLING_INTERVAL_MS = 2000; // pollling interval in millisec. Default = 2000
const mediaStateName = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerStateName = ["OFF", "ON"];
const powerStateTransition = { NOT_TRANSITIONING: 0, TRANSITIONING_ON_TO_OFF: 1, TRANSITIONING_OFF_TO_ON: 2 };
Object.freeze(mediaStateName);
Object.freeze(powerStateName);



// global variables (urgh)
let currentInputId;
//let currentPowerState;
//let currentMediaState;
//let targetMediaState;
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
		this.debugLevel = this.config.debugLevel || 0;

		this.api.on('didFinishLaunching', () => {
			if (this.debugLevel > 0) {
				this.log.warn('API event: didFinishLaunching');
			}

			this.log.warn('config',this.config);
			// detect if running on development environment
			//	customStoragePath: 'C:\\Users\\jochen\\.homebridge'
			if ( this.api.user.customStoragePath.includes( 'jochen' ) ) { PLUGIN_ENV = ' DEV' }
			if (PLUGIN_ENV) { this.log.warn('%s running in %s environment with debugLevel %s', PLUGIN_NAME, PLUGIN_ENV.trim(), this.debugLevel); }
	
			if (this.config.devices.length == 0) {
				this.log.warn('No devices found in config for %s', PLUGIN_NAME)
			} else {
				// check all devices in config
				this.log('Checking devices found in config for %s', PLUGIN_NAME)
				for (let i = 0, len = this.config.devices.length; i < len; i++) {
					//this.log("Checking device %s %s", i, this.config.devices[i]);

					this.log("Loading device %s: %s", i+1, this.config.devices[i].name, this.config.devices[i].ipAddress);
					//                                  	constructor(log, config, api, parent, device, deviceIndex) {
					//	constructor(log, config, api, platform, device, deviceIndex, pingCommand, pingResponseOn, pingResponseOff) {
					let newTvHtDevice = new samsungTvHtDevice(this.log, this.config, this.api, this, i);
					this.devices.push(newTvHtDevice);
				}
				}
				// start the regular powerStateMonitor
				this.checkPowerInterval = setInterval(this.powerStateMonitor.bind(this), POWER_STATE_POLLING_INTERVAL_MS);
		
		});
	}



	configureAccessory(platformAccessory) {
		this.log.debug('configurePlatformAccessory');
	}

	removeAccessory(platformAccessory) {
		this.log.debug('removePlatformAccessory');
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
	}

	powerStateMonitor() {
		// ping the devices regularly to check their power state
		this.log.debug("powerStateMonitor ---START-----------------------------------------")

		// need to add support for powerOnStartupTime

		// for linux: 	pingCmd = 'ping -c 1 -w 10' + ' ' + this.config.devices[0].ipAddress;
		// for win: 	pingCmd = 'ping -n 1 -w 10' + ' ' + this.config.devices[0].ipAddress;

		// ping all devices in the config
		for (let i = 0; i < this.config.devices.length; i++) {
			let device = this.devices[i];
			let secondsSinceLastPowerKeyPress = (Date.now() - device.powerLastKeyPress) / 1000;
			const powerStateMaxTransitionTimeSeconds = 30;
			//this.log("secondsSinceLastPowerKeyPress: ", secondsSinceLastPowerKeyPress)

			var pingCmd = this.config.pingCommand || 'ping -c 1 -w 10'; // default linux
			pingCmd = pingCmd.trim() + ' ' + this.config.devices[i].ipAddress;
			this.log.debug('powerStateMonitor: %s pinging device with %s', device.name, pingCmd);
	
			var self = this;
			var deviceRealPowerState;
			exec(pingCmd, function (error, stdout, stderr) {
				self.log.debug("powerStateMonitor: %s ping response: %s", device.name, stdout);
				// get the current device power state from the ping results
				// win10:	Packets: Sent = 1, Received = 0, Lost = 1 (100% loss),
				// linux: 	1 packets transmitted, 0 received, 100% packet loss, time 0ms
				if (stdout.includes(self.config.pingResponseOff || '100%')) { // 100% packet loss or 100% loss
					self.log.debug("powerStateMonitor: %s is not responding to ping, power is currently OFF", device.name);
					deviceRealPowerState = Characteristic.Active.INACTIVE;
				} else if (stdout.includes(self.config.pingResponseOn || '0%')) { // 0% packet loss or 0% loss
					self.log.debug("powerStateMonitor: %s is responding to ping, power is currently ON", device.name);
					deviceRealPowerState = Characteristic.Active.ACTIVE;
				} else {
					self.log.debug("powerStateMonitor: WARNING %s ping result cannot be parsed! stdout:", device.name, stdout);
					deviceRealPowerState = null;
				}


				// evaluate the real vs target power states
				self.log.debug("powerStateMonitor: %s evaluating power state. deviceRealPowerState %s, currentPowerState %s, targetPowerState %s", device.name, deviceRealPowerState, device.currentPowerState, device.targetPowerState);
				if (deviceRealPowerState != device.targetPowerState) {
					self.log.debug("powerStateMonitor: %s is currently transitioning from %s to %s. Transition time so far: %s seconds", device.name, deviceRealPowerState, device.targetPowerState, secondsSinceLastPowerKeyPress);
					// change in power state was requested
					if (secondsSinceLastPowerKeyPress < powerStateMaxTransitionTimeSeconds) {
						// device is currently undergoing a power state transition to the targetPowerState, set currentPowerState to targetPowerState
						self.log.debug("powerStateMonitor: %s is still within the allowed transition time of %s seconds, setting currentPowerState to targetPowerState %s", device.name, powerStateMaxTransitionTimeSeconds, device.targetPowerState);
						device.currentPowerState = device.targetPowerState;
					} else {
						// transition time has timed out, cancel the targetPowerState, reset current and target to deviceRealPowerState
						self.log.debug("powerStateMonitor: %s transition time longer than %s seconds, transition has timed out, no power state change occured, resetting currentPowerState to %s", device.name, powerStateMaxTransitionTimeSeconds, deviceRealPowerState);
						device.targetPowerState = deviceRealPowerState;
						device.currentPowerState = deviceRealPowerState;
					}

				} else {
					device.currentPowerState = deviceRealPowerState || device.currentPowerState; // handle null if a parse error occured
					self.log.debug("powerStateMonitor: %s currentPowerState stays unchanged at %s", device.name, device.currentPowerState);
				}


				// update device status
				//self.log.warn("powerStateMonitor: %s Calling device.updateDeviceState with device.currentPowerState %s", device.name, device.currentPowerState);
				if (device.currentPowerState) { device.updateDeviceState(device.currentPowerState); }
				self.log.debug("powerStateMonitor ---END-------------------------------------------")
		
			});


		}

	}
	



}



class samsungTvHtDevice {
	// build the device. Runs once on restart
	constructor(log, config, api, platform, deviceIndex) {
		this.log = log;
		this.api = api;
		this.config = config; // the entire platform config
		this.platform = platform; // the entire platform
		this.deviceIndex = deviceIndex; // the current device's index
		this.debugLevel = platform.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.deviceConfig = this.config.devices[deviceIndex]; // the config for the current device

		this.name = this.deviceConfig.name 	// device name from config
		this.ipAddress = this.deviceConfig.ipAddress // device ip address from config
		

		// setup arrays
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 96
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL
		this.lastRemoteKeyPressed = -1;	// holds the last key pressed, -1 = no key
		this.lastRemoteKeyPress0 = [];	// holds the time value of the last remote button press for key index i
		this.lastRemoteKeyPress1 = [];	// holds the time value of the last-1 remote button press for key index i
		this.lastRemoteKeyPress2 = [];	// holds the time value of the last-2 remote button press for key index i
		this.lastVolDownKeyPress = [];  // holds the time value of the last button press for the volume down button


		this.inputList = [];
		/*
			{inputId: "1", inputName: "SOURCE"},
			{inputId: "2", inputName: "SOURCE2"},
			{inputId: "2", inputName: "HDMI"},
			{inputId: "3", inputName: "HDMI2"}
		];
		*/

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
		this.manufacturer = this.config.manufacturer || "Samsung";
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
			this.log.warn('%s: prepareAccessory', this.name);
		}

		// exit immediately if already configured (runs from session watchdog)
		if (this.accessoryConfigured) { return }

		//this.log("prepareAccessory", this.name, PLUGIN_NAME);
		//this.log("prepareAccessory this.ipAddress", this.ipAddress);

		const accessoryName = this.name;
		const uuidSeed = this.ipAddress + PLUGIN_NAME + PLUGIN_ENV; // must be generated from a stable unchanging seed
		const accessoryUUID = UUID.generate(uuidSeed); 

		// default category is TV, allow also RECEIVER (avr)
		let accessoryCategory = Categories.TELEVISION;
		switch (this.deviceConfig.type) {
			case "receiver":
				accessoryCategory = Categories.AUDIO_RECEIVER;
				break;
			default:
				accessoryCategory = Categories.TELEVISION;
			}

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
			this.log.warn('%s: prepareAccessoryInformationService', this.name);
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
			this.log.warn('%s: prepareTelevisionService', this.name);
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
			.on('set', (newInputIdentifier, callback) => { this.setInput(this.inputList[newInputIdentifier], callback); });

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
			this.log.warn('%s: prepareTelevisionSpeakerService', this.name);
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
			this.log.warn('%s: prepareInputSourceServices', this.name);
		}

		// add dummy entry at index 0 for the inputList
		this.inputList.push({inputId: '0', inputName: 'Dummy'});

		// For Release 1.0, I'll only support the source by sending the SOURCE key, which just goes to next source
		// so disable HDMI 2 and Analog AUX. these need HDMI CEC support.
		// see https://developers.homebridge.io/#/service/InputSource
		// see https://developers.homebridge.io/#/characteristic/InputSourceType
		// see https://developers.homebridge.io/#/characteristic/InputDeviceType
		// HomeKit gets upset when the number of inputs changes. So configure 20 always, set conf and vis states if a deviceconfig exists
		this.log.warn('%s: prepareInputSourceServices inputs',this.name, this.deviceConfig.inputs);
		if (this.deviceConfig.inputs){
			for (let i = 0; i < 20; i++) {
				this.log.warn('%s: prepareInputSourceServices loading input %s',this.name,i+1,this.deviceConfig.inputs[i] || 'no config found');
				// show only if the deviceConfig setting exists
				var isConf = Characteristic.IsConfigured.NOT_CONFIGURED;
				var curVisState = Characteristic.CurrentVisibilityState.HIDDEN;
				var tarVisState = Characteristic.TargetVisibilityState.HIDDEN;
				if (this.deviceConfig.inputs[i]) {
					isConf = Characteristic.IsConfigured.CONFIGURED;
					curVisState = Characteristic.CurrentVisibilityState.SHOWN;
					tarVisState = Characteristic.TargetVisibilityState.HIDDEN;
				}
				let inputService = new Service.InputSource(1, "input_" + (i+1).toString() + ((this.deviceConfig.inputs[i] || {}).inputKeyCode || '') );
				inputService
					.setCharacteristic(Characteristic.Identifier, i+1)
					.setCharacteristic(Characteristic.ConfiguredName, (this.deviceConfig.inputs[i] || {}).inputName || 'input_' + (i+1).toString())
					.setCharacteristic(Characteristic.InputSourceType, (this.deviceConfig.inputs[i] || {}).inputSourceType || Characteristic.InputSourceType.HDMI)
					.setCharacteristic(Characteristic.InputDeviceType, (this.deviceConfig.inputs[i] || {}).inputDeviceType || Characteristic.InputDeviceType.TV)
					.setCharacteristic(Characteristic.IsConfigured, isConf)
					.setCharacteristic(Characteristic.CurrentVisibilityState, curVisState)
					.setCharacteristic(Characteristic.TargetVisibilityState, tarVisState);
		
				this.inputServices.push(inputService);
				this.accessory.addService(inputService);
				this.televisionService.addLinkedService(inputService);
				this.inputList.push({inputId: inputService.getCharacteristic(Characteristic.Identifier), inputName: inputService.getCharacteristic(Characteristic.ConfiguredName)});
			}
		}	

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
			ip: this.deviceConfig.ipAddress
		});
		
		// remote reports timeouts as errors
		remote.send(keyName, (err) => {
			if (err) {
				if (err == "Timeout") {
					// ignore, this is normal with SamsungRemote, some keys just do get a responce from the TV / AVR
				} else {
					this.log.warn("%s: sendKey: error %s", this.name, err);
				}
			}
		});
	}


	// get the device UI status
	// incomplete, to be completed if I can ever figure out how
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

	// update the device state (async)
	async updateDeviceState(powerState, mediaState, inputId, callback) {
		// doesn't get the data direct from the device box, but rather: gets it from the variables

		// grab the input variables
		if (powerState != null) { this.currentPowerState = powerState }
		if (mediaState != null) { this.currentMediaState = mediaState }
		if (inputId != null) 	{ this.currentInputId = inputId }

		// debugging, helps a lot to see InputName
		if (this.debugLevel > 2) {
			let currentInputName; // let is scopt to the current {} block
			let curInput = this.inputList.find(Input => Input.inputId === this.currentInputId); 
			if (curInput) { currentInputName = curInput.InputName; }
			this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentInputId %s [%s]', 
				this.name, 
				this.currentPowerState, 
				this.currentMediaState, mediaStateName[this.currentMediaState], 
				this.currentInputId, currentInputName
			);
		}



		// change only if configured, and update only if changed
		if (this.televisionService) {

			// set power state if changed
			var oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
			if ((this.currentPowerState) && (oldPowerState !== this.currentPowerState)) {
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
				/*
				// cannot show current input as it is unknown
				this.log('%s: Input changed from %s %s to %s %s', 
					this.name,
					oldActiveIdentifier + 1, oldName,
					currentActiveIdentifier + 1, newName);
				this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
				*/
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
		this.targetPowerState = targetPowerState;

		// only take action if the target state is different to the current state
		if (this.currentPowerState != this.targetPowerState) {
			// check what we want to do
			this.powerLastKeyPress = Date.now();
			this.currentPowerState = this.targetPowerState; // to ensure HomeKit gets the correct state at next poll, regardless

			if (this.targetPowerState == Characteristic.Active.INACTIVE){
				// we want to turn OFF, then we can turn it off with a sendKey
				// avr: BD_KEY_POWER, tv: KEY_POWER
				if (this.deviceConfig.powerOffButton) {this.sendKey(this.deviceConfig.powerOffButton)};
			} else {
				// we want to turn ON, can turn on only via HDMI-CEC
				this.log.warn("%s: setPower powerOnCommand %s", this.name, this.deviceConfig.powerOnCommand);
				var self = this;
				if (this.deviceConfig.powerOnCommand){
					exec(this.deviceConfig.powerOnCommand, function (error, stdout, stderr) {
						if (stderr){self.log.warn("%s: setPower powerOnCommand: %s", self.name, stderr);} // show any error if any generated
						if (stdout){self.log.debug("%s: setPower powerOnCommand: %s", self.name, stdout);} // show any stdOut in debug mode
					});
				}
			}

		} else {
			// if current is already same as target
			this.log("%s: Current power state is already %s [%s], doing nothing", this.name, this.currentPowerState, powerStateName[this.currentPowerState]);
		}
		callback(null); 
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
		// send only if a keycode exists
		const keyCode = this.deviceConfig.muteButton;
		if (keyCode.length > 0) {
			this.sendKey(keyCode);
		}
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
		this.log.debug('setVolume: Set volume: %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 10000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.lastVolDownKeyPress[2] = this.lastVolDownKeyPress[1] || 0;
			this.lastVolDownKeyPress[1] = this.lastVolDownKeyPress[0] || 0;
			this.lastVolDownKeyPress[0] = Date.now();
			tripleVolDownPress = this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('setVolume: Timediff between lastVolDownKeyPress[0] now and lastVolDownKeyPress[2]: %s ms', this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2]);
		}
			
		// check for triple press of volDown, send setmute if tripleVolDownPress less than 1000ms
		var keyCode;
		if (tripleVolDownPress < 1000) {
			this.log('Triple-press of volume down detected');
			keyCode = this.deviceConfig.voldownButtonTriplePress;
		} else if (volumeSelectorValue === Characteristic.VolumeSelector.INCREMENT) {
			keyCode = this.deviceConfig.volupButton;
		} else if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			keyCode = this.deviceConfig.voldownButton;
		}
		// send only if a keycode exists
		if ((keyCode || {}).length > 0) {
			this.sendKey(keyCode);
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
			this.log.warn('setInput input:',input.inputId.value, input.inputName.value, this.deviceConfig.inputs[input.inputId.value-1].inputKeyCode);
		}
		
		//one day I'll implement the HDMI CEC input control, then I'll need these functions:
		/*
		var currentInputName = 'UNKNOWN';
		var foundIndex = this.inputList.findIndex(input => input.inputId === currentInputId);
		if (foundIndex > -1) { currentInputName = this.inputList[foundIndex].InputName; }
		this.log('Change input from %s %s to %s %s', currentInputId, currentInputName, input.inputId, input.InputName);
		this.switchInput(input.inputId);
		*/
		
		const keyCode = this.deviceConfig.inputs[input.inputId.value-1].inputKeyCode;
		// send only if a keycode exists
		if ((keyCode || {}).length > 0) {
			this.sendKey(keyCode);
		}
		callback(null);
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
			this.sendKey(this.deviceConfig.viewTvSettingsCommand || 'KEY_MENU');
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
		if (this.config.debugLevel > 1) { this.log.warn('%s: setRemoteKey remoteKey:',this.name, remoteKey); }
		callback(null); // for rapid response

		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 0...15 exist, but keys 12, 13 & 14 are not defined by Apple


		// ------------- triple press function ---------------
		// triple key presses triggers a second layer function
		var tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed

		var lastKeyPressTime = this.lastRemoteKeyPress0[remoteKey] || 0; // find the time the current key was last pressed
		this.log("setRemoteKey remoteKey %s, lastKeyPressTime %s",remoteKey, lastKeyPressTime);

		// bump the array up one slot
		/*
		this.log("Shifting the array up one, and storing current time in index 0");
		lastkeyPress[remoteKey][2] = lastkeyPress[remoteKey][1] || 0;
		lastkeyPress[remoteKey][1] = lastkeyPress[remoteKey][0] || 0;
		lastkeyPress[remoteKey][0] = Date.now();
		*/

		// bump the array up one level and store now in lastRemoteKeyPress0
		this.log("setRemoteKey Shifting this.lastRemoteKeyPress array, and storing current time for key %s in index 0", remoteKey);
		this.lastRemoteKeyPress2[remoteKey] = this.lastRemoteKeyPress1[remoteKey];
		this.lastRemoteKeyPress1[remoteKey] = this.lastRemoteKeyPress0[remoteKey];
		this.lastRemoteKeyPress0[remoteKey] = Date.now();
		this.log("setRemoteKey Contents of lastRemoteKeyPress0 array:", this.lastRemoteKeyPress0);
		this.log("setRemoteKey Contents of lastRemoteKeyPress1 array:", this.lastRemoteKeyPress1);
		this.log("setRemoteKey Contents of lastRemoteKeyPress2 array:", this.lastRemoteKeyPress2);

		var lastPressTime2 = (this.lastRemoteKeyPress2[remoteKey] || (Date.now() - 86400)); // default to same time yesterday if empty
		var lastPressTime1 = this.lastRemoteKeyPress1[remoteKey] || Date.now() - 86400; // default to same time yesterday if empty
		var lastPressTime0 = this.lastRemoteKeyPress0[remoteKey];

		// write lastkeyPress to the array
		//this.lastRemoteKeyPress0[remoteKey] = lastkeyPress;
		//this.log("remoteKey %s, lastRemoteKeyPress has been updated, now:", remoteKey, this.lastRemoteKeyPress);


		// check if same as previous key pressed, within the limits of the  triple press time
		var buttonLayer=0; // default layer 0
		var doublePressTime = this.config.doublePressTime || 250;
		var triplePressTime = this.config.triplePressTime || 450;
		if (this.lastRemoteKeyPressed == remoteKey) {
			this.log("setRemoteKey current key %s same as last key %s",remoteKey, this.lastRemoteKeyPressed);

			// if same key, check for double or triple press
			// check timing, activating triple-press then double-press button layers
			// if historical key presses exist in buffer
			/*
			// disabled triplePress until I get doublePress working
			if (lastPressTime0 - lastPressTime2 < triplePressTime) {
				this.log('setRemoteKey remoteKey %s, triple press detected', remoteKey);
				buttonLayer=2;
				this.pendingKeyPress = -1; // clear any pending key press
				this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
				this.readyToSendRemoteKeyPress = true; // enable immediate send
			*/
			if (lastPressTime0 - lastPressTime1 < doublePressTime) {
				this.log('setRemoteKey remoteKey %s, double press detected', remoteKey);
				buttonLayer=1;
				this.pendingKeyPress = -1; // clear any pending key press
				this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
				this.readyToSendRemoteKeyPress = true; // enable immediate send
			} else {
				// no historical key presses exist, queue as a pending press
				this.log('setRemoteKey remoteKey %s, no historical key press detected', remoteKey);
				this.pendingKeyPress = remoteKey;
				this.sendRemoteKeyPressAfterDelay = true;	// enable send after delay
				this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
			}
		} else {
			this.log("setRemoteKey current key %s different to last key %s",remoteKey, this.lastRemoteKeyPressed);
			// this key is different to last key, send after delay (may be start of another double or triple key press)
			this.pendingKeyPress = remoteKey;
			this.sendRemoteKeyPressAfterDelay = true;	// enable send after delay
			this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
		}; 

		// check time difference between current keyPress and 2 keyPresses ago
		this.log('setRemoteKey remoteKey %s, Timediff between lastRemoteKeyPress0 now and lastRemoteKeyPress1: %s ms', remoteKey, lastPressTime0 - lastPressTime1);
		//this.log('setRemoteKey remoteKey %s, Timediff between lastRemoteKeyPress0 now and lastRemoteKeyPress2: %s ms', remoteKey, lastPressTime0 - lastPressTime2);


		this.log('setRemoteKey remoteKey %s, buttonLayer %s, pendingKeyPress %s, sendRemoteKeyPressAfterDelay %s, readyToSendRemoteKeyPress %s', remoteKey, buttonLayer, this.pendingKeyPress, this.sendRemoteKeyPressAfterDelay, this.readyToSendRemoteKeyPress);
		this.log('setRemoteKey --------------------');



		// do the button layer mapping
		var keyNameDefault;
		var keyName;
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				keyName = 'KEY_REWIND'; break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				keyName = 'KEY_FF'; break;
			/*
			case Characteristic.RemoteKey.NEXT_TRACK: // 2
				keyName = ''; break;
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				keyName = ''; break;
			*/

			case Characteristic.RemoteKey.ARROW_UP: // 4
				keyNameDefault = "KEY_UP";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowUpButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowUpButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowUpButton || keyNameDefault; 			break;
				}
				break;

			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				keyNameDefault = "KEY_DOWN";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowDownButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowDownButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowDownButton || keyNameDefault; 			break;
				}
				break;

			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyNameDefault = "KEY_LEFT";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowLeftButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowLeftButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowLeftButton || keyNameDefault; 			break;
				}
				break;

			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyNameDefault = "KEY_RIGHT";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowRightButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowRightButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowRightButton || keyNameDefault; 				break;
				}
				break;

			case Characteristic.RemoteKey.SELECT: // 8
				keyNameDefault = "KEY_ENTER";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.selectButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.selectButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.selectButton || keyNameDefault;	 			break;
				}
				break;

			case Characteristic.RemoteKey.BACK: // 9
				keyNameDefault = "KEY_RETURN";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.backButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.backButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.backButton || keyNameDefault; 			break;
				}
				break;

			case Characteristic.RemoteKey.EXIT: // 10
				keyName = this.deviceConfig.backButton || "KEY_EXIT"; 
				break;

			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				keyNameDefault = "KEY_PLAY";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.playPauseButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.playPauseButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.playPauseButton || keyNameDefault; 			break;
				}
				break; 

			case Characteristic.RemoteKey.INFORMATION: // 15
				keyNameDefault = "KEY_MENU";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.infoButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.infoButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.infoButton || keyNameDefault; 			break;
				}
				break;


			}


			// handle the macros or single key events
			if (keyName.startsWith("KeyMacro")) {
				var keyMacro;
				switch (keyName) {
					case 'KeyMacro1': keyMacro = this.deviceConfig.keyMacro1; break;
					case 'KeyMacro2': keyMacro = this.deviceConfig.keyMacro2; break;
					case 'KeyMacro3': keyMacro = this.deviceConfig.keyMacro3; break;
					case 'KeyMacro4': keyMacro = this.deviceConfig.keyMacro4; break;
					case 'KeyMacro5': keyMacro = this.deviceConfig.keyMacro5; break;
				}

				//var keyMacro = 'Back wait(500) Back wait(500) Back wait(500) MediaTopMenu wait(1000) ArrowDown wait(500) ArrowLeft wait(500) Enter wait(500) Enter'
				this.log('processing macro ', keyMacro);
				let keyArray = keyMacro.trim().split(' ');
				for (let i = 0; i < keyArray.length; i++) {
					this.log('remoteKey %s, sending key ', keyArray[i]);
					if ( keyArray[i].startsWith('wait(')) {
						// do a wait
							let delay = keyArray[i].replace('wait(', '').replace(')','');
							this.log('processing wait of %s ms', delay);
							await waitprom(delay);
							this.log('wait done');
						} else {
							// send the key
							this.log('sending key %s', keyArray[i].trim());
							this.sendKey(keyArray[i].trim() );
						}
					}
			} else {
				// single key event
				// send if not pending
				if (keyName)
					if (this.readyToSendRemoteKeyPress){ 
						// send immediately
						this.log('setRemoteKey sending key %s immediately',keyName);
						this.sendKey(keyName); 
					} else {
						// immediate send is not enabled. 
						// start a delay equal to doublePressTime, then send only if the readyToSendRemoteKeyPress is true
						var delayTime = this.config.doublePressDelayTime || 300;
						this.log('setRemoteKey sending key %s after delay of %s milliseconds',keyName, delayTime);
						setTimeout(() => { 
							// check if can be sent. Only send if sendRemoteKeyPressAfterDelay is still set. It may have been reset by another key press
							this.log('setRemoteKey setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s',keyName);
							if (this.sendRemoteKeyPressAfterDelay){ 
								this.log('setRemoteKey setTimeout delay completed, sending %s',keyName);
								this.sendKey(keyName); 
								this.log('setRemoteKey setTimeout delay completed, key %s sent, resetting readyToSendRemoteKeyPress',keyName);
								this.readyToSendRemoteKeyPress = true; // reset the enable flag
							} else {
								this.log('setRemoteKey setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s: sendRemoteKeyPressAfterDelay is false, doing nothing',keyName);
							}
						},
						delayTime); // send after delayTime
					}
			}
			this.lastRemoteKeyPressed = remoteKey; // store the current key as last key pressed
		}	

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};