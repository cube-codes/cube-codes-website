'use strict';

class ProgramRunner {

	/**
	 * State:
	 * 0 = INIT (host created)
	 * 1 = STARTING
	 * 2 = RUNNING
	 * 3 = DONE (worker called close)
	 * 4 = STOPPED (host called terminate)
	 * 5 = FAILED (program produced error)
	 * 6 = CRASHED (worker produced error)
	*/

	constructor(cube) {

		if (!window.Worker) throw new Error('Worker not available');

		this.cube = cube;
		this.dom = $(document.body).append('<br style="display: none;" />')[0];
		this.state = 0;
		this.worker = undefined;
	
	}

	setState(newState) {
		const oldState = this.state;
		this.state = newState;
		this.dom.dispatchEvent(new CustomEvent('stateChanged', {
			detail: {
				oldState: oldState,
				newState: newState
			}
		}));
	}

	on(eventName, listener) {
		this.dom.addEventListener(eventName, listener);
	}

	start(programCode, animationTime) {
		
		if(this.state === 1 || this.state === 2) throw new Error(`Invalid state: ${this.state}`);
		
		this.setState(1);
		
		// Setup worker
		this.worker = new Worker('worker.js');
		this.worker.onmessage = message => {
			console.debug('ProgramRunner: onmessage: ', message);
			if (typeof message.data.CubeStateChanged === 'object') {
				this.onCubeStateChanged(message.data.CubeStateChanged, animationTime);
			} else if (typeof message.data.WorkerDone === 'object') {
				this.onWorkerDone(message.data.WorkerDone);
			} else if (typeof message.data.WorkerFailed === 'object') {
				this.onWorkerFailed(message.data.WorkerFailed);
			} else if (typeof message.data.Log === 'object') {
				this.onLog(message.data.Log);
			} else if (typeof message.data.Display === 'object') {
				this.onDisplay(message.data.Display);
			} else {
				throw new Error('Unknown event: ' + JSON.stringify(message.data));
			}
		};
		this.worker.onerror = e => {
			console.debug('ProgramRunner: onerror: ', e);
			this.onWorkerCrashed({
				WorkerFailed: {
					error: e
				}
			});
		};

		// Start the program
		this.worker.postMessage({
			HostStarted: {
				cubeState: this.cube.getState(),
				programCode: programCode
			}
		});

		this.worker.postMessage({
			HostEventAsked: {}
		});
		
		
		this.setState(2);
		addLog('Program started', 'info', true);

	}

	abort() {

		if(this.state !== 2) throw new Error(`Invalid state: ${this.state}`);
		
		this.setState(4);
		addLog('Program aborted', 'danger', true);
		addLogSeperator();
		addToast('Program aborted', '', 'danger', 8000);
		
		this.worker.terminate();
	
	}

	onWorkerDone(e) {
		
		this.setState(3);
		addLog('Program finished', 'success', true);
		addLogSeperator();
		addToast('Program finished', '', 'success', 5000);

	}

	onWorkerFailed(e) {
		
		this.setState(5);
		addLog(`Program crashed with an error: ${e.error.stack}`, 'danger', true);
		addLogSeperator();
		addToast('Program crashed with an error', e.error.message, 'danger', 8000);

	}

	onWorkerCrashed(e) {
		
		this.setState(5);

	}

	onLog(e) {
		
		const colors = new Map([
			['info'   , 'info'],
			['success', 'success'],
			['warning', 'warning'],
			['error'  , 'danger']
		]);
		addLog(e.text, colors.get(e.type) ?? 'info', false);

		this.worker.postMessage({
			HostEventAsked: {}
		});

	}

	onDisplay(e) {
		
		const colors = new Map([
			['info'   , 'info'],
			['success', 'success'],
			['warning', 'warning'],
			['error'  , 'danger']
		]);
		addToast(`Program: ${e.title}`, e.text, colors.get(e.type) ?? 'info', e.delay);

		this.worker.postMessage({
			HostEventAsked: {}
		});

	}

	async onCubeStateChanged(e, animationTime) {

		const spec = this.cube.getState().spec; //TODO: Proper deserizaling
		
		e.oldState.spec = spec; //TODO: Remove
		e.newState.spec = spec; //TODO: Remove
		if(e.move) {
			e.move.spec = spec; //TODO: Remove
			this.cube.move(e.move);
		} else {
			this.cube.setState(e.newState);
		}

		//TODO: Animation Waiter
		await new Promise(resolve => setTimeout(resolve, animationTime));

		this.worker.postMessage({
			HostEventAsked: {}
		});

	}

}