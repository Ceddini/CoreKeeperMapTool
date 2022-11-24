function allowAnalytics() {
	Alpine.store("data").acceptedAdTracking = false;
	Alpine.store("data").acceptedAnalytics = true;
	saveCookieSelection();
}

function saveCookieSelection() {
	Alpine.store("data").savedCookies = true;
	Alpine.store("data").cookiesOpen = false;
	saveGoogleAnalyticsCookie();
	saveAdTrackingCookie();
	localStorage.setItem("savedCookies", true);
}

function saveGoogleAnalyticsCookie() {
	const accepted = Alpine.store("data").acceptedAnalytics;
	if (accepted) {
		gtag('consent', 'update', {
			'analytics_storage': 'granted'
		});

	} else {
		gtag('consent', 'update', {
			'analytics_storage': 'denied'
		});

	}
	localStorage.setItem("acceptedAnalytics", accepted);
}

function saveAdTrackingCookie() {
	const accepted = Alpine.store("data").acceptedAdTracking;
	if (accepted) {
		gtag('consent', 'update', {
			'ad_storage': 'granted'
		});
	} else {
		gtag('consent', 'update', {
			'ads_storage': 'denied'
		});
	}
	localStorage.setItem("acceptedAdTracking", accepted);
}