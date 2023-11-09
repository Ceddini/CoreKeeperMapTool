//https://mzhub.github.io/ckmap/

function loadParts(i, gridarr, mapParts, callback) {
	console.log(mapParts)
	if (i >= mapParts.keys.length) {
		return callback(gridarr);
	}
	if (mapParts.values[i] == undefined || mapParts.values[i].png == undefined) {
		return loadParts(i + 1, gridarr, mapParts, callback);
	}
	let imgobj = new Image();
	const pngAsUint8Array = new Uint8Array(mapParts.values[i].png);
	const pngAsBlob = new Blob([pngAsUint8Array], { 'type': 'image/png' });
	imgobj.onload = function () {
		gridarr.push({
			key: mapParts.keys[i],
			image: imgobj
		});
		loadParts(i + 1, gridarr, mapParts, callback);
	};
	imgobj.src = URL.createObjectURL(pngAsBlob);
}

function loadSingleFile(i, files, gridarr, callback) {
	if (i >= files.length) {
		return callback();
	}
	const file = files[i];
	const reader = new FileReader();
	reader.onload = function handleData(event) {
		const dataAsUint8Array = pako.inflate(event.target.result);
		const dataAsJsonString = new TextDecoder().decode(dataAsUint8Array);
		const data = JSON.parse(dataAsJsonString);
		loadParts(0, gridarr, data.mapParts, () => {
			loadSingleFile(i + 1, files, gridarr, callback);
		});
	};
	reader.readAsArrayBuffer(file);
}

function loadMapFile(fileInput, gridarr, callback) {
	loadSingleFile(0, fileInput.files, gridarr, callback);
}

async function loadStandardFile(gridarr, callback) {
	const response = await fetch("https://maptool-dev.ceschmitt.de/data/preview_map/1.mapparts.gzip")
		.then((response) => response.blob())
		.then((blob) => {
			loadSingleFile(0, [blob], gridarr, callback);
		});
}

function downloadMap(canvas) {
	const { x, y } = getCoreOffset();

	shouldDrawOnOverlay = false;
	redrawMap();

	const link = document.createElement('a');
	link.download = 'corekeeper_map.png';
	link.href = canvas.toDataURL()
	link.click();
	link.remove();

	shouldDrawOnOverlay = true;
	redrawMap();
}