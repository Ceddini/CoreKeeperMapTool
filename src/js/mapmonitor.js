const MapMonitor = {
  fileHandle: undefined,
  isPanning: false,
  lastModified: undefined,
  refreshMap: async function (){
    let file = await fileHandle.getFile();
    if(file.lastModified != MapMonitor.lastModified) {
      MapMonitor.lastModified = file.lastModified;
      let contents = await file.arrayBuffer();
      this.loadFile(contents, drawMap);
    } else {
      console.log(file.lastModified);
    }
  },
  loadFile: function(dataarr, callback){
    let dataAsUint8Array = pako.inflate(dataarr);
    let dataAsJsonString = new TextDecoder().decode(dataAsUint8Array);
    let data = JSON.parse(dataAsJsonString);
    loadParts(0, [], data.mapParts, callback);
  },
  startMonitoring: function(){
    setInterval(()=>{
      let shouldrefresh = document.getElementById("shouldrefresh").value;
      if(shouldrefresh && !MapMonitor.isPanning) {
        MapMonitor.refreshMap();
      }
    }, 10000);
    MapMonitor.refreshMap();
  }
}

async function registerMapFile(){
  // Destructure the one-element array.
  [fileHandle] = await window.showOpenFilePicker();
  MapMonitor.fileHandle = fileHandle;
  MapMonitor.startMonitoring();
}