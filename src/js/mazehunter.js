const SEARCH_RADII = { min: 140, min2: 19600, max: 500, max2: 250000 };
const OUTER_SEARCH_RADII = { min: 500, max: 800 }
const MAZE_HIGLIGHT = { 1: { r: 255, g: 0, b: 255 }, 2: { r: 0, g: 255, b: 255 }, 3: { r: 0, g: 255, b: 0 } };
const STONE_FILTER = { count: 0 };
const CLAY_FILTER = { count: 0 };

const WILDERNESS_FILTER = { count: 0 };
const SUNKENSEA_FILTER = { count: 0 };

const stoneArc = { start: 0, end: 0 };
const wildernessArc = { start: 0, end: 0 };

const arcticks = 1440.0;
const deltaRadians = (Math.PI * 2.0) / arcticks;

let HIGHEST_STONE = 0;
let HIGHEST_WILDERNESS = 0;

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
	let prevX, prevY, x, y, i;
	let deltaStone = [];
	for (let rad = 0; rad < arcticks; rad++) {
		let angle = rad * deltaRadians;
		let numStone = 0, numClay = 0;
		for (let radius = SEARCH_RADII.min; radius < SEARCH_RADII.max; radius++) {
			x = parseInt(radius * Math.sin(angle));
			y = parseInt(radius * Math.cos(angle));
			if (x != prevX || y != prevY) {
				prevX = x;
				prevY = y;
				x += coreLoc.x;
				y = coreLoc.y - y;
				i = (y * width + x) * 4;
				let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
				if (STONE_FILTER[r] && STONE_FILTER[r][g] && STONE_FILTER[r][g][b]) {
					++numStone;
				} else if (CLAY_FILTER[r] && CLAY_FILTER[r][g] && CLAY_FILTER[r][g][b]) {
					++numClay;
				}
			}
		}
		deltaStone.push(numStone - numClay);
	}
	return deltaStone;
}

function countWildernessSunkenSea(myImageData, width) {
	let prevX, prevY, x, y, i;
	let deltaWilderness = [];
	for (let rad = 0; rad < arcticks; rad++) {
		let angle = rad * deltaRadians;
		let numWilderness = 0, numSunkenSea = 0;
		for (let radius = OUTER_SEARCH_RADII.min; radius < OUTER_SEARCH_RADII.max; radius++) {
			x = parseInt(radius * Math.sin(angle));
			y = parseInt(radius * Math.cos(angle));
			if (x != prevX || y != prevY) {
				prevX = x;
				prevY = y;
				x += coreLoc.x;
				y = coreLoc.y - y;
				i = (y * width + x) * 4;
				let r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2];
				if (WILDERNESS_FILTER[r] && WILDERNESS_FILTER[r][g] && WILDERNESS_FILTER[r][g][b]) {
					++numWilderness;
				} else if (SUNKENSEA_FILTER[r] && SUNKENSEA_FILTER[r][g] && SUNKENSEA_FILTER[r][g][b]) {
					++numSunkenSea;
				}
			}
		}
		deltaWilderness.push(numWilderness - numSunkenSea);
	}
	return deltaWilderness;
}

function recordBiomeChange(rad, deltastone) {
	if (stoneArc.end === undefined && stoneArc.start === undefined) {
		let test = averageAround(rad + arcticks / 4, deltastone, 18);
		if (test < 0) {
			stoneArc.end = rad * deltaRadians;
			stoneArc.endTicks = rad;
		} else {
			stoneArc.start = rad * deltaRadians;
			stoneArc.startTicks = rad;
		}
	} else if (stoneArc.end === undefined) {
		stoneArc.end = rad * deltaRadians;
		stoneArc.endTicks = rad;
		return true;
	} else {
		stoneArc.start = rad * deltaRadians;
		stoneArc.startTicks = rad;
		return true;
	}
	return false;
}

function findStone(myImageData, width) {
	let deltaStone = countStoneClay(myImageData, width);
	stoneArc.start = stoneArc.end = undefined;
	//change to:
	//  for every tick, sum the half arc, push it to a new array
	//  find the max value slot in the array, that is the start angle, add half of arcticks and that is the end angle
	let countWidth = arcticks / 2;
	let maxStone = { index: -1, count: 0 }, maxClay = { index: -1, count: 0 };
	let tally = 0;
	for (let rad = 0; rad < arcticks; ++rad) {
		tally = 0;
		for (let i = 0; i < countWidth; i++) {
			let idx = (i + rad) % arcticks;
			tally += deltaStone[idx];
		}
		if (tally > maxStone.count) {
			maxStone.index = rad;
			maxStone.count = tally;
		}
		if (tally < maxClay.count) {
			maxClay.index = rad;
			maxClay.count = tally;
		}
	}

	HIGHEST_STONE = maxStone.count > maxClay.count * -1 ? maxStone.count : maxClay.count * -1;

	stoneArc.startTicks = maxStone.index;
	stoneArc.start = maxStone.index * deltaRadians;
	stoneArc.endTicks = maxClay.index;
	stoneArc.end = maxClay.index * deltaRadians;

	if (Alpine.store("data").showSmallMazeHoles || Alpine.store("data").showMediumMazeHoles || Alpine.store("data").showLargeMazeHoles)
		findHole(myImageData, width);
}

function findWilderness(myImageData, width) {
	let deltaWilderness = countWildernessSunkenSea(myImageData, width);
	wildernessArc.start = wildernessArc.end = undefined;
	//change to:
	//  for every tick, sum the half arc, push it to a new array
	//  find the max value slot in the array, that is the start angle, add half of arcticks and that is the end angle
	let countWidth = arcticks / 2;
	let maxWilderness = { index: -1, count: 0 }, maxSunkenSea = { index: -1, count: 0 };
	let tally = 0;
	for (let rad = 0; rad < arcticks; ++rad) {
		tally = 0;
		for (let i = 0; i < countWidth; i++) {
			let idx = (i + rad) % arcticks;
			tally += deltaWilderness[idx];
		}
		if (tally > maxWilderness.count) {
			maxWilderness.index = rad;
			maxWilderness.count = tally;
		}
		if (tally < maxSunkenSea.count) {
			maxSunkenSea.index = rad;
			maxSunkenSea.count = tally;
		}
	}

	HIGHEST_WILDERNESS = maxWilderness.count > maxSunkenSea.count * -1 ? maxWilderness.count : maxSunkenSea.count * -1;

	wildernessArc.startTicks = maxWilderness.index;
	wildernessArc.start = maxWilderness.index * deltaRadians;
	wildernessArc.endTicks = maxSunkenSea.index;
	wildernessArc.end = maxWilderness.index * deltaRadians - (2 * Math.PI) / 3;
}



function findHole(myImageData, width) {
	let visited = {};
	let prevX, prevY, x, y, i;
	let b = 0;
	let g = 0;
	let r = 0;
	let end = stoneArc.endTicks;
	if (end < stoneArc.startTicks) {
		end += arcticks;
	}

	for (let rad = stoneArc.startTicks; rad < end; ++rad) {
		let angle = (rad % arcticks) * deltaRadians;
		for (let radius = SEARCH_RADII.min; radius < 451; radius++) {
			x = parseInt(radius * Math.sin(angle));
			y = parseInt(radius * Math.cos(angle));
			if (x != prevX || y != prevY) {
				prevX = x;
				prevY = y;
				x += coreLoc.x;
				y = coreLoc.y - y;
				if (hasVisited(visited, x, y)) {
					continue;
				}
				i = (y * width + x) * 4;
				let /*r = myImageData[i], g = myImageData[i + 1], b = myImageData[i + 2],*/ a = myImageData[i + 3];
				if (a == 0) { //if transparent
					let hole = traverseHole(x, y, myImageData, width, visited);
					if (hole._fits > 0) {
						let holeColor = MAZE_HIGLIGHT[hole._fits];
						delete hole._fits;

						if (Alpine.store("data").showSmallMazeHoles && holeColor === MAZE_HIGLIGHT[1]) {
							colorHole(myImageData, width, hole, holeColor);
						}

						if (Alpine.store("data").showMediumMazeHoles && holeColor === MAZE_HIGLIGHT[2]) {
							colorHole(myImageData, width, hole, holeColor);
						}

						if (Alpine.store("data").showLargeMazeHoles && holeColor === MAZE_HIGLIGHT[3]) {
							colorHole(myImageData, width, hole, holeColor);
						}
					}
				}
			}
		}
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
	if (x < hole.minX) {
		hole.minX = x;
	}
	if (x > hole.maxX) {
		hole.maxX = x;
	}
	if (y < hole.minY) {
		hole.minY = y;
	}
	if (y > hole.maxY) {
		hole.maxY = y;
	}
}

function traverseHole(startx, starty, myImageData, width, visited) {
	let toVisit = [{ x: startx, y: starty }];
	let hole = {
		maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY,
		minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY,
		_fits: -1
	};
	let idx = 0;
	while (idx < toVisit.length) {
		let { x, y } = toVisit[idx];
		++idx;
		i = (y * width + x) * 4;
		if (myImageData[i + 3] != 0) {//not a hole
			continue;
		}
		if (hasVisited(visited, x, y)) {//already visited
			continue;
		}
		let dcx = coreLoc.x - x;
		let dcy = coreLoc.y - y;
		let dist2 = (dcx * dcx) + (dcy * dcy);
		if (dist2 > SEARCH_RADII.max2 || dist2 < SEARCH_RADII.min2) {//outside search radius
			continue;
		}
		let ax = x - coreLoc.x;
		let ay = coreLoc.y - y;
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
		if (stoneArc.end < stoneArc.start) {
			if (angle > stoneArc.end && angle < stoneArc.start) {
				continue;
			}
		} else if (angle < stoneArc.start || angle > stoneArc.end) {
			continue;
		}

		visited[y][x] = true;
		addToHole(hole, x, y);
		toVisit.push({ x: x, y: y - 1 });
		toVisit.push({ x: x, y: y + 1 });
		toVisit.push({ x: x - 1, y });
		toVisit.push({ x: x + 1, y });
	}
	testHole(hole);
	return hole;
}
const SMALL_MAZE = { width: 20, height: 18, size: 1 };
const MEDIUM_MAZE = { width: 39, height: 39, size: 2 };
const LARGE_MAZE = { width: 51, height: 53, size: 3 };
const TEST_MAZES = [LARGE_MAZE, MEDIUM_MAZE, SMALL_MAZE];
function testHole(hole) {
	let holeWidth = hole.maxX - hole.minX;
	let holeHeight = hole.maxY - hole.minY;
	for (let test of TEST_MAZES) {
		//check if hole is big enough for maze
		if (holeWidth < test.width || holeHeight < test.height) {
			continue;
		}
		let validCols = 0;
		let startCols = 0;
		let fits = false;
		for (let y = hole.minY; !fits && y < hole.maxY; y++) {
			for (let x = hole.minX; !fits && x < hole.maxX; x++) {
				if (!hole[y][x]) {
					validCols = -1;
				} else if (validCols == 0) {
					startCols = x;
				} else if (validCols >= test.width) {
					fits = isBigEnough(hole, startCols, y, test);
				}
				validCols++;
			}
		}
		if (fits) {
			hole._fits = test.size;
			break;
		}
	}
	delete hole.minX;
	delete hole.maxX;
	delete hole.minY;
	delete hole.maxY;
}

function isBigEnough(hole, x, y, maze) {
	let endX = x + maze.width;
	let endY = y + maze.height;
	for (; y < endY; y++) {
		for (; x < endX; x++) {
			if (!hole[y][x]) {
				return false;
			}
		}
	}
	return true;
}

function buildStoneFilter() {
	for (let tileType of tileColorMap) {
		let filterObj = undefined;

		if (tileType.tilesetname == "Stone") {
			filterObj = STONE_FILTER;
		} else if (tileType.tilesetname == "Clay") {
			filterObj = CLAY_FILTER;
		} else if (tileType.tilesetname == "Wilderness") {
			filterObj = WILDERNESS_FILTER;
		} else if (tileType.tilesetname == "SunkenSea") {
			filterObj = SUNKENSEA_FILTER;
		}

		if (filterObj) {
			filterObj.count++;
			if (!filterObj[tileType.r]) {
				((filterObj[tileType.r] = {})[tileType.g] = {})[tileType.b] = true;
			} else if (!filterObj[tileType.r][tileType.g]) {
				(filterObj[tileType.r][tileType.g] = {})[tileType.b] = true;
			} else {
				filterObj[tileType.r][tileType.g][tileType.b] = true;
			}
		}
	}
}
buildStoneFilter();

function toggleAllMazeHoles(event) {
	if (Alpine.store("data").showSmallMazeHoles && Alpine.store("data").showMediumMazeHoles && Alpine.store("data").showLargeMazeHoles) {
		Alpine.store("data").showSmallMazeHoles = false;
		Alpine.store("data").showMediumMazeHoles = false;
		Alpine.store("data").showLargeMazeHoles = false;
	} else {
		Alpine.store("data").showSmallMazeHoles = true;
		Alpine.store("data").showMediumMazeHoles = true;
		Alpine.store("data").showLargeMazeHoles = true;
	}
	redrawDebounce(event);
}