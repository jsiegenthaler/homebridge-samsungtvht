//'use strict';

// ****************** start of settings


// name and version
const packagejson = require('./package.json');
const PLUGIN_NAME = packagejson.name;
const PLATFORM_NAME = packagejson.platformname;
const PLUGIN_VERSION = packagejson.version;


// required node modules
//const fs = require('fs'); -- removed in 1.0.4, not needed
//const fsPromises = require('fs').promises; -- removed in 1.0.4, not needed
//const path = require('path'); -- removed in 1.0.4, not needed
//import SamsungRemote from 'samsung-remote'; // https://github.com/natalan/samsung-remote
const SamsungRemote = require('samsung-remote'); // https://github.com/natalan/samsung-remote



// https://github.com/Samfox2/homebridge-cec-tv-platform/blob/main/index.js
//const  CecController = require('cec-controller');

// exec spawns child process to run a bash script
const exec = require("child_process").exec;

// to detect dev env
var PLUGIN_ENV = ''; // controls the development environment, appended to UUID to make unique device when developing



// general constants
const NO_INPUT_ID = 999 // default to input 999, no input
const NO_INPUT_NAME = 'UNKNOWN'; // an input name that does not exist
const POWER_STATE_DEFAULT_POLLING_INTERVAL_MS = 3000; // default polling interval in millisec
const POWER_STATE_MAX_TRANSITION_TIME_S = 30; // the maximum transition time we allow for a device to come online after a power ON command, default 30 s
const mediaStateName = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerStateName = ["OFF", "ON"];
//const powerStateTransition = { NOT_TRANSITIONING: 0, TRANSITIONING_ON_TO_OFF: 1, TRANSITIONING_OFF_TO_ON: 2 }; // used by HDMI-CEC
Object.freeze(mediaStateName);
Object.freeze(powerStateName);



// global variables (urgh)
// let currentInputId;
//let currentPowerState;
//let currentMediaState;
//let targetMediaState;
let Accessory, Characteristic, Service, Categories, UUID;




// wait function
const wait=ms=>new Promise(resolve => setTimeout(resolve, ms)); 

// wait function with promise
function waitprom(ms) {
	return new Promise((resolve, reject) => {
	  setTimeout(() => {
		resolve(ms)
	  }, ms )
	})
  }  


// funtion to return a unique set of keys from an array
function uniqBy(arr, key) {
	return Object.values([...arr].reverse().reduce((m, i) => {m[key.split('.').reduce((a, p) => a?.[p], i)] = i; return m;}, {}))
  }

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
		if (!config) {
			log.warn('WARNING: No configuration found for %s', PLUGIN_NAME);
			return;
		}
		if (!Array.isArray(config.devices)) {
			log.warn('WARNING: No devices configured for %s, please add at least one device', PLUGIN_NAME);
			return;
		}

		// abort load if device IP address are not unique
		if (uniqBy(config.devices, 'ipAddress').length != config.devices.length) {
			log.warn('WARNING: IP addresses not unique for %s. Please ensure you use a unique IP address per device', PLUGIN_NAME);
			return;
		}

		this.log = log;
		this.config = config;
		this.api = api;
		this.devices = [];
		this.debugLevel = this.config.debugLevel || 0;

		// show some useful version info
		this.log.info('%s v%s, node %s, homebridge v%s', packagejson.name, packagejson.version, process.version, this.api.serverVersion)


		this.api.on('didFinishLaunching', () => {
			if (this.debugLevel > 0) {
				this.log.warn('API event: didFinishLaunching');
			}

			// detect if running on development environment
			//	customStoragePath: 'C:\\Users\\jochen\\.homebridge'
			if ( this.api.user.customStoragePath.includes( 'jochen' ) ) { PLUGIN_ENV = ' DEV' }
			if (PLUGIN_ENV) { this.log.warn('%s running in %s environment with debugLevel %s', PLUGIN_NAME, PLUGIN_ENV.trim(), this.debugLevel); }
	
			if (this.config.devices.length == 0) {
				this.log.warn('No devices found in config for %s', PLUGIN_NAME)
			} else {
				// check all devices in config
				this.log.debug('Checking devices found in config for %s', PLUGIN_NAME)
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
				// DISABLE FOR DEBUGGING THE CHANNEL NAME ISSUE
				this.checkPowerInterval = setInterval(this.powerStateMonitor.bind(this), this.config.pingInterval * 1000 || POWER_STATE_DEFAULT_POLLING_INTERVAL_MS);
		
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

		// need to add support for powerOnStartupTime
		//this.suppressPowerStateMonitoringUntil // datetime

		// for linux: 	pingCmd = 'ping -c 1 -w 10' + ' ' + this.config.devices[0].ipAddress;
		// for win: 	pingCmd = 'ping -n 1 -w 10' + ' ' + this.config.devices[0].ipAddress;

		// ping all devices in the config
		for (let i = 0; i < this.config.devices.length; i++) {
			this.devices[i].powerStateMonitorCounter++; // increment global counter by 1
			let device = this.devices[i];
			let logPrefix = 'powerStateMonitor(' + device.powerStateMonitorCounter + '): '; // set a log prefix for this instance of the powerStateMonitor to allow differentiation in the logs

			// set a ping command
			var pingCmd = this.config.pingCommand || 'ping -c 1 -w 20'; // default linux, 1 ping, 20ms wait
			pingCmd = pingCmd.trim() + ' ' + this.config.devices[i].ipAddress;
			this.log.debug(logPrefix + '%s pinging device with %s', device.name, pingCmd);
	
			var self = this;
			var deviceRealPowerState;
			exec(pingCmd, function (error, stdout, stderr) {
				self.log.debug(logPrefix + "%s ping response: %s", device.name, stdout);

				self.log.debug(logPrefix + '%s powerLastKeyPress %s', device.name, device.powerLastKeyPress.toLocaleString());
				var dateNow = new Date;
				const secondsSinceLastPowerKeyPress = (dateNow - device.powerLastKeyPress) / 1000;
				const yearsSinceLastPowerKeyPress = (dateNow.getFullYear() - device.powerLastKeyPress.getFullYear());
				
				self.log.debug(logPrefix + '%s secondsSinceLastPowerKeyPress %s', device.name, secondsSinceLastPowerKeyPress);
				self.log.debug(logPrefix + '%s yearsSinceLastPowerKeyPress %s', device.name, yearsSinceLastPowerKeyPress);

				// get the current device power state from the ping results
				// win10:	Packets: Sent = 1, Received = 0, Lost = 1 (100% loss),
				// linux: 	1 packets transmitted, 0 received, 100% packet loss, time 0ms
				// reworked to show 100% loss is OFF, anything else is ON
				if (stdout.includes(self.config.pingResponseOff) && ((self.config.pingResponseOff  || '') !=  '')) { // user-configred OFF response found which is not empty
					self.log.debug(logPrefix + "%s is not responding to ping, power is currently OFF (using config detection)", device.name);
					deviceRealPowerState = Characteristic.Active.INACTIVE;
				} else if (stdout.includes('100% packet loss')) { // Linux: "1 packets transmitted, 0 received, 100% packet loss, time 0ms" detect "100% packet loss"
					self.log.debug(logPrefix + "%s is not responding to ping, power is currently OFF (using Linux detection)", device.name);
					deviceRealPowerState = Characteristic.Active.INACTIVE;
				} else if (stdout.includes('(100% loss)')) { // Windows: "Packets: Sent = 1, Received = 0, Lost = 1 (100% loss)", detect "(100% loss)"
					self.log.debug(logPrefix + "%s is not responding to ping, power is currently OFF (using Windows detection)", device.name);
					deviceRealPowerState = Characteristic.Active.INACTIVE;
				} else {
					// any ping where we did not have 100% loss, is considered being ON, as some packets were returned
					self.log.debug(logPrefix + "%s is responding to ping, power is currently ON", device.name);
					deviceRealPowerState = Characteristic.Active.ACTIVE;
					//self.log.debug("powerStateMonitor: WARNING %s cannot determine power state from ping result! stdout:", device.name, stdout);
					//deviceRealPowerState = device.currentPowerState; // maintain current state
				}


				// evaluate the real vs target power states
				self.log.debug(logPrefix + "%s evaluating power state. deviceRealPowerState %s, currentPowerState %s, targetPowerState %s", device.name, deviceRealPowerState, device.currentPowerState, device.targetPowerState);
				if (!(deviceRealPowerState === device.currentPowerState) && (yearsSinceLastPowerKeyPress > 100)) {
					// (yearsSinceLastPowerKeyPress > 100) means no HomeKit key presses were made, but a deviceRealPowerState has detected which is differen to the currentPowerState. Probably changed through a non-HomeKit method, eg physical remote control
					self.log.debug(logPrefix + "%s power state change detected from device, setting currentPowerState to deviceRealPowerState %s", device.name, deviceRealPowerState);
					device.targetPowerState = deviceRealPowerState;
					device.currentPowerState = deviceRealPowerState;

				} else if ((deviceRealPowerState != device.targetPowerState) && (yearsSinceLastPowerKeyPress < 100)) {
					self.log.debug(logPrefix + "%s is currently transitioning from %s to %s. Transition time so far: %s seconds", device.name, deviceRealPowerState, device.targetPowerState, secondsSinceLastPowerKeyPress);
					// change in power state was requested. yearsSinceLastPowerKeyPress helps us detect a Homebridge reboot 
					if ((secondsSinceLastPowerKeyPress < POWER_STATE_MAX_TRANSITION_TIME_S) && (yearsSinceLastPowerKeyPress < 100)) {
						// device is currently undergoing a power state transition to the targetPowerState, set currentPowerState to targetPowerState
						self.log.debug(logPrefix + "%s is still within the allowed transition time of %s seconds, setting currentPowerState to targetPowerState %s", device.name, POWER_STATE_MAX_TRANSITION_TIME_S, device.targetPowerState);
						device.currentPowerState = device.targetPowerState;
					} else {
						// transition time has timed out, cancel the targetPowerState, reset current and target to deviceRealPowerState
						self.log.debug(logPrefix + "%s transition time longer than %s seconds, transition has timed out, no power state change occured, resetting currentPowerState to %s", device.name, POWER_STATE_MAX_TRANSITION_TIME_S, deviceRealPowerState);
						device.targetPowerState = deviceRealPowerState;
						device.currentPowerState = deviceRealPowerState;
					}

				} else {
					device.currentPowerState = deviceRealPowerState || device.currentPowerState; // handle null if a parse error occured
					self.log.debug(logPrefix + "%s currentPowerState stays unchanged at %s", device.name, device.currentPowerState);
				}


				// update device status
				self.log.debug(logPrefix + "%s calling device.updateDeviceState with device.currentPowerState %s", device.name, device.currentPowerState);
				device.updateDeviceState(device.currentPowerState); 

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
		this.powerStateMonitorCounter=0; // the power state monitor counter for this device

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
		this.inputList = [];			// holds the input list, do we really need it?

		//setup variables
		this.accessoryConfigured = false;	// true when the accessory is configured

		// initial states. Will be updated by code
		this.currentPowerState; // deliberately leave at undefined to detect a reboot and inital start = Characteristic.Active.INACTIVE;
		this.targetPowerState = this.currentPowerState;
		this.currentInputId = 1; // default startup at input 1 (first in list) NO_INPUT_ID;
		this.currentMediaState = Characteristic.CurrentMediaState.STOP; // default stop
		this.targetMediaState = this.currentMediaState;
		this.powerLastKeyPress = new Date("1900-01-01T00:00:00Z"); // set a valid date but many years in the past

		// prepare the accessory
		this.prepareAccessory();
		
	}



  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	//Prepare accessory (runs from samsungTvHtDevice)
	prepareAccessory() {
		if (this.debugLevel > 0) {
			this.log.warn('%s: prepareAccessory', this.name);
		}

		// exit immediately if already configured (runs from session watchdog)
		if (this.accessoryConfigured) { return }

		//this.log("prepareAccessory", this.name, PLUGIN_NAME);
		//this.log("prepareAccessory this.ipAddress", this.ipAddress);

		const accessoryName = this.name;

		// generate a constant uuid that will never change over the life of the accessory
		const uuid = UUID.generate(this.ipAddress + PLUGIN_ENV); 
		if (this.debugLevel > 1) {
			this.log.warn('%s: prepareAccessory: UUID %s', this.name, uuid);
		}

		// default category is TV, allow also RECEIVER (avr)
		let accessoryCategory = Categories.TELEVISION;
		switch (this.deviceConfig.type) {
			case "receiver":
				accessoryCategory = Categories.AUDIO_RECEIVER;
				break;
			default:
				accessoryCategory = Categories.TELEVISION;
			}

		this.accessory = new Accessory(accessoryName, uuid, accessoryCategory);

		this.prepareAccessoryInformationService();	// service 1 of 100
		this.prepareTelevisionService();			// service 2 of 100
		this.prepareTelevisionSpeakerService();		// service 3 of 100
		this.prepareInputSourceServices();			// service 4....100

		// set displayOrder
		this.televisionService.getCharacteristic(Characteristic.DisplayOrder)
			.value = Buffer.from(this.displayOrder).toString('base64');

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
			.setCharacteristic(Characteristic.Manufacturer, this.deviceConfig.manufacturer || 'Samsung')
			.setCharacteristic(Characteristic.Model, this.deviceConfig.modelName || PLATFORM_NAME)
			.setCharacteristic(Characteristic.SerialNumber, this.deviceConfig.serialNumber || 'unknown')
			.setCharacteristic(Characteristic.FirmwareRevision, this.deviceConfig.firmwareRevision || PLUGIN_VERSION) // must be numeric. Non-numeric values are not displayed
			// optional characteristics
			// if ConfiguredName is not supplied, the accessory name and input source names may appear as default names (Input Source, Input Source 2, Input Source 3, etc)
			.setCharacteristic(Characteristic.ConfiguredName, this.name) // required for iOS18

		this.log.warn('%s: prepareAccessoryInformationService: informationService:', this.name, informationService);
		this.accessory.addService(informationService);
	}



	//Prepare Television service
	prepareTelevisionService() {
		if (this.debugLevel > 0) {
			this.log.warn('%s: prepareTelevisionService', this.name);
		}
		//this.televisionService = new Service.Television(null, 'televisionService');
		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService
			.setCharacteristic(Characteristic.ConfiguredName, this.name)
			.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
			// extra characteristics added here are accessible in Shortcuts and Automations (both personal and home)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT) // NO_FAULT or GENERAL_FAULT
		
		// power
		this.televisionService.getCharacteristic(Characteristic.Active)
			.onGet(this.getPower.bind(this))
			.onSet(this.setPower.bind(this));

		// active input
		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.onGet(this.getActiveIdentifier.bind(this))
			.onSet(this.setActiveIdentifier.bind(this));

		// configured name - added to log the calls to get configured name
		this.televisionService.getCharacteristic(Characteristic.ConfiguredName)
			.onGet(this.getConfiguredName.bind(this))
			.onSet(this.setConfiguredName.bind(this));

		// remote control keys in the Apple TV Remote app
		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.onSet(this.setRemoteKey.bind(this));

		// the View TV Settings menu item
		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.onSet(this.setPowerModeSelection.bind(this));

		// display order of the channels
		this.televisionService.getCharacteristic(Characteristic.DisplayOrder)
			.onGet(this.getDisplayOrder.bind(this))
			.onSet(this.setDisplayOrder.bind(this));



		// Experimenting with removing some unwanted optional characteristics
		// removeCharacteristic(accessory.service.getCharacteristic(Characteristic.ABC))
		//		this.televisionService
		//			.removeCharacteristic(this.televisionService.getCharacteristic(Characteristic.CurrentMediaState))
		//			.removeCharacteristic(this.televisionService.getCharacteristic(Characteristic.TargetMediaState))
		//;
		//this.televisionService.setCharacteristic(Characteristic.IsConfigured, configState)

		/*
		this.log('this.televisionService')
		this.log(this.televisionService)
		
		this.log('this.televisionService.Brightness.Props')
		//this.log(this.televisionService.Brightness.Props)

		this.log('this.televisionService Brightness')
		this.log(this.televisionService.getCharacteristic(Characteristic.Brightness))
		
		// Hidden ”hd” This characteristic is hidden from the user
		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.setProps({ 
				perms: [Characteristic.Perms.HIDDEN]
			});

		this.log('this.televisionService CurrentMediaState')
		this.log(this.televisionService.getCharacteristic(Characteristic.CurrentMediaState))
		*/

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
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE); // only relative is supported for the Apple Remote with Up/Down buttons
		this.speakerService.getCharacteristic(Characteristic.VolumeSelector)  // the volume selector, increment or decrement, allows the iOS device keys to be used to change volume
			.onSet(this.setVolume.bind(this));
		//this.speakerService.getCharacteristic(Characteristic.Volume) // percentage, 0-100
		//	.onSet(this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
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
			this.log.warn('%s: prepareInputSourceServices', this.name);
		}

		//this.inputList.push({inputId: '0', inputName: 'Dummy'});
		// add dummy entry at index 999 for the inputList
		/*
		var defaultEntry = {
			inputId: NO_INPUT_ID,
			inputName: NO_INPUT_NAME 
		}
		this.inputList.push(defaultEntry);
		*/
		this.inputList = [];
		//this.log(defaultEntry);
		this.displayOrder = [];

		// For Release 1.0, I'll only support the source by sending the SOURCE key, which just goes to next source
		// so disable HDMI 2 and Analog AUX. these need HDMI CEC support.
		// see https://developers.homebridge.io/#/service/InputSource
		// see https://developers.homebridge.io/#/characteristic/InputSourceType
		// see https://developers.homebridge.io/#/characteristic/InputDeviceType
		// HomeKit gets upset when the number of inputs changes. So configure 20 always, set conf and vis states if a deviceconfig exists
		//this.log.warn('%s: prepareInputSourceServices inputs',this.name, this.deviceConfig.inputs);
		if (this.deviceConfig.inputs){
			// i = identifier number starting at 1, so start loop at 1
			// deviceconfig is zero-based, starting at 0
			for (let i = 0; i < 4; i++) { // was 20

				this.log.debug('%s: prepareInputSourceServices loading config index %s input %s',this.name,i,i+1,this.deviceConfig.inputs[i] || 'no config found');
				// show only if the deviceConfig setting exists
				var configState = Characteristic.IsConfigured.NOT_CONFIGURED;
				var visState = Characteristic.CurrentVisibilityState.HIDDEN;
				if (this.deviceConfig.inputs[i]) {
					configState = Characteristic.IsConfigured.CONFIGURED;
					visState = Characteristic.CurrentVisibilityState.SHOWN;
				}
				let inputService = new Service.InputSource('input' + (i+1).toString(), 'input' + (i+1).toString()); // displayName, subtype
				inputService
					.setCharacteristic(Characteristic.Identifier, i+1) // must be 1-based, so that input1 is also Identifier1, and so that CurrentActivIdentifier = same as Input number
					.setCharacteristic(Characteristic.ConfiguredName, (this.deviceConfig.inputs[i] || {}).inputName || 'input' + (i+1).toString()) // Initial configured name is "inputN", Input text is 1-based
					.setCharacteristic(Characteristic.InputSourceType, (this.deviceConfig.inputs[i] || {}).inputSourceType || Characteristic.InputSourceType.HDMI)
					.setCharacteristic(Characteristic.InputDeviceType, (this.deviceConfig.inputs[i] || {}).inputDeviceType || Characteristic.InputDeviceType.TV)
					.setCharacteristic(Characteristic.IsConfigured, configState)
					.setCharacteristic(Characteristic.CurrentVisibilityState, visState)
					.setCharacteristic(Characteristic.TargetVisibilityState, visState);

				this.inputServices.push(inputService);
				this.accessory.addService(inputService);
				this.televisionService.addLinkedService(inputService);
				// pushing into the array always creates a zero-based array, each push fills the next index
				this.inputList.push({inputId: inputService.getCharacteristic(Characteristic.Identifier), inputName: inputService.getCharacteristic(Characteristic.ConfiguredName)});

				// add DisplayOrder, see :
				// https://github.com/homebridge/HAP-NodeJS/issues/644
				// https://github.com/ebaauw/homebridge-zp/blob/master/lib/ZpService.js  line 916: this.displayOrder.push(0x01, 0x04, identifier & 0xff, 0x00, 0x00, 0x00)

				// store in a displayOrder[] array with same index number
				// this.displayOrder.push(0x01, 0x04, i & 0xff, 0x00, 0x00, 0x00);
				//                        type  len   inputId  empty empty empty
				//this.displayOrder.push(0x01, 0x04,       i, 0x00, 0x00, 0x00);
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
				this.displayOrder.push(0x01, 0x01, (i+1) & 0xff)

			}
			// close off the TLV8 by sending 0x00 0x00
			this.displayOrder.push(0x00, 0x00); // close off the displayorder array with 0x00 0x00

		}	
		this.log.debug('%s: prepareInputSourceServices loading complete, this.inputServices',this.name,this.inputServices);

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
			this.log.warn('%s: sendKey: keySequence %s', this.name, keySequence);
		}

		// make a new remote
		const remote = new SamsungRemote({
			ip: this.deviceConfig.ipAddress
		});

		let keyArray = keySequence.trim().split(' ');
		if (keyArray.length > 1) { this.log('%s: sendKey: processing keySequence', this.name, keySequence); }
		// supported key1 key2 key3 wait() wait(100)
		for (let i = 0; i < keyArray.length; i++) {
			const keyName = keyArray[i].trim();
			this.log.debug('%s: sendKey: processing key %s of %s: %s', this.name, i+1, keyArray.length, keyName);
			
			// if a wait appears, use it
			let waitDelay; // default
			if (keyName.toLowerCase().startsWith('wait(')) {
				this.log.debug('%s: sendKey: reading delay from %s', this.name, keyName);
				waitDelay = keyName.toLowerCase().replace('wait(', '').replace(')','');
				if (waitDelay == ''){ waitDelay = 100; } // default 100ms
				this.log.debug('%s: sendKey: delay read as %s', this.name, waitDelay);
			}
			// else if not first key and last key was not wait, and next key is not wait, then set a default delay of 100 ms
			 else if (i>0 && i<keyArray.length-1 && !(keyArray[i-1] || '').toLowerCase().startsWith('wait(') && !(keyArray[i+1] || '').toLowerCase().startsWith('wait(')) {
				this.log.debug('%s: sendKey: not first key and neiher previous key %s nor next key %s is wait(). Setting default wait of 100 ms', this.name, keyArray[i-1], keyArray[i+1]);
				waitDelay = 100;
			} 

			// add a wait if waitDelay is defined
			if (waitDelay) {
				if (this.debugLevel > 0) {this.log('%s: sendKey: wait %s ms', this.name, waitDelay)};
				await waitprom(waitDelay);
				this.log.debug('%s: sendKey: wait %s done', this.name, waitDelay);
			}

			// send the key if not a wait()
			if (!keyName.toLowerCase().startsWith('wait(')) {
				if (this.debugLevel > 0) {this.log('%s: sendKey: send %s', this.name, keyName)};
				remote.send(keyName, (err) => {
					if (err && (err || '' != "Timeout")) {
						//  Timeout ignore, this is normal with SamsungRemote, some keys just do get a response from the TV / AVR
						this.log.warn("%s: sendKey: %s error %s", this.name, keyName, err);
					} else {
						this.log.debug('%s: sendKey: send %s done', this.name, keyName);
					}
				});
			}

		} // end for loop

	}


	// get the device UI status
	// incomplete, to be completed if I can ever figure out how
	getUiStatus() {
		if (this.debugLevel > 1) {
			this.log.warn('getUiStatus');
		}
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END state handler
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++





	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state (async)
	async updateDeviceState(powerState, mediaState, inputId, callback) {
		// doesn't get the data direct from the device, but rather: gets it from the variables
		if (this.debugLevel > 2) { 
			this.log.warn('%s: updateDeviceState: powerState %s, mediaState %s, inputId %s', this.name, powerState, mediaState, inputId); 
		}

		// grab the input variables
		if (powerState != null) { this.currentPowerState = powerState }
		if (mediaState != null) { this.currentMediaState = mediaState }
		if (inputId != null) 	{ this.currentInputId = inputId }

		// debugging, helps a lot to see InputName
		if (this.debugLevel > 2) {
			//let currentInputName; // let is scoped to the current {} block
			//this.log.warn('%s: updateDeviceState: this.inputList', this.name, this.inputList);
	
			// get current input, ensure we always have a json value
			let curInput = (this.inputList.find(Input => Input.inputId.value === this.currentInputId) || {});

			// ensure we have a name value even for input 999
			let curName = ((curInput.inputName || {}).value || NO_INPUT_NAME);

			this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentInputId %s [%s]', 
				this.name, 
				this.currentPowerState, 
				this.currentMediaState, mediaStateName[this.currentMediaState], 
				this.currentInputId, curName
			);
		}



		// change only if configured, and update only if changed
		if (this.televisionService) {

			// set power state if changed
			const previousPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
			const currentPowerState = this.currentPowerState || Characteristic.Active.INACTIVE; // ensure never null
			this.log.debug('%s: updateDeviceState: previousPowerState %s, currentPowerState %s',this.name, previousPowerState, currentPowerState);
			if (previousPowerState !== currentPowerState) {
				this.log('%s: Power changed from %s %s to %s %s', 
					this.name,
					previousPowerState, powerStateName[previousPowerState],
					currentPowerState, powerStateName[currentPowerState]);
				this.televisionService.getCharacteristic(Characteristic.Active).updateValue(currentPowerState);
			} else {
				this.log.debug('%s: updateDeviceState: no change to current power, Characteristic.Active not updated',this.name);
			}
			
			// set active input if changed
			var oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
			//var currentActiveIdentifier = this.inputList.findIndex(input => input.inputId === currentInputId);
			var currentActiveIdentifier = NO_INPUT_ID; // fixed at NO_INPUT_ID to clear the Tile
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
				// cannot show current input as it is unknown, so log at debug level only, as inputs often hold remote keys
				this.log.debug('%s: Input changed from %s %s to %s %s', 
					this.name,
					oldActiveIdentifier + 1, oldName,
					currentActiveIdentifier + 1, newName);
				this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
			} else {
				this.log.debug('%s: updateDeviceState: no change to current input, Characteristic.ActiveIdentifier not updated',this.name);
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
	async getPower() {
			// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		if (this.debugLevel > 1) { 
			this.log.warn('%s: getPower returning %s [%s]', this.name, this.currentPowerState || Characteristic.Active.INACTIVE, powerStateName[this.currentPowerState || Characteristic.Active.INACTIVE]); 
		}
		return this.currentPowerState || Characteristic.Active.INACTIVE; // return current state: 0=off, 1=on. Default to OFF if null.
	}

	// set power state
	async setPower(targetPowerState) {
		// fired when the user clicks the power button in the TV accessory in HomeKit
		// fired when the user clicks the TV tile in HomeKit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.debugLevel > 1) { this.log.warn('%s: setPower: targetPowerState:', this.name, targetPowerState, powerStateName[targetPowerState]); }
		this.targetPowerState = targetPowerState;

		// only take action if the target state is different to the current state
		if (this.currentPowerState != this.targetPowerState) {
			// check what we want to do
			this.powerLastKeyPress = new Date();
			this.log.debug("%s: setPower: reset powerLastKeyPress to %s", this.name, this.powerLastKeyPress.toLocaleString());
			this.currentPowerState = this.targetPowerState; // to ensure HomeKit gets the correct state at next poll, regardless

			if (this.targetPowerState == Characteristic.Active.INACTIVE){
				// we want to turn OFF, then we can turn it off with a sendKey
				// avr: BD_KEY_POWER, tv: KEY_POWER
				if (this.deviceConfig.powerOffButton) {this.sendKey(this.deviceConfig.powerOffButton)};
			} else {
				// we want to turn ON, can turn on only via HDMI-CEC
				this.log("%s: setPower: powerOnCommand: %s", this.name, this.deviceConfig.powerOnCommand);
				var self = this;
				if (this.deviceConfig.powerOnCommand){
					exec(this.deviceConfig.powerOnCommand, function (error, stdout, stderr) {
						if (stderr){self.log.warn("%s: setPower: powerOnCommand: %s", self.name, stderr);} // show any error if any generated
						if (stdout){self.log.debug("%s: setPower: powerOnCommand: %s", self.name, stdout);} // show any stdOut in debug mode
					});
				}
			}

		} else {
			// if current is already same as target
			this.log.debug("%s: Current power state is already %s [%s], doing nothing", this.name, this.currentPowerState, powerStateName[this.currentPowerState]);
		}
		return
	}

	// get configured name
	async getConfiguredName() {
		// trial to see if this is called during bootup
		if (this.debugLevel > 1) { 
			this.log.warn('%s: getConfiguredName called', this.name); 
		}
		var currentConfiguredName = this.televisionService.getCharacteristic(Characteristic.ConfiguredName).value; 		
		this.log.warn("%s: getConfiguredName returning '%s'", this.name, currentConfiguredName); 
		return currentConfiguredName
	}

	// set configured name
	async setConfiguredName(newName) {
		// trial to see if this is called during bootup
		if (this.debugLevel > 1) { 
			this.log.warn('%s: setConfiguredName: newName %s', this.name, newName); 
		}
		return
	}


	// set mute state
	async setMute(muteState) {
		// sends the mute command
		// works for TVs that accept a mute toggle command
		// muteState = Boolean = True (muted) or false (notMuted)
		if (this.debugLevel > 0) {
			this.log.warn('%s: setMute: muteState:', this.name, muteState);
		}
		/*
		if (callbackMute && typeof(callbackMute) === 'function') { 
			callbackMute();
		}
			*/
 
		// mute state is a boolean, either true or false
		// const NOT_MUTED = 0, MUTED = 1;
		this.log('%s: Set mute: %s', this.name, (muteState) ? 'Muted' : 'Not muted');
		// send only if a keycode exists
		const keyCode = this.deviceConfig.muteButton;
		if (keyCode.length > 0) {
			this.sendKey(keyCode);
		}
		return
	}


	// set volume
	async setVolume(volumeSelectorValue) {
		// set the volume of the TV using bash scripts
		// so volume must be handled over a different method
		// here we send execute a bash command on the raspberry pi using the samsungctl command
		// to control the authors samsung stereo at 192.168.0.152
		if (this.debugLevel > 0) { this.log.warn('%s: setVolume: volumeSelectorValue:', this.name, volumeSelectorValue); }

		// volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
		this.log.debug('%s: setVolume: Set volume: %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 10000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.lastVolDownKeyPress[2] = this.lastVolDownKeyPress[1] || 0;
			this.lastVolDownKeyPress[1] = this.lastVolDownKeyPress[0] || 0;
			this.lastVolDownKeyPress[0] = Date.now();
			tripleVolDownPress = this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('%s: setVolume: Timediff between lastVolDownKeyPress[0] now and lastVolDownKeyPress[2]: %s ms', this.name, this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2]);
		}
			
		// check for triple press of volDown, send setmute if tripleVolDownPress less than 1000ms
		var keyCode;
		if (tripleVolDownPress < 1000) {
			this.log.debug('%s: Triple-press of volume down detected', this.name);
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
		return
	}

	// get ActiveIdentifier (input)
	// ActiveIdentifier is zero-based: 0=input1, 1=input2, etc
	async getActiveIdentifier() {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// currentInputId is updated by the polling mechanisn
		// must return a valid index, and must never return null
		// Input 0 is the first entry in the input list, input 1 the next, and so on
		// Active identifier (as retrieved in Shortcuts) 
		this.log.warn('%s: getActiveIdentifier: called, this.currentInputId:', this.name, this.currentInputId);

		// find the currentInputId in the inputs and return the currentActiveInput once found
		// this allows HomeKit to show the selected current input
		// search for input by the displayName, which is configured as "inputN" where N is the index: 1=first, 2=next, and so on
		// currentActiveIdentifierZeroBased is zero-based: 0=input1, 1=input2, etc
		//this.log.warn('%s: getActiveIdentifier this.inputServices', this.name, this.inputServices);
		var currentActiveIdentifierZeroBased = this.inputServices.findIndex(input => input.displayName === 'input' + this.currentInputId) ; // returns -1 if not found, returns the index (0-based) when found. Index 0 = Input 1
		if (currentActiveIdentifierZeroBased == -1) { currentActiveIdentifierZeroBased = NO_INPUT_ID -1 } // if nothing found (-1), set to NO_INPUT_ID to clear the name from the Home app tile
		//this.log.warn('%s: getActiveIdentifier currentActiveIdentifierZeroBased', this.name, currentActiveIdentifierZeroBased);
		//this.log.warn('%s: getActiveIdentifier this.inputServices[currentActiveIdentifierZeroBased]', this.name, this.inputServices[currentActiveIdentifierZeroBased]);

		// get name if currentActiveInput is within bounds of the inputServices array
		var currentInputName; // default empty
		if ((currentActiveIdentifierZeroBased >= 0) && (currentActiveIdentifierZeroBased < this.inputServices.length)) { 
			currentInputName = this.inputServices[currentActiveIdentifierZeroBased].getCharacteristic(Characteristic.ConfiguredName).value; 
		}

		// currentActiveIdentifierZeroBased is zero-based. 0=Input1, 1=Input2, etc.
		if (this.debugLevel > 0) { 
			this.log.warn('%s: getActiveIdentifier returning currentActiveIdentifier %s = input %s [%s]', this.name, currentActiveIdentifierZeroBased + 1, currentActiveIdentifierZeroBased + 1, currentInputName || NO_INPUT_NAME);
		}

		return currentActiveIdentifierZeroBased + 1; // first input has ActiveIdentifier 1, 2nd has 2, and so on
	}

	// set ActiveIdentifier (input, uint32)
	async setActiveIdentifier(newInputId) {
		// newInputId is an integer, 1-based. 1 is the first entry in the input list, input 2 the next, and so on
		this.log.warn('%s: setActiveIdentifier newInputId:', this.name, newInputId);
		
		//one day I'll implement the HDMI CEC input control, then I'll need these functions:
		/*
		var currentInputName = 'UNKNOWN';
		var foundIndex = this.inputList.findIndex(input => input.inputId === currentInputId);
		if (foundIndex > -1) { currentInputName = this.inputList[foundIndex].InputName; }
		this.log('Change input from %s %s to %s %s', currentInputId, currentInputName, input.inputId, input.InputName);
		this.switchInput(input.inputId);
		*/
		
		// get keycode only if we have an input (sometimes not defined)
		// Remember: newInputId is 1-based, but the array is zero-based, so subtract 1
		var keyCode = '';
		if (newInputId !== undefined) {
			keyCode = this.deviceConfig.inputs[newInputId-1].inputKeyCode;
			this.log.warn('%s: setActiveIdentifier newActiveIdentifier %s inputs keyCode %s', this.name, newInputId, keyCode );
		}
		// send only if a keycode exists
		if ((keyCode || {}).length > 0) {
			this.sendKey(keyCode);

			var currentInputName; // default empty
			// Remember: newInputId is 1-based, but the array is zero-based, so subtract 1
			if ((newInputId > 0) && (newInputId <= this.inputServices.length)) { 
				currentInputName = this.inputServices[newInputId-1].getCharacteristic(Characteristic.ConfiguredName).value; 
			}
			this.log.warn('%s: setActiveIdentifier setting newInputId to: %s [%s]', this.name, newInputId, currentInputName );
	
			this.currentInputId = newInputId; // persist to homebridge, InputId is the Identifier value, which is 1-based. ActiveIdentifier is zero-based
			this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(newInputId);
		}

		// disabled in v1.1.0, we now allow the persistance of the selected value
		/*
		// immediately reset the input back to nothing to clear any scenes and clear the tile display
		if (this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value != NO_INPUT_ID) {
			this.log.warn('%s: setActiveIdentifier setting ActiveIdentifier to NO_INPUT_ID %s :', this.name, NO_INPUT_ID);
			this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(NO_INPUT_ID);
		} else {
			this.log.debug('%s: setActiveIdentifier: ActiveIdentifier OK, no need to change', this.name);
		}
		*/
		return
	}

	// set input name
	async setInputName(inputName) {
		// fired by the user changing an input name in Home app accessory setup
		if (this.debugLevel > 0) {
			this.log.warn('%s: setInputName inputName:', this.name, inputName);
		}
		return
	};

	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state) {
		// fired by the View TV Settings command in the HomeKit TV accessory Settings
		if (this.debugLevel > 0) {
			this.log.warn('%s: setPowerModeSelection state:', this.name, state);
		}
		this.log('%s: Menu command: View TV Settings', this.name);
		// only send the keys if the power is on
		if (this.currentPowerState == Characteristic.Active.ACTIVE) {
			this.sendKey(this.deviceConfig.viewTvSettingsCommand || 'KEY_MENU');
		} else {
			this.log('%s: Power is Off. View TV Settings command not sent', this.name);
		}
		return
	}

	// get current media state
	async getCurrentMediaState() {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.debugLevel > 0) {
			this.log.warn('%s: getCurrentMediaState returning %s [%s]', this.name, this.currentMediaState, mediaStateName[this.currentMediaState]);
		}
		return this.currentMediaState;
	}

	// get target media state
	async getTargetMediaState() {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// must never return null, so send STOP as default value
		if (this.debugLevel > 0) {
			this.log.warn('%s: getTargetMediaState returning %s [%s]', this.name, this.targetMediaState, mediaStateName[this.targetMediaState]);
		}
		return this.currentMediaState;
	}

	// set target media state
	async setTargetMediaState(targetState) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.debugLevel > 1) { this.log.warn('%s: setTargetMediaState this.targetMediaState:',this.name, targetState, mediaStateName[targetState]); }
		callback(null); // for rapid response
		switch (targetState) {
			case Characteristic.TargetMediaState.PLAY:
				this.log('%s: setTargetMediaState: Set media to PLAY for', this.name, this.currentInputId);
				this.setMediaState(this.currentInputId, 1)
				break;
			case Characteristic.TargetMediaState.PAUSE:
				this.log('%s: setTargetMediaState: Set media to PAUSE for', this.name, this.currentInputId);
				this.setMediaState(this.currentInputId, 0)
				break;
			case Characteristic.TargetMediaState.STOP:
				this.log('%s: setTargetMediaState: Set media to STOP for', this.name, this.currentInputId);
				this.setMediaState(this.currentInputId, 0)
				break;
			}
		return
	}

	// get display order
	async getDisplayOrder() {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// log the display order
		// Buffer.from(this.displayOrder).toString('base64')
		let displayOrder = this.televisionService.getCharacteristic(Characteristic.DisplayOrder).value;
		if (this.config.debugLevel > 1) { 
			this.log.warn("%s: getDisplayOrder returning '%s'", this.name, displayOrder); 
			this.log.warn("%s: getDisplayOrder buffer is '%s'", this.name, Buffer.from(this.displayOrder).toString('base64')); 
		}
		return displayOrder;
	}

	// set display order
	async setDisplayOrder(displayOrder) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		if (this.config.debugLevel > 1) { this.log.warn('%s: setDisplayOrder displayOrder',this.name, displayOrder); }
		return
	}

	// set remote key
	async setRemoteKey(remoteKey) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: setRemoteKey: remoteKey:', this.name, remoteKey); }

		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 0...15 exist, but keys 12, 13 & 14 are not defined by Apple


		// ------------- double and triple press function ---------------
		// triple key presses triggers a second layer function
		var tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed

		var lastKeyPressTime = this.lastRemoteKeyPress0[remoteKey] || 0; // find the time the current key was last pressed
		this.log.debug("%s: setRemoteKey: remoteKey %s, lastKeyPressTime %s",this.name, remoteKey, lastKeyPressTime);

		// bump the array up one slot
		/*
		this.log("Shifting the array up one, and storing current time in index 0");
		lastkeyPress[remoteKey][2] = lastkeyPress[remoteKey][1] || 0;
		lastkeyPress[remoteKey][1] = lastkeyPress[remoteKey][0] || 0;
		lastkeyPress[remoteKey][0] = Date.now();
		*/

		// bump the array up one level and store now in lastRemoteKeyPress0
		this.lastRemoteKeyPress2[remoteKey] = this.lastRemoteKeyPress1[remoteKey];
		this.lastRemoteKeyPress1[remoteKey] = this.lastRemoteKeyPress0[remoteKey];
		this.lastRemoteKeyPress0[remoteKey] = Date.now();

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
			this.log.debug("%s: setRemoteKey: current key %s same as last key %s", this.name, remoteKey, this.lastRemoteKeyPressed);

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
				this.log.debug('%s: setRemoteKey remoteKey %s, double press detected', this.name, remoteKey);
				buttonLayer=1;
				this.pendingKeyPress = -1; // clear any pending key press
				this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
				this.readyToSendRemoteKeyPress = true; // enable immediate send
			} else {
				// no historical key presses exist, queue as a pending press
				this.log.debug('%s: setRemoteKey remoteKey %s, no historical key press detected', this.name, remoteKey);
				this.pendingKeyPress = remoteKey;
				this.sendRemoteKeyPressAfterDelay = true;	// enable send after delay
				this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
			}
		} else {
			this.log.debug("%s: setRemoteKey current key %s different to last key %s", this.name, remoteKey, this.lastRemoteKeyPressed);
			// this key is different to last key, send after delay (may be start of another double or triple key press)
			this.pendingKeyPress = remoteKey;
			this.sendRemoteKeyPressAfterDelay = true;	// enable send after delay
			this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
		}; 

		// check time difference between current keyPress and 2 keyPresses ago
		this.log.debug('%s: setRemoteKey remoteKey %s, Timediff between lastRemoteKeyPress0 now and lastRemoteKeyPress1: %s ms', this.name, remoteKey, lastPressTime0 - lastPressTime1);
		this.log.debug('%s: setRemoteKey remoteKey %s, buttonLayer %s, pendingKeyPress %s, sendRemoteKeyPressAfterDelay %s, readyToSendRemoteKeyPress %s', this.name, remoteKey, buttonLayer, this.pendingKeyPress, this.sendRemoteKeyPressAfterDelay, this.readyToSendRemoteKeyPress);


		// do the button layer mapping
		var keyNameDefault;
		var keyName;
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				keyName = 'KEY_REWIND'; break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				keyName = 'KEY_FF'; break;

			//case Characteristic.RemoteKey.NEXT_TRACK: // 2
				//keyNameDefault = "";  // no corresponding keys can be identified. not supported in Apple Remote GUI
			//	break;

			//case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				//keyNameDefault = "";  // no corresponding keys can be identified. not supported in Apple Remote GUI
			//	break;

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
					default: 	keyName = this.deviceConfig.arrowDownButton || keyNameDefault; 				break;
				}
				break;

			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyNameDefault = "KEY_LEFT";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowLeftButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowLeftButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowLeftButton || keyNameDefault; 				break;
				}
				break;

			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyNameDefault = "KEY_RIGHT";
				switch (buttonLayer) {
					case 2: 	keyName = this.deviceConfig.arrowRightButtonTripleTap || keyNameDefault; 	break;
					case 1: 	keyName = this.deviceConfig.arrowRightButtonDoubleTap || keyNameDefault; 	break;
					default: 	keyName = this.deviceConfig.arrowRightButton || keyNameDefault; 			break;
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
					default: 	keyName = this.deviceConfig.playPauseButton || keyNameDefault; 				break;
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

			default: // log any other keypresses in case Apple adds any more
				this.log('%s: setRemoteKey: Unknown remoteKey:', this.name, remoteKey);
		}


		// handle the key code (can be a sequence)
		// send only if keyName is not null
		if (keyName) {
			if (this.readyToSendRemoteKeyPress){ 
				// send immediately
				this.log.debug('%s: setRemoteKey: sending key %s immediately', this.name, keyName);
				this.sendKey(keyName); 
			} else {
				// immediate send is not enabled. 
				// start a delay equal to doublePressTime, then send only if the readyToSendRemoteKeyPress is true
				var delayTime = this.config.doublePressDelayTime || 300;
				this.log.debug('%s: setRemoteKey: sending key %s after delay of %s milliseconds', this.name, keyName, delayTime);
				setTimeout(() => { 
					// check if can be sent. Only send if sendRemoteKeyPressAfterDelay is still set. It may have been reset by another key press
					this.log.debug('%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s', this.name, keyName);
					if (this.sendRemoteKeyPressAfterDelay){ 
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, sending %s', this.name, keyName);
						this.sendKey(keyName); 
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, key %s sent, resetting readyToSendRemoteKeyPress', this.name, keyName);
						this.readyToSendRemoteKeyPress = true; // reset the enable flag
					} else {
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s: sendRemoteKeyPressAfterDelay is false, doing nothing', this.name, keyName);
					}
				},
				delayTime); // send after delayTime
			}
		}
		this.lastRemoteKeyPressed = remoteKey; // store the current key as last key pressed
		return
	}	

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};