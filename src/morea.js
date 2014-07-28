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

	/**
	 * Initialize plugin.
	 */
	morea.prototype.init = function() {

	};

	morea.prototype.render = function(e) {

	};

	return morea;

});
