class TileFilter
{
	constructor(tiles)
	{
		this.tiles = new Set(tiles.map( ({r,g,b})=>(r<<16) + (g<<8) + b ) );
	}
	isMatch(r, g, b)
	{
		if(g == undefined || b == undefined) return this.tiles.has(r);
		const hexCode = (r<<16) + (g<<8) + b;
		return this.tiles.has(hexCode);
	}
}

const mazeFilters = {
	STONE : new TileFilter([
		new Tile("Stone Wall", 73, 103, 125),
		new Tile("Stone Ground", 103, 131, 151),
		new Tile("Dark Stone Ground", 123, 140, 172),
		new Tile("Iron Ore", 130, 155, 203),
		new Tile("Stone Moss", 207, 241, 255)
	]),
	CLAY : new TileFilter([
		new Tile("Clay Wall", 193, 100, 54),
		new Tile("Clay Ground", 232, 139, 105),
		new Tile("Tin Ore", 142, 122, 118),
		new Tile("Chrysalis", 252, 166, 148),
		new Tile("Clay Moss", 126, 87, 78)
	]),
	WILDERNESS : new TileFilter([
		new Tile("Grass Wall", 22, 131, 27),
		new Tile("Grass Ground", 61, 155, 65),
		new Tile("Tilled Grass Ground", 12, 115, 43),
		new Tile("Scarlet Ore", 206, 59, 59),
		new Tile("Ground Poison Slime", 184, 86, 165),
		new Tile("Lush Moss", 163, 206, 74)
	]),
	SEA : new TileFilter([
		new Tile("Limestone Wall", 180, 147, 154),
		new Tile("City Wall", 49, 77, 87),
		new Tile("Beach Sand Ground", 235, 192, 190),
		new Tile("City Floor", 87, 128, 132),
		new Tile("Octarine Ore", 139, 82, 238),
		new Tile("Sea Water", 52, 208, 255),
		new Tile("Ground Slippery Slime", 47, 47, 255),
		new Tile("Urban Moss", 42, 210, 62)
	])
};