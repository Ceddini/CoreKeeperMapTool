window.addEventListener('DOMContentLoaded', () => {
  const tilelist = [];
  const fileupload = document.getElementById("mapupload");
  const updatemap = () => { drawMap(tilelist) };
  fileupload.addEventListener('change', function handleFile(event) {
    loadMapFile(fileupload, tilelist, updatemap);
  });
  const savemap = document.getElementById("savemap");
  savemap.addEventListener('click', ()=>{
    downloadMap(document.getElementById("mapcanvas"));
  });
}, false);