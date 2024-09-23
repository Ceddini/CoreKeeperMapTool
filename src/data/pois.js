const RINGS = {
	DESERT: "Desert",
	WILDERNESS: "Wilderness",
	SUNKENSEA: "Sunken Sea",
	STONE: "Stone",
	CLAY: "Clay",
	PASSAGE: "Passage"
};

const BIOMES = {
	DESERT: { name: "desert_of_beginnings", ring: RINGS.DESERT },
	WILDERNESS: { name: "the_wilderness", ring: RINGS.WILDERNESS },
	SUNKENSEA: { name: "sunken_sea", ring: RINGS.SUNKENSEA },
	STONE: { name: "stone", ring: RINGS.STONE },
	CLAY: { name: "clay", ring: RINGS.CLAY },
	DIRT: { name: "the_underground" },
	HIVE: { name: "larva_hive", ring: RINGS.CLAY },
	RUINS: { name: "ruins", ring: RINGS.STONE },
	PASSAGE: { name: "passage", ring: RINGS.PASSAGE }
};

class CircleItem {
	visible = false;
	disabled = false;

	constructor(name, longName, locations, radii, color, textColor, tooltip, wikiUrl, image) {
		this.name = name;
		this.longName = longName;
		this.locations = locations;
		this.radii = radii;
		this.color = color;
		this.textColor = textColor;
		this.tooltip = tooltip;
		this.wikiUrl = wikiUrl;
		this.image = image;
	}

	getTooltipTitle() {
		return this.longName;
	}

	getTooltipContent() {
		let tooltip = `<strong>${this.longName}</strong>`;

		if (this.locations && this.locations)
			tooltip += `<br>Location(s): ${this.locations.map(l => l.name).join(", ")}`;

		if (this.radii)
			tooltip += `<br>Distance(s) from Core: ${this.radii.join(", ")}`;

		return tooltip;
	}

	getTooltipContentAsJsonString() {
		let obj = { name: this.longName };

		if (this.locations)
			obj["locations"] = this.locations.map(l => `$t(poi:location.${l.name})`).join(", ");

		if (this.radii)
			obj["radii"] = this.radii.join(", ");


		return JSON.stringify(obj);
	}
}

class Category {
	constructor(name, items) {
		this.name = name;
		this.items = items;
	}
}

// TODO: Neatening up every available feature
// - TODO: Add tile highlighting
// TODO: Limit Circles to Biome (if biome visible, or if manual biome angle is enabled)
// TODO: Fill FAQ
// TODO: Fix Credits
// TODO: Readd Legend with tile highlighting
// TODO: Toggle all should be more dynamic. Add counter to category. Add 1 when sub button is pressed. Subtract when disabled. and if greater 0 show Toggle off.
// TODO: Recolour bow part rings (main color of item icons or dark greeny / grey like the sea dungeons)
// TODO: Add (?) Symbol where tooltips are present
// TODO: Move "Show Maze Holes" in with the biome stuff
// TODO: Tooltip for Chunk Grid Button: "64x64 grid used by dynamic world generation to spawn set-piece scenes and fill in procedurally generated terrain as players explore within range for the first time."
// TODO: Tooltip for Mob Grid.
// - TODO: Add expandable below "(?) More Info on Mob Grids", once mob grid is enabled
// - TODO: Display text: "16x16 grid of cells used by the mob spawning algorithm. Each cell receives one spawn event every 15 to 22 minutes, staggered in time from other cells. Each spawn surface tile gives a chance to spawn a mob. See this guide: https://steamcommunity.com/sharedfiles/filedetails/?id=2846860078"

const bosses = new Category("bosses", [
	//Early game
	new CircleItem("glurch", "Glurch the Abominous Mass", [BIOMES.DIRT], [65], "#D95917", "#FFFFFF", true, "#", "bosses/glurch.webp"),
	new CircleItem("ghorm", "Ghorm the Devourer", [BIOMES.STONE, BIOMES.CLAY], [200], "#7F5F30", "#FFFFFF", true, "#", "bosses/ghorm.png"),
	new CircleItem("malugaz", "Malugaz the Corrupted", [BIOMES.RUINS], [300], "#1f4ec9", "#FFFFFF", true, "#", "bosses/malugaz.png"),
	//Mid game
	new CircleItem("azeos", "Azeos the Sky Titan", [BIOMES.WILDERNESS], [550], "#d2b835", "#FFFFFF", true, "#", "bosses/azeos.png"),
	new CircleItem("omoroth", "Omoroth the Sea Titan", [BIOMES.SUNKENSEA], [650], "#9E3F9B", "#FFFFFF", true, "#", "bosses/omoroth.png"),
	new CircleItem("ra-akar", "Ra-Akar the Sand Titan", [BIOMES.DESERT], [600], "#1d9124", "#FFFFFF", true, "#", "bosses/Ra-Akar_the_Sand_Titan.png"),
	//Late game
	//new CircleItem("druidia", "Druidra the Wild Titan",[BIOMES.WILDERNESS], [0], "#000000", "#FFFFFF", true, "#", ""),
	//new CircleItem("crydra", "Crydra the Ice Titan",[BIOMES.SUNKENSEA], [0], "#000000", "#FFFFFF", true, "#", ""),
	//new CircleItem("pyrdra", "Pyrdra the Fire Titan",[BIOMES.DESERT], [0], "#000000", "#FFFFFF", true, "#", ""),
	//new CircleItem("commander", "Core Commander", [BIOMES.DESERT], [0], "#000000", "#FFFFFF", true, "#", ""),
]);


const optionalBosses = new Category("optional_bosses", [
	new CircleItem("hive_mother", "The Hive Mother", [BIOMES.HIVE], [330], "#FCA694", "#FFFFFF", true, "#", "bosses/hive_mother.png"),
	new CircleItem("ivy", "Ivy the Poisonous Mass", [BIOMES.WILDERNESS], [600], "#FF00FF", "#FFFFFF", true, "#", "bosses/ivy.png"),
	new CircleItem("morpha", "Morpha the Aquatic Mass", [BIOMES.SUNKENSEA], [700], "#1898F4", "#FFFFFF", true, "#", "bosses/morpha.png"),
	new CircleItem("igneous", "Igneous the Molten Mass", [BIOMES.DESERT], [650], "#484454", "#FFFFFF", true, "#", "bosses/Igneous_the_Molten_Mass.png"),
	//new CircleItem("Atlantean", "Atlantean Worm", [BIOMES.SUNKENSEA], [0], "#000000", "#FFFFFF", true, "#", ""),
	//new CircleItem("urschleim", "Urschleim", [BIOMES.PASSAGE], [1250], "#484454", "#FFFFFF", true, "#", ""),
]);

const pois = new Category("points_of_interest", [
	new CircleItem("mold_dungeon", "Mold Dungeon", [BIOMES.WILDERNESS], [750], "#6CBBE0", "#FFFFFF", true, "#", "items/poisonous_sickle.png"),
	new CircleItem("the_vault", "The Vault", [BIOMES.SUNKENSEA], [500], "#e4ad2a", "#FFFFFF", true, "#", "items/glyph_parchment.png"),
	new CircleItem("broken_core_1", "Broken Core 1", [BIOMES.SUNKENSEA], [550], "#e4ad2a", "#FFFFFF", true, "#", "items/channeling_gemstone.png"),
	new CircleItem("broken_core_2", "Broken Core 2", [BIOMES.SUNKENSEA], [650], "#e4ad2a", "#FFFFFF", true, "#", "items/fractured_limbs.png"),
	new CircleItem("broken_core_3", "Broken Core 3", [BIOMES.SUNKENSEA], [750], "#e4ad2a", "#FFFFFF", true, "#", "items/energy_string.png"),
	new CircleItem("titan_temple", "Titan Temple", [BIOMES.DESERT], [650], "#f2df3a", "#000000", true, "#", "items/Godsent_King_Mask.png"),
	new CircleItem("prince_dungeon", "Prince Dungeon", [BIOMES.DESERT], [500], "#239029", "#FFFFFF", true, "#", "items/Ra-Akar_Automaton.png"),
	new CircleItem("queen_dungeon", "Queen Dungeon", [BIOMES.DESERT], [600], "#a555a4", "#FFFFFF", true, "#", "items/Azeos_Feather_Fan.png"),
	new CircleItem("king_dungeon", "King Dungeon", [BIOMES.DESERT], [700], "#19bdc6", "#000000", true, "#", "items/Omoroth_Compass.png"),
	new CircleItem("ancient_forge", "Ancient Forge", [BIOMES.DESERT], [650], "#91210b", "#FFFFFF", true, "#", "items/Soul_Seeker.png"),
	new CircleItem("crystal_meteor", "Crystal Meteor", [BIOMES.DESERT], [700], "#94f7dd", "#000000", true, "#", "items/Crystal_Meteor_Shard.png"),
]);

const categories = [
	bosses,
	optionalBosses,
	pois,
];

document.addEventListener('alpine:init', function () {
	Alpine.store('categories', categories);
});

function toggleCircle(circle) {
	circle.visible = !circle.visible;
	circle.disabled = true;
	redrawMap();
	circle.disabled = false;
}

function toggleTile(tile) {
	tile.visible = !tile.visible;

	if (tile.visible)
		Alpine.store('tilecolormap').visible.push(tile);
	else
		Alpine.store('tilecolormap').visible = Alpine.store('tilecolormap').visible.filter((e) => e.name != tile.name);

	tile.disabled = true;
	redrawMap();
	tile.disabled = false;
}

function toggleCategoryCircles(circles) {
	const firstItemVisibility = circles[0].visible;
	circles.forEach(circle => { circle.visible = !firstItemVisibility; circle.disabled = true; });
	redrawMap();
	circles.forEach(circle => { circle.disabled = false; });
}

function toggleCategoryTiles(tiles) {
	const firstItemVisibility = tiles[0].visible;

	tiles.forEach(tile => { tile.visible = !firstItemVisibility; tile.disabled = true; });

	for (tile of tiles) {
		if (tile.visible)
			Alpine.store('tilecolormap').visible.push(tile);
		else
			Alpine.store('tilecolormap').visible = Alpine.store('tilecolormap').visible.filter((e) => e.name != tile.name);
	}

	redrawMap();
	tiles.forEach(tile => { tile.disabled = false; });
}