const pickerOptions = {
	types: [
		{
			description: 'Core Keeper Map',
			accept: {
				'application/gzip': ['.gzip']
			}
		},
	],
	excludeAcceptAllOption: true,
	multiple: false
};


const MapMonitor = {
	fileHandle: undefined,
	isPanning: false,
	lastModified: undefined,
	refreshMap: async function () {
		let file = await this.fileHandle.getFile();
		if (file.lastModified != MapMonitor.lastModified) {
			MapMonitor.lastModified = file.lastModified;
			let contents = await file.arrayBuffer();
			this.loadFile(contents, drawMap);
		} else {
			console.log(file.lastModified);
		}
	},

	loadFile: function (dataarr, callback) {
		let dataAsUint8Array = pako.inflate(dataarr);
		let dataAsJsonString = new TextDecoder().decode(dataAsUint8Array);
		let data = JSON.parse(dataAsJsonString);
		loadParts(0, [], data.mapParts, callback);
	},
	startMonitoring: function () {
		setInterval(() => {
			let shouldrefresh = document.getElementById("shouldrefresh").checked;
			if (shouldrefresh && !MapMonitor.isPanning) {
				MapMonitor.refreshMap();
			}
		}, 10000);
		this.refreshMap();
	}
}


function loadMapFileWithHandle(fileHandle) {
	const uploadButton = document.getElementById("uploadbutton");


	MapMonitor.fileHandle = fileHandle;
	uploadButton.value = fileHandle.name;
	MapMonitor.startMonitoring();

	Alpine.store('data').mapPickerShown = false;
}

// Method for loading map
async function registerMapFile() {
	Alpine.store('data').isExampleMap = false;
	Alpine.store('data').mapLoaded = false;
	resetMap();

	const uploadButton = document.getElementById("uploadbutton");

	// Destructure the one-element array.
	if (typeof window.showOpenFilePicker !== "undefined") {
		[fileHandle] = await window.showOpenFilePicker(pickerOptions);

		loadMapFileWithHandle(fileHandle);
	} else {
		const mapupload = document.getElementById("mapupload");
		mapupload.click();
	}

}