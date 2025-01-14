const supportedLngs = {
	en: { nativeName: "English" },
	de: { nativeName: "Deutsch" },
}

$(function () {
	i18next.use(i18nextBrowserLanguageDetector).use(i18nextChainedBackend).init({
		debug: false,
		fallbackLng: ["en", "de"],
		detection: {
			order: ['localStorage', 'navigator'],
			caches: ['localStorage'],
		},
		ns: ["translation", "faq", "poi"],
		load: "languageOnly",
		backend: {
			backends: [
				//i18nextLocalStorageBackend,
				i18nextHttpBackend
			],
			backendOptions: [
				//{},
				{
					load: "languageOnly",
					loadPath: "./locales/{{lng}}/{{ns}}.json"
				}
			]
		},
	}, function (err, t) {
		const curtain = document.getElementById("curtain");

		jqueryI18next.init(i18next, $, { useOptionsAttr: true });


		Object.keys(supportedLngs).map(lng => {
			const opt = new Option(supportedLngs[lng].nativeName, lng);
			if (lng === i18next.resolvedLanguage) {
				opt.setAttribute("selected", "");
			}
			$("#languageSwitcher").append(opt);
		});

		$("#languageSwitcher").change((e) => {
			const chosenLng = e.target.value;
			i18next.changeLanguage(chosenLng, () => {
				console.log(chosenLng);
				location.reload();
			});
		});

		curtain.classList.add("hidden");
		setTimeout(() => {
			curtain.remove();
		}, 350);

		$('body').localize();
		document.title = t('page_title');
		document.querySelectorAll("[data-poi-tooltip]").forEach((elem) => {
			const s = t('poi:description', {
				...JSON.parse(elem.dataset.poiTooltip),
				interpolation: {
					skipOnVariables: false
				}
			});
			elem.dataset.bsTitle = s;
		});
	});
});


