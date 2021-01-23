'use strict';

importScripts('libs/cube-codes-model/cube-codes-model.min.js');

let workerDone = false;
const newEvents = [];
let newEventPromise;
let cube;

const _log = (type, text) => {
	scheduleEvent({
		Log: {
			type: type,
			text: text
		}
	});
};
const log        = text => _log('info',    text);
const logSuccess = text => _log('success', text);
const logWarning = text => _log('warning', text);
const logError   = text => _log('error',   text);

const _display = (type, title, text = '', delay = 3000) => {
	scheduleEvent({
		Display: {
			type: type,
			title: title,
			text: text,
			delay: delay
		}
	});
};
const display        = (title, text = '', delay = 3000) => _display('info',    title, text, delay);
const displaySuccess = (title, text = '', delay = 3000) => _display('success', title, text, delay);
const displayWarning = (title, text = '', delay = 3000) => _display('warning', title, text, delay);
const displayError   = (title, text = '', delay = 3000) => _display('error',   title, text, delay);

const cubeStateChangedHandler = e => {
	
	const event = {
		CubeStateChanged: {//TODO: Proper Serialization
			oldState: {
				value: e.oldState.value
			},
			newState: {
				value: e.newState.value
			},
			move: !e.move ? undefined : {
				face: e.move.face,
				slices: e.move.slices,
				angle: e.move.angle
			}
		}
	};

	scheduleEvent(event);

};

const onHostStarted = e => {
	
	const initialState = e.cubeState;
	initialState.move = function(move) { return new CC.CubeState(this.spec, this.value + move.angle); }; //TODO: Proper Deserialize
	
	cube = new CC.Cube(initialState);
	cube.stateChanged.on(cubeStateChangedHandler);
	
	let event = {
		WorkerDone: {}
	};

	try {
		Function(e.programCode)();
	} catch(e2) {
		event = {
			WorkerFailed: {
				error: e2
			}
		};
	}
	
	scheduleEvent(event);

};

const scheduleEvent = e => {
	newEvents.push(e);
	newEventPromise?.resolve(true);
};

const sendEventAsMessage = e => {
	if(typeof e.WorkerDone === 'object') {
		workerDone = true;
	}
	postMessage(e);
	if(typeof e.WorkerDone === 'object') {
		close();
	}
};

const onHostEventAsked = async e => {

	if(workerDone) return;
	
	let publicResolve;
	newEventPromise = new Promise(resolve => publicResolve = resolve);
	newEventPromise.resolve = publicResolve;
	newEventPromise.enabled = true;

	const oldestEvent = newEvents.shift();
	if(oldestEvent !== undefined) {
		sendEventAsMessage(oldestEvent);
		return;
	}

	await newEventPromise;
	newEventPromise = undefined;

	const oldestEvent2 = newEvents.shift();
	if(oldestEvent2 !== undefined) {
		sendEventAsMessage(oldestEvent2);
		return;
	}

	onHostEventAsked(e);

};

onmessage = message => {
	if (typeof message.data.HostStarted === 'object') {
		onHostStarted(message.data.HostStarted);
	} else if (typeof message.data.HostEventAsked === 'object') {
		onHostEventAsked(message.data.HostEventAsked);
	} else {
		throw new Error('Unknown event: ' + JSON.stringify(message.data));
	}
};