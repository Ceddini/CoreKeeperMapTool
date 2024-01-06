const updatemap = () => { drawMap(tilelist) };

let tilelist = [];

document.addEventListener("keypress", function (event) {
	if (Alpine.store('data').mapLoaded === false) return;

	if (event.key === 'c') {
		recenterMap();
	}

	if (event.key === 'h') {
		Alpine.store('data').showMazeHoles = !Alpine.store('data').showMazeHoles;
		redrawMap();
	}

	if (event.key === 'g') {
		Alpine.store('data').showChunkGrid = !Alpine.store('data').showChunkGrid;
		redrawMap();
	}

	if (event.key === 'G') {
		Alpine.store('data').showMobGrid = !Alpine.store('data').showMobGrid;
		redrawMap();
	}
});

document.addEventListener('alpine:init', function () {

	const canWatchFile = typeof window.showOpenFilePicker !== "undefined";

	Alpine.store('directoryList', []);
	Alpine.store('faq', faq);

	Alpine.store('tilecolormap', { list: tileColors, visible: [] });

	Alpine.store('data', {
		mapLoaded: false,
		firstTimeLoaded: false,
		isExampleMap: false,
		canWatchFile,

		tutorialShown: tutorialShown,
		mapPickerShown: false, // TODO: RESET TO TRUE TO ENABLE
		directoryHandle: null,

		arcSlidersPrefilled: false,

		showArcs: false,
		showChunkGrid: false,
		showMobGrid: false,
		showCustomRing: false,
		showMazeHoles: false,
		manualArcRotation: false,
		cropRingsToBiome: false,

		innerSlider: 0,
		outerSlider: 0,
		ringTransparency: 50,
		biomeTransparency: 50,
		gridTransparency: 30,
		tileTransparency: 15,
		customRing: 25,
	});
});

window.addEventListener('DOMContentLoaded', () => {
	const fileupload = document.getElementById("mapupload");
	const mapCanvas = document.getElementById("mapcanvas");
	const uploadButton = document.getElementById("uploadbutton");
	fileupload?.addEventListener('change', function handleFile(event) {
		Alpine.store('data').isExampleMap = false;
		Alpine.store('data').mapLoaded = false;
		uploadButton.value = fileupload.files[0].name;
		resetMap();
		loadMapFile(fileupload, tilelist, updatemap);
	});
	panZoomElem = Panzoom(mapCanvas, {
		maxScale: MAX_ZOOM,
		canvas: true,
	});

	mapCanvas.parentElement.addEventListener('wheel', zoomWithMouseWheel);
	mapCanvas.addEventListener('mousemove', updateCoordinates);
	mapCanvas.addEventListener('panzoomend', storeCoreRelativeOffset);
	mapCanvas.addEventListener('panzoomend', () => { MapMonitor.isPanning = false; });
	mapCanvas.addEventListener('panzoomstart', () => { MapMonitor.isPanning = true; });

	const menuheaders = document.querySelectorAll(".collapsable-menu");
	const mnuclick = function (event) {
		let menu_ul = document.getElementById(this.getAttribute("label-for"));
		const cssObj = window.getComputedStyle(menu_ul, null);

		let menu_visible = cssObj.getPropertyValue("display");
		//let menu_visible = menu_ul.style.display;
		menu_ul.style.display = (menu_visible == "none") ? "block" : "none";
	};
	for (let mnu of menuheaders) {
		if (mnu.innerHTML.trim() == "Clear") continue;
		mnu.onclick = mnuclick;
	}

	setFilterTop();

}, false);

function loadExample() {
	Alpine.store('data').isExampleMap = true;
	Alpine.store('data').mapLoaded = false;
	resetMap();
	loadStandardFile(tilelist, updatemap);
}

function resetMap() {
	tilelist = [];
	HIGHEST_STONE = 0;
	HIGHEST_WILDERNESS = 0;
	document.getElementById('showArcs').checked = false;
}

function setFilterTop() {
	let filterdiv = document.getElementById("tilefilter");
	let navdiv = document.getElementById("navdiv").getBoundingClientRect();
	filterdiv.style.top = navdiv.bottom;
}

function redrawDebounce(event) {
	event.target.setAttribute("disabled", "true");

	redrawMap();

	setTimeout(() => {
		event.target.removeAttribute("disabled");
	}, 10);
}

// ON CHANGE EVENTS

function onChangeInnerArc(event) {
	redrawMap();
}

function onChangeOuterArc(event) {
	redrawMap();
}

function onChangeRingTransparency(event) {
	redrawMap();
}

function onChangeBiomeTransparency(event) {
	redrawMap();
}

function onChangeGridTransparency(event) {
	redrawMap();
}
function onChangeTileTransparency(event) {
	redrawMapDirty();
}

function onChangeShowCustomRing(event) {
	redrawDebounce(event);
}

function onChangeCustomRing(event) {
	redrawMap();
}

function onChangeShowChunkGrid(event) {
	redrawDebounce(event);
}

function onChangeShowMobGrid(event) {
	redrawDebounce(event);
}

function onChangeShowMazeHoles(event) {
	event.target.setAttribute("disabled", "true");
	redrawMapDirty();
	setTimeout(() => {
		event.target.removeAttribute("disabled");
	}, 10);
}

function onChangeShowArcs(event) {
	const checked = event.target.checked;
	event.target.setAttribute("disabled", "true");

	if (checked) {
		const myImage = getCanvasPixelData();
		findStone(myImage.data, myImage.width);
		findWilderness(myImage.data, myImage.width);
	}

	redrawMap();

	setTimeout(() => {
		event.target.removeAttribute("disabled");
	}, 10);
}

function onChangeManualArcRotation(event) {
	const checked = event.target.checked;
	event.target.setAttribute("disabled", "true");

	if (checked && Alpine.store('data').arcSlidersPrefilled === false) {
		Alpine.store('data').innerSlider = Math.round(stoneArc.start * 180 / Math.PI);
		Alpine.store('data').outerSlider = Math.round(wildernessArc.start * 180 / Math.PI);

		if (Alpine.store('data').innerSlider !== 0 && Alpine.store('data').outerSlider !== 0)
			Alpine.store('data').arcSlidersPrefilled = true;
	}

	setTimeout(() => {
		redrawMap();
	}, 10)

	setTimeout(() => {
		event.target.removeAttribute("disabled");
	}, 10);
}

function toggleDarkMode() {
	const offcanvas = document.getElementById("offcanvas");
	const findMapGuide = document.getElementById("findMapGuide");

	const legendAccordion = document.getElementById("legendAccordion");
	const legendItems = document.querySelector("#legendAccordion .accordion-item");
	const legendButton = document.querySelector("#legendAccordion button");

	const logo = document.getElementById("logo");
	const favicon = document.getElementById("favicon");

	const body = document.getElementById("body");

	if (offcanvas.classList.contains("text-bg-dark")) {
		offcanvas.classList.remove("text-bg-dark");
		findMapGuide?.classList.remove("text-bg-dark");
		legendItems.classList.remove("text-bg-dark");
		legendButton.classList.remove("text-bg-dark");
		body.classList.remove("dark-mode");
		logo.src = "img/logo_light.png";
		favicon.href = "img/favicon_light.png";
	} else {
		offcanvas.classList.add("text-bg-dark");
		findMapGuide?.classList.add("text-bg-dark");
		legendItems.classList.add("text-bg-dark");
		legendButton.classList.add("text-bg-dark");
		body.classList.add("dark-mode");
		logo.src = "img/logo_dark.png";
		favicon.href = "img/favicon_dark.png";
	}
}