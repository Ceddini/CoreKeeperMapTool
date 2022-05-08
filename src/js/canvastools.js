let cameraZoom = 1
let MAX_ZOOM = 5
let MIN_ZOOM = 0.1
let _image_cache = undefined;
let cameraOffset = { x: 0, y: 0 }
let _global_ctx;
let coreloc = { x: 0, y: 0 };

function changeZoom(delta) {
  cameraZoom = delta;
  if (_image_cache !== undefined) {
    redrawMap();
  }
}
function panImage(dx, dy) {
  cameraOffset.x = dx;
  cameraOffset.y = dy;
  if (_image_cache !== undefined) {
    redrawMap();
  }
}

function setContext(ctx, width, height) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2.0, height / 2.0);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(width / -2.0, height / -2.0);
  ctx.translate(cameraOffset.x, cameraOffset.y);
  cameraZoom = 1.0;
  cameraOffset.x = cameraOffset.y = 0;
}

function redrawMap() {
  const canvas = document.getElementById("mapcanvas");
  setContext(_global_ctx, canvas.width, canvas.height);
  _global_ctx.drawImage(_image_cache, 0, 0);
  if (document.getElementById("bosscircle").checked) {
    drawBosses(_global_ctx, canvas.width, canvas.height);
  }
}

function drawBosses(ctx, width, height) {
  
  let radius = 900;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 20;
  ctx.strokeStyle = "#FF00FF";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  radius = 750;
  ctx.strokeStyle = "#6cbbe0";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();  

  radius = 600;
  ctx.strokeStyle = "#3d9b41";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  radius = 350;
  ctx.strokeStyle = "#678397";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();
  
  radius = 330;
  ctx.strokeStyle = "#fca694";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  
  radius = 250;
  ctx.strokeStyle = "#d95917";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  
  radius = 65;
  ctx.strokeStyle = "#7f5f30";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();


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
  coreloc.x = -minx * TILE_SIZE;
  coreloc.y = (maxy + 1) * TILE_SIZE;
  const canvas = document.getElementById("mapcanvas");
  canvas.width = (maxx - minx + 1) * TILE_SIZE;
  canvas.height = (maxy - miny + 1) * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  _global_ctx = ctx;
  setContext(ctx, canvas.width, canvas.height);
  // Draw the image
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].image) {
      let px = (tiles[i].key.x - minx) * TILE_SIZE;
      let py = (maxy - tiles[i].key.y) * TILE_SIZE;
      console.log(`(${tiles[i].key.x}, ${tiles[i].key.y}) = > (${px}, ${py})`);
      ctx.drawImage(tiles[i].image, px, py);
    }
  }
  _image_cache = new Image();
  _image_cache.src = canvas.toDataURL();
  
  if (document.getElementById("bosscircle").checked) {
    drawBosses(_global_ctx, canvas.width, canvas.height);
  }
}