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
		data: [],						// Array of sentence objects
		dataUrl: undefined,				// Or an endpoint + callback to process the data
		orientation: 'horizontal',
		user: 'tester',
		targets: []
	};

	/**
	 * Initialize plugin.
	 */
	morea.prototype.init = function() {
		this.config = this._extend({}, this.defaults, this.options);
		
		this._addEvent(window, "resize", this._toggleOrientation.bind(this));
		this.el.addClass('horizontal');

		this.render();

		// TODO: Rip this out and come up with a robust solution for data population
		if (this.config.data.length !== 0) {
			this.data = this.config.data;

			for (var i = 0; i < this.data.length; i++) {

				// Play mode
				var that = this;
				if (this.config.mode === 'play') {
					this.data[i].words.forEach(function(word) {
						word.answers = that._clone(word.translations) || [];
						word.translations = [];
					});
				}

				this.renderSentence(this.data[i]);
			}
		}
		else {
			this.data = [];

			/*
			* Existing modes: create, play, edit. In all modes but create, we need existing translations.
			*/
			var url = this.config.dataUrl;
			if (this.config.mode !== 'create')
				url += '?full=True';

			this._fetchData(url, function(response) {
				var that = this;
				this.data[0] = response;

				// Get the available languages
				var langs = Object.keys(this.data[0].translations);

				// Filter out so we're only returning target languages
				langs = langs.filter(function(l) {
					if (that.config.targets.length === 0)
						return true;
					else
						return that.config.targets.indexOf(l) !== -1;
				});

				// TODO: replace all this gnarly code, when we have lang at doc level. Should come in to us as a config.
				// This config setting should be set by some translation engine outside of this plugin
				this.config.langs = langs.reduce(function(map, el) { 
					var eng = { "fr": "French", "en": "English", "fa": "Farsi", "hr": "Croatian"};
					map[el] = {
						"hr": eng[el],
						"dir": (el === 'fa') ? 'rtl' : 'ltr',
						"resource_uri": that.data[0].translations[el] 
					};
					return map;
				}, {});

				// Need to deal with localization outside of this code, at application level
				this.config.langs[this.data[0].words[0].lang] = {
					"hr": "Greek",
					"resource_uri": this.data[0].resource_uri,
					"dir": "ltr"
				};

				this._updateLoadingFeedback();

				// Only fetch existing alignments if we're going to use them
				if (this.config.mode !== 'create') {
					for (var i = 0; i < langs.length; i++) {
						var url = this.config.langs[langs[i]].resource_uri + '?full=True';
						this._fetchData(url);
					}
				}

			}.bind(this));
		}
	};

	morea.prototype._fetchData = function(dataUrl, callback) {
		var request = new XMLHttpRequest();
		dataUrl += '&format=json';
		request.open('GET', dataUrl, true);
		//request.responseType = 'json';

		request.onload = function() {
			if (request.status >= 200 && request.status < 400) {

				// Render this sentence
				var that = this;

				// Firefox not recognizing responseType = 'json'...
				var sentence = request.responseText;
				if (typeof(sentence) !== 'object') {
					sentence = JSON.parse(sentence);
				}

				sentence.lang = sentence.words[0].lang;		// TODO: derive from CTS

				// Ensure that each word has a translation field. Erase if not in edit mode.
				if (this.config.mode === 'play') {
					sentence.words.forEach(function(word) {
						word.answers = that._clone(word.translations) || [];
						word.answers = word.answers.filter(function(w) {
							return that.config.targets.indexOf(w.lang) !== -1;
						});
						word.translations = [];
					});
				}

				this.data.push(sentence);

				// Perform callback if needed
				if (callback) {
					callback(sentence);
				}

				this.renderSentence(sentence);
				this._updateLoadingFeedback();
			}
			else {
				this.showFeedback("There was an error loading data.");
			}

		}.bind(this);

		request.send(null);
	};

	morea.prototype._updateLoadingFeedback = function() {
		var totalLangs = Object.keys(this.config.langs).length;
		var finishedLangs = this.el.querySelectorAll('.sentence').length;

		if (Object.keys(this.config.langs).length === this.el.querySelectorAll('.sentence').length) {
			this.showFeedback('Done loading &mdash; get started!', true);
			this.config.starttime = new Date();
		}
		else {
			this.showFeedback('Loading alignment ' + (finishedLangs + 1) + '/' + totalLangs);
		}
	};

	/**
	 * Hovering over a node shows all the current links.
	 */
	morea.prototype.focusNode = function(e) {

		var translations = e.target.dataset.translations.split(",");
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

		// Close Form if it's open
		if (this.header.querySelector('form.open') !== null)
			this.toggleForm();

		// If they're already , modify links (add/remove) 
		if (this.el.className.indexOf('editing') !== -1) {
			if (e.target.className.indexOf('linked') !== -1)
				this.removeLink(e);
			else
				this.createLink(e);

			return;
		}

		// Otherwise, "intialize" editing environment -- put el in edit mode, highlight existing links
		e.target.addClass('selected');
		e.target.addClass('linked');

		var translations = e.target.dataset.translations.split(",");
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
		if (e) e.preventDefault();

		this.unfocusNodes();

		var wordNodes = this.el.querySelectorAll('span');
		var newWords = this.el.querySelectorAll('.linked');

		for (var i = 0; i < wordNodes.length; i++) {
			wordNodes[i].removeClass('linked');
			wordNodes[i].removeClass('selected');
		}

		this.el.removeClass('editing');

		if (this.config.mode === 'play') {
			this.checkAnswers();
			
			if (newWords.length === 0)
				return;

			// See which words, which were just updated, are right or wrong:
			var accuracies = [], CTS = [], response = [];
			for (var i = 0, node; node = newWords[i]; i++) {
				CTS.push(node.dataset.cts);
				response.push(node.innerHTML);

				if (node.className.indexOf('bou') !== -1)
					accuracies.push(100);
				else if (node.className.indexOf('wiggle') !== -1)
					accuracies.push(0);
				else
					accuracies.push(50);
			}
			var accuracy = (_.reduce(accuracies, function(prev, curr) {
				return prev + curr;
			}, 0)) / accuracies.length;

			this.sendSubmission(accuracy, CTS, response);
		}
	};
	
	morea.prototype.checkAnswers = function() {

		// Get nodes. Check their translations in the data.
		var wordNodes = this.el.querySelectorAll('span');
		var wordData = [].concat.apply([], this.data.map(function(sentence) {
			return sentence.words;
		}));

		var msg = "", points = 0;

		for (var i = 0; i < wordNodes.length; i++) {
			var CTS = wordNodes[i].dataset.cts;
			
			// Get arrays of CTS ids - one of guesses, one of answers. 
			var guesses = wordNodes[i].dataset.translations;
			guesses = guesses.length === 0 ? [] : guesses.split(",");

			var answers = wordData.filter(function(word) {
				return word.CTS === CTS;
			})[0].answers.map(function(a) {
				return a.CTS;
			});

			if (guesses.length === 0) {
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('wiggle');
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('bou');
				continue;
			}

			// Create a list of matches
			var matches = guesses.filter(function(g) {
				return answers.indexOf(g) !== -1;
			});
			points += matches.length;

			if (matches.length === answers.length && answers.length !== 0) {
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('wiggle');
				this.el.querySelector('span[data-cts="' + CTS + '"]').addClass('bou');
			}
			else if (guesses.length < answers.length) {
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('wiggle');
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('bou');
				msg = msg.length === 0 ? "This phrase requires more words." : msg;
			}
			else if (guesses.length !== 0) {
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('bou');
				this.el.querySelector('span[data-cts="' + CTS + '"]').addClass('wiggle');
				msg = msg.length === 0 ? "One or more of these words isn't right." : msg;
			}
			else {
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('wiggle');
				this.el.querySelector('span[data-cts="' + CTS + '"]').removeClass('bou');
			}
		}

		// Give user feedback
		msg = msg.length === 0 ? "Great Job!" : msg;
		this.showFeedback(msg, true);
		this.updatePoints(points);
	};

	morea.prototype.sendSubmission = function(accuracy, CTS, response) {
		var eventType = 'submitted';
		var e;
		// If Custom event is available, we want this to trasmit data via event about what user has just done 
		if (window.CustomEvent) {
			var detail = {
				"detail": {
					"accuracy": accuracy,
					"task": "align_sentence",
					"response": response,
					"encounteredWords": CTS,
					"starttime": this.config.starttime
				}
			};
			e = new CustomEvent(eventType, detail);
		}
		else {
			e = document.createEvent(eventType);	
		}
		console.log(detail.detail);
		this.el.dispatchEvent(e);
	};

	morea.prototype.updatePoints = function(points) {
		var el = this.header.querySelector('.points');
		var currPoints = parseInt(el.innerHTML);
		if (points > currPoints) {
			el.addClass('bou');
			el.addClass('success');
			this._delayRemoveClass(el, 'bou', 3000);
			this._delayRemoveClass(el, 'success', 3000);
		}
		else if (points < currPoints) {
			el.addClass('wiggle');
			el.addClass('error');
			this._delayRemoveClass(el, 'wiggle', 3000);
			this._delayRemoveClass(el, 'error', 3000);
		}
		el.innerHTML = points;
	};

	morea.prototype.showFeedback = function(msg, autoHide) {
		var el = this.header.querySelector('.feedback');
		el.removeClass('hidden');
		el.innerHTML = msg;

		if (autoHide)
			this._delayAddClass(el, 'hidden', 3000);
	};

	morea.prototype.createLink = function(e) {
		e.target.addClass('linked');
		e.target.addClass('hovered');

		// Update our internal data structure
		var targetCTS = e.target.dataset.cts;
		var linkNodes = Array.prototype.slice.call(this.el.querySelectorAll('.linked'));
		linkNodes = linkNodes.concat(Array.prototype.slice.call(this.el.querySelectorAll('.hovered')));

		// Extract just the CTS properties of all links
		var links = [], that = this;
		for (var i = 0, node; node = linkNodes[i]; i++) {
			if (links.indexOf(node.dataset.cts) === -1)
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
				return (word.lang !== dest.lang) && (word.lang === 'grc' || dest.lang === 'grc') && (word.CTS !== dest.CTS);
			});

			// Return if no words fit criteria
			if (source.length === 0)
				return;

			// Update data structure
			dest.translations = dest.translations.concat(source);
			links = source.map(function(obj) {
				return obj.CTS;
			});

			// Update DOM
			var el = this.el.querySelector('span[data-cts="' + dest.CTS + '"]');
			var trans = el.dataset.translations;
			trans = trans.length === 0 ? [] : trans.split(",");
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
				if (dest[i].lang === source.lang || dest[i].CTS === source.CTS || (source.lang !== 'grc' && dest[i].lang !== 'grc')) continue;

				// Update data structure
				dest[i].translations.push(source);

				// Update DOM
				var el = this.el.querySelector('span[data-cts="' + dest[i].CTS + '"]');
				var trans = el.dataset.translations;
				trans = trans.length === 0 ? [] : trans.split(",");
				trans.push(source.CTS);
				el.setAttribute('data-translations', trans.join(","));
				el.addClass('linked');
			}
		}
	};

	morea.prototype.removeLink = function(e) {
		e.target.removeClass('linked');
		e.target.removeClass('hovered');

		// Update our internal data structure
		var targetCTS = e.target.dataset.cts;
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

		// Update data structure 
		dest.translations = dest.translations.filter(function(obj) {
			return obj.CTS !== source.CTS;
		});

		// and DOM
		var words = [].concat.apply([], dest.translations.map(function(word) {
			return word.CTS;
		}));
		var el = this.el.querySelector('span[data-cts="' + dest.CTS + '"]');
		el.setAttribute('data-translations', words.join(","));

		el = this.el.querySelector('span[data-cts="' + source.CTS + '"]');
		var trans = el.dataset.translations;
		trans = trans.length === 0 ? [] : trans.split(",");
		trans.splice(trans.indexOf(source.CTS), 1);
		el.setAttribute('data-translations', trans.join(","));
	};

	morea.prototype.unfocusNodes = function(e) {
		
		var wordNodes = this.el.querySelectorAll('span');

		for (var i = 0; i < wordNodes.length; i++) {
			wordNodes[i].removeClass('hovered');
		}
	};

	/**
	 * Inputs and outputs by CTS.
	 */
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
		if (e) e.preventDefault();
		var el = this.header.querySelector('#btn-add-translation');

		var form = this.header.querySelector('form');
		if (form !== null && form.className !== 'open') {
			form.className = 'open';
			el.innerHTML = 'Close';
		}
		else if (form !== null && form.className === 'open') { 
			form.className = '';
			el.innerHTML = 'Add Translation';
		}
		else {
			el.innerHTML = 'Close';
			this._renderForm();
			this.header.querySelector('form').className = 'open';
		}
	};

	morea.prototype._toggleOrientation = function(e) {

		if (this.el.offsetWidth < 1000)
			this.el.addClass('horizontal')
		else
			this.el.removeClass('horizontal');
	};

	morea.prototype._renderForm = function(e) {
		var form = document.createElement('form');
		var langSelector = document.createElement('select');
		langSelector.setAttribute('name', 'lang');

		var opt = document.createElement('option');
		opt.innerHTML = 'Select Language';

		var langs = Object.keys(this.config.langs).sort();
		for (var i = 0; i < langs.length; i++) {
			var option = document.createElement('option');
			option.setAttribute('value', langs[i]);
			option.innerHTML = this.config.langs[langs[i]].hr;
			langSelector.appendChild(option);
		}

		var textBox = document.createElement('textarea');

		var tokenOption = document.createElement('label');
		tokenOption.setAttribute('for', 'token-option');

		var checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('id', 'token-option');
		checkbox.setAttribute('name', 'tokenize-punctuation');

		tokenOption.appendChild(checkbox);
		tokenOption.innerHTML += 'Split punctuation as tokens';

		var btn = document.createElement('button');
		btn.setAttribute('type', 'submit');
		btn.setAttribute('value', 'Align Text');
		btn.innerHTML = 'Align Text';
		btn.addEventListener('click', this.addTranslation.bind(this));

		form.appendChild(textBox);
		form.appendChild(langSelector);
		form.appendChild(tokenOption);
		form.appendChild(btn);

		this.header.appendChild(form);
		this.header.querySelector('input[name="tokenize-punctuation"]').checked = true;
	};

	morea.prototype.addTranslation = function(e) {
		e.preventDefault();

		var form = this.header.querySelector('form');
		this.toggleForm();

		// Retrieve then clean sentence input
		var sentenceInput = form.querySelector('textarea');
		var s = sentenceInput.value.trim();
		sentenceInput.value = '';
		
		if (form.querySelector('input[name="tokenize-punctuation"]').checked) {
			s = s.replace(/([\.,-\/#!$%\^&\*;:{}=\-_`~()])/g, " \$1");
		}

		var sentence = s.split(" ");

		// Form the new CTS identifier
		var lang = form.querySelector('select').value;
		var subref = this._getCtsProperty(this.data[0].CTS, "work");
		subref["translation"] = this.config.user + "-" + lang;
		var newCTS = this._setCtsProperty(this.data[0].CTS, {
			"work": subref 
		});

		// Users may only work on individual languages, to avoid confusing document references.
		// Could change in the future, but adds unnecessary complexity now.
		if (this.el.querySelector('[data-cts="' + newCTS + '"]') !== null) {
			alert("You are already working on this language. Click 'Edit' to modify it.");
			return;
		}


		var words = [];

		for (var i = 0; i < sentence.length; i++) {
			words.push({
				value: sentence[i],
				lang: lang,
				length: sentence[i].length,
				translations: [],
				CTS: newCTS + ':' + (i + 1) 	// Setting word number 
			});
		}

		var sentence = {
			CTS: newCTS,
			length: words.length,
			sentence: form.querySelector('textarea').value.trim(),
			translations: {},																	// TODO: obv. replace
			lang: lang,
			words: words
		};

		this.data.splice(1, 0, sentence);
		this.renderSentence(this.data[1]);
	};

	morea.prototype._renderHeader = function() {

		// Add header
		this.header = document.createElement('div');
		this.header.className = 'header';

		// Button container
		var btnContainer = document.createElement('div');
		btnContainer.className = 'btn-container';

		// Add Buttons
		var btnDone = document.createElement('a');
		btnDone.innerHTML = 'Link';
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

		var trackerContainer = document.createElement('div');
		trackerContainer.className = 'tracker';

		// Only users who are editing or creating can add their own translation
		if (this.config.mode !== 'play') {

			// Add Translation Link
			var btnAddTrans = document.createElement('a');
			btnAddTrans.innerHTML = 'Add Translation';
			btnAddTrans.className = 'btn';
			btnAddTrans.setAttribute('id', 'btn-add-translation');
			btnAddTrans.setAttribute('href', '#');

			btnAddTrans.addEventListener('click', this.toggleForm.bind(this));
			this.header.appendChild(btnAddTrans);
		}
		else {

			// Only append points if in play mode
			var points = document.createElement('div');
			points.className = 'points';
			points.innerHTML = '0';
			trackerContainer.appendChild(points);
		}

		// Feedback
		var feedback = document.createElement('div');
		feedback.className = 'feedback';
		trackerContainer.appendChild(feedback);

		// Editing Buttons
		btnContainer.appendChild(btnDone);
		btnDone.addEventListener('click', this.stopEditing.bind(this));

		// Enter automatically assumes done
		this._addEvent(window, "keypress", this.stopEditing.bind(this));

		this.header.appendChild(trackerContainer);
		this.header.appendChild(btnContainer);
		this.el.appendChild(this.header);

		this.showFeedback('Initializing Alignment Editor...');
	};

	morea.prototype.render = function(e) {
		
		if (this.el.className.indexOf('morea') === -1)
			this.el.addClass('morea');

		this.el.innerHTML = '';
		this._renderHeader();	
	};

	morea.prototype.renderSentence = function(sentence) {

		// Adjust width of sentences
		var newWidth = 100 / this.data.length;

		var el, lang;
		if (this.el.querySelector('[data-cts="' + sentence.CTS + '"]') === null) {
			el = document.createElement('div');
			el.className = 'sentence';
			el.setAttribute('lang', sentence.lang);
			el.setAttribute('data-cts', sentence.CTS);
			el.style.width = newWidth + '%';
		}

		// TODO: Get this out of hardcoding to support all RTL langs
		if (this.config.langs[sentence.lang].dir === 'rtl')
			el.addClass('rtl');

		el.innerHTML = '';

		if (sentence.lang !== 'grc' && this.config.mode === 'edit') {
			var x = document.createElement('a');
			x.setAttribute('href', '#');
			x.setAttribute('title', 'Close Translation');
			x.innerHTML = '&times;';
			el.appendChild(x);
		}

		for (var j = 0; j < sentence.words.length; j++) {
			var word = document.createElement('span');
			word.innerHTML = sentence.words[j].value;

			var translations = sentence.words[j].translations.map(function(word) {
				return word.CTS;
			}).toString();
			
			/* Show users which words don't have alignments
			if (this.config.mode === 'play' && sentence.words[j].answers.length === 0)
				word.addClass('disabled');*/

			word.setAttribute('data-translations', translations);
			word.setAttribute('data-cts', sentence.words[j].CTS);
			word.setAttribute('lang', sentence.lang);

			word.addEventListener("mouseover", this.focusNode.bind(this));
			word.addEventListener("mouseout", this.unfocusNodes.bind(this));
			word.addEventListener("click", this.editNode.bind(this));

			el.appendChild(word);
			el.appendChild(document.createTextNode(' '));
		}

		var els = this.el.querySelectorAll('.sentence');
		for (var i = 0; i < els.length; i++) {
			els[i].style.width = newWidth + '%';
		}

		this.el.appendChild(el);
	}


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

	morea.prototype._addEvent = function(el, type, handler) {
		if (el === null || typeof(el) === 'undefined') 
			return;

		if (el.addEventListener)
			el.addEventListener(type, handler, false);
		else if (el.attachEvent)
			el.attachEvent('on' + type, handler);
		else
			el['on' + type] = handler;

	};

	morea.prototype._splitCts = function(CTS) {
		/*	CTS example:	urn:	cts:	greekLit:	tlg0003.tlg001.perseus-grc:		1.89.1:		13
							urn:	cts:	namespace:	work:							passage:	word
		*/ 
		var split = CTS.split(":");
		var work = split[3].split(".");

		var obj = {
			"urn": split[0],
			"cts": split[1],
			"namespace": split[2],
			"work": {
				"textgroup": work[0],
				"text": work[1],
				"translation": work[2]
			},
			"sentence": split[4]
		};

		if (split.length === 6)
			obj["word"] = split[5];

		return obj;
	};

	morea.prototype._getCtsProperty = function(CTS, property) {
		var newCTS = this._splitCts(CTS);
		return newCTS[property];
	};

	morea.prototype._setCtsProperty = function(CTS, propertyList) {
		var c = this._splitCts(CTS);
	
		for (var key in propertyList) {
			if (propertyList.hasOwnProperty(key)) {
				c[key] = propertyList[key];
			}
		}
		var work = Object.keys(c.work).map(function(k) {
			return c.work[k];
		});

		// TODO: Replace
		var updatedCTS = c.urn + ":" + c.cts + ":" + c.namespace + ":" + work.join(".") + ":" + c.sentence;

		if (c.word)
			updatedCTS += ":" + c.word;

		return updatedCTS;
	};

	morea.prototype._clone = function(obj) {
		if (null == obj || "object" != typeof obj) return obj;
		var copy = obj.constructor();
		for (var attr in obj)
			if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];

		return copy;
	};

	morea.prototype._delayAddClass = function(el, className, waitTime) {
		setTimeout(function() {
			el.addClass(className);
		}, waitTime);
	};
	morea.prototype._delayRemoveClass = function(el, className, waitTime) {
		setTimeout(function() {
			el.removeClass(className);
		}, waitTime);
	};

	if (!HTMLElement.prototype.removeClass) {
		HTMLElement.prototype.removeClass = function(remove) {
			var newList = '';
			var classes = this.className.trim().split(" ");
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
