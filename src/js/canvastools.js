let cameraZoom = 1
let MAX_ZOOM = 10
let MIN_ZOOM = 0.1
let _image_cache = undefined;
let cameraOffset = { x: 0, y: 0 }
let _global_ctx;
let coreloc = { x: 0, y: 0 };
let pixelmap = {};
let panzoomele;

function changeZoom(delta) {
  if (cameraZoom >= MAX_ZOOM && delta > 0) {
    return;
  }
  else if (cameraZoom <= MIN_ZOOM && delta < 0) {
    return;
  }
  if (cameraZoom < 1 || (cameraZoom === 1 && delta < 0)) {
    // Smaller steps for zooming out, otherwise we jump straight to 0
    delta /= 10;
  }
  cameraZoom += delta;
  // Cut off floating point errors
  cameraZoom = Math.round(cameraZoom * 100) / 100;
  panzoomele.zoom(cameraZoom, { animate: false });
  document.getElementById('zoomval').value = cameraZoom;
  if (cameraZoom < 1.0) {
    document.getElementById("mapcanvas").style.imageRendering = "auto";
  } else {
    document.getElementById("mapcanvas").style.imageRendering = "pixelated";
  }
  /*if (_image_cache !== undefined) {
    redrawMap();
  }*/
}
function panImage(dx, dy) {
  cameraOffset.x += dx;
  cameraOffset.y += dy;
  panzoomele.pan(cameraOffset.x, cameraOffset.y);
  /*
  cameraOffset.x = dx;
  cameraOffset.y = dy;
  if (_image_cache !== undefined) {
    redrawMap();
  }*/
}

function zoomWithMouseWheel(event) {
  const delta = event.deltaY > 0 ? -1 : 1;
  changeZoom(delta);
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
  /*ctx.translate(width / 2.0, height / 2.0);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(width / -2.0, height / -2.0);
  ctx.translate(cameraOffset.x, cameraOffset.y);
  cameraZoom = 1.0;
  cameraOffset.x = cameraOffset.y = 0;*/
}

function redrawMap() {
  const canvas = document.getElementById("mapcanvas");
  setContext(_global_ctx, canvas.width, canvas.height);
  _global_ctx.drawImage(_image_cache, 0, 0);
  decorateMap(canvas.width, canvas.height);
}

function decorateMap(width, height) {
  highlightSelected();
  if (document.getElementById("bosscircle").classList.contains("active")) {
    drawBosses(_global_ctx, width, height);
  }
}

function drawBosses(ctx, width, height) {

  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 20;

  //Ivy
  let radius = 900;
  ctx.strokeStyle = "#FF00FF";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Mold Dungeon
  radius = 750;
  ctx.strokeStyle = "#6cbbe0";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Azeos
  radius = 600;
  ctx.strokeStyle = "#3d9b41";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Malugaz the Corrupted
  radius = 350;
  ctx.strokeStyle = "#678397";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Hive Mother
  radius = 330;
  ctx.strokeStyle = "#fca694";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Ghorm
  radius = 250;
  ctx.strokeStyle = "#d95917";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  //Glurch
  radius = 65;
  ctx.strokeStyle = "#7f5f30";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  /*
  _global_ctx.fillStyle = MAZE_HIGLIGHT;
  _global_ctx.beginPath();
  //ARC starts 0 at 3 oclock
  _global_ctx.arc(coreloc.x, coreloc.y, SEARCH_RADII.max, stoneArc.start - Math.PI / 2, stoneArc.end - Math.PI / 2);
  _global_ctx.fill();*/

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
      //console.log(`(${tiles[i].key.x}, ${tiles[i].key.y}) = > (${px}, ${py})`);
      ctx.drawImage(tiles[i].image, px, py);
    }
  }
  _image_cache = new Image();
  _image_cache.src = canvas.toDataURL();
  //scanImage(pixelmap);
  decorateMap(canvas.width, canvas.height);
}

function scanImage(colormap) {
  const canvas = document.getElementById("mapcanvas");
  /* https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
    RGBA Order pixel info
    Uint8ClampedArray contains height × width × 4 bytes of data, with index values ranging from 0 to (height×width×4)-1.
  */
  const myImage = _global_ctx.getImageData(0, 0, canvas.width, canvas.height);
  const myImageData = myImage.data;
  //console.log(myImageData[0],myImageData[1],myImageData[2],myImageData[3]);
  console.log("Start", new Date());
  let count = 0;
  for (let i = 0; i < myImageData.length; i += 4) {
    if (myImageData[i + 3] != 0) { //if not transparent
      let x = parseInt(i % myImage.width);
      let y = parseInt(i / myImage.width);
      let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
      if (!colormap[r]) {
        colormap[r] = {};
      }
      if (!colormap[r][g]) {
        colormap[r][g] = {};
      }
      if (!colormap[r][g][b]) {
        colormap[r][g][b] = {
          pixels: {

          }
        }
      }
      if (!colormap[r][g][b].pixels[x]) {
        colormap[r][g][b].pixels[x] = {};
      }
      colormap[r][g][b].pixels[x][y] = true;
      ++count;
    }
  }
  console.log("End", count, new Date());
}

function highlightSelected() {
  let searchobj = { count: 0 };
  buildHighlightSelection(searchobj);
  const canvas = document.getElementById("mapcanvas");
  const myImage = _global_ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (searchobj.count > 0)
    highlightColors(myImage, searchobj);
  let ele = document.getElementById("mazeholes");
  if (ele.classList.contains("active")) {
    findStone(myImage.data, canvas.width);
  }
  _global_ctx.putImageData(myImage, 0, 0);
}

function highlightColors(myImage, search) {
  const myImageData = myImage.data;
  for (let i = 0; i < myImageData.length; i += 4) {
    if (myImageData[i + 3] != 0) { //if not transparent
      let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
      if (search[r] && search[r][g] && search[r][g][b]) {
        myImageData[i + 3] = 255;
      }
      else {
        myImageData[i + 3] = 30;
      }
    }
  }

}