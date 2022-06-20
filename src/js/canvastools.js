let currentZoom = 1
let MAX_ZOOM = 12;
let MIN_ZOOM = 0.1;
let _image_cache = undefined;
let cameraOffset = { x: 0, y: 0 }
let _global_ctx;
let coreloc = { x: 0, y: 0 };
let pixelmap = {};
let panzoomele;

function panImage(dx, dy) {
  cameraOffset.x += dx;
  cameraOffset.y += dy;
  panzoomele.pan(cameraOffset.x, cameraOffset.y);
}

function zoomWithMouseWheel(event) {
  const opts = {
    animate: false,
    step: 2.0,
  };
  const scale = panzoomele.getScale();
  const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
  const wheel = delta < 0 ? 1 : -1;
  let targetScale = scale * Math.exp((wheel * opts.step) / 3);
  if (targetScale >= MAX_ZOOM && delta > 0) {
    return;
  }
  else if (targetScale <= MIN_ZOOM && delta < 0) {
    return;
  }
  // Round zoom scales larger than 1 for pixel-perfect zoom-in
  if (targetScale > 1) {
    targetScale = Math.round(targetScale);
  }
  panzoomele.zoomToPoint(targetScale, event, opts);
  if (panzoomele.getScale() < 1.0) {
    document.getElementById("mapcanvas").style.imageRendering = "auto";
  } else {
    document.getElementById("mapcanvas").style.imageRendering = "pixelated";
  }
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
  const canvas = document.getElementById("mapcanvas");
  setContext(_global_ctx, canvas.width, canvas.height);
  _global_ctx.drawImage(_image_cache, 0, 0);
  decorateMap(canvas.width, canvas.height);
}

function decorateMap(width, height) {
  highlightSelected();
  if (document.getElementById("userradius").value.trim() != "") {
    let radius = parseFloat(document.getElementById("userradius").value.trim());
    drawCircle(_global_ctx, radius);
  }
  if (document.getElementById("bosscircle").classList.contains("active")) {
    drawBosses(_global_ctx, width, height);
  }
  if (document.getElementById("chunkgrid").classList.contains("active")) {
    drawGrid(_global_ctx, width, height);
  }
}

function drawGrid(ctx, width, height) {
  ctx.globalAlpha = 0.3;
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

let userdefinedTimeout = undefined;
function userDefinedChanged(){
  if(userdefinedTimeout == undefined){
    console.log('setting timeout');
    userdefinedTimeout = setTimeout(()=>{
      userdefinedTimeout = undefined;
      console.log('redrawing userdefined');
      redrawMap();
    }, 1000);
  }
}

function drawCircle(ctx, radius){
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 20;
  ctx.strokeStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(coreloc.x, coreloc.y, radius, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.globalAlpha = 1.0;
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


  _global_ctx.fillStyle = MAZE_HIGLIGHT;
  _global_ctx.beginPath();
  //ARC starts 0 at 3 oclock
  _global_ctx.arc(coreloc.x, coreloc.y, SEARCH_RADII.max, stoneArc.start - Math.PI / 2, stoneArc.end - Math.PI / 2);
  _global_ctx.fill();

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
      ctx.drawImage(tiles[i].image, px, py);
    }
  }
  _image_cache = new Image();
  _image_cache.src = canvas.toDataURL();
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
  let ele = document.getElementById("mazeholes");
  if (ele.classList.contains("active")) {
    findStone(myImage.data, canvas.width);
  }
  _global_ctx.putImageData(myImage, 0, 0);
}

function testPixel(width, myImageData, r, g, b, x, y) {
  let i = y * width + x;
  return (r == myImageData[i] && g == myImageData[i + 1] && b == myImageData[i + 2]);
}

function highlightPixel(width, myImageData, x, y) {
  let i = y * width + x;
  myImageData[i + 3] = 255;
}

function testBoulder(width, myImageData, r, g, b, x, y, x1, y1) {
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
  } else {
    let alpha = SliderInfo.transparency();
    let i = y * width + x;
    myImageData[i + 3] = alpha;
  }
}

function highlightBoulder(myImage, r, g, b, x, y) {
  const myImageData = myImage.data;
  let count = 0;

  //test top left
  count = 0;
  if (x > 0 && y > 0) {
    testBoulder(myImage.width, myImageData, r, g, b, x, y, x - 1, y - 1);
  }
  //test bottom left
  if (x > 0 && y < myImage.height) {
    testBoulder(myImage.width, myImageData, r, g, b, x, y, x - 1, y + 1);
  }
  //test bottom right
  if (x < myImage.width && y < myImage.height) {
    testBoulder(myImage.width, myImageData, r, g, b, x, y, x + 1, y + 1);
  }
  if (x < myImage.width && y > 0) {
    testBoulder(myImage.width, myImageData, r, g, b, x, y, x + 1, y - 1);
  }
}

function highlightColors(myImage, search) {
  const myImageData = myImage.data;
  let alpha = SliderInfo.transparency();
  for (let i = 0; i < myImageData.length; i += 4) {
    if (myImageData[i + 3] != 0) { //if not transparent
      let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
      if (search.boulders[r] && search.boulders[r][g] && search.boulders[r][g][b]) {
        let x = parseInt(i % myImage.width);
        let y = parseInt(i / myImage.width);
        highlightBoulder(myImage, r, g, b, x, y);
      } else if (search[r] && search[r][g] && search[r][g][b]) {
        myImageData[i + 3] = 255;
      } else {
        myImageData[i + 3] = alpha;
      }
    }
  }

}