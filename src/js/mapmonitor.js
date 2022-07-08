const MapMonitor = {
  fileHandle: undefined,
  refreshMap: async function (){
    console.log("refreshing map...");
    const file = await fileHandle.getFile();
    let contents = await file.arrayBuffer();
    const tilelist = [];
    const updatemap = () => { drawMap(tilelist) };
    this.loadFile(contents, tilelist, updatemap);
  },
  loadFile: function(dataarr, gridarr, callback){
    const dataAsUint8Array = pako.inflate(dataarr);
    const dataAsJsonString = new TextDecoder().decode(dataAsUint8Array);
    const data = JSON.parse(dataAsJsonString);
    loadParts(0, gridarr, data.mapParts, callback);
  },
  startMonitoring: function(){
    setInterval(()=>{
      MapMonitor.refreshMap();
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