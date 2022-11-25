const supportedLngs = {
	en: { nativeName: "English" },
	de: { nativeName: "Deutsch" },
}

const rerender = (t) => {
	console.log("Rerendering...");
	$('body').localize();
	document.title = t('page_title');
};


$(function () {
	i18next.use(i18nextBrowserLanguageDetector).use(i18nextChainedBackend).init({
		debug: true,
		fallbackLng: ["en", "de"],
		detection: {
			order: ['localStorage', 'navigator'],
			caches: ['localStorage'],
		},
		ns: ["translation", "faq"],
		backend: {
			backends: [
				//i18nextLocalStorageBackend,
				i18nextHttpBackend
			],
			backendOptions: [
				//{},
				{
					load: "languageOnly",
					loadPath: "/locales/{{lng}}/{{ns}}.json"
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
				rerender(t);
			});
		});

		rerender(t);
		curtain.classList.add("hidden");
		setTimeout(() => {
			curtain.remove();
		}, 350);
	});
});


