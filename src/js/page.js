window.addEventListener('DOMContentLoaded', () => {
  const tilelist = [];
  const fileupload = document.getElementById("mapupload");
  const mapCanvas = document.getElementById("mapcanvas");
  const updatemap = () => { drawMap(tilelist) };
  fileupload.addEventListener('change', function handleFile(event) {
    loadMapFile(fileupload, tilelist, updatemap);
  });
  panzoomele = Panzoom(mapCanvas, {
    maxScale: MAX_ZOOM
  });
  mapCanvas.addEventListener('wheel', zoomWithMouseWheel);
}, false);

function toggleBosses(){
  //class="active"
  let ele = document.getElementById("bosscircle");
  if(ele.classList.contains("active")){
    ele.classList.remove("active");
  } else {
    ele.classList.add("active");
  }
  redrawMap();
}

function toggleDirections(){
  let ele = document.getElementById("directions");
  if(ele.style.display == "none"){
    ele.style.display = "block"
  } else {
    ele.style.display = "none";
  }
}

function toggleDarkMode(){
  let ele = document.body;
  let toggleele = document.getElementById("darkmodeui");
  if(ele.style.backgroundColor == "white"){
    ele.style.backgroundColor = "black";
    toggleele.style.boxShadow = "#0088cc -15px 0px";
  } else {
    ele.style.backgroundColor = "white";
    toggleele.style.boxShadow = "rgb(220,220,220) -15px 0px";
  }
}