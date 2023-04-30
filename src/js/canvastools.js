let currentZoom = 1
let MAX_ZOOM = 12;
let MIN_ZOOM = 0.1;
let _image_cache = undefined;
let cameraOffset = { x: 0, y: 0 }
let previousCoreRelativeOffset = undefined;
let _global_ctx;
let coreLoc = { x: 0, y: 0 };
let pixelMap = {};
let panZoomElem;
let mousePosElem;

let shouldDrawOnOverlay = true;


const STONE_ARC_START_OFFSET = Math.PI / 2;
const STONE_ARC_END_OFFSET = Math.PI / 2;

const CLAY_ARC_START_OFFSET = -Math.PI / 2;
const CLAY_ARC_END_OFFSET = -Math.PI / 2;

const DESERT_ARC_START_OFFSET = Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3);
const DESERT_ARC_END_OFFSET = Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3);

const WILDERNESS_ARC_START_OFFSET = Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2;
const WILDERNESS_ARC_END_OFFSET = Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2;

const SUNKENSEA_ARC_START_OFFSET = Math.PI / 2 + (2.25 * Math.PI / 180);
const SUNKENSEA_ARC_END_OFFSET = Math.PI / 2 - (2.25 * Math.PI / 180);

function panImage(dx, dy) {
	cameraOffset.x += dx;
	cameraOffset.y += dy;
	panZoomElem.pan(cameraOffset.x, cameraOffset.y);
}

function getCoreOffset() {
	const boundingRect = document.querySelector('.canvas-container').getBoundingClientRect();
	const mapCanvas = document.getElementById('mapcanvas');
	const scale = panZoomElem.getScale();
	// Panzoom forces transform-origin: center, which needs to be accounted for
	const originOffsetX = (mapCanvas.width / 2) - (mapCanvas.width * scale / 2);
	const originOffsetY = (mapCanvas.height / 2) - (mapCanvas.height * scale / 2);
	// Panzoom sets transform: scale(n) translate(x, y); which scales the x and y.
	// Calculate the core location as if it was scaled, then account for the transform scaling by dividing by scale.
	const x = ((boundingRect.width / 2) - (coreLoc.x * scale) - originOffsetX) / scale;
	const y = ((boundingRect.height / 2) - (coreLoc.y * scale) - originOffsetY) / scale;
	return { x, y };
}

function panToCore() {
	const { x, y } = getCoreOffset();
	xOffset = (document.getElementById("offcanvas").classList.contains("show")) ? 200 : 0;
	panZoomElem.pan(x + xOffset, y);
}

function panToPreviousCoreRelativeOffset() {
	const { x: coreOffsetX, y: coreOffsetY } = getCoreOffset();
	const { x: relativeOffsetX, y: relativeOffsetY } = previousCoreRelativeOffset;
	const x = coreOffsetX - relativeOffsetX;
	const y = coreOffsetY - relativeOffsetY;
	panZoomElem.pan(x, y);
}

function getCoreRelativeOffset() {
	const { x: coreOffsetX, y: coreOffsetY } = getCoreOffset();
	const { x: currentOffsetX, y: currentOffsetY } = panZoomElem.getPan();
	const relativeOffsetX = coreOffsetX - currentOffsetX;
	const relativeOffsetY = coreOffsetY - currentOffsetY;
	return {
		x: relativeOffsetX,
		y: relativeOffsetY,
	};
}

function storeCoreRelativeOffset() {
	previousCoreRelativeOffset = getCoreRelativeOffset();
}

function zoomWithMouseWheel(event) {
	const opts = {
		animate: false,
		step: 1,
	};
	// const scale = panZoomElem.getScale();
	// const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
	// const wheel = delta < 0 ? 1 : -1;
	// let targetScale = scale * Math.exp((wheel * opts.step) / 3);
	// console.log(targetScale);
	// console.log(delta);

	// console.log(targetScale >= MAX_ZOOM);
	// console.log(targetScale <= MIN_ZOOM);

	// if (targetScale >= MAX_ZOOM && delta > 0) {
	// 	return;
	// }
	// else if (targetScale <= MIN_ZOOM && delta < 0) {
	// 	return;
	// }
	// // Round zoom scales larger than 1 for pixel-perfect zoom-in
	// if (targetScale > 1) {
	// 	targetScale = Math.round(targetScale * 10) / 10;
	// 	console.log(targetScale);
	// }

	const scale = panZoomElem.getScale();
	const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
	let targetScale = scale;

	if (delta < 0) {
		if (scale >= 8)
			targetScale = scale + 2;
		else if (scale >= 1)
			targetScale = scale + 1;
		else
			targetScale = scale + 0.1;
	} else {
		if (scale > 8)
			targetScale = scale - 2;
		else if (scale > 1)
			targetScale = scale - 1;
		else
			targetScale = scale - 0.1;
	}


	panZoomElem.zoomToPoint(targetScale, event, opts);
	if (panZoomElem.getScale() < 1.0) {
		document.getElementById("mapcanvas").style.imageRendering = "auto";
	} else {
		document.getElementById("mapcanvas").style.imageRendering = "pixelated";
	}
	storeCoreRelativeOffset();
}
function updateCoordinates(event) {
	let tempX = event.pageX;
	let tempY = event.pageY;
	if (tempX < 0) { tempX = 0; }
	if (tempY < 0) { tempY = 0; }
}


let mouseTilePos = { x: 0, y: 0 };

function updateMousePos(event) {
	if (Alpine.store("data").mapLoaded === false) return;

	const mouseX = event.pageX - (window.innerWidth / 2);
	const mouseY = event.pageY - (window.innerHeight / 2);

	const { x, y } = getCoreRelativeOffset();

	let posX = Math.round(mouseX / panZoomElem.getScale() + x);
	let posY = Math.round(mouseY / panZoomElem.getScale() + y);

	mouseTilePos.x = posX;
	mouseTilePos.y = posY;

	let distance = Math.round(Math.sqrt((posX * posX) + (posY * posY)));

	mousePosElem.innerHTML = `X: ${posX}, Y: ${-posY}<br>Distance: ${distance}`;
}

function drawExamplePin() {
	drawOverlayPin(0, 0, "Spawn location");
}

function setContext(ctx, width, height) {
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, width, height);
}

function redrawMap() {
	const canvas = document.getElementById("mapcanvas");
	setContext(_global_ctx, canvas.width, canvas.height);
	_global_ctx.drawImage(_image_cache, 0, 0);
	// Reset overlays
	resetOverlayLists();
	decorateMap(canvas.width, canvas.height);
}

function loop(val, min, max) {
	return (val >= min && val <= max) ? val : ((val < max) ? max - Math.abs(val) % max + 1 : min + Math.abs(val) % 10 - 1);
}

function decorateMap(width, height) {
	highlightSelected();

	const showArcs = document.getElementById("showArcs")?.checked;
	const cropRingsToBiome = Alpine.store('data').cropRingsToBiome;
	const manualArcRotation = Alpine.store('data').manualArcRotation;

	if (showArcs) {
		const innerStart = (manualArcRotation) ? document.getElementById('innerArcSlider').value * Math.PI / 180 : stoneArc.start;
		const innerEnd = (manualArcRotation) ? loop(document.getElementById('innerArcSlider').value - 180, 0, 359) * Math.PI / 180 : stoneArc.end;

		drawArcs(innerStart, innerEnd);

		const outerStart = (manualArcRotation) ? document.getElementById('outerArcSlider').value * Math.PI / 180 : wildernessArc.start;
		const outerEnd = (manualArcRotation) ? loop(document.getElementById('outerArcSlider').value - 120, 0, 359) * Math.PI / 180 : wildernessArc.end;

		drawOuterArcs(outerStart, outerEnd);
	}

	if (Alpine.store('data').showCustomRing) {
		if (shouldDrawOnOverlay)
			drawOverlayCircle(parseInt(Alpine.store('data').customRing));
		else
			drawCircle(parseInt(Alpine.store('data').customRing))
	}

	if (Alpine.store('data').mapLoaded) {
		Alpine.store('categories').forEach(category => {
			category.items.forEach(circle => {
				if (circle.visible)
					circle.radii.forEach(radius => {
						if (cropRingsToBiome) {
							let hasBeenCropped = false;

							circle.locations.forEach(location => {
								if (location.ring) {
									if (location.ring === RINGS.CLAY || location.ring === RINGS.STONE) {
										const start = (manualArcRotation) ? document.getElementById('innerArcSlider').value * Math.PI / 180 : stoneArc.start;
										const end = (manualArcRotation) ? loop(document.getElementById('innerArcSlider').value - 180, 0, 359) * Math.PI / 180 : stoneArc.end;

										let startOffset = endOffset = 0;
										switch (location.ring) {
											case RINGS.CLAY:
												startOffset = CLAY_ARC_START_OFFSET;
												endOffset = CLAY_ARC_END_OFFSET;
												break;
											case RINGS.STONE:
												startOffset = STONE_ARC_START_OFFSET;
												endOffset = STONE_ARC_END_OFFSET;
												break;
										}

										drawOverlayAnnulus(radius, start + (2.5 * Math.PI / 180) - startOffset, end - (2.5 * Math.PI / 180) - endOffset, circle.color, false);
										hasBeenCropped = true;
									} else {
										const start = (manualArcRotation) ? document.getElementById('outerArcSlider').value * Math.PI / 180 : wildernessArc.start;
										const end = (manualArcRotation) ? loop(document.getElementById('outerArcSlider').value - 120, 0, 359) * Math.PI / 180 : wildernessArc.end;

										let startOffset = endOffset = 0;
										switch (location.ring) {
											case RINGS.SUNKENSEA:
												startOffset = SUNKENSEA_ARC_START_OFFSET;
												endOffset = SUNKENSEA_ARC_END_OFFSET;
												break;
											case RINGS.WILDERNESS:
												startOffset = WILDERNESS_ARC_START_OFFSET;
												endOffset = WILDERNESS_ARC_END_OFFSET;
												break;
											case RINGS.DESERT:
												startOffset = DESERT_ARC_START_OFFSET;
												endOffset = DESERT_ARC_END_OFFSET;
												break;
										}
										drawOverlayAnnulus(radius, start - startOffset, end - endOffset, circle.color, true);
										hasBeenCropped = true;
									}
								}
							});

							if (hasBeenCropped === false)
								if (shouldDrawOnOverlay)
									drawOverlayCircle(radius, circle.color);
								else
									drawCircle(radius, circle.color);
						} else {
							if (shouldDrawOnOverlay)
								drawOverlayCircle(radius, circle.color);
							else
								drawCircle(radius, circle.color);
						}
					});
			});
		});
	}

	if (Alpine.store('data').showChunkGrid) {
		drawChunkGrid(_global_ctx, width, height);
	}

	if (Alpine.store('data').showMobGrid) {
		drawMobGrid(_global_ctx, width, height);
	}
}

function drawChunkGrid(ctx, width, height) {
	ctx.globalAlpha = Alpine.store('data').gridTransparency / 100;

	ctx.lineWidth = 3;
	ctx.strokeStyle = "#AAAAAA";
	const gridsize = 64;
	let x = 0;
	while (x <= width) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
		x += gridsize;
	}
	let y = 0;
	while (y <= height) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
		y += gridsize;
	}
	ctx.globalAlpha = 1.0;
}

function drawMobGrid(ctx, width, height) {
	ctx.globalAlpha = Alpine.store('data').gridTransparency / 100;

	ctx.lineWidth = 1;
	ctx.strokeStyle = "#CCCCCC";
	const gridsize = 16;
	let x = 0;
	while (x <= width) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
		x += gridsize;
	}
	let y = 0;
	while (y <= height) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
		y += gridsize;
	}
	ctx.globalAlpha = 1.0;
}

let userdefinedTimeout = undefined;
function userDefinedChanged() {
	if (userdefinedTimeout == undefined) {
		console.log('setting timeout');
		userdefinedTimeout = setTimeout(() => {
			userdefinedTimeout = undefined;
			console.log('redrawing userdefined');
			redrawMap();
		}, 1000);
	}
}

function drawCircle(radius, color = "#FFFFFF") {
	_global_ctx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	_global_ctx.lineWidth = 20;
	_global_ctx.strokeStyle = color;
	_global_ctx.beginPath();
	_global_ctx.arc(coreLoc.x, coreLoc.y, radius, 0, 2 * Math.PI);
	_global_ctx.stroke();
	_global_ctx.globalAlpha = 1.0;
}

function drawAnnulus(ctx, radius, start, end, color = "#FFFFFF") {
	ctx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	ctx.fillStyle = color;
	annulus(ctx, coreLoc.x, coreLoc.y, radius - 10, radius + 10, start, end, true);
	ctx.globalAlpha = 1.0;
}

function annulus(ctx, centerX, centerY,
	innerRadius, outerRadius,
	startAngle, endAngle,
	anticlockwise) {
	var th1 = startAngle;
	var th2 = endAngle;
	var startOfOuterArcX = outerRadius * Math.cos(th2) + centerX;
	var startOfOuterArcY = outerRadius * Math.sin(th2) + centerY;

	ctx.beginPath();
	ctx.arc(centerX, centerY, innerRadius, th1, th2, anticlockwise);
	ctx.lineTo(startOfOuterArcX, startOfOuterArcY);
	ctx.arc(centerX, centerY, outerRadius, th2, th1, !anticlockwise);
	ctx.fill();
	ctx.closePath();
}

function drawArcs(start, end) {
	start = start + (2.5 * Math.PI / 180);
	end = end - (2.5 * Math.PI / 180);

	if (shouldDrawOnOverlay) {
		drawOverlayArcs(150, SEARCH_RADII.max - 50, start - STONE_ARC_START_OFFSET, end - STONE_ARC_END_OFFSET, "#C2C2C2", false);
		drawOverlayArcs(150, SEARCH_RADII.max - 50, start - CLAY_ARC_START_OFFSET, end - CLAY_ARC_END_OFFSET, "#A66829", false);
	} else {
		drawArc(150, SEARCH_RADII.max - 50, start - STONE_ARC_START_OFFSET, end - STONE_ARC_END_OFFSET, "#C2C2C2");
		drawArc(150, SEARCH_RADII.max - 50, start - CLAY_ARC_START_OFFSET, end - CLAY_ARC_END_OFFSET, "#A66829");
	}
}

function drawOuterArcs(start, end) {
	if (shouldDrawOnOverlay) {
		drawOverlayArcs(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180), end - Math.PI / 2 + (2.25 * Math.PI / 180), "#3B7EDB", true)
		drawOverlayArcs(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), "#2B941B", true);
		drawOverlayArcs(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, "#CFC35D", true);
	} else {
		drawArc(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180), end - Math.PI / 2 + (2.25 * Math.PI / 180), "#3B7EDB")
		drawArc(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), "#2B941B");
		drawArc(OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, "#CFC35D");
	}
}

function drawArc(innerRadius, outerRadius, start, end, color = "#FFFFFF", anticlockwise = true) {
	_global_ctx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	_global_ctx.fillStyle = color;
	annulus(_global_ctx, coreLoc.x, coreLoc.y, innerRadius * scale, outerRadius * scale, start, end, anticlockwise);
	_global_ctx.globalAlpha = 1.0;
}

function drawMap(tiles) {
	const TILE_SIZE = 256;
	let minx = Number.POSITIVE_INFINITY;
	let miny = Number.POSITIVE_INFINITY;
	let maxx = Number.NEGATIVE_INFINITY;
	let maxy = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < tiles.length; i++) {
		let key = tiles[i].key;
		if (minx > key.x) minx = key.x;
		if (miny > key.y) miny = key.y;
		if (maxx < key.x) maxx = key.x;
		if (maxy < key.y) maxy = key.y;
	}
	coreLoc.x = -minx * TILE_SIZE;
	coreLoc.y = (maxy + 1) * TILE_SIZE;
	const canvas = document.getElementById("mapcanvas");
	canvas.width = (maxx - minx + 1) * TILE_SIZE;
	canvas.height = (maxy - miny + 1) * TILE_SIZE;
	// const ctx = canvas.getContext('2d', { willReadFrequently: true });
	const ctx = canvas.getContext('2d');
	_global_ctx = ctx;
	setContext(_global_ctx, canvas.width, canvas.height);
	// Draw the image
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i].image) {
			let px = (tiles[i].key.x - minx) * TILE_SIZE;
			let py = (maxy - tiles[i].key.y) * TILE_SIZE;
			_global_ctx.drawImage(tiles[i].image, px, py);
		}
	}
	_image_cache = new Image();
	_image_cache.src = canvas.toDataURL();

	if (previousCoreRelativeOffset) {
		panToPreviousCoreRelativeOffset();
	}
	else {
		panToCore();
	}

	if (Alpine.store("data").mapLoaded === false) {
		panZoomElem.zoom(1, { animate: true });
		resetOverlayLists();
		panToCore();
		Alpine.store('data').mapLoaded = true;
		drawOverlay();
	}

	if (Alpine.store("data").firstTimeLoaded === false) {
		Alpine.store("data").faqOpen = false;
		Alpine.store("data").aboutOpen = false;
		Alpine.store("data").cookiesOpen = false;
	}
	Alpine.store("data").firstTimeLoaded = true;

	decorateMap(canvas.width, canvas.height);
}

function highlightSelected() {
	let searchobj = { count: 0, boulders: {} };

	buildHighlightSelection(searchobj);

	const canvas = document.getElementById("mapcanvas");
	const myImage = _global_ctx.getImageData(0, 0, canvas.width, canvas.height);

	if (searchobj.count > 0) {
		highlightColors(myImage, searchobj);
	}

	if (Alpine.store("data").showMazeHoles || Alpine.store("data").cropRingsToBiome) {
		findStone(myImage.data, canvas.width);

		if (Alpine.store("data").cropRingsToBiome) {
			findWilderness(myImage.data, canvas.width);
		}
	}
	_global_ctx.putImageData(myImage, 0, 0);
}

function recenterMap() {
	panZoomElem.zoom(1, { animate: true });
	panToCore();
}

function testPixel(width, myImageData, r, g, b, x, y) {
	let i = (y * width + x) * 4;
	let r1 = myImageData[i], g1 = myImageData[i + 1], b1 = myImageData[i + 2];

	return (r == r1 && g == g1 && b == b1);
}

function highlightPixel(width, myImageData, x, y) {
	let i = (y * width + x) * 4;
	myImageData[i + 3] = 255;
}

function testBoulder(width, myImageData, r, g, b, x, y, x1, y1) {
	let i = (y * width + x) * 4;
	let count = 0;
	if (testPixel(width, myImageData, r, g, b, x1, y1)) {
		count++;
	}
	if (testPixel(width, myImageData, r, g, b, x, y1)) {
		count++;
	}
	if (testPixel(width, myImageData, r, g, b, x1, y)) {
		count++;
	}
	if (count == 3) {
		highlightPixel(width, myImageData, x1, y1);
		highlightPixel(width, myImageData, x, y1);
		highlightPixel(width, myImageData, x1, y);
		highlightPixel(width, myImageData, x, y);
	} else if (myImageData[i + 3] != 255) {
		let alpha = Alpine.store('data').tileTransparency / 100 * 255;
		myImageData[i + 3] = alpha;
	}
}

function highlightBoulder(myImage, r, g, b, x, y) {
	const myImageData = myImage.data;
	let count = 0;

	count = 0;
	/*if (x > 0 &&  y > 0) {
	  testBoulder(myImage.width, myImageData, r, g, b, x, y, x - 1, y - 1);
	}
	//test bottom left
	if (x > 0 && y < myImage.height) {
	  testBoulder(myImage.width, myImageData, r, g, b, x, y, x - 1, y + 1);
	}*/
	//test bottom right
	if (x < myImage.width && y < myImage.height) {
		testBoulder(myImage.width, myImageData, r, g, b, x, y, x + 1, y + 1);
	}/*
  if (x < myImage.width && y > 0) {
    testBoulder(myImage.width, myImageData, r, g, b, x, y, x + 1, y - 1);
  }*/
}

function highlightColors(myImage, search) {
	const myImageData = myImage.data;
	let alpha = Alpine.store('data').tileTransparency / 100 * 255;

	for (let i = 0; i < myImageData.length; i += 4) {
		if (myImageData[i + 3] != 0) { //if not transparent
			let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
			if (search[r] && search[r][g] && search[r][g][b]) {
				myImageData[i + 3] = 255;
			} else {
				myImageData[i + 3] = alpha;
			}
		}
	}
	for (let i = 0, p = 0; i < myImageData.length; i += 4, ++p) {
		if (myImageData[i + 3] != 0) { //if not transparent

			let x = parseInt(p % myImage.width);
			let y = parseInt(p / myImage.width);
			let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
			if (search.boulders[r] && search.boulders[r][g] && search.boulders[r][g][b]) {
				highlightBoulder(myImage, r, g, b, x, y);
			}
		}
	}
}

function _highlightColors(myImage, search) {
	const myImageData = myImage.data;
	let alpha = Math.max(TileSliderInfo.transparency(), 1);

	for (let i = 0; i < myImageData.length; i += 4) {
		if (myImageData[i + 3] != 0) { //if not transparent
			let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
			if (search[r] && search[r][g] && search[r][g][b]) {
				myImageData[i + 3] = 255;
			} else {
				myImageData[i + 3] = alpha;
			}
		}
	}
	for (let i = 0, p = 0; i < myImageData.length; i += 4, ++p) {
		if (myImageData[i + 3] != 0) { //if not transparent

			let x = parseInt(p % myImage.width);
			let y = parseInt(p / myImage.width);
			let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
			if (search.boulders[r] && search.boulders[r][g] && search.boulders[r][g][b]) {
				highlightBoulder(myImage, r, g, b, x, y);
			}
		}
	}
}