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

	morea.prototype.showAligned = function(e) {
		var translations = e.toElement.dataset.translations.split(",");
		var wordNodes = this.el.querySelectorAll('span');

		var matches = this._getAllRelatedAlignments(translations);

		for (var i = 0; i < wordNodes.length; i++) {
			if (matches.indexOf(wordNodes[i].dataset.cts) !== -1) 
				wordNodes[i].className = 'aligned';
		}

	};

	morea.prototype.hideAligned = function(e) {
		var wordNodes = this.el.querySelectorAll('span');

		for (var i = 0; i < wordNodes.length; i++)
			wordNodes[i].className = '';
	};

	morea.prototype._getAllRelatedAlignments = function(translations) {
		var alignments = [];
		var words = [].concat.apply([], this.data.map(function(sentence) {
			return sentence.words;
		}));
		
		// First run though, get all connected words
		for (var i = 0; i < words.length; i++) {
			if (alignments.indexOf(words[i].CTS) === -1 && translations.indexOf(words[i].CTS) !== -1) {
				alignments.push(words[i].CTS);
			}
		}
		
		// Then get all words where a word in alignments is in one of their translations
		for (var i = 0; i < words.length; i++) {
			var toCheck = words[i].translations.map(function(el) {
				return el.CTS;	
			});
			if (this._anyMatchInArray(alignments, toCheck))
				alignments.push(words[i].CTS);
		}

		return alignments;
	};

	morea.prototype.render = function(e) {
		
		if (this.el.className.indexOf('morea') === -1)
			this.el.className += ' morea';

		this.el.innerHTML = '';

		// For each sentence, add words inside a subcontainer
		for (var i = 0; i < this.data.length; i++) {
			var el = document.createElement('div'), lang = '';
			el.className = 'sentence';

			// HACK, til we have lang attrs
			if (this.data[i].CTS.indexOf('fas') !== -1)
				lang = 'fas';
			else if (this.data[i].CTS.indexOf('eng') !== -1)
				lang = 'eng';
			else
				lang = 'grc';

			if (lang === 'fas')
				el.className += ' rtl';

			for (var j = 0; j < this.data[i].words.length; j++) {
				var word = document.createElement('span');
				word.innerHTML = this.data[i].words[j].value;

				var translations = this.data[i].words[j].translations.map(function(word) {
					return word.CTS;
				}).toString();

				word.setAttribute('data-translations', translations);
				word.setAttribute('data-cts', this.data[i].words[j].CTS);
				word.setAttribute('lang', lang);

				word.addEventListener("mouseover", this.showAligned.bind(this));
				word.addEventListener("mouseout", this.hideAligned.bind(this));

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

	morea.prototype._anyMatchInArray = function(target, toMatch) {
		var found = false, map = {}, i, j, current;

		for (i = 0, j = target.length; i < j; i++) {
			current = target[i];
			map[current] = true;
		}

		for (i = 0, j = toMatch.length; !found && (i < j); i++) {
			current = toMatch[i];
			found = !!map[current];
		}

		return found;
	};

	return morea;

});
