/*
        <li class="dropdown">
          <a class="dropdown-toggle" data-toggle="dropdown" href="#">
            Dropdown
            <b class="caret"></b>
          </a>
          <ul class="dropdown-menu">
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </li>
*/

/*
<label label-for="stone-menu" class="collapsable-menu">Stone</label>
    <ul id="stone-menu" class="collapsable-menu-ul">
      <li style="padding-left: 30px;"><label class="checkbox" style="box-shadow: rgb(73, 103, 125) -25px 0px;"><input type="checkbox" data-color-type="single" data-block-id="18" style="margin-left: -14px;">Stone Wall</label></li>
      <li style="padding-left: 30px;"><label class="checkbox" style="box-shadow: rgb(103, 131, 151) -25px 0px;"><input type="checkbox" data-color-type="single" data-block-id="19" style="margin-left: -14px;">Stone Ground</label></li>
      <li style="padding-left: 30px;"><label class="checkbox" style="box-shadow: rgb(130, 155, 203) -25px 0px;"><input type="checkbox" data-color-type="single" data-block-id="20" style="margin-left: -14px;">Iron Ore</label></li>
      <li style="padding-left: 30px;"><label class="checkbox" style="box-shadow: rgb(130, 130, 130) -25px 0px;"><input type="checkbox" data-color-type="single" data-block-id="78" style="margin-left: -14px;">Caveling Floor Tile</label></li>
    </ul>
*/
function buildDropdownMenu(name) {
  let menuid = (name + "-menu").toLowerCase();
  let div = document.createElement('div');
  let labelele = document.createElement("label");
  labelele.setAttribute("label-for", menuid);
  labelele.classList.add("collapsable-menu");
  labelele.appendChild(document.createTextNode(name));
  div.appendChild(labelele);
  let elemenu = document.createElement("ul");
  elemenu.setAttribute("id", menuid);
  elemenu.classList.add("collapsable-menu-ul");
  div.appendChild(elemenu);
  return { root: div, menu: elemenu };
}

function buildTileCheckBox(tiletype) {
  //  <label style='box-shadow:#{DIRT_WALL_COLOR_HERE} -25px 0px'><input type="checkbox" data-color-type='single' data-block-color='color identifier here'>Dirt Wall</label>
  let labelele = document.createElement("label");
  labelele.style.boxShadow = `rgb(${tiletype.r},${tiletype.g},${tiletype.b}) -25px 0px`;
  let chkele = document.createElement("input");
  chkele.setAttribute("type", "checkbox");
  chkele.setAttribute("data-color-type", "single");
  chkele.setAttribute("data-block-id", `${tiletype.id}`);
  chkele.style.marginLeft = "-14px";
  chkele.onchange = () => {
    if (!togglelock) {
      toggleAllCheckboxes(tiletype.id, chkele.checked);
      redrawMap();
    }
  };
  labelele.appendChild(chkele);
  labelele.appendChild(document.createTextNode(tiletype.name));
  labelele.classList.add("checkbox");
  let liele = document.createElement("li");
  liele.style.paddingLeft = "30px"
  liele.appendChild(labelele);
  return liele;
}

let togglelock = false;

function toggleAllCheckboxes(id, state) {
  togglelock = true;
  for (let chkbox of document.querySelectorAll('input[type="checkbox"][data-block-id="' + id + '"]')) {
    chkbox.checked = state;
  }
  togglelock = false;
}
function clearAllHighlights() {
  togglelock = true;
  for (let chkbox of document.querySelectorAll('input[type="checkbox"][data-block-id]')) {
    chkbox.checked = false;
  }
  togglelock = false;
  redrawMap();
}

function buildHighlightSelection(search) {
  let filterchecks = document.querySelectorAll('input[type="checkbox"][data-block-id]');
  var selected = [].filter.call(filterchecks, function (el) {
    return el.checked
  });
  for (let chkbox of selected) {
    search.count++;
    let tiletype = tilecolormap[chkbox.getAttribute("data-block-id")];
    if (!search[tiletype.r]) {
      ((search[tiletype.r] = {})[tiletype.g] = {})[tiletype.b] = true;
    } else if (!search[tiletype.r][tiletype.g]) {
      (search[tiletype.r][tiletype.g] = {})[tiletype.b] = true;
    } else {
      search[tiletype.r][tiletype.g][tiletype.b] = true;
    }
  }
}

function buildSelectAll(items) {
  /*
   *<ul class="nav nav-pills movement-nav">
        <li><a href="#" onclick="changeZoom(0.1);"><i class="fas fa-search-plus"></i></a></li> 
   */
  let ulele = document.createElement("ul");
  ulele.classList.add("nav");
  ulele.classList.add("nav-pills");
  let liele = document.createElement("li");
  let aele = document.createElement("a");
  aele.setAttribute("href", "#");
  aele.onclick = () => {
    if (aele.classList.contains("active")) {
      aele.classList.remove("active");
    } else {
      aele.classList.add("active");
    }
    if (aele.classList.contains("active")) {

    }
  };
  aele.appendChild(document.createTextNode("Select All"));
}

function buildDropdownMenuItem(name, items) {
  let { root, menu } = buildDropdownMenu(name);

  for (let item of items) {
    menu.appendChild(buildTileCheckBox(item));
  }
  return root;
}

function buildTileMenu() {
  let mainmenu = document.getElementById("tilefilter");
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
  let bysetname = {};
  let bytiletype = {};
  let id = 0;
  for (let tiletype of tilecolormap) {
    tiletype.id = id++;
    if (!bysetname[tiletype.tilesetname]) {
      bysetname[tiletype.tilesetname] = [tiletype];
    } else {
      bysetname[tiletype.tilesetname].push(tiletype);
    }
    if (!bytiletype[tiletype.type]) {
      bytiletype[tiletype.type] = [tiletype];
    } else {
      bytiletype[tiletype.type].push(tiletype);
    }
  }
  for (let setname in bysetname) {
    mainmenu.appendChild(buildDropdownMenuItem(setname, bysetname[setname]));
  }
  /*
  for (let tiletype in bytiletype) {
    mainmenu.appendChild(buildDropdownMenuItem(tiletype[0].toUpperCase() + tiletype.substring(1), bytiletype[tiletype]));
  }*/
}
buildTileMenu();

$('.dropdown-menu a').click(function (e) {
  e.stopPropagation();
});

$('.dropdown-menu input').click(function (e) {
  e.stopPropagation();
});