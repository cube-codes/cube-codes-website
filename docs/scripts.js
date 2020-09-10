$(function() {

	// Editor

	let editor = ace.edit('editor', {
		mode: 'ace/mode/javascript',
		newLineMode: 'unix',
		useSoftTabs: false,
		tabSize: 4,
		dragEnabled: false,
		showPrintMargin: false,
		theme: 'ace/theme/textmate',
		fixedWidthGutter: true
	});
	editor.renderer.setScrollMargin(6, 0, 0, 0);
	editor.on('input', function() {
		$('#button-editor-undo').prop('disabled', !editor.session.getUndoManager().hasUndo());
		$('#button-editor-redo').prop('disabled', !editor.session.getUndoManager().hasRedo());
	});

	let myWorker;
	let start = function() {

		if (!window.Worker) throw new Error('WebWorker not available');

		$('#button-editor-stop').prop('disabled', false);
		$('#button-editor-run' ).prop('disabled', true);

		let workerCode = new Blob([`
			
			"use strict";

			let workerDone = function() {
				postMessage({
					eventName: 'WorkerDone'
				});
				close();
			};

			let eventId = -1;
			let wait = false;

			let cubeStateChanged = async function() {
				eventId = Math.random();
				wait = true;
				postMessage({
					eventName: 'CubeStateChanged',
					eventId: eventId,
					value: 1
				});
				while(wait) {
					await new Promise(r => setTimeout(r, 3000));
				}
				setTimeout(cubeStateChanged, 1000);
			};

			onmessage = function(message) {
				if(message.data.eventName === 'WorkerHostStarted') {
					setTimeout(workerDone, 10000);
					setTimeout(cubeStateChanged, 1000);
				} else if(message.data.eventName === 'CubeStateChangedAck') {
					if(message.data.eventId === eventId) {
						wait = false;
					} else {
						throw new Error('Ignore Event Ack Id: ' + message.data.eventId);
					}
				} else {
					throw new Error('Unknown event: ' + message.data.eventName);
				}
			};

			`
		], {
			type: 'application/javascript'
		});

		myWorker = new Worker(URL.createObjectURL(workerCode));
		myWorker.onmessage = async function(message) {
			console.log('Message received from worker', message);
			if(message.data.eventName === 'WorkerDone') {
				$('#button-editor-stop').prop('disabled', true);
				$('#button-editor-run' ).prop('disabled', false);
			} else if(message.data.eventName === 'CubeStateChanged') {
				console.log('Event CubeStateChanged Start', message.data);
				await new Promise(r => setTimeout(r, 1000));
				console.log('Event CubeStateChanged End', message.data);
				myWorker.postMessage({
					eventName: 'CubeStateChangedAck',
					eventId: message.data.eventId
				});
			} else {
				throw new Error('Unknown event: ' + message.data.eventName);
			}
		};
		myWorker.onerror = function(error) {
			
			console.log('Error received from worker', error);

			$('#button-editor-stop').prop('disabled', true);
			$('#button-editor-run' ).prop('disabled', false);
		
		};
		myWorker.postMessage({
			eventName: 'WorkerHostStarted'
		});

	};

	let stop = function() {

		myWorker.terminate();

		$('#button-editor-stop').prop('disabled', true);
		$('#button-editor-run' ).prop('disabled', false);

	};
	
	$('#button-editor-stop'           ).on('click', function(e) { stop(); });
	$('#button-editor-run'            ).on('click', function(e) { start(); });
	$('#button-editor-undo'           ).on('click', function(e) { editor.undo(); });
	$('#button-editor-redo'           ).on('click', function(e) { editor.redo(); });
	$('#button-editor-search'         ).on('click', function(e) { editor.execCommand('find'); });
	$('#button-editor-show-invisibles').on('click', function(e) { editor.setOption('showInvisibles', !editor.getOption('showInvisibles')); });

	// Cube

	let cubeSpec = new CC.CubeSpecification(3);
	let cube = new CC.Cube(new CC.CubeState(cubeSpec, 0));
	cube.stateChanged.on(function(e) { console.log('Event: cube.change', e); });
	
	// Display Cube State

	cube.stateChanged.on(function(e) { $('#section-cube-display').html(e.newState.value); });
	$('#section-cube-display').html(cube.getState().value);
	
	// Cube History

	let cubeHistory = new CC.CubeHistory(cube);
	cubeHistory.moved.on(function(e) { console.log('Event: cubeHistory.moved', e); });
	cubeHistory.recorded.on(function(e) { console.log('Event: cubeHistory.recorded', e); });
	cubeHistory.pastCleaned.on(function(e) { console.log('Event: cubeHistory.pastCleaned', e); });
	cubeHistory.futureCleaned.on(function(e) { console.log('Event: cubeHistory.futureCleaned', e); });
	
	// Display Cube History Moves

	cubeHistory.moved.on(function(e) { $('#section-history-changes > span.current').removeClass('current'); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); });
	cubeHistory.recorded.on(function(e) { $('#section-history-changes').append('<span>' + (cube.getMoveLanguage().stringify([e.change.move]) || 'Manual') + '</span>'); });
	cubeHistory.pastCleaned.on(function(e) { $('#section-history-changes').children().slice(1, e.to + 1).remove(); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); });
	cubeHistory.futureCleaned.on(function(e) { $('#section-history-changes').children().slice(e.from + 1).remove(); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); });
	$('#section-history-changes').append('<span class="current">Manual</span>');
	
	// Update Cube History Controls

	var updateHistoryButtons = function() {
		$('#button-history-jump-start').prop('disabled', cubeHistory.isAtStart());
		$('#button-history-play-back' ).prop('disabled', cubeHistory.isAtStart());
		$('#button-history-step-back' ).prop('disabled', cubeHistory.isAtStart());
		$('#button-history-step-ahead').prop('disabled', cubeHistory.isAtEnd());
		$('#button-history-play-ahead').prop('disabled', cubeHistory.isAtEnd());
		$('#button-history-jump-end'  ).prop('disabled', cubeHistory.isAtEnd());
	};
	cubeHistory.moved.on(updateHistoryButtons);
	cubeHistory.pastCleaned.on(updateHistoryButtons);
	cubeHistory.futureCleaned.on(updateHistoryButtons);
	updateHistoryButtons();
	
	// Cube History Click

	$('#section-history-changes').on('click', 'span', function(e) {  cubeHistory.jumpToIndex($(this).index() - 1); });

	// Cube History Controls

	$('#button-history-jump-start').on('click', function(e) { cubeHistory.jumpToStart(); });
	$('#button-history-jump-end'  ).on('click', function(e) { cubeHistory.jumpToEnd(); });
	$('#button-history-step-back' ).on('click', function(e) { cubeHistory.stepBack(); });
	$('#button-history-step-ahead').on('click', function(e) { cubeHistory.stepAhead(); });
	
	// Cube Controls

	$('#button-cube-front').on('click', function(e) { cube.mFront(); });
	$('#dropdown-item-cube-front-two').on('click', function(e) { cube.mFront(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-front-invert').on('click', function(e) { cube.mFront(CC.CubeAngle.CC90); });
	
	$('#button-cube-front-middle').on('click', function(e) { cube.mwFront(2); });
	$('#dropdown-item-cube-front-middle-two').on('click', function(e) { cube.mwFront(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-front-middle-invert').on('click', function(e) { cube.mwFront(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-back-middle').on('click', function(e) { cube.mwBack(2); });
	$('#dropdown-item-cube-back-middle-two').on('click', function(e) { cube.mwBack(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-back-middle-invert').on('click', function(e) { cube.mwBack(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-back').on('click', function(e) { cube.mBack(); });
	$('#dropdown-item-cube-back-two').on('click', function(e) { cube.mBack(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-back-invert').on('click', function(e) { cube.mBack(CC.CubeAngle.CC90); });
	
	$('#button-cube-z').on('click', function(e) { cube.rZ(); });
	$('#dropdown-item-cube-z-two').on('click', function(e) { cube.rZ(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-z-invert').on('click', function(e) { cube.rZ(CC.CubeAngle.CC90); });
	
	$('#button-cube-left').on('click', function(e) { cube.mLeft(); });
	$('#dropdown-item-cube-left-two').on('click', function(e) { cube.mLeft(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-left-invert').on('click', function(e) { cube.mLeft(CC.CubeAngle.CC90); });
	
	$('#button-cube-left-middle').on('click', function(e) { cube.mwLeft(2); });
	$('#dropdown-item-cube-left-middle-two').on('click', function(e) { cube.mwLeft(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-left-middle-invert').on('click', function(e) { cube.mwLeft(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-right-middle').on('click', function(e) { cube.mwRight(2); });
	$('#dropdown-item-cube-right-middle-two').on('click', function(e) { cube.mwRight(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-right-middle-invert').on('click', function(e) { cube.mwRight(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-right').on('click', function(e) { cube.mRight(); });
	$('#dropdown-item-cube-right-two').on('click', function(e) { cube.mRight(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-right-invert').on('click', function(e) { cube.mRight(CC.CubeAngle.CC90); });
	
	$('#button-cube-x').on('click', function(e) { cube.rX(); });
	$('#dropdown-item-cube-x-two').on('click', function(e) { cube.rX(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-x-invert').on('click', function(e) { cube.rX(CC.CubeAngle.CC90); });
	
	$('#button-cube-up').on('click', function(e) { cube.mUp(); });
	$('#dropdown-item-cube-up-two').on('click', function(e) { cube.mUp(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-up-invert').on('click', function(e) { cube.mUp(CC.CubeAngle.CC90); });
	
	$('#button-cube-up-middle').on('click', function(e) { cube.mwUp(2); });
	$('#dropdown-item-cube-up-middle-two').on('click', function(e) { cube.mwUp(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-up-middle-invert').on('click', function(e) { cube.mwUp(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-down-middle').on('click', function(e) { cube.mwDown(2); });
	$('#dropdown-item-cube-down-middle-two').on('click', function(e) { cube.mwDown(2, CC.CubeAngle.C180); });
	$('#dropdown-item-cube-down-middle-invert').on('click', function(e) { cube.mwDown(2, CC.CubeAngle.CC90); });
	
	$('#button-cube-down').on('click', function(e) { cube.mDown(); });
	$('#dropdown-item-cube-down-two').on('click', function(e) { cube.mDown(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-down-invert').on('click', function(e) { cube.mDown(CC.CubeAngle.CC90); });
	
	$('#button-cube-y').on('click', function(e) { cube.rY(); });
	$('#dropdown-item-cube-y-two').on('click', function(e) { cube.rY(CC.CubeAngle.C180); });
	$('#dropdown-item-cube-y-invert').on('click', function(e) { cube.rY(CC.CubeAngle.CC90); });

});