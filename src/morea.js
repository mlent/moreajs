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

		if (this.config.mode === 'play') {
			this.data.forEach(function(sentObj) {
				var words = sentObj.words;

				for (var i = 0, word; word = words[i]; i++)
					word.translations = [];
			});
		}

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

	/**
	 * Hovering over a node shows all the current links.
	 */
	morea.prototype.focusNode = function(e) {

		var translations = e.toElement.dataset.translations.split(",");
		var wordNodes = this.el.querySelectorAll('span');

		var matches = this._getAllRelatedAlignments(translations);

		for (var i = 0; i < wordNodes.length; i++) {
			if (matches.indexOf(wordNodes[i].dataset.cts) !== -1) 
				wordNodes[i].addClass('hovered');
		}

	};

	/**
	 * Clicking a node allows you to edit the links it has.
	 */
	morea.prototype.editNode = function(e) {
		var wordNodes = this.el.querySelectorAll('span');

		// If they're already , modify links (add/remove) 
		if (this.el.className.indexOf('editing') !== -1) {
			if (e.toElement.className.indexOf('linked') !== -1)
				this.removeLink(e);
			else
				this.createLink(e);

			return;
		}

		// Otherwise, "intialize" editing environment -- put el in edit mode, highlight existing links
		e.toElement.addClass('selected');
		e.toElement.addClass('linked');

		var translations = e.toElement.dataset.translations.split(",");
		var matches = this._getAllRelatedAlignments(translations);

		this.el.addClass('editing');

		for (var i = 0; i < wordNodes.length; i++) {
			if (matches.indexOf(wordNodes[i].dataset.cts) !== -1) { 
				wordNodes[i].addClass('linked');
			}
			wordNodes[i].setAttribute('data-tooltip', '');
		}
	};

	morea.prototype.stopEditing = function(e) {
		e.preventDefault();
		this.unfocusNodes();

		var wordNodes = this.el.querySelectorAll('span');

		for (var i = 0; i < wordNodes.length; i++) {
			wordNodes[i].removeClass('linked');
			wordNodes[i].removeClass('selected');
		}

		this.el.removeClass('editing');
	};

	morea.prototype.createLink = function(e) {
		e.toElement.addClass('linked');
		e.toElement.addClass('hovered');

		// Update our internal data structure
		var targetCTS = e.toElement.dataset.cts;
		var linkNodes = Array.prototype.slice.call(this.el.querySelectorAll('.linked'));
		linkNodes = linkNodes.concat(Array.prototype.slice.call(this.el.querySelectorAll('.hovered')));

		// Extract just the CTS properties of all links
		var links = [], that = this;
		for (var i = 0, node; node = linkNodes[i]; i++) {
			links.push(node.dataset.cts);
		}
			
		// Update the translations in our actual data
		var words = [].concat.apply([], this.data.map(function(sentence) {
			return sentence.words;
		}));

		// newWords -- must also include the existing links of that word
		var newWords = words.filter(function(word) {
			return links.indexOf(word.CTS) !== -1;
		});

		this.data.forEach(function(sentObj, i) {
			var words = sentObj.words;

			for (var i = 0, word; word = words[i]; i++) {
				if (links.indexOf(word.CTS) !== -1)  {
					that.insertTranslation(word, newWords);
					that.insertTranslation(newWords, word);
				}
			}
		});
	};

	/**
	 * Insert source word as translation in dest.
	 * @param {object} source - Word to be added into Dest's translation list. Can be object or array.
	 * @param {object} dest - Word to receive source as a translation. Can be object or array.
	 */
	// TODO: Prevent beispielsweise Farsi from having English translations directly linked
	morea.prototype.insertTranslation = function(source, dest) {
		var that = this, isNew;

		// TODO: Find out if there is a better way to check for which is an array of objects. toString results in [obj Obj] in both cases.
		// Means we are adding many translations to Dest
		if (source[0] !== undefined) {

			// Create list of CTS to check against
			var links = source.map(function(obj) {
				return obj.CTS;
			});
			isNew = (dest.translations.filter(function(word) {
				return links.indexOf(word.CTS) !== -1;
			}).length === 0);

			if (!isNew) return;

			// Filter out links we don't want:
			//	1. The language is the same (e.g. don't align greek to greek)
			//	2. One of the languages isn't the primary source (e.g. don't align english to farsi)

			source = source.filter(function(word) {
				return word.lang !== dest.lang && (word.lang === 'grc' || dest.lang === 'grc');
			});

			// Update data structure
			dest.translations = dest.translations.concat(source);

			// Update DOM
			var el = this.el.querySelector('span[data-cts="' + dest.CTS + '"]');
			var trans = el.dataset.translations.split(",");
			el.setAttribute('data-translations', trans.concat(links).join(","));
			el.addClass('linked');
		}

		// Means we are adding source to many translations
		if (dest[0] !== undefined) {

			// Check each destination, whether source is already in its translations array
			for (var i = 0; i < dest.length; i++) {
				var isNew = (dest[i].translations.filter(function(word) {
					return word.CTS === source.CTS;
				}).length === 0);

				if (!isNew) continue;

				// Filter the destination out if it's the same language as source
				if (dest[i].lang === source.lang || (source.lang !== 'grc' && dest[i].lang !== 'grc')) continue;

				// Update data structure
				dest[i].translations.push(source);

				// Update DOM
				var el = this.el.querySelector('span[data-cts="' + dest[i].CTS + '"]');
				var trans = el.dataset.translations.split(",");
				trans.push(source.CTS);
				el.setAttribute('data-translations', trans.join(","));
				el.addClass('linked');
			}
		}
	};

	morea.prototype.removeLink = function(e) {
		e.toElement.removeClass('linked');
		e.toElement.removeClass('hovered');

		// Update our internal data structure
		var targetCTS = e.toElement.dataset.cts;
		var linkNodes = Array.prototype.slice.call(this.el.querySelectorAll('.linked'));
		linkNodes = linkNodes.concat(Array.prototype.slice.call(this.el.querySelectorAll('.selected')));

		// Extract just the CTS properties of all links
		var links = [], that = this;
		for (var i = 0, node; node = linkNodes[i]; i++)
			links.push(node.dataset.cts);
			
		// Update the translations in our actual data
		var words = [].concat.apply([], this.data.map(function(sentence) {
			return sentence.words;
		}));
		var newWord = words.filter(function(word) {
			return word.CTS === targetCTS;
		})[0];
		this.data.forEach(function(sentObj, i) {
			var words = sentObj.words;

			for (var i = 0, word; word = words[i]; i++) {
				if (links.indexOf(word.CTS) !== -1)  {

					// Splice out our targetCTS from links
					that.removeTranslation(word, newWord);
					that.removeTranslation(newWord, word);
				}
			}
		});
	};

	/**
	 * Remove source word as translation in dest.
	 * @param {object} source - Word to be removed from Dest's translation list.
	 * @param {object} dest - Word to be removed from source as a translation.
	 */
	morea.prototype.removeTranslation = function(source, dest) {

		// Update data structure and DOM
		dest.translations = dest.translations.filter(function(obj) {
			return obj.CTS !== source.CTS;
		});

		var el = this.el.querySelector('span[data-cts="' + source.CTS + '"]');
		var trans = el.dataset.translations.split(",");
		trans.splice(trans.indexOf(source.CTS), 1);
		el.setAttribute('data-translations', trans.join());
	};

	morea.prototype.unfocusNodes = function(e) {
		
		var wordNodes = this.el.querySelectorAll('span');

		for (var i = 0; i < wordNodes.length; i++) {
			wordNodes[i].removeClass('hovered');
		}
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

	morea.prototype._renderHeader = function() {

		// Add header
		this.header = document.createElement('div');
		this.header.className = 'header';

		// Add Translation Link
		var btnAddTrans = document.createElement('a');
		btnAddTrans.innerHTML = 'Add Translation';
		btnAddTrans.className = 'btn';
		btnAddTrans.setAttribute('id', 'btn-add-translation');
		btnAddTrans.setAttribute('href', '#');

		// Button container
		var btnContainer = document.createElement('div');
		btnContainer.className = 'btn-container';

		// Add Buttons
		var btnDone = document.createElement('a');
		btnDone.innerHTML = 'Done';
		btnDone.className = 'btn';
		btnDone.setAttribute('id', 'btn-done');
		btnDone.setAttribute('href', '#');

		var btnEdit = document.createElement('a');
		btnEdit.innerHTML = 'Edit';
		btnEdit.className = 'btn';
		btnEdit.setAttribute('id', 'btn-edit');
		btnEdit.setAttribute('href', '#');

		var btnMerge = document.createElement('a');
		btnMerge.innerHTML = 'Merge';
		btnMerge.className = 'btn';
		btnMerge.setAttribute('id', 'btn-merge');
		btnMerge.setAttribute('href', '#');

		// Event Listeners
		btnAddTrans.addEventListener('click', this.toggleForm.bind(this));
		btnDone.addEventListener('click', this.stopEditing.bind(this));

		// Editing Buttons
		this.header.appendChild(btnAddTrans);
		btnContainer.appendChild(btnDone);
		//this.header.appendChild(btnEdit);
		//this.header.appendChild(btnMerge);
		this.header.appendChild(btnContainer);
		this.el.appendChild(this.header);
	};

	morea.prototype.render = function(e) {
		
		if (this.el.className.indexOf('morea') === -1)
			this.el.addClass('morea');

		this.el.innerHTML = '';
		this._renderHeader();	

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
			if (this.className.indexOf(add) === -1)
				this.className += ' ' + add;

			this.className.trim();
		};
	}

	return morea;

});
