window.addEventListener('DOMContentLoaded', () => {
  function setTerrainSelect(){
    const selTerrain = document.getElementById("highlighttype");
    /*
      {
    "index": "3",
    "tileset": "0",
    "tilesetname": "Dirt",
    "type": "ground",
    "name": "Dirt Ground",
    "r": "127",
    "g": "95",
    "b": "48"
  },
    */
    var option = document.createElement("option");
    option.text = `None`;
    option.value = ``;
    selTerrain.add(option);
    for(let row of tilecolormap){
      option = document.createElement("option");
      option.text = `${row.tilesetname} - ${row.name}`;
      option.value = `${row.r},${row.g},${row.b}`;
      selTerrain.add(option);
    }
  }

  setTerrainSelect();
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
  panzoomele = Panzoom(document.getElementById("mapcanvas"), {
    maxScale: 5
  });
}, false);