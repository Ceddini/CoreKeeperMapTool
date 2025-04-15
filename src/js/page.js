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

	Alpine.store("pins", []);

	Alpine.store('player', {
		posX: 0,
		posY: 0,
		radius: 208,
		color: "#000000"
	})


	Alpine.store('data', {
		// Loaded from savehandler.js
		tutorialShown: loadSetting("tutorialShown"),
		acceptedAdTracking: loadSetting("acceptedAdTracking"),
		acceptedAnalytics: loadSetting("acceptedAnalytics"),
		savedCookies: loadSetting("savedCookies"),

		mapLoaded: false,
		firstTimeLoaded: false,
		faqOpen: true,
		aboutOpen: true,
		cookiesOpen: !loadSetting("savedCookies"),
		isExampleMap: false,
		canWatchFile,

		mapPickerShown: false, // TODO: RESET TO TRUE TO ENABLE
		directoryHandle: null,

		arcSlidersPrefilled: false,

		showPlayerRadius: false,

		showArcs: false,
		showChunkGrid: false,
		showMobGrid: false,
		showCustomRing: false,
		showSmallMazeHoles: false,
		showMediumMazeHoles: false,
		showLargeMazeHoles: false,
		manualArcRotation: false,
		cropRingsToBiome: true,

		showCustomHighlightColor: false,
		customHighlightColor: "#FF0000",

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
	mousePosElem = document.getElementById("mouse-position");

	mapCanvas.parentElement.addEventListener('wheel', zoomWithMouseWheel);
	mapCanvas.addEventListener('mousemove', updateCoordinates);
	mapCanvas.addEventListener('mousemove', updateMousePos);
	mapCanvas.addEventListener('panzoomend', storeCoreRelativeOffset);
	mapCanvas.addEventListener('panzoomend', () => { MapMonitor.isPanning = false; });
	mapCanvas.addEventListener('panzoomstart', () => { MapMonitor.isPanning = true; });
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
	redrawMap();
}

function onChangeCropRingsToBiome(event) {
	redrawDebounce(event);
}

function onChangeShowCustomHighlightColor(event) {
	redrawDebounce(event);
}

function onChangeShowCustomRing(event) {
	redrawDebounce(event);
}

function onChangeShowPlayerRadius(event) {

}

function onChangeCustomRing(event) {
	redrawMap();
}

function onChangePlayerRadius(event) {

}

function onChangeShowChunkGrid(event) {
	redrawDebounce(event);
}

function onChangeShowMobGrid(event) {
	redrawDebounce(event);
}

function onChangeShowMazeHoles(event) {
	redrawDebounce(event);
}

function onChangeShowArcs(event) {
	const checked = event.target.checked;
	event.target.setAttribute("disabled", "true");

	if (checked) {
		const canvas = document.getElementById("mapcanvas");
		const myImage = _global_ctx.getImageData(0, 0, canvas.width, canvas.height);
		findStone(myImage.data, canvas.width);
		findWilderness(myImage.data, canvas.width);
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

function openColorPicker() {
	const eyeDropper = new EyeDropper();
	const abortController = new AbortController();

	eyeDropper.open({ signal: abortController.signal }).then((result) => {
		// console.log(result.);
		// const temp = result.sRGBHex.split("(")[1].split(")")[0].split(", ");

		// const hex = "#" + temp.map(function (x) {
		//	x = parseInt(x).toString(16);
		//	return (x.length == 1) ? "0" + x : x;
		//}).join("");

		Alpine.store('data').customHighlightColor = result.sRGBHex;

	}).catch((e) => {
		console.log(e);
	});
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