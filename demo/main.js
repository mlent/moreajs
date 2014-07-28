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

	new Morea('div', { });

});
