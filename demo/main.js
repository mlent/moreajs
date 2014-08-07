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
		targetLang: ['eng']
	});

});
