const overlayCanvas = document.getElementById("overlaycanvas");
const overlayCtx = overlayCanvas.getContext("2d");

let scale = 1;

let rectList = [];
let annulusList = [];
let circleList = [];

function resetOverlayLists() {
	rectList = [];
	annulusList = [];
	circleList = [];

	Alpine.store("pins", []);
}

overlayCtx.canvas.width = window.innerWidth;
overlayCtx.canvas.height = window.innerHeight;
addEventListener("resize", (event) => {
	overlayCtx.canvas.width = window.innerWidth;
	overlayCtx.canvas.height = window.innerHeight;
});

function drawOverlayPin(x, y, text) {
	Alpine.store("pins").push({ x, y, text });
}

function removeOverlayPin(i) {
	Alpine.store("pins").splice(i, 1);
}

function drawOverlayRect(x, y, w, h, color) {
	rectList.push({ x, y, w, h, color });
}

function drawOverlayArcs(innerRadius, outerRadius, startAngle, endAngle, color = "#FFFFFF", anticlockwise) {
	annulusList.push({ innerRadius, outerRadius, start: startAngle, end: endAngle, color, anticlockwise });
}

function drawOverlayAnnulus(radius, start, end, color = "#FFFFFF", anticlockwise) {
	annulusList.push({ innerRadius: radius - 10, outerRadius: radius + 10, start, end, color, anticlockwise });
}

function drawOverlayCircle(radius, color = "#FFFFFF") {
	circleList.push({ radius, color });
}

function _drawOverlayRect(x, y, w, h, color) {
	overlayCtx.fillStyle = color;
	overlayCtx.fillRect(x * scale, y * scale, w * scale, h * scale);
}

function _drawOverlayAnnulus(innerRadius, outerRadius, start, end, color = "#FFFFFF", anticlockwise) {
	overlayCtx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	overlayCtx.fillStyle = color;
	annulus(overlayCtx, 0, 0, innerRadius * scale, outerRadius * scale, start, end, anticlockwise);
	overlayCtx.globalAlpha = 1.0;
}

function _drawOverlayCircle(radius, color) {
	overlayCtx.fillStyle = color;
	overlayCtx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	overlayCtx.lineWidth = 20 * scale;
	overlayCtx.strokeStyle = color;
	overlayCtx.beginPath();
	overlayCtx.arc(0, 0, radius * scale, 0, 2 * Math.PI);
	overlayCtx.stroke();
	overlayCtx.globalAlpha = 1.0;
}

function _drawOverlayPin(x, y, text, color = "#000000") {
	overlayCtx.fillStyle = color;
	overlayCtx.beginPath();
	overlayCtx.arc(x * scale, y * scale, 5, 0, 2 * Math.PI);
	overlayCtx.fill();
	overlayCtx.fillStyle = "white";
	overlayCtx.strokeStyle = "black";
	overlayCtx.lineWidth = 1;
	overlayCtx.font = `bold 35px sans-serif`;
	overlayCtx.fillText(text, x * scale + 10, y * scale + 12);
	overlayCtx.strokeText(text, x * scale + 10, y * scale + 12);
}

function _drawOverlayPlayerRadius(x, y, radius, color = "#000000") {
	overlayCtx.fillStyle = color;
	overlayCtx.globalAlpha = Alpine.store('data').ringTransparency / 100;
	overlayCtx.lineWidth = 20 * scale;
	overlayCtx.strokeStyle = color;
	overlayCtx.beginPath();
	overlayCtx.arc(x * scale, y * scale, radius * scale, 0, 2 * Math.PI);
	overlayCtx.stroke();
	overlayCtx.globalAlpha = 1.0;

	_drawOverlayPin(x, y, "Player Pos", color);
}

function drawOverlay() {
	const offset = getCoreRelativeOffset();
	scale = panZoomElem.getScale();

	overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight)
	overlayCtx.translate(window.innerWidth / 2 - offset.x * scale, window.innerHeight / 2 - offset.y * scale)

	rectList.forEach(r => _drawOverlayRect(r.x, r.y, r.w, r.h, r.color));
	circleList.forEach(c => _drawOverlayCircle(c.radius, c.color));
	annulusList.forEach(a => _drawOverlayAnnulus(a.innerRadius, a.outerRadius, a.start, a.end, a.color, a.anticlockwise));

	Alpine.store("pins").forEach(p => _drawOverlayPin(p.x, p.y, p.text));

	if (Alpine.store("data").showPlayerRadius)
		_drawOverlayPlayerRadius(Alpine.store("player").posX, Alpine.store("player").posY, Alpine.store("player").radius, Alpine.store("player").color);

	overlayCtx.translate(-window.innerWidth / 2 + offset.x * scale, - window.innerHeight / 2 + offset.y * scale)

	if (Alpine.store('data').mapLoaded)
		requestAnimationFrame(drawOverlay);
}