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
		dataUrl: 'data.json',
		lang: 'eng',
		callback: function(response_text) {
			var data = JSON.parse(response_text);

			// Create array of sentence objects
			this.translations = data.translations;

			var sentences = [];
			sentences[0] = data.words;

			return sentences;
		}
	});

});
