function buildDropdownMenu(name) {
	let menuid = (name + "-menu").toLowerCase();
	let div = document.createElement('div');
	let labelElem = document.createElement("label");
	labelElem.setAttribute("label-for", menuid);
	labelElem.classList.add("collapsable-menu");
	labelElem.appendChild(document.createTextNode(name));
	div.appendChild(labelElem);
	let menuElem = document.createElement("ul");
	menuElem.setAttribute("id", menuid);
	menuElem.classList.add("collapsable-menu-ul");
	div.appendChild(menuElem);
	return { root: div, menu: menuElem };
}

function buildTileCheckBox(tileType) {
	//  <label style='box-shadow:#{DIRT_WALL_COLOR_HERE} -25px 0px'><input type="checkbox" data-color-type='single' data-block-color='color identifier here'>Dirt Wall</label>
	let labelElem = document.createElement("label");
	labelElem.style.boxShadow = `rgb(${tileType.r},${tileType.g},${tileType.b}) -25px 0px`;
	let checkboxElem = document.createElement("input");
	checkboxElem.setAttribute("type", "checkbox");
	checkboxElem.setAttribute("data-color-type", "single");
	checkboxElem.setAttribute("data-block-id", `${tileType.id}`);
	checkboxElem.style.marginLeft = "4px";
	checkboxElem.style.marginRight = "4px";
	checkboxElem.onchange = () => {
		checkboxElem.setAttribute("disabled", "true");
		//toggleAllCheckboxes(tiletype.id, chkele.checked);
		redrawMap();
		setTimeout(() => {
			checkboxElem.removeAttribute("disabled");
		}, 10);
	};
	labelElem.appendChild(checkboxElem);
	labelElem.appendChild(document.createTextNode(tileType.name));
	labelElem.classList.add("checkbox");
	let liElem = document.createElement("li");
	liElem.style.paddingLeft = "30px"
	liElem.appendChild(labelElem);
	return liElem;
}


function toggleAllCheckboxes(id, state) {
	for (let chkbox of document.querySelectorAll('input[type="checkbox"][data-block-id="' + id + '"]')) {
		chkbox.checked = state;
	}
}
function clearAllHighlights() {
	for (let chkbox of document.querySelectorAll('input[type="checkbox"][data-block-id]')) {
		chkbox.checked = false;
	}
	redrawMap();
}

function isBoulder(tile) {
	return tile.name.toLowerCase().includes("boulder");
}

function _isBoulder(elem) {
	let parentMenu = elem.parentElement.parentElement.parentElement;
	return parentMenu.getAttribute("ID") == "boulder-menu";
}

function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

function buildHighlightSelection(search) {
	for (let tile of Alpine.store('tilecolormap').visible) {
		search.count++;
		filterObj = isBoulder(tile) ? search.boulders : search;

		if (!filterObj[tile.r]) {
			((filterObj[tile.r] = {})[tile.g] = {})[tile.b] = true;
		} else if (!filterObj[tile.r][tile.g]) {
			(filterObj[tile.r][tile.g] = {})[tile.b] = true;
		} else {
			filterObj[tile.r][tile.g][tile.b] = true;
		}
	}

	if (Alpine.store('data').showCustomHighlightColor) {
		search.count++;

		const customHighlightColor = Alpine.store("data").customHighlightColor;
		console.log("Highlighting: " + customHighlightColor);

		const customColorRGB = hexToRgb(customHighlightColor);
		console.log("In RGB: " + customColorRGB);

		if (!search[customColorRGB.r]) {
			((search[customColorRGB.r] = {})[customColorRGB.g] = {})[customColorRGB.b] = true;
		} else if (!search[customColorRGB.r][customColorRGB.g]) {
			(search[customColorRGB.r][customColorRGB.g] = {})[customColorRGB.b] = true;
		} else {
			search[customColorRGB.r][customColorRGB.g][customColorRGB.b] = true;
		}
	}
}

function _buildHighlightSelection(search) {
	let filterChecks = document.querySelectorAll('input[type="checkbox"][data-block-id]');
	var selected = [].filter.call(filterChecks, function (el) {
		return el.checked
	});
	let filterObj;
	for (let chkbox of selected) {
		search.count++;
		filterObj = isBoulder(chkbox) ? search.boulders : search;
		let tileType = tileColorMap[chkbox.getAttribute("data-block-id")];
		if (!filterObj[tileType.r]) {
			((filterObj[tileType.r] = {})[tileType.g] = {})[tileType.b] = true;
		} else if (!filterObj[tileType.r][tileType.g]) {
			(filterObj[tileType.r][tileType.g] = {})[tileType.b] = true;
		} else {
			filterObj[tileType.r][tileType.g][tileType.b] = true;
		}
	}
}

function buildSelectAll(items) {
	/*
	 *<ul class="nav nav-pills movement-nav">
		  <li><a href="#" onclick="changeZoom(0.1);"><i class="fas fa-search-plus"></i></a></li> 
	 */
	let ulElem = document.createElement("ul");
	ulElem.classList.add("nav");
	ulElem.classList.add("nav-pills");
	let liele = document.createElement("li");
	let linkElem = document.createElement("a");
	linkElem.setAttribute("href", "#");
	linkElem.onclick = () => {
		if (linkElem.classList.contains("active")) {
			linkElem.classList.remove("active");
		} else {
			linkElem.classList.add("active");
		}
		if (linkElem.classList.contains("active")) {

		}
	};
	linkElem.appendChild(document.createTextNode("Select All"));
}

function buildDropdownMenuItem(name, items) {
	let { root, menu } = buildDropdownMenu(name);

	for (let item of items) {
		menu.appendChild(buildTileCheckBox(item));
	}
	return root;
}

function buildTileMenu() {
	let mainMenu = document.getElementById("tilefilter");
	/*  
	{
	  "tilesetname": "Stone",
	  "type": "ground",
	  "name": "Caveling Floor Tile",
	  "r": "130",
	  "g": "130",
	  "b": "130"
	}
	*/
	let bySetName = {};
	let byTileType = {};
	let id = 0;
	for (let tileType of tileColorMap) {
		tileType.id = id++;
		if (!bySetName[tileType.tilesetname]) {
			bySetName[tileType.tilesetname] = [tileType];
		} else {
			bySetName[tileType.tilesetname].push(tileType);
		}
		if (!byTileType[tileType.type]) {
			byTileType[tileType.type] = [tileType];
		} else {
			byTileType[tileType.type].push(tileType);
		}
	}
	for (let setName in bySetName) {
		mainMenu.appendChild(buildDropdownMenuItem(setName, bySetName[setName]));
	}
	/*
	for (let tiletype in bytiletype) {
	  mainmenu.appendChild(buildDropdownMenuItem(tiletype[0].toUpperCase() + tiletype.substring(1), bytiletype[tiletype]));
	}*/
}

$('.dropdown-menu a').click(function (e) {
	e.stopPropagation();
});

$('.dropdown-menu input').click(function (e) {
	e.stopPropagation();
});