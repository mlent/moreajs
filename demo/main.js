requirejs.config({
	'baseUrl': '../',
	'paths': {
		'morea': 'src/morea'
	},
	'shim': {
		'morea': {
			'exports': 'morea'
		}
	}
});

require(['morea'], function(Morea) {

	new Morea('div', { 
		mode: 'edit',
		dataUrl: 'http://139.18.40.154:8000/api/v1/sentence/401/?full=True',
		lang: 'eng',
		callback: function(response_text) {
			var data = JSON.parse(response_text);
			this.langs = Object.keys(data.translations); 

			// TODO: Streamline data acquisition, make async w/ event handling
			// Create array of sentence objects
			var sentences = [];
			sentences[0] = data;

			// Get other translations
			for (var i = 0; i < this.langs.length; i++) {
				var request = new XMLHttpRequest();
				request.open('GET', data.translations[this.langs[i]] + '?full=True', false);
				request.onload = function() {
					if (request.status >= 200 && request.status < 400)
						sentences[i+1] = JSON.parse(request.responseText);
					else
						console.log("Error fetching document at " + data.translations[this.langs[i]]);
				};
				request.send();
			}

			return sentences;
		}
	});

});
