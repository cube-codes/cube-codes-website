'use strict';

const addLog = (text, color, withDate) => {
	let date = '';
	if(withDate) {
		date = '[' + new Date().toLocaleTimeString('en-US', { hourCycle: 'h23' }) + '] ';
	}
	$(`<div class="log text-${color}">${date}${text}</div>`).appendTo('#logger');
	if($('#button-editor-lock-scroll').hasClass('active')) {
		$('#logger').scrollTop($('#logger').prop("scrollHeight"));
	}
};
const addLogSeperator = () => addLog("&nbsp;\n" + '-'.repeat(80) + "\n&nbsp;", 'info', false);

const addToast = (title, text, color, delay) => {
	const icons = new Map([
		['info'   , 'info-circle-fill.svg'],
		['success', 'check-circle-fill.svg'],
		['warning', 'exclamation-circle-fill.svg'],
		['danger' , 'x-circle-fill.svg']
	]);
	const toast = $(`<div class="toast bg-${color} text-light" data-delay="${delay}"><div class="toast-header"><img src="bootstrap-icons/${icons.get(color)}" /><strong>${title}</strong><button type="button" class="ml-auto close" data-dismiss="toast">×</button></div><div class="toast-body">${text}</div></div>`).appendTo('#toast-zone');
	toast.on('hidden.bs.toast', () => {
		toast.remove();
	});
	toast.toast('show');
};

window.addEventListener('beforeunload', e => event.returnValue = 'Are you sure you want to leave?');



$(function() {

	startApplication();

});

const hideLoader = () => {

	$('#loader').empty();
	$('#loader').fadeOut(300);

};

const startApplication = () => {

	// Cube

	const cubeSpec = new CC.CubeSpecification(3);
	const cube = new CC.Cube(new CC.CubeState(cubeSpec, 0));
	cube.stateChanged.on(e => console.log('Event: cube.change', e));

	// Editor

	const editor = ace.edit('editor', {
		mode: 'ace/mode/javascript',
		newLineMode: 'unix',
		useSoftTabs: false,
		tabSize: 4,
		dragEnabled: false,
		showPrintMargin: false,
		theme: 'ace/theme/textmate',
		fixedWidthGutter: true
	});
	editor.fontsize = 12;
	editor.renderer.setScrollMargin(6, 0, 0, 0);
	editor.on('input', e => {
		$('#button-editor-undo').prop('disabled', !editor.session.getUndoManager().hasUndo());
		$('#button-editor-redo').prop('disabled', !editor.session.getUndoManager().hasRedo());
	});

	const programRunner = new ProgramRunner(cube);
	programRunner.on('stateChanged', e => {
		const running = e.detail.newState === 1 || e.detail.newState === 2;
		$('#button-editor-abort'   ).prop('disabled', !running);
		$('#button-editor-run'     ).prop('disabled', running);
		$('#button-editor-run-fast').prop('disabled', running);
	})
	
	$('#button-editor-abort'          ).on('click', e => programRunner.abort());
	$('#button-editor-run'            ).on('click', e => programRunner.start(editor.getValue(), 300));
	$('#button-editor-run-fast'       ).on('click', e => programRunner.start(editor.getValue(), 0));
	$('#button-editor-undo'           ).on('click', e => editor.undo());
	$('#button-editor-redo'           ).on('click', e => editor.redo());
	$('#button-editor-search'         ).on('click', e => editor.execCommand('find'));
	$('#button-editor-show-invisibles').on('click', e => editor.setOption('showInvisibles', !editor.getOption('showInvisibles')));
	$('#button-editor-font-increase'  ).on('click', e => { editor.fontsize = Math.floor(editor.fontsize * 1.2); $('#editor, #logger').attr('style', `font-size: ${editor.fontsize}px !important`); });
	$('#button-editor-font-decrease'  ).on('click', e => { editor.fontsize = Math.floor(editor.fontsize / 1.2); $('#editor, #logger').attr('style', `font-size: ${editor.fontsize}px !important`); });
	$('#button-editor-clean'          ).on('click', e => $('#logger').empty());
	
	// Display Cube State

	cube.stateChanged.on(e => $('#section-cube-display').html(e.newState.value));
	$('#section-cube-display').html(cube.getState().value);
	
	// Cube History

	const cubeHistory = new CC.CubeHistory(cube);
	cubeHistory.moved.on(e => console.log('Event: cubeHistory.moved', e));
	cubeHistory.recorded.on(e => console.log('Event: cubeHistory.recorded', e));
	cubeHistory.pastCleaned.on(e => console.log('Event: cubeHistory.pastCleaned', e));
	cubeHistory.futureCleaned.on(e => console.log('Event: cubeHistory.futureCleaned', e));
	
	// Display Cube History Moves

	cubeHistory.moved.on(e => { $('#section-history-changes > span.current').removeClass('current'); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); });
	cubeHistory.recorded.on(e => { $('#section-history-changes').append('<span class="badge badge-light">' + (e.change.move ? cube.getMoveLanguage().stringify([e.change.move]) : 'Manual') + '</span>'); if($('#button-history-lock-scroll').hasClass('active')) { $('#section-history-changes').scrollTop($('#section-history-changes').prop("scrollHeight")); } });
	cubeHistory.pastCleaned.on(e => { $('#section-history-changes').children().slice(0, e.before + 1).remove(); $('#section-history-changes > span.current').removeClass('current'); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); $('#section-history-changes > span:first-child').html('Manual'); });
	cubeHistory.futureCleaned.on(e => { $('#section-history-changes').children().slice(e.after + 2).remove(); $('#section-history-changes > span.current').removeClass('current'); $('#section-history-changes > span:nth-child(' + (cubeHistory.getCurrentPosition() + 2) + ')').addClass('current'); });
	$('#section-history-changes').append('<span class="badge badge-light current">Manual</span>');
	
	// Update Cube History Controls

	const updateHistoryButtons = () => {
		$('#button-history-jump-start'  ).prop('disabled', cubeHistory.isAtStart());
		$('#button-history-play-back'   ).prop('disabled', cubeHistory.isAtStart());
		$('#button-history-step-back'   ).prop('disabled', cubeHistory.isAtStart());
		$('#button-history-step-ahead'  ).prop('disabled', cubeHistory.isAtEnd());
		$('#button-history-play-ahead'  ).prop('disabled', cubeHistory.isAtEnd());
		$('#button-history-jump-end'    ).prop('disabled', cubeHistory.isAtEnd());
	};
	cubeHistory.moved.on(updateHistoryButtons);
	cubeHistory.pastCleaned.on(updateHistoryButtons);
	cubeHistory.futureCleaned.on(updateHistoryButtons);
	updateHistoryButtons();
	
	// Cube History Click

	$('#section-history-changes').on('click', 'span', e => cubeHistory.jumpToIndex($(e.target).index() - 1));

	// Cube History Controls

	$('#button-history-jump-start'  ).on('click', e => cubeHistory.jumpToStart());
	$('#button-history-jump-end'    ).on('click', e => cubeHistory.jumpToEnd());
	$('#button-history-step-back'   ).on('click', e => cubeHistory.stepBack());
	$('#button-history-step-ahead'  ).on('click', e => cubeHistory.stepAhead());
	$('#button-history-clean-past'  ).on('click', e => cubeHistory.cleanPastBefore(cubeHistory.getCurrentPosition()));
	$('#button-history-clean-future').on('click', e => cubeHistory.cleanFutureAfter(cubeHistory.getCurrentPosition()));
	
	// Cube Controls

	$('#button-cube-front').on('click', e => cube.mFront());
	$('#dropdown-item-cube-front-two').on('click', e => cube.mFront(CC.CubeAngle.C180));
	$('#dropdown-item-cube-front-invert').on('click', e => cube.mFront(CC.CubeAngle.CC90));
	
	$('#button-cube-front-stand').on('click', e => cube.mwFront(2));
	$('#dropdown-item-cube-front-stand-two').on('click', e => cube.mwFront(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-front-stand-invert').on('click', e => cube.mwFront(2, CC.CubeAngle.CC90));
	
	$('#button-cube-stand').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-stand-two').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-stand-invert').on('click', e => null); //TODO: Implement
	
	$('#button-cube-back-stand').on('click', e => cube.mwBack(2));
	$('#dropdown-item-cube-back-stand-two').on('click', e => cube.mwBack(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-back-stand-invert').on('click', e => cube.mwBack(2, CC.CubeAngle.CC90));
	
	$('#button-cube-back').on('click', e => cube.mBack());
	$('#dropdown-item-cube-back-two').on('click', e => cube.mBack(CC.CubeAngle.C180));
	$('#dropdown-item-cube-back-invert').on('click', e => cube.mBack(CC.CubeAngle.CC90));
	
	$('#button-cube-z').on('click', e => cube.rZ());
	$('#dropdown-item-cube-z-two').on('click', e => cube.rZ(CC.CubeAngle.C180));
	$('#dropdown-item-cube-z-invert').on('click', e => cube.rZ(CC.CubeAngle.CC90));
	
	$('#button-cube-left').on('click', e => cube.mLeft());
	$('#dropdown-item-cube-left-two').on('click', e => cube.mLeft(CC.CubeAngle.C180));
	$('#dropdown-item-cube-left-invert').on('click', e => cube.mLeft(CC.CubeAngle.CC90));
	
	$('#button-cube-left-middle').on('click', e => cube.mwLeft(2));
	$('#dropdown-item-cube-left-middle-two').on('click', e => cube.mwLeft(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-left-middle-invert').on('click', e => cube.mwLeft(2, CC.CubeAngle.CC90));
	
	$('#button-cube-middle').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-middle-two').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-middle-invert').on('click', e => null); //TODO: Implement
	
	$('#button-cube-right-middle').on('click', e => cube.mwRight(2));
	$('#dropdown-item-cube-right-middle-two').on('click', e => cube.mwRight(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-right-middle-invert').on('click', e => cube.mwRight(2, CC.CubeAngle.CC90));
	
	$('#button-cube-right').on('click', e => cube.mRight());
	$('#dropdown-item-cube-right-two').on('click', e => cube.mRight(CC.CubeAngle.C180));
	$('#dropdown-item-cube-right-invert').on('click', e => cube.mRight(CC.CubeAngle.CC90));
	
	$('#button-cube-x').on('click', e => cube.rX());
	$('#dropdown-item-cube-x-two').on('click', e => cube.rX(CC.CubeAngle.C180));
	$('#dropdown-item-cube-x-invert').on('click', e => cube.rX(CC.CubeAngle.CC90));
	
	$('#button-cube-up').on('click', e => cube.mUp());
	$('#dropdown-item-cube-up-two').on('click', e => cube.mUp(CC.CubeAngle.C180));
	$('#dropdown-item-cube-up-invert').on('click', e => cube.mUp(CC.CubeAngle.CC90));
	
	$('#button-cube-up-equator').on('click', e => cube.mwUp(2));
	$('#dropdown-item-cube-up-equator-two').on('click', e => cube.mwUp(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-up-equator-invert').on('click', e => cube.mwUp(2, CC.CubeAngle.CC90));
	
	$('#button-cube-equator').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-equator-two').on('click', e => null); //TODO: Implement
	$('#dropdown-item-cube-equator-invert').on('click', e => null); //TODO: Implement
	
	$('#button-cube-down-equator').on('click', e => cube.mwDown(2));
	$('#dropdown-item-cube-down-equator-two').on('click', e => cube.mwDown(2, CC.CubeAngle.C180));
	$('#dropdown-item-cube-down-equator-invert').on('click', e => cube.mwDown(2, CC.CubeAngle.CC90));
	
	$('#button-cube-down').on('click', e => cube.mDown());
	$('#dropdown-item-cube-down-two').on('click', e => cube.mDown(CC.CubeAngle.C180));
	$('#dropdown-item-cube-down-invert').on('click', e => cube.mDown(CC.CubeAngle.CC90));
	
	$('#button-cube-y').on('click', e => cube.rY());
	$('#dropdown-item-cube-y-two').on('click', e => cube.rY(CC.CubeAngle.C180));
	$('#dropdown-item-cube-y-invert').on('click', e => cube.rY(CC.CubeAngle.CC90));

	$('#button-cube-shuffle').on('click', e => null); //TODO: Implement

	hideLoader();

};