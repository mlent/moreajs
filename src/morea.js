define(function() {
	
	'use strict';

	/**
	 * Constructor.
	 * @param {object} selector - text or the node itself (useful for scoping/esp. with backbone).
	 * @param {object} options - configuration options for alignment editor.
	 */
	function morea(selector, options) {
		/*jshint validthis:true */

		if (typeof(selector) === 'string')
			this.el = document.querySelector(selector);
		else
			this.el = selector;

		this.options = options || {};

		if (this.el === null) {
			console.log("Could not find DOM object.");
			return this;
		}

		this.init();
		return this;

	};

	morea.prototype.defaults = {
		mode: 'edit',
		data: null,					// Array of sentence objects
		dataUrl: null,				// Or an endpoint + callback to process the data
		orientation: 'horizontal'
	};

	/**
	 * Initialize plugin.
	 */
	morea.prototype.init = function() {
		this.config = this._extend({}, this.defaults, this.options);
		this.data = this.config.data || this._fetchData(this.config.dataUrl);
		this.render();
	};

	morea.prototype._fetchData = function(dataUrl) {
		var request = new XMLHttpRequest();
		var out = {};
		request.open('GET', dataUrl, false);

		request.onload = function() {
			if (request.status >= 200 && request.status < 400) {
				// Use the user's defined callback
				out = this.config.callback(request.responseText);
			}
			else
				console.log("");
		}.bind(this);

		request.send();
		
		return out;
	};

	morea.prototype.render = function(e) {
		
		if (this.el.className.indexOf('morea') === -1)
			this.el.className += ' morea';

		this.el.innerHTML = '';

		// For each sentence, add words inside a subcontainer
		for (var i = 0; i < this.data.length; i++) {
			var el = document.createElement('div');
			el.className = 'sentence';

			for (var j = 0; j < this.data[i].length; j++) {
				var word = document.createElement('span');
				word.innerHTML = this.data[i][j].value;
				el.appendChild(word);
				el.appendChild(document.createTextNode(' '));
			}

			this.el.appendChild(el);
		}

	};

	// ------------------------- //
	// Utility Functions         //
	// ------------------------- //
	morea.prototype._extend = function(out) {
		out = out || {};

		for (var i = 1; i < arguments.length; i++) {
			if (!arguments[i])
				continue;

			for (var key in arguments[i]) {
				if (arguments[i].hasOwnProperty(key))
					out[key] = arguments[i][key];
			}
		}

		return out;
	};

	return morea;

});
