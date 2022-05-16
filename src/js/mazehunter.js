const SEARCH_RADII = { min: 140, min2: 19600, max: 500, max2: 250000 };
const MAZE_HIGLIGHT = { 1: { r: 255, g: 0, b: 255 }, 2: { r: 0, g: 255, b: 255 }, 3: { r: 0, g: 255, b: 0 } };
const STONE_FILTER = { count: 0 };
const CLAY_FILTER = { count: 0 };
const stoneArc = { start: 0, end: 0 };
const arcticks = 1440.0;
const deltaRadians = (Math.PI * 2.0) / arcticks;

function averageAround(i, arr, width) {
  let sval = i - width;
  let eval = i + width;
  let dsum = 0;
  let dcount = 0;
  for (let i = sval; i <= eval; i++) {
    let idx = i % arr.length;
    if (idx < 0) idx = arr.length + idx;
    dsum += arr[idx];
    dcount++;
  }
  return dsum / dcount;
}

function countStoneClay(myImageData, width) {
  let prevx, prevy, x, y, i;
  let deltastone = [];
  for (let rad = 0; rad < arcticks; rad++) {
    let angle = rad * deltaRadians;
    let numstone = 0, numclay = 0;
    for (let radius = SEARCH_RADII.min; radius < SEARCH_RADII.max; radius++) {
      x = parseInt(radius * Math.sin(angle));
      y = parseInt(radius * Math.cos(angle));
      if (x != prevx || y != prevy) {
        prevx = x;
        prevy = y;
        x += coreloc.x;
        y = coreloc.y - y;
        i = (y * width + x) * 4;
        let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
        if (STONE_FILTER[r] && STONE_FILTER[r][g] && STONE_FILTER[r][g][b]) {
          ++numstone;
        } else if (CLAY_FILTER[r] && CLAY_FILTER[r][g] && CLAY_FILTER[r][g][b]) {
          ++numclay;
        }
      }
    }
    deltastone.push(numstone - numclay);
  }
  return deltastone;
}

function recordBiomeChange(rad, deltastone) {
  if (stoneArc.end === undefined && stoneArc.start === undefined) {
    let test = averageAround(rad + arcticks / 4, deltastone, 18);
    if (test < 0) {
      stoneArc.end = rad * deltaRadians;
      stoneArc.endticks = rad;
    } else {
      stoneArc.start = rad * deltaRadians;
      stoneArc.startticks = rad;
    }
  } else if (stoneArc.end === undefined) {
    stoneArc.end = rad * deltaRadians;
    stoneArc.endticks = rad;
    return true;
  } else {
    stoneArc.start = rad * deltaRadians;
    stoneArc.startticks = rad;
    return true;
  }
  return false;
}

function findStone(myImageData, width) {
  let deltastone = countStoneClay(myImageData, width);
  stoneArc.start = stoneArc.end = undefined;
  //change to:
  //  for every tick, sum the half arc, push it to a new array
  //  find the max value slot in the array, that is the start angle, add half of arcticks and that is the end angle
  let countwidth = arcticks / 2;
  let maxstone = { index: -1, count: 0 }, maxclay = { index: -1, count: 0 };
  let tally = 0;
  for (let rad = 0; rad < arcticks; ++rad) {
    tally = 0;
    for (let i = 0; i < countwidth; i++) {
      let idx = (i + rad) % arcticks;
      tally += deltastone[idx];
    }
    if (tally > maxstone.count) {
      maxstone.index = rad;
      maxstone.count = tally;
    }
    if (tally < maxclay.count) {
      maxclay.index = rad;
      maxclay.count = tally;
    }
  }
  stoneArc.startticks = maxstone.index;
  stoneArc.start = maxstone.index * deltaRadians;
  stoneArc.endticks = maxclay.index;
  stoneArc.end = maxclay.index * deltaRadians;
  findHole(myImageData, width);
}
function findHole(myImageData, width) {
  let visited = {};
  let prevx, prevy, x, y, i;
  let b = 0;
  let g = 0;
  let r = 0;

  for (let rad = stoneArc.startticks; rad < stoneArc.endticks; ++rad) {
    let angle = rad * deltaRadians;
    for (let radius = SEARCH_RADII.min; radius < SEARCH_RADII.max; radius++) {
      x = parseInt(radius * Math.sin(angle));
      y = parseInt(radius * Math.cos(angle));
      if (x != prevx || y != prevy) {
        prevx = x;
        prevy = y;
        x += coreloc.x;
        y = coreloc.y - y;
        if (hasVisited(visited, x, y)) {
          continue;
        }
        i = (y * width + x) * 4;
        let /*r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2],*/ a = myImageData[i + 3];
        if (a == 0) { //if transparent
          let hole = traverseHole(x, y, myImageData, width, visited);
          if (hole._fits > 0) {
            let holecolor = MAZE_HIGLIGHT[hole._fits];
            delete hole._fits;
            colorHole(myImageData, width, hole, holecolor);
          }
        }
      }
    }
    /*myImageData[i] = 255;
    myImageData[i + 2] = 255;
    myImageData[i + 3] = 255;*/
  }
}

function colorHole(myImageData, width, hole, color) {
  let i, yc, xc;
  for (let y in hole) {
    yc = parseInt(y);
    for (let x in hole[y]) {
      xc = parseInt(x);
      i = (yc * width + xc) * 4;
      myImageData[i] = color.r;
      myImageData[i + 1] = color.g;
      myImageData[i + 2] = color.b;
      myImageData[i + 3] = 255;
    }
  }
}


function hasVisited(visited, x, y) {
  if (!visited[y]) {
    visited[y] = {};
    return false;
  } else {
    return visited[y][x];
  }
}

function addToHole(hole, x, y) {
  if (!hole[y]) {
    hole[y] = {};
  }
  hole[y][x] = true;
  if (x < hole.minx) {
    hole.minx = x;
  } 
  if (x > hole.maxx) {
    hole.maxx = x;
  }
  if (y < hole.miny) {
    hole.miny = y;
  } 
  if (y > hole.maxy) {
    hole.maxy = y;
  }
}

function traverseHole(startx, starty, myImageData, width, visited) {
  let tovisit = [{ x: startx, y: starty }];
  let hole = {
    maxx: Number.NEGATIVE_INFINITY, maxy: Number.NEGATIVE_INFINITY,
    minx: Number.POSITIVE_INFINITY, miny: Number.POSITIVE_INFINITY,
    _fits: -1
  };
  let idx = 0;
  while (idx < tovisit.length) {
    let { x, y } = tovisit[idx];
    ++idx;
    i = (y * width + x) * 4;
    if (myImageData[i + 3] != 0) {//not a hole
      continue;
    }
    if (hasVisited(visited, x, y)) {//already visited
      continue;
    }
    let dcx = coreloc.x - x;
    let dcy = coreloc.y - y;
    let dist2 = (dcx * dcx) + (dcy * dcy);
    if (dist2 > SEARCH_RADII.max2 || dist2 < SEARCH_RADII.min2) {//outside search radius
      continue;
    }
    let ax = x - coreloc.x;
    let ay = coreloc.y - y;
    let angle = Math.atan2(ay, ax);
    //atan2 is starting 0 at 3 oclock, negative for down, positive for up
    //stoneArc starts 0 at 12 oclock, and runs positive clockwise
    //first realign to 12 oclock
    angle = Math.PI / 2 - angle;
    //then adjust from 0 -> 2pi clockwise
    if (angle < 0) {
      angle = Math.PI * 2 + angle;
    }
    //outside the stone biome
    if ((stoneArc.end < stoneArc.start && angle > stoneArc.end && angle < stoneArc.start) ||
      (angle < stoneArc.start || angle > stoneArc.end)) {
      continue;
    }
    visited[y][x] = true;
    addToHole(hole, x, y);
    //myImageData[i] = 255;
    //myImageData[i + 2] = 255;
    //myImageData[i + 3] = 255;
    tovisit.push({ x: x, y: y - 1 });
    tovisit.push({ x: x, y: y + 1 });
    tovisit.push({ x: x - 1, y });
    tovisit.push({ x: x + 1, y });
  }
  testHole(hole);
  return hole;
}
const SMALL_MAZE = { width: 20, height: 18, size: 1 };
const MEDIUM_MAZE = { width: 39, height: 39, size: 2 };
const LARGE_MAZE = { width: 51, height: 53, size: 3 };
const TEST_MAZES = [LARGE_MAZE, MEDIUM_MAZE, SMALL_MAZE];
function testHole(hole) {
  let holeWidth = hole.maxx - hole.minx;
  let holeHeight = hole.maxy - hole.miny;
  for (let test of TEST_MAZES) {
    //check if hole is big enough for maze
    if (holeWidth < test.width || holeHeight < test.height) {
      continue;
    }
    let validcols = 0;
    let startcol = 0;
    let fits = false;
    for (let y = hole.miny; !fits && y < hole.maxy; y++) {
      for (let x = hole.minx; !fits && x < hole.maxx; x++) {
        if (!hole[y][x]) {
          validcols = -1;
        } else if (validcols == 0) {
          startcol = x;
        } else if (validcols >= test.width) {
          fits = isBigEnough(hole, startcol, y, test);
        }
        validcols++;
      }
    }
    if (fits) {
      hole._fits = test.size;
      break;
    }
  }
  delete hole.minx;
  delete hole.maxx;
  delete hole.miny;
  delete hole.maxy;
}

function isBigEnough(hole, x, y, maze) {
  let endx = x + maze.width;
  let endy = y + maze.height;
  for (; y < endy; y++) {
    for (; x < endx; x++) {
      if (!hole[y][x]) {
        return false;
      }
    }
  }
  return true;
}

function findMazes() {
  //class="active"
  let ele = document.getElementById("mazeholes");
  if (ele.classList.contains("active")) {
    ele.classList.remove("active");
  } else {
    ele.classList.add("active");
  }
  redrawMap();
}

function buildStoneFilter() {
  for (let tiletype of tilecolormap) {
    let filterobj = undefined;

    if (tiletype.tilesetname == "Stone") {
      filterobj = STONE_FILTER;
    } else if (tiletype.tilesetname == "Clay") {
      filterobj = CLAY_FILTER;
    }
    if (filterobj) {
      filterobj.count++;
      if (!filterobj[tiletype.r]) {
        ((filterobj[tiletype.r] = {})[tiletype.g] = {})[tiletype.b] = true;
      } else if (!filterobj[tiletype.r][tiletype.g]) {
        (filterobj[tiletype.r][tiletype.g] = {})[tiletype.b] = true;
      } else {
        filterobj[tiletype.r][tiletype.g][tiletype.b] = true;
      }
    }
  }
}
buildStoneFilter();