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


const bosses = new Category("Bosses", [
	new CircleItem("Glurch", "Glurch the Abominous Mass", "Dirt Biome", [65], "#D95917", "#FFFFFF", true, "#", "bosses/glurch.webp"),
	new CircleItem("Ghorm", "Ghorm the Devourer", "Dirt & Clay Biome", [220], "#7F5F30", "#FFFFFF", true, "#", "bosses/ghorm.png"),
	new CircleItem("Hive Mother", "The Hive Mother", "Hive Biome", [330], "#FCA694", "#FFFFFF", true, "#", "bosses/hive_mother.png"),
	new CircleItem("Azeos", "Azeos the Sky Titan", "Wilderness", [600], "#d2b835", "#FFFFFF", true, "#", "bosses/azeos.png"),
	new CircleItem("Omoroth", "Omoroth the Sea Titan", "Sunken Sea", [1100], "#9E3F9B", "#FFFFFF", true, "#", "bosses/omoroth.png"),
]);

// TODO: Neatening up every available feature

const optionalBosses = new Category("Optional Bosses", [
	new CircleItem("Malugaz", "Malugaz the Corrupted", "Ruins", [350], "#1f4ec9", "#FFFFFF", true, "#", "bosses/malugaz.png"),
	new CircleItem("Ivy", "Ivy the Poisonous Mass", "Wilderness", [900], "#FF00FF", "#FFFFFF", true, "#", "bosses/ivy.png"),
	new CircleItem("Morpha", "Morpha the Aquatic Mass", "Sunken Sea", [1400], "#1898F4", "#FFFFFF", true, "#", "bosses/morpha.png"),
]);

const pois = new Category("Other POIs", [
	new CircleItem("Mold Dungeon", "Mold Dungeon", "", [750], "#6CBBE0", "#FFFFFF", true, "#", "items/poisonous_sickle.png"),
	new CircleItem("The Vault", "The Vault", "", [1000], "#e4ad2a", "#FFFFFF", true, "#", "items/glyph_parchment.png"),
	new CircleItem("Broken Core 1", "Broken Core 1", "", [1250], "#e4ad2a", "#FFFFFF", true, "#", "items/channeling_gemstone.png"),
	new CircleItem("Broken Core 2", "Broken Core 2", "", [1550], "#e4ad2a", "#FFFFFF", true, "#", "items/fractured_limbs.png"),
	new CircleItem("Broken Core 3", "Broken Core 3", "", [1750], "#e4ad2a", "#FFFFFF", true, "#", "items/energy_string.png"),
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

function toggleCategoryCircles(circles) {
	const firstItemVisibility = circles[0].visible;
	circles.forEach(circle => { circle.visible = !firstItemVisibility; circle.disabled = true; });
	redrawMap();
	circles.forEach(circle => { circle.disabled = false; });
}