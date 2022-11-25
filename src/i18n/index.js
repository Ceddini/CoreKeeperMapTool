// i18nextChainedBackend
// i18nextLocalStorageBackend
// i18nextHttpBackend

const rerender = () => {
	$('body').localize();
};


$(function () {
	i18next.use(i18nextBrowserLanguageDetector).use(i18nextChainedBackend).init({
		debug: false,
		fallbackLng: "en",
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
		rerender();

		curtain.classList.add("hidden");
		setTimeout(() => {
			curtain.remove();
		}, 350);
		document.title = i18next.t('map_tool');
	});
});


