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
	Ores: "Ores",
	Objects: "Objects"
};

class Tile {
	visible = false;
	disabled = false;

	constructor(name, r, g, b) {
		this.name = name;
		this.r = r;
		this.g = g;
		this.b = b;
	}
}

let tileColors = [
	{
		"set": TileType.SpawnTiles,
		"tiles": [
			new Tile("Ground Slime", 217, 98, 23),
			new Tile("Fungal Soil", 183, 83, 61),
			new Tile("Stone Moss", 207, 241, 255),
			new Tile("Ground Slippery Slime", 46, 46, 255),
			new Tile("Chrysalis", 252, 166, 148),
			new Tile("Ground Acid Slime", 193, 170, 33),
			new Tile("Ground Poison Slime", 184, 86, 165),
		]
	},
	{
		"set": TileType.Liquids,
		"tiles": [
			new Tile("Water", 30, 61, 129),
			new Tile("Larva Hive Water", 117, 103, 48),
			new Tile("Mold Water", 61, 85, 135),
			new Tile("Sea Water", 52, 208, 255),
		]
	},
	{
		"set": TileType.Boulders,
		"tiles": [
			new Tile("Copper Boulder", 327, 96, 87),
			new Tile("Tin Boulder", 142, 122, 118),
			new Tile("Gold Boulder", 242, 204, 61),
			new Tile("Iron Boulder", 130, 155, 203),
			new Tile("Scarlet Boulder", 206, 59, 59),
			new Tile("Octarine Boulder", 139, 82, 238),
		]
	},
	{
		"set": TileType.Ores,
		"tiles": [
			new Tile("Ancient Gemstone Ore", 0, 147, 255),
			new Tile("Copper Ore", 327, 96, 87),
			new Tile("Tin Ore", 142, 122, 118),
			new Tile("Gold Ore", 242, 204, 61),
			new Tile("Iron Ore", 130, 155, 203),
			new Tile("Scarlet Ore", 206, 59, 59),
			new Tile("Octarine Ore", 139, 82, 238),
		]
	},
	{
		"set": TileType.Walls,
		"tiles": [
			new Tile("Obsidian Wall", 22, 42, 39),
			new Tile("Dirt Wall", 97, 73, 39),
			new Tile("Sand Wall", 172, 143, 58),
			new Tile("Turf Wall", 70, 103, 81),
			new Tile("Clay Wall", 193, 100, 54),
			new Tile("Stone Wall", 73, 103, 125),
			new Tile("Great Wall", 19, 94, 82),
			new Tile("Wood Wall", 148, 105, 51),
			new Tile("Stone Bricks Wall", 106, 108, 114),
			new Tile("Scarlet Wall", 144, 38, 19),
			new Tile("Larva Hive Wall", 163, 97, 83),
			new Tile("City Wall", 49, 77, 87),
			new Tile("Limestone Wall", 180, 147, 154),
			new Tile("Black Wall", 62, 62, 62),
			new Tile("White Wall", 157, 180, 203),
			new Tile("Brown Wall", 124, 58, 28),
			new Tile("Blue Wall", 28, 93, 216),
			new Tile("Purple Wall", 109, 49, 137),
			new Tile("Red Wall", 187, 10, 10),
			new Tile("Green Wall", 64, 169, 16),
			new Tile("Yellow Wall", 212, 194, 42),
			new Tile("Unpainted Wall", 154, 165, 212),
			new Tile("Grass Wall", 22, 131, 27),
			new Tile("Mold Wall", 89, 156, 186),
		]
	},
	{
		"set": TileType.Grounds,
		"tiles": [
			new Tile("Obsidian Ground", 31, 67, 62),
			new Tile("Dirt Ground", 127, 95, 48),
			new Tile("Sand Ground", 212, 185, 89),
			new Tile("Turf Ground", 86, 128, 100),
			new Tile("Clay Ground", 232, 139, 105),
			new Tile("Stone Ground", 103, 131, 151),
			new Tile("Grass Ground", 61, 155, 65),
			new Tile("Larva Hive Ground", 199, 116, 99),
			new Tile("Mold Ground", 108, 188, 224),
			new Tile("Beach Sand Ground", 235, 192, 190),

			new Tile("Tilled Dirt Ground", 180, 127, 73),
			new Tile("Watered Dirt Ground", 141, 102, 62),
			new Tile("Tilled Grass Ground", 12, 115, 43),
			new Tile("Watered Grass Ground", 26, 93, 46),
		]
	},
	{
		"set": TileType.Floors,
		"tiles": [
			new Tile("Wood Floor", 199, 148, 79),
			new Tile("Stone Floor", 129, 132, 140),
			new Tile("Unpainted Floor", 174, 189, 241),
			new Tile("Yellow Floor", 255, 232, 46),
			new Tile("Green Floor", 85, 182, 39),
			new Tile("Red Floor", 223, 0, 0),
			new Tile("Purple Floor", 139, 79, 167),
			new Tile("Blue Floor", 43, 108, 228),
			new Tile("Brown Floor", 151, 75, 40),
			new Tile("White Floor", 178, 206, 233),
			new Tile("Black Floor", 76, 84, 85),
			new Tile("Scarlet Floor", 178, 53, 38),
			new Tile("Caveling Floor Tile", 130, 130, 130),
			new Tile("City Floor", 87, 128, 132),

		]
	},
	{
		"set": TileType.Objects,
		"tiles": [
			new Tile("Root", 225, 163, 104),
			new Tile("Wooden Crate", 114, 60, 17),
			new Tile("Ancient Crate", 77, 168, 202),
			new Tile("Electrical Wire", 89, 80, 73),
			new Tile("Ancient Wire (core)", 66, 93, 94),
			new Tile("Rail", 122, 122, 122),
			new Tile("Wood Bridge", 140, 88, 38),
			new Tile("Wood Fence", 112, 72, 33),
			new Tile("Rug", 124, 71, 123),
			new Tile("Stone Bridge", 123, 116, 108),
			new Tile("Stone Fence", 97, 91, 85),
			new Tile("Woven Mat", 58, 139, 65),
			new Tile("Scarlet Bridge", 168, 30, 46),
			new Tile("Scarlet Fence", 128, 36, 46),
			new Tile("Flower Vessel", 205, 189, 48),
			new Tile("Wooden Crate", 114, 60, 17),
			new Tile("Mold Vessel", 229, 229, 229),
			new Tile("Conveyor Belt", 104, 127, 174),
			new Tile("Coral Wood", 250, 89, 163),
		]
	},
	{
		"set": TileType.Ungrouped,
		"tiles": [
			new Tile("Pit", 31, 31, 31),
			new Tile("Jellyfish", 48, 124, 205),
			new Tile("Large Jellyfish", 48, 124, 205),
		]
	},
]

