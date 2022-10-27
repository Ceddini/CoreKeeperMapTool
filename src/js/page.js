window.addEventListener('DOMContentLoaded', () => {
	const tilelist = [];
	const fileupload = document.getElementById("mapupload");
	const mapCanvas = document.getElementById("mapcanvas");
	const updatemap = () => { drawMap(tilelist) };
	fileupload.addEventListener('change', function handleFile(event) {
		loadMapFile(fileupload, tilelist, updatemap);
	});
	panzoomele = Panzoom(mapCanvas, {
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

	const ringSlider = document.getElementById("ringSlider");
	ringSlider.value = RingSliderInfo.value;
	ringSlider.onchange = ringOnChange;

	const tileSlider = document.getElementById("tileSlider");
	tileSlider.value = TileSliderInfo.value;
	tileSlider.onchange = tileOnChange;

	setFilterTop();

}, false);

function setFilterTop() {

	let filterdiv = document.getElementById("tilefilter");
	let navdiv = document.getElementById("navdiv").getBoundingClientRect();
	filterdiv.style.top = navdiv.bottom;
}

const TileSliderInfo = {
	value: 80,
	transparency: function () { return TileSliderInfo.value; }
}

const RingSliderInfo = {
	value: 80,
	transparency: function () { return RingSliderInfo.value / 100; }
}

function tileOnChange(event) {
	sliderOnChange(event, TileSliderInfo);
}

function ringOnChange(event) {
	sliderOnChange(event, RingSliderInfo);
}

function sliderOnChange(event, sliderInfo) {
	const val = event.target.value;

	sliderInfo.value = val;
	redrawMap();
}

function sliderUp(event, sliderInfo) {
	sliderInfo.down = false;
	let tempX = event.pageX;
	let tempY = event.pageY;
	if (tempX < 10) { tempX = 10; }
	if (tempY < 0) { tempY = 0; }
	redrawMap();
	//console.log(tempX, tempY, SliderInfo.x, SliderInfo.transparency());
}

function sliderDown(event, sliderInfo) {
	sliderInfo.down = true;
}
function sliderDrag(event, sliderInfo) {
	if (sliderInfo.down) {
		let tempX = event.pageX;
		if (tempX < 32) { tempX = 32; }
		if (tempX > 206) { tempX = 206; }
		sliderInfo.x = tempX - 20 - 12;
		sliderInfo.element.style.left = `${sliderInfo.x}px`;
	}
}

function toggleBosses() {
	let ele = document.querySelector("#bosscircle > a");

	const bossesLegend = document.getElementById('bosses-legend');

	if (ele.classList.contains("active")) {
		ele.classList.remove("active");
		bossesLegend.classList.add("d-none");

	} else {
		ele.classList.add("active");
		bossesLegend.classList.remove("d-none");
	}
	redrawMap();
}

function toggleSea() {
	let ele = document.querySelector("#seacircle > a");
	if (ele.classList.contains("active")) {
		ele.classList.remove("active");
	} else {
		ele.classList.add("active");
	}
	redrawMap();
}


function toggleChunkGrid() {
	let ele = document.querySelector("#chunkgrid > a");
	if (ele.classList.contains("active")) {
		ele.classList.remove("active");
	} else {
		ele.classList.add("active");
	}
	redrawMap();
}


function toggleMobGrid() {
	let ele = document.querySelector("#mobgrid > a");
	if (ele.classList.contains("active")) {
		ele.classList.remove("active");
	} else {
		ele.classList.add("active");
	}
	redrawMap();
}

function toggleDirections() {
	let ele = document.getElementById("directions");
	if (ele.style.display == "none") {
		ele.style.display = "block"
		document.querySelector(".highlight-container").style.top = "260px";
	} else {
		ele.style.display = "none";
		document.querySelector(".highlight-container").style.top = "150px";
	}
	setFilterTop();
}


function toggleDarkMode() {
	const offcanvas = document.getElementById("offcanvas");
	// const offcanvasRight = document.getElementById("offcanvasRight");

	const legendAccordion = document.getElementById("legendAccordion");
	const legendItems = document.querySelector("#legendAccordion .accordion-item");
	const legendButton = document.querySelector("#legendAccordion button");

	if (offcanvas.classList.contains("text-bg-dark")) {
		// ele.style.backgroundColor = "white";
		offcanvas.classList.remove("text-bg-dark");
		// offcanvasRight.classList.remove("text-bg-dark");
		legendItems.classList.remove("text-bg-dark");
		legendButton.classList.remove("text-bg-dark");
	} else {
		// ele.style.backgroundColor = "black";
		offcanvas.classList.add("text-bg-dark");
		// offcanvasRight.classList.add("text-bg-dark");
		legendItems.classList.add("text-bg-dark");
		legendButton.classList.add("text-bg-dark");
	}
}