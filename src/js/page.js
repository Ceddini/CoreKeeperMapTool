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

  const slider = document.querySelector(".transparency-knob");
  slider.onmousedown = sliderDown;
  slider.onmouseup = sliderUp;
  slider.onmousemove = sliderDrag;
  SliderInfo.element = slider;

}, false);

const SliderInfo = {
  element: undefined,
  minx: 0,
  maxx: 174,
  down: false,
  x: 20, y: 0,
  transparency: function () { return parseInt((SliderInfo.x / 174) * 255); }
}

function sliderUp(event) {
  SliderInfo.down = false;
  let tempX = event.pageX;
  let tempY = event.pageY;
  if (tempX < 10) { tempX = 10; }
  if (tempY < 0) { tempY = 0; }
  redrawMap();
  //console.log(tempX, tempY, SliderInfo.x, SliderInfo.transparency());
}

function sliderDown(event) {
  SliderInfo.down = true;
}
function sliderDrag(event) {
  if (SliderInfo.down) {
    let tempX = event.pageX;
    if (tempX < 32) { tempX = 32; }
    if (tempX > 206) { tempX = 206; }
    SliderInfo.x = tempX - 20 - 12;
    SliderInfo.element.style.left = `${SliderInfo.x}px`;
  }
}

function toggleBosses() {
  //class="active"
  let ele = document.getElementById("bosscircle");
  if (ele.classList.contains("active")) {
    ele.classList.remove("active");
  } else {
    ele.classList.add("active");
  }
  redrawMap();
}
function toggleGrid() {
  //class="active"
  let ele = document.getElementById("chunkgrid");
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
}

function toggleDarkMode() {
  let ele = document.body;
  let toggleele = document.getElementById("darkmodeui");
  if (ele.style.backgroundColor == "white") {
    ele.style.backgroundColor = "black";
    toggleele.style.boxShadow = "#0088cc -15px 0px";
  } else {
    ele.style.backgroundColor = "white";
    toggleele.style.boxShadow = "rgb(220,220,220) -15px 0px";
  }
}