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
			this.translations = Object.keys(data.translations); 

			// Create array of sentence objects
			var sentences = [];
			sentences[0] = data.words;
			
			for (var i = 0; i < sentences[0].length; i++) {
				var word = sentences[0][i];

				for (var j = 0; j < this.translations.length; j++) {
					var lang = this.translations[j];

					// HACK, 'til we have the lang attr avail on words
					var words = word.translations.filter(function(trans) {
						trans.lang = lang;					
						return trans.CTS.indexOf(lang) !== -1;
					});

					if (sentences[j+1] === undefined) { 
						sentences[j+1] = [];
					}

					sentences[j+1] = sentences[j+1].concat(words); 

				}

			}

			return sentences;
		}
	});

});
