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
		mode: 'create',
		dataUrl: 'http://139.18.40.154:8000/api/v1/sentence/4/'
	});

});
