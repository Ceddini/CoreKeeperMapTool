/*

			{
				"type": "wall",
				"name": "Dirt",
				"r": "",
				"g": "",
				"b": "",
			}
*/

// https://core-keeper.fandom.com/wiki/Category:Items_visible_on_map

const TileType = {
	SpawnTiles: "Spawn Tiles",
	Liquids: "Liquids",
	Boulders: "Boulders",
	Ores: "Ores",
	GroundBlocks: "Ground (Blocks)",
	WallsBlocks: "Walls (Blocks)",
	Walls: "Walls",
	WallsPaintable: "Walls (Paintable)",
	Floors: "Floors",
	FloorsPaintable: "Floors (Paintable)",
	FloorsLit: "Floors (Lit)",
	FloorsRug: "Floors (Rug)",
	Bridges: "Bridges",
	Fences: "Fences",
	Electronics: "Electronics",
	Objects: "Objects",
	Ungrouped: "Ungrouped",
};

class Tile {
	visible = false;
	disabled = false;

	constructor(name, r, g, b, textBlack = false) {
		this.name = name;
		this.r = r;
		this.g = g;
		this.b = b;
		this.textColor = textBlack ? "#000000" : "#FFFFFF";
	}
}

let tileColors = [
	{
		"set": TileType.SpawnTiles,
		"tiles": [
			// misc
			new Tile("Fungal Soil", 183, 83, 60),
			new Tile("Chrysalis", 252, 166, 148),
			// slimes
			new Tile("Ground Slime", 217, 98, 23),
			new Tile("Ground Poison Slime", 184, 86, 165),
			new Tile("Ground Slippery Slime", 51, 51, 238),
			new Tile("Ground Magma Slime", 255, 84, 0),
			// cavelings
			new Tile("Stone Moss", 207, 241, 255),
			new Tile("Clay Moss", 126, 87, 78),
			new Tile("Lush Moss", 163, 206, 74),
			new Tile("Urban Moss", 42, 169, 71),
			new Tile("Valley Moss", 249, 116, 67),
			// shimmering
			new Tile("Crystal Crust", 15, 162, 184),
		],
	},
	{
		"set": TileType.Liquids,
		"tiles": [
			// ordered by priority
			new Tile("Water", 30, 61, 129),
			new Tile("Lava", 222, 53, 1),
			new Tile("Acid Water", 117, 103, 48),
			new Tile("Mold Water", 61, 85, 135),
			new Tile("Shimmering Water", 154, 198, 243),
			new Tile("Grimy Water", 61, 57, 89),
			new Tile("Sea Water", 52, 208, 255),

		],
	},
	{
		"set": TileType.Boulders,
		"tiles": [
			new Tile("Copper Boulder", 237, 96, 87),
			new Tile("Tin Boulder", 142, 122, 118),
			new Tile("Iron Boulder", 130, 155, 203),
			new Tile("Gold Boulder", 242, 204, 61),
			new Tile("Scarlet Boulder", 206, 59, 59),
			new Tile("Octarine Boulder", 139, 82, 238),
			new Tile("Galaxite Boulder", 215, 220, 251),
			new Tile("Solarite Boulder", 226, 161, 44),
			new Tile("Pandorium Boulder", 9, 175, 36),
		],
	},
	{
		"set": TileType.Ores,
		"tiles": [
			new Tile("Copper Ore", 237, 96, 87),
			new Tile("Tin Ore", 142, 122, 118),
			new Tile("Gold Ore", 242, 204, 61),
			new Tile("Iron Ore", 130, 155, 203),
			new Tile("Scarlet Ore", 206, 59, 59),
			new Tile("Octarine Ore", 139, 82, 238),
			new Tile("Galaxite Ore", 247, 240, 220),
			new Tile("Solarite Ore", 255, 190, 78),
			new Tile("Pandorium Ore", 9, 175, 36),
			// misc
			new Tile("Ancient Gemstone", 0, 147, 255),
		],
	},
	{
		"set": TileType.WallsBlocks,
		"tiles": [
			// blocks, ordered by wall health
			new Tile("Sand Block", 172, 143, 58),
			new Tile("Snow Block", 109, 177, 180),
			new Tile("Dirt Block", 97, 73, 39),
			new Tile("Meadow Block", 224, 201, 97),
			new Tile("Turf Block", 70, 103, 81),
			new Tile("Clay Block", 193, 100, 54),
			// doesn't show wall color on map...
			// new Tile("Dark Stone Block", 123, 140, 172),
			new Tile("Stone Block", 73, 103, 125),
			new Tile("Larva Hive Block", 163, 97, 83),
			new Tile("Grass Block", 22, 131, 27),
			new Tile("Beach Block", 180, 147, 154),
			new Tile("Mold Block", 89, 156, 186),
			new Tile("Desert Block", 166, 146, 152),
			new Tile("Metropolis Block", 49, 77, 87),
			new Tile("Alien Tech Block", 70, 62, 102),
			new Tile("Crystal Block", 42, 89, 238),
			new Tile("Desert Temple Block", 0, 87, 163),
			new Tile("Maze Block", 60, 79, 57),
			new Tile("Lava Rock Block", 56, 52, 71),
			new Tile("Fossil Block", 89, 86, 100),
			new Tile("Obsidian Block", 22, 42, 39),
		],
	},
	{
		"set": TileType.GroundBlocks,
		"tiles": [
			// blocks, ordered by wall health
			new Tile("Sand Block", 212, 185, 89),
			new Tile("Snow Block", 155, 231, 235),
			new Tile("Dirt Block", 127, 95, 48),
			new Tile("Meadow Block", 239, 225, 179),
			new Tile("Turf Block", 86, 128, 100),
			new Tile("Clay Block", 232, 139, 105),
			new Tile("Dark Stone Block", 123, 140, 172),
			new Tile("Stone Block", 103, 131, 151),
			new Tile("Larva Hive Block", 199, 116, 99),
			new Tile("Grass Block", 61, 155, 65),
			new Tile("Beach Block", 235, 192, 190),
			new Tile("Mold Block", 108, 188, 224),
			new Tile("Desert Block", 210, 154, 124),
			new Tile("Metropolis Block", 87, 128, 132),
			new Tile("Alien Tech Block", 69, 106, 115),
			new Tile("Crystal Block", 57, 136, 219),
			new Tile("Desert Temple Block", 134, 113, 110),
			new Tile("Maze Block", 83, 100, 96),
			new Tile("Lava Rock Block", 85, 78, 106),
			new Tile("Fossil Block", 192, 186, 207),
			new Tile("Obsidian Block", 31, 67, 62),
		],
	},
	{
		"set": TileType.Walls,
		"tiles": [
			// crafted
			new Tile("Straw-bale Wall", 219, 212, 137),
			new Tile("Wood Wall", 148, 105, 51),
			new Tile("Stone Bricks Wall", 106, 108, 114),
			new Tile("Scarlet Wall", 144, 38, 19),
			new Tile("Coral Wall", 222, 142, 178),
			new Tile("Galaxite Wall", 221, 221, 221),
			new Tile("Gleam Wood Wall", 15, 161, 174),

			// seasonal
			new Tile("Eerie Wall", 103, 79, 122),

			// found
			new Tile("Thermite Wall", 216, 39, 62),

			// misc
			new Tile("Explosives Deposit", 192, 23, 26),
		],
	},
	{
		"set": TileType.WallsPaintable,
		"tiles": [
			new Tile("Paintable Wall", 154, 165, 212),
			new Tile("Red Paintable Wall", 187, 10, 10),
			new Tile("Purple Paintable Wall", 109, 49, 137),
			new Tile("Blue Paintable Wall", 28, 93, 216),
			new Tile("Brown Paintable Wall", 124, 58, 28),
			new Tile("White Paintable Wall", 157, 180, 203),
			new Tile("Black Paintable Wall", 62, 62, 62),
			new Tile("Orange Paintable Wall", 226, 121, 41),
			new Tile("Cyan Paintable Wall", 31, 193, 179),
			new Tile("Pink Paintable Wall", 246, 30, 120),
			new Tile("Grey Paintable Wall", 131, 151, 159),
			new Tile("Peach Paintable Wall", 224, 112, 100),
			new Tile("Teal Paintable Wall", 26, 134, 117),
			new Tile("Yellow Paintable Wall", 212, 194, 42),
			new Tile("Green Paintable Wall", 64, 169, 16),
		],
	},
	{
		"set": TileType.Floors,
		"tiles": [
			// crafted
			new Tile("Woven Straw Floor", 255, 243, 113),
			new Tile("Wood Floor", 199, 148, 79),
			new Tile("Stone Floor", 129, 132, 140),
			new Tile("Scarlet Floor", 178, 53, 38),
			new Tile("Coral Floor", 213, 109, 183),
			new Tile("Galaxite Floor", 197, 197, 197),
			new Tile("Gleam Wood Floor", 128, 242, 255),
			new Tile("Grimy Stone Floor", 54, 89, 86),

			// seasonal
			new Tile("Eerie Floor", 133, 102, 156),

			// found
			new Tile("Caveling Floor Tile", 130, 130, 130),
			new Tile("Woven Mat", 58, 139, 65),
		],
	},
	{
		"set": TileType.FloorsPaintable,
		"tiles": [
			new Tile("Paintable Floor", 174, 189, 241),
			new Tile("Red Paintable Floor", 223, 0, 0),
			new Tile("Purple Paintable Floor", 139, 79, 167),
			new Tile("Blue Paintable Floor", 43, 108, 228),
			new Tile("Brown Paintable Floor", 151, 75, 40),
			new Tile("White Paintable Floor", 178, 206, 233),
			new Tile("Black Paintable Floor", 76, 84, 85),
			new Tile("Orange Paintable Floor", 237, 144, 73),
			new Tile("Cyan Paintable Floor", 41, 226, 180),
			new Tile("Pink Paintable Floor", 250, 69, 144),
			new Tile("Grey Paintable Floor", 157, 175, 183),
			new Tile("Peach Paintable Floor", 255, 151, 124),
			new Tile("Teal Paintable Floor", 15, 158, 136),
			new Tile("Yellow Paintable Floor", 255, 232, 46),
			new Tile("Green Paintable Floor", 85, 182, 39),
		],
	},
	{
		"set": TileType.FloorsLit,
		"tiles": [
			new Tile("Lit Floor", 159, 159, 159),
			new Tile("Red Lit Floor", 246, 115, 115),
			new Tile("Purple Lit Floor", 191, 124, 222),
			new Tile("Blue Lit Floor", 109, 133, 255),
			new Tile("Brown Lit Floor", 246, 186, 108),
			new Tile("White Lit Floor", 255, 255, 255),
			new Tile("Black Lit Floor", 44, 44, 44),
			new Tile("Orange Lit Floor", 255, 163, 95),
			new Tile("Cyan Lit Floor", 150, 255, 232),
			new Tile("Pink Lit Floor", 255, 177, 225),
			new Tile("Grey Lit Floor", 186, 228, 246),
			new Tile("Peach Lit Floor", 255, 176, 155),
			new Tile("Teal Lit Floor", 75, 183, 173),
			new Tile("Yellow Lit Floor", 255, 248, 131),
			new Tile("Green Lit Floor", 155, 230, 120),
		],
	},
	{
		"set": TileType.FloorsRug,
		"tiles": [
			new Tile("Rug", 124, 71, 123),
			new Tile("Red Rug", 255, 62, 37),
			new Tile("Purple Rug", 205, 31, 255),
			new Tile("Blue Rug", 78, 54, 255),
			new Tile("Brown Rug", 208, 113, 0),
			new Tile("White Rug", 255, 243, 243),
			new Tile("Black Rug", 13, 32, 43),
			new Tile("Orange Rug", 255, 129, 45),
			new Tile("Cyan Rug", 34, 236, 225),
			new Tile("Pink Rug", 255, 83, 202),
			new Tile("Grey Rug", 126, 135, 137),
			new Tile("Peach Rug", 255, 129, 105),
			new Tile("Teal Rug", 73, 166, 130),
			new Tile("Yellow Rug", 252, 255, 0),
			new Tile("Green Rug", 132, 246, 63),
		],
	},
	{
		"set": TileType.Bridges,
		"tiles": [
			// crafted
			new Tile("Wood Bridge", 140, 88, 38),
			new Tile("Stone Bridge", 123, 116, 108),
			new Tile("Scarlet Bridge", 168, 30, 46),
			new Tile("Coral Bridge", 200, 92, 204),
			new Tile("Galaxite Bridge", 172, 179, 169),
			new Tile("Gleam Wood Bridge", 15, 210, 190),

			// found
			new Tile("Metal Grate", 197, 135, 54),
		],
	},
	{
		"set": TileType.Fences,
		"tiles": [
			// crafted
			new Tile("Wood Fence", 112, 72, 33),
			new Tile("Stone Fence", 97, 91, 85),
			new Tile("Scarlet Fence", 128, 36, 46),
			new Tile("Coral Fence", 159, 61, 164),
			new Tile("Galaxite Fence", 152, 161, 149),
			new Tile("Gleam Wood Fence", 16, 154, 166),
		],
	},
	{
		"set": TileType.Electronics,
		"tiles": [
			new Tile("Electrical Wire", 89, 80, 73),
			new Tile("Conveyor Belt", 104, 127, 174),
		],
	},
	{
		"set": TileType.Objects,
		"tiles": [
			// wood
			new Tile("Wood", 225, 163, 104),
			new Tile("Coral Wood", 253, 106, 173),
			new Tile("Gleam Wood", 173, 235, 253),

			// crates
			new Tile("Wooden Crate", 114, 60, 17),
			new Tile("Clay Pot", 99, 48, 19),
			new Tile("Ancient Crate / Metropolis Crate", 77, 168, 202),
			new Tile("Flower Vessel", 205, 189, 48),
			new Tile("Mold Vessel", 229, 229, 229),
			new Tile("Beached Jelly", 48, 124, 205),
			new Tile("Charred Crate", 103, 127, 174),
			new Tile("Alien Tech Crate", 76, 233, 224),
			new Tile("Desert Flower Vessel", 219, 92, 63),
			new Tile("Driftwood Wooden Crate", 143, 123, 119),
			new Tile("Radiation Crystal", 38, 222, 81),
			new Tile("Slime Vessels", 166, 53, 0),
			new Tile("Poison Slime Vessels", 91, 50, 110),
			new Tile("Temple Crate", 238, 205, 99),
			new Tile("Fossil Cluster", 215, 220, 251),// same as galaxite boulder?
		],
	},
	{
		"set": TileType.Ungrouped,
		"tiles": [
			new Tile("Pit", 31, 31, 31),
			new Tile("Ground Acid Slime", 193, 170, 33),
			new Tile("Indestructible Ancient Wire", 66, 93, 94),
			new Tile("Rail", 122, 122, 122),
			new Tile("Alien Floor Vent", 71, 104, 126),

			// corals
			new Tile("Bicolor Coral", 74, 97, 218),
			new Tile("Crimson Coral", 187, 64, 52),
			new Tile("Dish Coral", 159, 78, 159),
		],
	},
];

let tileColorMap = [
	{
		"tilesetname": "Dirt",
		"type": "pit",
		"name": "Pit",
		"r": "31",
		"g": "31",
		"b": "31"
	},
	{
		"tilesetname": "Dirt",
		"type": "wall",
		"name": "Dirt Wall",
		"r": "97",
		"g": "73",
		"b": "39"
	},
	{
		"tilesetname": "Dirt",
		"type": "ground",
		"name": "Dirt Ground",
		"r": "127",
		"g": "95",
		"b": "48"
	},
	{
		"tilesetname": "Dirt",
		"type": "water",
		"name": "Water",
		"r": "30",
		"g": "61",
		"b": "129"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Copper Boulder",
		"r": "237",
		"g": "96",
		"b": "87"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Gold Boulder",
		"r": "242",
		"g": "204",
		"b": "61"
	},
	{
		"tilesetname": "Dirt",
		"type": "ore",
		"name": "Copper Ore",
		"r": "237",
		"g": "96",
		"b": "87"
	},
	{
		"tilesetname": "Dirt",
		"type": "ore",
		"name": "Gold Ore",
		"r": "242",
		"g": "204",
		"b": "61"
	},
	{
		"tilesetname": "Dirt",
		"type": "ore",
		"name": "Root",
		"r": "225",
		"g": "163",
		"b": "104"
	},
	{
		"tilesetname": "Dirt",
		"type": "ground",
		"name": "Tilled Dirt Ground",
		"r": "180",
		"g": "127",
		"b": "73"
	},
	{
		"tilesetname": "Dirt",
		"type": "ore",
		"name": "Ancient Gemstone Ore",
		"r": "0",
		"g": "147",
		"b": "255"
	},
	{
		"tilesetname": "Dirt",
		"type": "ground",
		"name": "Watered Dirt Ground",
		"r": "141",
		"g": "102",
		"b": "62"
	},
	{
		"tilesetname": "Dirt",
		"type": "ground",
		"name": "Ground Slime",
		"r": "217",
		"g": "98",
		"b": "23"
	},
	{
		"tilesetname": "Hive",
		"type": "ground",
		"name": "Chrysalis",
		"r": "252",
		"g": "166",
		"b": "148"
	},
	{
		"tilesetname": "Sand",
		"type": "wall",
		"name": "Sand Wall",
		"r": "172",
		"g": "143",
		"b": "58"
	},
	{
		"tilesetname": "Sand",
		"type": "ground",
		"name": "Sand Ground",
		"r": "212",
		"g": "185",
		"b": "89"
	},
	{
		"tilesetname": "Dirt",
		"type": "wall",
		"name": "Turf Wall",
		"r": "70",
		"g": "103",
		"b": "81"
	},
	{
		"tilesetname": "Dirt",
		"type": "ground",
		"name": "Turf Ground",
		"r": "86",
		"g": "128",
		"b": "100"
	},
	{
		"tilesetname": "Clay",
		"type": "wall",
		"name": "Clay Wall",
		"r": "193",
		"g": "100",
		"b": "54"
	},
	{
		"tilesetname": "Clay",
		"type": "ground",
		"name": "Clay Ground",
		"r": "232",
		"g": "139",
		"b": "105"
	},
	{
		"tilesetname": "Stone",
		"type": "wall",
		"name": "Stone Wall",
		"r": "73",
		"g": "103",
		"b": "125"
	},
	{
		"tilesetname": "Stone",
		"type": "ground",
		"name": "Stone Ground",
		"r": "103",
		"g": "131",
		"b": "151"
	},
	{
		"tilesetname": "Stone",
		"type": "ore",
		"name": "Iron Ore",
		"r": "130",
		"g": "155",
		"b": "203"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Iron Boulder",
		"r": "130",
		"g": "155",
		"b": "203"
	},
	{
		"tilesetname": "Obsidian",
		"type": "wall",
		"name": "Obsidian Wall",
		"r": "22",
		"g": "42",
		"b": "39"
	},
	{
		"tilesetname": "Obsidian",
		"type": "ground",
		"name": "Obsidian Ground",
		"r": "31",
		"g": "67",
		"b": "62"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Electrical Wire",
		"r": "89",
		"g": "80",
		"b": "73"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Ancient Wire (core)",
		"r": "66",
		"g": "93",
		"b": "94"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Rail",
		"r": "122",
		"g": "122",
		"b": "122"
	},
	{
		"tilesetname": "Obsidian",
		"type": "wall",
		"name": "Great Wall",
		"r": "19",
		"g": "94",
		"b": "82"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Wood Wall",
		"r": "148",
		"g": "105",
		"b": "51"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Wood Floor",
		"r": "199",
		"g": "148",
		"b": "79"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Wood Bridge",
		"r": "140",
		"g": "88",
		"b": "38"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Wood Fence",
		"r": "112",
		"g": "72",
		"b": "33"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Rug",
		"r": "124",
		"g": "71",
		"b": "123"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Stone Bricks Wall",
		"r": "106",
		"g": "108",
		"b": "114"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Stone Floor",
		"r": "129",
		"g": "132",
		"b": "140"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Stone Bridge",
		"r": "123",
		"g": "116",
		"b": "108"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Stone Fence",
		"r": "97",
		"g": "91",
		"b": "85"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Woven Mat",
		"r": "58",
		"g": "139",
		"b": "65"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Scarlet Wall",
		"r": "144",
		"g": "38",
		"b": "19"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Scarlet Floor",
		"r": "178",
		"g": "53",
		"b": "38"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Scarlet Bridge",
		"r": "168",
		"g": "30",
		"b": "46"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Scarlet Fence",
		"r": "128",
		"g": "36",
		"b": "46"
	},
	{
		"tilesetname": "Hive",
		"type": "wall",
		"name": "Larva Hive Wall",
		"r": "163",
		"g": "97",
		"b": "83"
	},
	{
		"tilesetname": "Hive",
		"type": "ground",
		"name": "Larva Hive Ground",
		"r": "199",
		"g": "116",
		"b": "99"
	},
	{
		"tilesetname": "Hive",
		"type": "water",
		"name": "Larva Hive Water",
		"r": "117",
		"g": "103",
		"b": "48"
	},
	{
		"tilesetname": "Hive",
		"type": "ground",
		"name": "Ground Acid Slime",
		"r": "193",
		"g": "170",
		"b": "33"
	},
	{
		"tilesetname": "Boulder",
		"type": "bolder",
		"name": "Tin Boulder",
		"r": "142",
		"g": "122",
		"b": "118"
	},
	{
		"tilesetname": "Clay",
		"type": "ore",
		"name": "Tin Ore",
		"r": "142",
		"g": "122",
		"b": "118"
	},
	{
		"tilesetname": "Wilderness",
		"type": "wall",
		"name": "Grass Wall",
		"r": "22",
		"g": "131",
		"b": "27"
	},
	{
		"tilesetname": "Wilderness",
		"type": "ground",
		"name": "Grass Ground",
		"r": "61",
		"g": "155",
		"b": "65"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Scarlet Boulder",
		"r": "206",
		"g": "59",
		"b": "59"
	},
	{
		"tilesetname": "Wilderness",
		"type": "ore",
		"name": "Scarlet Ore",
		"r": "206",
		"g": "59",
		"b": "59"
	},
	{
		"tilesetname": "Wilderness",
		"type": "ground",
		"name": "Tilled Grass Ground",
		"r": "12",
		"g": "115",
		"b": "43"
	},
	{
		"tilesetname": "Wilderness",
		"type": "ground",
		"name": "Watered Grass Ground",
		"r": "26",
		"g": "93",
		"b": "46"
	},
	{
		"tilesetname": "Wilderness",
		"type": "ground",
		"name": "Ground Poison Slime",
		"r": "184",
		"g": "86",
		"b": "165"
	},
	{
		"tilesetname": "Mold",
		"type": "wall",
		"name": "Mold Wall",
		"r": "89",
		"g": "156",
		"b": "186"
	},
	{
		"tilesetname": "Mold",
		"type": "ground",
		"name": "Mold Ground",
		"r": "108",
		"g": "188",
		"b": "224"
	},
	{
		"tilesetname": "Mold",
		"type": "water",
		"name": "Mold Water",
		"r": "61",
		"g": "85",
		"b": "135"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Unpainted Wall",
		"r": "154",
		"g": "165",
		"b": "212"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Unpainted Floor",
		"r": "174",
		"g": "189",
		"b": "241"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Yellow Wall",
		"r": "212",
		"g": "194",
		"b": "42"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Yellow Floor",
		"r": "255",
		"g": "232",
		"b": "46"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Green Wall",
		"r": "64",
		"g": "169",
		"b": "16"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Green Floor",
		"r": "85",
		"g": "182",
		"b": "39"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Red Wall",
		"r": "187",
		"g": "10",
		"b": "10"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Red Floor",
		"r": "223",
		"g": "0",
		"b": "0"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Purple Wall",
		"r": "109",
		"g": "49",
		"b": "137"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Purple Floor",
		"r": "139",
		"g": "79",
		"b": "167"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Blue Wall",
		"r": "28",
		"g": "93",
		"b": "216"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Blue Floor",
		"r": "43",
		"g": "108",
		"b": "228"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Brown Wall",
		"r": "124",
		"g": "58",
		"b": "28"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Brown Floor",
		"r": "151",
		"g": "75",
		"b": "40"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "White Wall",
		"r": "157",
		"g": "180",
		"b": "203"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "White Floor",
		"r": "178",
		"g": "206",
		"b": "233"
	},
	{
		"tilesetname": "Structures",
		"type": "wall",
		"name": "Black Wall",
		"r": "62",
		"g": "62",
		"b": "62"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Black Floor",
		"r": "76",
		"g": "84",
		"b": "85"
	},
	{
		"tilesetname": "Furniture",
		"type": "furniture",
		"name": "Flower Vessel",
		"r": "205",
		"g": "189",
		"b": "48"
	},
	{
		"tilesetname": "Furniture",
		"type": "furniture",
		"name": "Wooden Crate",
		"r": "114",
		"g": "60",
		"b": "17"
	},
	{
		"tilesetname": "Furniture",
		"type": "furniture",
		"name": "Mold Vessel",
		"r": "229",
		"g": "229",
		"b": "229"
	},
	{
		"tilesetname": "Furniture",
		"type": "furniture",
		"name": "Ancient Crate",
		"r": "77",
		"g": "168",
		"b": "202"
	},
	{
		"tilesetname": "Structures",
		"type": "floor",
		"name": "Conveyor Belt",
		"r": "104",
		"g": "127",
		"b": "174"
	},
	{
		"tilesetname": "Stone",
		"type": "ground",
		"name": "Caveling Floor Tile",
		"r": "130",
		"g": "130",
		"b": "130"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "ground",
		"name": "Beach Sand Ground",
		"r": "235",
		"g": "192",
		"b": "190"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "wall",
		"name": "Limestone Wall",
		"r": "180",
		"g": "147",
		"b": "154"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "ore",
		"name": "Octarine Ore",
		"r": "139",
		"g": "82",
		"b": "238"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Octarine Boulder",
		"r": "139",
		"g": "82",
		"b": "238"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "ore",
		"name": "Coral Wood",
		"r": "250",
		"g": "89",
		"b": "163"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "ore",
		"name": "Jellyfish",
		"r": "48",
		"g": "124",
		"b": "205"
	},
	{
		"tilesetname": "Boulder",
		"type": "boulder",
		"name": "Large Jellyfish",
		"r": "48",
		"g": "124",
		"b": "205"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "water",
		"name": "Sea Water",
		"r": "52",
		"g": "208",
		"b": "255"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "wall",
		"name": "City Wall",
		"r": "49",
		"g": "77",
		"b": "87"
	},
	{
		"tilesetname": "SunkenSea",
		"type": "ground",
		"name": "City Floor",
		"r": "87",
		"g": "128",
		"b": "132"
	}
];
