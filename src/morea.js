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

	morea.prototype.focusNode = function(e) {


		// Otherwise, show display hover status
		
		var translations = e.toElement.dataset.translations.split(",");
		var wordNodes = this.el.querySelectorAll('span');

		var matches = this._getAllRelatedAlignments(translations);

		for (var i = 0; i < wordNodes.length; i++) {
			if (matches.indexOf(wordNodes[i].dataset.cts) !== -1) 
				wordNodes[i].addClass('hovered');
		}

	};

	morea.prototype.editNode = function(e) {
		this.unfocusNodes();
		var wordNodes = this.el.querySelectorAll('span');

		// Select this node, make appropriate nodes editable
		if (e.toElement.className.indexOf('selected') !== -1) {
			e.toElement.removeClass('selected');
			e.toElement.parentElement.removeClass('editing');

			for (var i = 0; i < wordNodes.length; i++) {
				wordNodes[i].removeClass('linked');
			}
			return;
		}

		// If this word is already aligned, display editing functionality
		if (e.toElement.parentElement.className.indexOf('editing') !== -1) {
			if (e.toElement.className.indexOf('linked') !== -1)
				this.createLink(e);
			else
				this.removeLink(e);

			return;
		}

		// Otherwise, "intialize" editing environment
		e.toElement.addClass('selected');
		var sentenceNodes = this.el.querySelectorAll('.sentence');
		var translations = e.toElement.dataset.translations.split(",");
		var matches = this._getAllRelatedAlignments(translations);

		// Skip first sentence, which is Original Version
		for (var i = 1; i < sentenceNodes.length; i++) {
			sentenceNodes[i].addClass('editing');
		}

		// Assign all currently linked to "linked"
		for (var i = 0; i < wordNodes.length; i++) {
			if (matches.indexOf(wordNodes[i].dataset.cts) !== -1) 
				wordNodes[i].addClass('linked');
		}
	};

	morea.prototype.createLink = function(e) {
		console.log("create link");
		e.toElement.addClass('linked');

		// Update our internal data structure
		var targetCTS = e.toElement.dataset.cts;
		var links = this.el.querySelectorAll('.linked').map(function(node) {
			return node.dataset.cts;
		});
		var words = [].concat.apply([], this.data.map(function(sentence) {
			return sentence.words;
		})).filter(function(word) {
			return this._anyMatchInArray(links, word.CTS);
		});
		
		console.log("words that should all be connected", words);
		
		// Update UI
		var sentenceNodes = this.el.querySelectorAll('.sentence');

	};

	morea.prototype.insertTranslation = function(words, link) {

	};

	morea.prototype.removeTranslation = function(word, translationLinks) {

	}

	morea.prototype.removeLink = function(e) {
		console.log("remove link");
		e.toElement.removeClass('linked');

		// Update our internal data structure

		// Update the element's data-translations field
	};

	morea.prototype.unfocusNodes = function(e) {
		
		var wordNodes = this.el.querySelectorAll('span');

		for (var i = 0; i < wordNodes.length; i++)
			wordNodes[i].removeClass('hovered');
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

	morea.prototype.toggleForm = function(e) {
		e.preventDefault();

		var form = this.header.querySelector('form');
		if (form !== null && form.className !== 'open') {
			form.className = 'open';
			e.toElement.innerHTML = 'Close';
		}
		else if (form !== null && form.className === 'open') { 
			form.className = '';
			e.toElement.innerHTML = 'Add Translation';
		}
		else {
			e.toElement.innerHTML = 'Close';
			this._renderForm();
			this.header.querySelector('form').className = 'open';
		}
	};

	morea.prototype._renderForm = function(e) {
		var form = document.createElement('form');
		var langSelector = document.createElement('select');
		langSelector.setAttribute('name', 'lang');

		// TODO: make this external setting, not hardcoded
		var langs = [
			{
				"hr": "English",
				"code": "eng",
				"dir": "ltr"
			},
			{
				"hr": "Français",
				"code": "fra",
				"dir": "ltr"
			},
			{
				"hr": "فارسی",
				"code": "fas",
				"dir": "rtl"
			}
		];

		var opt = document.createElement('option');
		opt.innerHTML = 'Select Language';

		for (var i = 0; i < langs.length; i++) {
			var option = document.createElement('option');
			option.setAttribute('value', langs[i].code);
			option.innerHTML = langs[i].hr;
			option.setAttribute('data-text-direction', langs[i].dir);
			langSelector.appendChild(option);
		}

		var textBox = document.createElement('textarea');

		var textDirLabel = document.createElement('label');
		textDirLabel.innerHTML = 'Text Direction: '; 

		var ltrRadio = document.createElement('input');
		ltrRadio.setAttribute('type', 'radio');
		ltrRadio.setAttribute('name', 'textdirection');
		ltrRadio.setAttribute('value', 'ltr');
		ltrRadio.setAttribute('id', 'ltr-radio');

		var ltrRadioLabel = document.createElement('label');
		ltrRadioLabel.setAttribute('for', 'ltr-radio');

		ltrRadioLabel.appendChild(ltrRadio);
		ltrRadioLabel.innerHTML += 'Left to Right';

		var rtlRadio = document.createElement('input');
		rtlRadio.setAttribute('type', 'radio');
		rtlRadio.setAttribute('name', 'textdirection');
		rtlRadio.setAttribute('value', 'rtl');
		rtlRadio.setAttribute('id', 'rtl-radio');

		var rtlRadioLabel = document.createElement('label');
		rtlRadioLabel.setAttribute('for', 'rtl-radio');

		rtlRadioLabel.appendChild(rtlRadio);
		rtlRadioLabel.innerHTML += 'Right to Left';

		var tokenOption = document.createElement('label');
		tokenOption.setAttribute('for', 'token-option');

		var checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('id', 'token-option');
		checkbox.setAttribute('name', 'tokenize-punctuation');
		checkbox.setAttribute('value', 'true');

		tokenOption.appendChild(checkbox);
		tokenOption.innerHTML += 'Split punctuation as tokens';

		var btn = document.createElement('button');
		btn.setAttribute('type', 'submit');
		btn.setAttribute('value', 'Align Text');
		btn.innerHTML = 'Align Text';
		btn.addEventListener('click', this.addTranslation.bind(this));

		form.appendChild(textBox);
		form.appendChild(langSelector);
		form.appendChild(textDirLabel);
		form.appendChild(ltrRadioLabel);
		form.appendChild(rtlRadioLabel);
		form.appendChild(tokenOption);
		form.appendChild(btn);

		this.header.appendChild(form);
	};

	morea.prototype.addTranslation = function(e) {
		e.preventDefault();

		var form = this.header.querySelector('form');
		var sentence = form.querySelector('textarea').value.split(" ");
		var lang = form.querySelector('select').value;
		var words = [];

		for (var i = 0; i < sentence.length; i++) {
			words.push({
				value: sentence[i],
				lang: lang,
				length: sentence[i].length,
				translations: [],
				CTS: 'urn:cts:greekLit:tlg0003.tlg001.perseus-' + 'test' + /*lang*/ + ':1.89.1:' + (i + 1) 	// TODO: obviously replace
			});
		}

		var sentence = {
			CTS: 'urn:cts:greekLit:tlg0003.tlg001.perseus-' + 'test' + /*lang*/ + ':1.89.1',
			length: words.length,
			sentence: form.querySelector('textarea').value.trim(),
			translations: {},																	// TODO: obv. replace
			words: words
		};

		this.data.splice(1, 0, sentence);
		this.render();
	};

	morea.prototype.render = function(e) {
		
		if (this.el.className.indexOf('morea') === -1)
			this.el.className += ' morea';

		this.el.innerHTML = '';

		// Add header
		this.header = document.createElement('div');
		this.header.className = 'header';

		var addLink = document.createElement('a');
		addLink.innerHTML = 'Add Translation';
		addLink.setAttribute('href', '#');
		addLink.addEventListener('click', this.toggleForm.bind(this));

		this.header.appendChild(addLink);
		this.el.appendChild(this.header);

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

			if (lang !== 'grc') {
				var x = document.createElement('a');
				x.setAttribute('href', '#');
				x.setAttribute('title', 'Close Translation');
				x.innerHTML = '&times;';
				el.appendChild(x);
			}

			for (var j = 0; j < this.data[i].words.length; j++) {
				var word = document.createElement('span');
				word.innerHTML = this.data[i].words[j].value;

				var translations = this.data[i].words[j].translations.map(function(word) {
					return word.CTS;
				}).toString();

				if (translations.length > 0)
					word.className = 'aligned';

				word.setAttribute('data-translations', translations);
				word.setAttribute('data-cts', this.data[i].words[j].CTS);
				word.setAttribute('lang', lang);

				word.addEventListener("mouseover", this.focusNode.bind(this));
				word.addEventListener("mouseout", this.unfocusNodes.bind(this));
				word.addEventListener("click", this.editNode.bind(this));

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

	if (!HTMLElement.prototype.removeClass) {
		HTMLElement.prototype.removeClass = function(remove) {
			var newList = '';
			var classes = this.className.split(" ");
			for (var i = 0; i < classes.length; i++) {
				if (classes[i] !== remove)
					newList += classes[i] + " ";
			}
			this.className = newList.trim();
		};
	}

	if (!HTMLElement.prototype.addClass) {
		HTMLElement.prototype.addClass = function(add) {
			if (this.className.indexOf('add') === -1)
				this.className += ' ' + add;

			this.className.trim();
		};
	}

	return morea;

});
