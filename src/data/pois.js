class CircleItem {
	visible = false;
	disabled = false;

	constructor(name, longName, location, radii, color, textColor, tooltip, wikiUrl, image) {
		this.name = name;
		this.longName = longName;
		this.location = location;
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

		if (this.location && this.location != "")
			tooltip += `<br>Location: ${this.location}`;

		if (this.radii)
			tooltip += `<br>Distance(s) from Core: ${this.radii.join(", ")}`;

		return tooltip;
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

const bosses = new Category("Bosses", [
	new CircleItem("Glurch", "Glurch the Abominous Mass", "Dirt Biome", [65], "#D95917", "#FFFFFF", true, "#", "bosses/glurch.webp"),
	new CircleItem("Ghorm", "Ghorm the Devourer", "Dirt & Clay Biome", [220], "#7F5F30", "#FFFFFF", true, "#", "bosses/ghorm.png"),
	new CircleItem("Hive Mother", "The Hive Mother", "Hive Biome", [330], "#FCA694", "#FFFFFF", true, "#", "bosses/hive_mother.png"),
	new CircleItem("Azeos", "Azeos the Sky Titan", "Wilderness", [600], "#d2b835", "#FFFFFF", true, "#", "bosses/azeos.png"),
	new CircleItem("Omoroth", "Omoroth the Sea Titan", "Sunken Sea", [1100], "#9E3F9B", "#FFFFFF", true, "#", "bosses/omoroth.png"),
	new CircleItem("Ra-Akar", "Ra-Akar the Sand Titan", "Desert of Beginnings", [1000], "#1d9124", "#FFFFFF", true, "#", "bosses/Ra-Akar_the_Sand_Titan.png"),
]);


const optionalBosses = new Category("Optional Bosses", [
	new CircleItem("Malugaz", "Malugaz the Corrupted", "Ruins", [350], "#1f4ec9", "#FFFFFF", true, "#", "bosses/malugaz.png"),
	new CircleItem("Ivy", "Ivy the Poisonous Mass", "Wilderness", [900], "#FF00FF", "#FFFFFF", true, "#", "bosses/ivy.png"),
	new CircleItem("Morpha", "Morpha the Aquatic Mass", "Sunken Sea", [1400], "#1898F4", "#FFFFFF", true, "#", "bosses/morpha.png"),
	new CircleItem("Igneous", "Igneous the Molten Mass", "Desert of Beginnings", [1400], "#484454", "#FFFFFF", true, "#", "bosses/Igneous_the_Molten_Mass.png"),
]);

const pois = new Category("Points of Interest", [
	new CircleItem("Mold Dungeon", "Mold Dungeon", "", [750], "#6CBBE0", "#FFFFFF", true, "#", "items/poisonous_sickle.png"),
	new CircleItem("The Vault", "The Vault", "", [1000], "#e4ad2a", "#FFFFFF", true, "#", "items/glyph_parchment.png"),
	new CircleItem("Broken Core 1", "Broken Core 1", "", [1250], "#e4ad2a", "#FFFFFF", true, "#", "items/channeling_gemstone.png"),
	new CircleItem("Broken Core 2", "Broken Core 2", "", [1550], "#e4ad2a", "#FFFFFF", true, "#", "items/fractured_limbs.png"),
	new CircleItem("Broken Core 3", "Broken Core 3", "", [1750], "#e4ad2a", "#FFFFFF", true, "#", "items/energy_string.png"),
	new CircleItem("Titan Temple", "Titan Temple", "", [900], "#f2df3a", "#000000", true, "#", "items/Godsent_King_Mask.png"),
	new CircleItem("Prince Dungeon", "Prince Dungeon", "", [1100], "#239029", "#FFFFFF", true, "#", "items/Ra-Akar_Automaton.png"),
	new CircleItem("Queen Dungeon", "Queen Dungeon", "", [1300], "#a555a4", "#FFFFFF", true, "#", "items/Azeos_Feather_Fan.png"),
	new CircleItem("King Dungeon", "King Dungeon", "", [1500], "#19bdc6", "#000000", true, "#", "items/Omoroth_Compass.png"),
	new CircleItem("Ancient Forge", "Ancient Forge", "", [1600], "#91210b", "#FFFFFF", true, "#", "items/Soul_Seeker.png"),
	new CircleItem("Crystal Meteor", "Crystal Meteor", "", [1200], "#94f7dd", "#000000", true, "#", "items/Crystal_Meteor_Shard.png"),
]);;

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
	redrawMapDirty();
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

	redrawMapDirty();
	tiles.forEach(tile => { tile.disabled = false; });
}