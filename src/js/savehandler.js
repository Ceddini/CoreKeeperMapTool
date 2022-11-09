let tutorialShown = false;

let temp = localStorage.getItem("tutorialShown").toLowerCase();

if (temp === "true" || temp === "false")
	tutorialShown = JSON.parse(temp);


async function openDirectoryHandle() {
	const dirHandle = await window.showDirectoryPicker();
	Alpine.store("data").directoryHandle = dirHandle;
}

async function loadDirectoryList() {
	const dirHandle = Alpine.store("data").directoryHandle;
	let fileHandles = [];

	console.log(dirHandle);

	for await (let handle of dirHandle.values()) {
		if (handle.kind === "file" && handle.name.endsWith(".gzip")) {
			fileHandles.push(handle);
		}
	}

	Alpine.store('directoryList', fileHandles);
}

function showTutorial() {
	introJs().setOptions({
		steps: [
			{
				title: "Load map file",
				intro: "Click here to the select the map file.",
				element: document.getElementById("uploadbutton")
			}
		]
	}).start();
}

function dismissTutorial() {
	Alpine.store("data").tutorialShown = true;
	localStorage.setItem("tutorialShown", true);
}

function openTutorial() {
	Alpine.store("data").tutorialShown = false;
	localStorage.setItem("tutorialShown", false);
}