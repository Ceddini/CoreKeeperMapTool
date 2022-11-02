let directoryHandle = localStorage.getItem("mapDirectoryHandle");
let tutorialShown = localStorage.getItem("tutorialShown");

function saveDirectoryHandle(dirHandle) {
	localStorage.setItem("mapDirectoryHandle", dirHandle);
	directoryHandle = dirHandle;
}

function dismissTutorial() {
	tutorialShown = true;
	localStorage.setItem("tutorialShown", true);
}

function openTutorial() {
	tutorialShown = false;
	localStorage.setItem("tutorialShown", false);
}