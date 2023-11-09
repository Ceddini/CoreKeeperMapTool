/*

			{
				"type": "wall",
				"name": "Dirt",
				"r": "",
				"g": "",
				"b": "",
			}
*/

const TileType = {
	Ungrouped: "Ungrouped",
	Grounds: "Grounds",
	Floors: "Floors",
	Walls: "Walls",
	SpawnTiles: "Spawn Tiles",
	Liquids: "Liquids",
	Boulders: "Boulders",
	Destructibles: "Destructibles",
	Ores: "Ores",
	Objects: "Objects"
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
};

let tileColors = [
	{
		"set": TileType.SpawnTiles,
		"tiles": [
			new Tile("Chrysalis", 252, 166, 148),
			new Tile("Clay Moss", 126, 87, 78),
			new Tile("Crystal Crust", 255, 224, 142),
			new Tile("Fungal Soil", 183, 83, 60),
			new Tile("Ground Acid Slime", 193, 170, 33),
			new Tile("Ground Magma Slime", 255, 84, 0),
			new Tile("Ground Poison Slime", 184, 86, 165),
			new Tile("Ground Slime", 217, 98, 23),
			new Tile("Ground Slippery Slime", 47, 47, 255),
			new Tile("Lush Moss", 163, 206, 74),
			new Tile("Stone Moss", 207, 241, 255),
			new Tile("Urban Moss", 42, 210, 62),
			new Tile("Valley Moss", 249, 116, 67),
		]
	},
	{
		"set": TileType.Liquids,
		"tiles": [
			new Tile("Water", 30, 61, 129),
			new Tile("Larva Hive Water", 117, 103, 48),
			new Tile("Mold Water", 61, 85, 135),
			new Tile("Sea Water", 52, 208, 255),
			new Tile("Shimmering Water", 154, 198, 243),
			new Tile("Lava", 222, 53, 1),
		]
	},
	{
		"set": TileType.Boulders,
		"tiles": [
			new Tile("Copper Boulder", 237, 96, 87),
			new Tile("Tin Boulder", 142, 122, 118),
			new Tile("Gold Boulder", 242, 204, 61),
			new Tile("Iron Boulder", 130, 155, 203),
			new Tile("Scarlet Boulder", 206, 59, 59),
			new Tile("Solarite Boulder", 247, 240, 220),
			new Tile("Octarine Boulder", 139, 82, 238),
			new Tile("Galaxite Boulder", 247, 240, 220),
		]
	},
	{
		"set": TileType.Ores,
		"tiles": [
			new Tile("Ancient Gemstone Ore", 0, 147, 255),
			new Tile("Copper Ore", 237, 96, 87),
			new Tile("Tin Ore", 142, 122, 118),
			new Tile("Gold Ore", 242, 204, 61),
			new Tile("Iron Ore", 130, 155, 203),
			new Tile("Scarlet Ore", 206, 59, 59),
			new Tile("Solarite Ore", 247, 240, 220),
			new Tile("Octarine Ore", 139, 82, 238),
			new Tile("Galaxite Ore", 247, 240, 220, true),
		]
	},
	{
		"set": TileType.Walls,
		"tiles": [
			new Tile("Alien Tech Wall", 70, 62, 102),
			new Tile("Black Wall", 62, 62, 62),
			new Tile("Blue Wall", 28, 93, 216),
			new Tile("Brown Wall", 124, 58, 28),
			new Tile("City Wall", 49, 77, 87),
			new Tile("Clay Wall", 193, 100, 54),
			new Tile("Crystal Wall", 42, 112, 186),
			new Tile("Cyan Wall", 31, 193, 179),
			new Tile("Dirt Wall", 97, 73, 39),
			new Tile("Eerie Wall", 103, 79, 122),
			new Tile("Explosives Deposit", 192, 23, 26),
			new Tile("Gleam Wood Wall", 15, 161, 174),
			new Tile("Grass Wall", 22, 131, 27),
			new Tile("Gray Wall", 131, 151, 159),
			new Tile("Great Wall", 19, 94, 82),
			new Tile("Green Wall", 64, 169, 16),
			new Tile("Larva Hive Wall", 163, 97, 83),
			new Tile("Lava Rock Wall", 56, 52, 71),
			new Tile("Limestone Wall", 180, 147, 154),
			new Tile("Maze Wall", 60, 79, 57),
			new Tile("Meadow Wall", 224, 201, 97),
			new Tile("Mold Wall", 89, 156, 186),
			new Tile("Obsidian Wall", 22, 42, 39),
			new Tile("Orange Wall", 226, 121, 41),
			new Tile("Pink Wall", 246, 30, 120),
			new Tile("Purple Wall", 109, 49, 137),
			new Tile("Red Wall", 187, 10, 10),
			new Tile("Sand Wall", 172, 143, 58),
			new Tile("Sandstone Wall", 166, 146, 152),
			new Tile("Scarlet Wall", 144, 38, 19),
			new Tile("Stone Bricks Wall", 106, 108, 114),
			new Tile("Stone Wall", 73, 103, 125),
			new Tile("Straw-bale Wall", 219, 212, 137),
			new Tile("Temple Wall", 0, 108, 177),
			new Tile("Turf Wall", 70, 103, 81),
			new Tile("Unpainted Wall", 154, 165, 212),
			new Tile("White Wall", 157, 180, 203),
			new Tile("Wood Wall", 148, 105, 51),
			new Tile("Yellow Wall", 212, 194, 42),
		]
	},
	{
		"set": TileType.Grounds,
		"tiles": [
			new Tile("Beach Sand Ground", 235, 192, 190),
			new Tile("Clay Ground", 232, 139, 105),
			new Tile("Crystal Ground", 57, 136, 219),
			new Tile("Dark Stone Ground", 123, 140, 172),
			new Tile("Desert Sand Ground", 210, 154, 124),
			new Tile("Dirt Ground", 127, 95, 48),
			new Tile("Grass Ground", 61, 155, 65),
			new Tile("Larva Hive Ground", 199, 116, 99),
			new Tile("Lava Rock Ground", 85, 78, 106),
			new Tile("Meadow Ground", 239, 225, 179),
			new Tile("Mold Ground", 108, 188, 224),
			new Tile("Obsidian Ground", 31, 67, 62),
			new Tile("Sand Ground", 212, 185, 89),
			new Tile("Stone Ground", 103, 131, 151),
			// new Tile("Tilled Dirt Ground", 180, 127, 73),
			new Tile("Tilled Grass Ground", 12, 115, 43),
			new Tile("Turf Ground", 86, 128, 100),
		]
	},
	{
		"set": TileType.Floors,
		"tiles": [
			new Tile("Alien Tech Floor", 69, 106, 115),
			new Tile("Black Floor", 76, 84, 85),
			new Tile("Blue Floor", 43, 108, 228),
			new Tile("Brown Floor", 151, 75, 40),
			new Tile("Caveling Floor Tile", 130, 130, 130),
			new Tile("Cyan Floor", 41, 226, 180),
			new Tile("City Floor", 87, 128, 132),
			new Tile("Eerie Floor", 133, 102, 156),
			new Tile("Gleam Wood Floor", 128, 242, 255),
			new Tile("Gray Floor", 157, 175, 183),
			new Tile("Green Floor", 85, 182, 39),
			new Tile("Maze Floor", 83, 100, 96),
			new Tile("Orange Floor", 237, 144, 73),
			new Tile("Pink Floor", 250, 69, 144),
			new Tile("Purple Floor", 139, 79, 167),
			new Tile("Red Floor", 223, 0, 0),
			new Tile("Scarlet Floor", 178, 53, 38),
			new Tile("Stone Floor", 129, 132, 140),
			new Tile("Temple Floor", 158, 138, 134),
			new Tile("Unpainted Floor", 174, 189, 241),
			new Tile("White Floor", 178, 206, 233),
			new Tile("Woven Straw Floor", 255, 243, 113),
			new Tile("Wood Floor", 199, 148, 79),
			new Tile("Yellow Floor", 255, 232, 46),

		]
	},
	{
		"set": TileType.Objects,
		"tiles": [
			new Tile("Alien Floor Vent", 71, 104, 126),
			new Tile("Ancient Wire (core)", 66, 93, 94),
			new Tile("Conveyor Belt", 104, 127, 174),
			new Tile("Coral Wood", 250, 89, 163),
			new Tile("Electrical Wire", 89, 80, 73),
			new Tile("Gleam Wood", 41, 174, 223),
			new Tile("Gleam Wood Bridge", 15, 210, 190),
			new Tile("Metal Grate", 178, 158, 115),
			new Tile("Rail", 122, 122, 122),
			new Tile("Rug", 124, 71, 123),
			new Tile("Scarlet Bridge", 168, 30, 46),
			new Tile("Scarlet Fence", 128, 36, 46),
			new Tile("Stone Bridge", 123, 116, 108),
			new Tile("Stone Fence", 97, 91, 85),
			new Tile("Wood", 225, 163, 104),
			new Tile("Wood Bridge", 140, 88, 38),
			new Tile("Wood Fence", 112, 72, 33),
			new Tile("Woven Mat", 58, 139, 65),
		]
	},
	{
		"set": TileType.Destructibles,
		"tiles": [
			new Tile("Alien Tech Crate", 76, 233, 224),
			new Tile("Ancient / Metropolis Crate", 77, 168, 202),
			new Tile("Beached Jelly", 48, 124, 205),
			new Tile("Charred Crate", 103, 127, 174),
			new Tile("Driftwood Wooden Crate", 143, 123, 119),
			new Tile("Flower Vessel", 205, 189, 48),
			new Tile("Mold Vessel", 229, 229, 229),
			new Tile("Overgrown Wooden Crate", 97, 72, 34),
			new Tile("Sun Crystal", 219, 140, 38),
			new Tile("Temple Crate", 24, 133, 216),
			new Tile("Wooden Crate", 114, 60, 17),
		]
	},
	{
		"set": TileType.Ungrouped,
		"tiles": [
			new Tile("Pit", 31, 31, 31),
		]
	},
];