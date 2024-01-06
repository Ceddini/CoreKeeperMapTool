// include { buildHighlightSelection } from "./menubuilder.js";

let currentZoom = 1
let MAX_ZOOM = 12;
let MIN_ZOOM = 0.1;
let _image_cache = undefined;
let _image_pixelData = null;
let _decorated_pixelData = null;
let cameraOffset = { x: 0, y: 0 };
let previousCoreRelativeOffset = undefined;
let _global_ctx;
let coreLoc = { x: 0, y: 0 };
let pixelMap = {};
let panZoomElem;

function getCanvasPixelData()
{
	if(!_image_pixelData)
	{
		_image_pixelData = _global_ctx.getImageData(0, 0, canvas.width, canvas.height);
		return _image_pixelData; 
	}
	const cloneData = new Uint8ClampedArray(_image_pixelData.data);
	const clone = new ImageData(cloneData, _image_pixelData.width, _image_pixelData.height);
	return clone;
}

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
	panZoomElem.pan(x, y);
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
	const mapCanvas = document.getElementById('mapcanvas');
	if (panZoomElem.getScale() < 1.0) {
		mapCanvas.style.imageRendering = "auto";
	} else {
		mapCanvas.style.imageRendering = "pixelated";
	}
	storeCoreRelativeOffset();
}
function updateCoordinates(event) {
	let tempX = event.pageX;
	let tempY = event.pageY;
	if (tempX < 0) { tempX = 0; }
	if (tempY < 0) { tempY = 0; }
}

function setContext(ctx, width, height) {
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, width, height);
}

function redrawMap() {
	const mapCanvas = document.getElementById('mapcanvas');
	setContext(_global_ctx, mapCanvas.width, mapCanvas.height);
	_global_ctx.putImageData(_decorated_pixelData, 0, 0);
	decorateMap(mapCanvas.width, mapCanvas.height);
}

function redrawMapDirty() {
	const mapCanvas = document.getElementById('mapcanvas');
	setContext(_global_ctx, mapCanvas.width, mapCanvas.height);
	_global_ctx.drawImage(_image_cache, 0, 0);
	highlightSelected();
	decorateMap(mapCanvas.width, mapCanvas.height);
}

function loop(val, min, max) {
	return (val >= min && val <= max) ? val : ((val < max) ? max - Math.abs(val) % max + 1 : min + Math.abs(val) % 10 - 1);
}

function decorateMap(width, height) {
	const showArcsCheckbox = document.getElementById("showArcs");

	if (showArcsCheckbox.checked) {
		const manualArcRotation = Alpine.store('data').manualArcRotation;

		const innerStart = (manualArcRotation) ? document.getElementById('innerArcSlider').value * Math.PI / 180 : stoneArc.start;
		const innerEnd = (manualArcRotation) ? loop(document.getElementById('innerArcSlider').value - 180, 0, 359) * Math.PI / 180 : stoneArc.end;

		drawArcs(_global_ctx, innerStart, innerEnd);

		const outerStart = (manualArcRotation) ? document.getElementById('outerArcSlider').value * Math.PI / 180 : wildernessArc.start;
		const outerEnd = (manualArcRotation) ? loop(document.getElementById('outerArcSlider').value - 120, 0, 359) * Math.PI / 180 : wildernessArc.end;

		drawOuterArcs(_global_ctx, outerStart, outerEnd);
	}

	if (Alpine.store('data').showCustomRing) {
		drawCircle(_global_ctx, Alpine.store('data').customRing);
	}

	if (Alpine.store('data').mapLoaded) {
		Alpine.store('categories').forEach(category => {
			category.items.forEach(circle => {
				if (circle.visible)
					circle.radii.forEach(radius => {
						drawCircle(_global_ctx, radius, circle.color);
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

function drawCircle(ctx, radius, color = "#FFFFFF") {
	ctx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	ctx.lineWidth = 20;
	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.arc(coreLoc.x, coreLoc.y, radius, 0, 2 * Math.PI);
	ctx.stroke();
	ctx.globalAlpha = 1.0;
}

function annulus(centerX, centerY,
	innerRadius, outerRadius,
	startAngle, endAngle,
	anticlockwise) {
	var th1 = startAngle;
	var th2 = endAngle;
	var startOfOuterArcX = outerRadius * Math.cos(th2) + centerX;
	var startOfOuterArcY = outerRadius * Math.sin(th2) + centerY;

	_global_ctx.beginPath();
	_global_ctx.arc(centerX, centerY, innerRadius, th1, th2, anticlockwise);
	_global_ctx.lineTo(startOfOuterArcX, startOfOuterArcY);
	_global_ctx.arc(centerX, centerY, outerRadius, th2, th1, !anticlockwise);
	_global_ctx.fill();
	_global_ctx.closePath();
}

function drawArcs(ctx, start, end) {
	ctx.globalAlpha = Alpine.store('data').biomeTransparency / 100;

	start = start + (2.5 * Math.PI / 180);
	end = end - (2.5 * Math.PI / 180);

	//ARC starts 0 at 3 oclock
	_global_ctx.fillStyle = "#C2C2C2";
	annulus(coreLoc.x, coreLoc.y, 150, SEARCH_RADII.max - 50, start - Math.PI / 2, end - Math.PI / 2);

	// _global_ctx.beginPath();
	// _global_ctx.arc(coreLoc.x, coreLoc.y, SEARCH_RADII.max - 50, start - Math.PI / 2, end - Math.PI / 2);
	// _global_ctx.fill();

	_global_ctx.fillStyle = "#A66829";
	annulus(coreLoc.x, coreLoc.y, 150, SEARCH_RADII.max - 50, start + Math.PI / 2, end + Math.PI / 2);

	// _global_ctx.beginPath();
	// _global_ctx.arc(coreLoc.x, coreLoc.y, SEARCH_RADII.max - 50, start + Math.PI / 2, end + Math.PI / 2);
	// _global_ctx.fill();

	ctx.globalAlpha = 1.0;
}

function drawOuterArcs(ctx, start, end) {
	ctx.globalAlpha = Alpine.store('data').biomeTransparency / 100;

	_global_ctx.fillStyle = "#3B7EDB";
	annulus(coreLoc.x, coreLoc.y, OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180), end - Math.PI / 2 + (2.25 * Math.PI / 180), true);

	_global_ctx.fillStyle = "#2B941B";
	annulus(coreLoc.x, coreLoc.y, OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3), true);

	_global_ctx.fillStyle = "#CFC35D";
	annulus(coreLoc.x, coreLoc.y, OUTER_SEARCH_RADII.min + 20, OUTER_SEARCH_RADII.max + 700, start - Math.PI / 2 - (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, end - Math.PI / 2 + (2.25 * Math.PI / 180) + ((2 * Math.PI) / 3) * 2, true);

	// _global_ctx.beginPath();
	//_global_ctx.arc(coreLoc.x, coreLoc.y, OUTER_SEARCH_RADII.max, wildernessArc.start - Math.PI / 2, wildernessArc.end - Math.PI / 2, true);
	//_global_ctx.lineTo()
	//_global_ctx.arc(coreLoc.x, coreLoc.y, SEARCH_RADII.max, wildernessArc.start - Math.PI / 2, wildernessArc.end - Math.PI / 2, false);
	// _global_ctx.fill();
	ctx.globalAlpha = 1.0;
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
	const canvas = document.getElementById('mapcanvas');
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
	// cache original image
	_image_cache = new Image();
	_image_cache.src = canvas.toDataURL();
	_image_pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	_decorated_pixelData = _image_pixelData;

	if (previousCoreRelativeOffset) {
		panToPreviousCoreRelativeOffset();
	}
	else {
		panToCore();
	}

	Alpine.store('data').mapLoaded = true;
	Alpine.store('data').firstTimeLoaded = true;
	highlightSelected();
	decorateMap(canvas.width, canvas.height);
}

function highlightSelected() {
	_decorated_pixelData = getCanvasPixelData();

	const filters = buildHighlightSelection();
	if(filters) highlightColors(_decorated_pixelData, filters);

	if (Alpine.store('data').showMazeHoles) {
		findHole(_decorated_pixelData.data, _decorated_pixelData.width);
	}
	_global_ctx.putImageData(_decorated_pixelData, 0, 0);
}

function recenterMap() {
	panZoomElem.zoom(1, { animate: true });
	panToCore();
}

function highlightColors(imageData, {normal, boulders})
{
	const {data:pixelArray, width} = imageData;
	const alpha = Alpine.store('data').tileTransparency / 100 * 255;
	const length = pixelArray.length;

	for (let i = 0; i < length; i += 4) {
		if (pixelArray[i + 3] === 0) continue;
		const r = pixelArray[i], g = pixelArray[i+1], b = pixelArray[i+2];
		pixelArray[i + 3] = normal.isMatch(r,g,b) ? 255 : alpha;
		if(boulders.isMatch(r,g,b)) highlightBoulders(imageData, i);
	}
}

function checkBoulders(imageData, x, y)
{
	const {data:pixelArray, width, height} = imageData;
	function getHexCode(x, y)
	{
		const i = (y*width + x)*4;
		return pixelArray[i] << 16 + pixelArray[i+1] << 8 + pixelArray[i+2];
	}

	if(x-1 >= width || y-1 >= height) return false;
	const baseHex = getHexCode(x, y);
	if(getHexCode(x+1, y) !== baseHex || getHexCode(x, y+1) !== baseHex || getHexCode(x+1, y+1) !== baseHex) return false;
	return true;
}

function highlightBoulders(imageData, i)
{
	const {data:pixelArray, width, height} = imageData;
	const x = (i/4) % width;
	const y = Math.floor((i/4) / width);

	if(!checkBoulders(imageData, x, y)) return;
	for(let dx=0; dx<2; dx++)
	{
		for(let dy=0; dy<2; dy++)
		{
			let index = ((y+dy)*width + x+dx)*4 + 3;
			pixelArray[index] = 255
		}
	}
}