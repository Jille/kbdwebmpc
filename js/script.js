var lastError = false;
var errorTimer = false;
var notifyTimer = false;
var mode = null;
var selectedPlaylistEntry = null;
var selectedSearchResult = null;
var selectedFile = null;
var searchField = null;
var searchTimer = false;
var updateTimer = false;
var lastSearch = null;
var numResults = null;
var playlistLength = null;
var numFiles = null;
var browseStack = [];
var misconfigured = false;
var refreshedSinceLastUpdate = true;
var myPlaylistSeq = -1;

var refreshDelay = 500;
var pagesize = 20;
var lineHeight = 17;
var lineHeightSearchMode = 16;
var scrollThreshold = 35;
var scrollThresholdSearchMode = 30;

var stateDescriptions = {
	'play': 'Now playing',
	'pause': 'Paused',
	'stop': 'Stopped',
};

function page_init() {
	update();
	searchField = document.getElementById('searchField');
	searchField.focus();
	mode = 'search';

	window.onkeydown = function(event) {
		switch(event.keyCode) {
			case 8:
				return handleBackspace();
			case 9:
				return handleTab();
			case 13:
				return handleReturn();
			case 16:
			case 17:
			case 18:
			case 91:
			case 93:
				// shift/alt/ctrl
				break;
			case 27:
				return handleEscape();
			case 33:
				return handlePageUp();
			case 34:
				return handlePageDown();
			case 37:
				return handleArrowLeft();
			case 38:
				return handleArrowUp();
			case 39:
				return handleArrowRight();
			case 40:
				return handleArrowDown();
			case 43:
			case 187:
				return handlePlus();
			case 45:
			case 189:
				return handleMinus();
			case 46:
				return handleDelete();
			default:
				return handleDefault(event);
		}
	};

	window.oncontextmenu = function(event) {
		return false;
	};

	searchField.onkeyup = function(event) {
		if(searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = false;
		}
		if(searchField.value != '') {
			if(searchField.value.length < 3) {
				searchField.style.backgroundColor = '';
				searchField.style.color = '';
			} else {
				if(searchField.value != lastSearch) {
					searchTimer = setTimeout('search_trigger();', 250)
				}
			}
		} else {
			e = document.getElementById('searchResults');
			e.innerHTML = '';
			e.style.display = 'none';
			searchField.style.backgroundColor = '';
			searchField.style.color = '';
		}
	};

	shortcut.add('F1', function() { command('toggle'); });
	shortcut.add('F2', function() { command('next'); });
	shortcut.add('F5', function() { command('volumeDown'); });
	shortcut.add('F6', function() { command('volumeUp'); });
	shortcut.add('F8', function() { command('crossfade'); });
	shortcut.add('F9', function() { command('flats'); });
	shortcut.add('F10', function() { command('shuffle'); });
}

function handleReturn() {
	if(mode == 'search') {
		if(selectedSearchResult) {
			var el = document.getElementById('searchresultsentry'+ selectedSearchResult);

			if(event.shiftKey) {
				command('prepend', el.filename); 
			} else {
				command('queue', el.filename); 
			}

			if(event.ctrlKey) {
				notify('Queued '+ el.innerHTML);
				handleArrowDown();
			} else {
				if(selectedSearchResult) {
					var el = document.getElementById('searchresultsentry'+ selectedSearchResult);
					el.className = 'searchresultsentry';
					selectedSearchResult = null;
				}
				document.getElementById('searchResults').style.display = 'none';
				lastSearch = null;
				searchField.value = '';
				searchField.focus();
			}
		}
	} else if(mode == 'browse') {
		if(selectedFile) {
			var el = document.getElementById('fileBrowserEntry'+ selectedFile);
			if(el.className.match(/fileBrowserFile/) || (!event.shiftKey && event.altKey && el.className.match(/fileBrowserDirectory/))) {

				if(event.shiftKey) {
					command('prepend', el.filename); 
				} else {
					command('queue', el.filename); 
				}

				if(event.ctrlKey) {
					document.getElementById('searchResults').style.display = 'none';
					lastSearch = null;
					searchField.value = '';
					notify('Queued '+ el.innerHTML);
					handleArrowDown();
				} else {
					exitBrowseMode();
				}
			} else if(el.className.match(/fileBrowserDirectory/)) {
				browseStack.push(selectedFile);
				selectedFile = 1;
				listFiles(true, el.directory);
			} else if(el.className.match(/fileBrowserCdup/)) {
				selectedFile = browseStack.pop();
				listFiles(true, el.cdup);
			}
		}
	}
	return true;
}

function handleArrowDown() {
	if(mode == 'search') {
		if(searchField.value != '') {
			if(selectedSearchResult === null) {
				var el = document.getElementById('searchresultsentry1');
				if(el) {
					el.className = 'searchresultsentry_selected';
					selectedSearchResult = 1;
				}
				searchField.blur();
			} else {
				var el = document.getElementById('searchresultsentry'+ (selectedSearchResult + 1));
				if(el) {
					var el2 = document.getElementById('searchresultsentry'+ selectedSearchResult);
					el.className = 'searchresultsentry_selected';
					el2.className = 'searchresultsentry';
					selectedSearchResult = selectedSearchResult + 1;
					if(selectedSearchResult > scrollThresholdSearchMode) {
						document.getElementById('searchResults').scrollTop += lineHeightSearchMode;
					}
				}
			}
			return false;
		} else if(playlistLength > 0) {
			switchModeTo('playlist');
			var el = document.getElementById('playlistentry1');
			el.className = 'playlistentry_selected';
			selectedPlaylistEntry = 1;
		}
	} else if(mode == 'browse') {
		var el = document.getElementById('fileBrowserEntry'+ (selectedFile + 1));
		if(el) {
			var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
			el.className += ' fileBrowserEntry_selected';
			el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
			selectedFile = selectedFile + 1;
			if(selectedFile > scrollThreshold) {
				document.getElementById('fileBrowser').scrollTop += lineHeight;
			}
		}
	} else if(mode == 'playlist') {
		if(event.altKey) {
			_moveEntryInPlaylist(1);
		} else {
			if(selectedPlaylistEntry === null) {
				var el = document.getElementById('playlistentry1');
				if(el) {
					el.className = 'playlistentry_selected';
					selectedPlaylistEntry = 1;
				}
				searchField.blur();
			} else {
				var el = document.getElementById('playlistentry'+ (selectedPlaylistEntry + 1));
				if(el) {
					var el2 = document.getElementById('playlistentry'+ selectedPlaylistEntry);
					el.className = 'playlistentry_selected';
					el2.className = 'playlistentry';
					selectedPlaylistEntry = selectedPlaylistEntry + 1;
					if(selectedPlaylistEntry > scrollThreshold) {
						document.getElementById('playlist').scrollTop += lineHeight;
					}
				}
			}
		}
	}
	return true;
}

function handlePageDown() {
	if(mode == 'search') {
		if(searchField.value != '') {
			if(selectedSearchResult === null) {
				for(var i = pagesize; i > 0; i--) {
					var el = document.getElementById('searchresultsentry'+ i);
					if(el) {
						searchField.blur();
						el.className = 'searchresultsentry_selected';
						selectedSearchResult = i;
						break;
					}
				}
			} else {
				for(var i = pagesize; i > 0; i--) {
					var el = document.getElementById('searchresultsentry'+ (selectedSearchResult + i));
					if(el) {
						var el2 = document.getElementById('searchresultsentry'+ selectedSearchResult);
						el.className = 'searchresultsentry_selected';
						el2.className = 'searchresultsentry';
						selectedSearchResult = selectedSearchResult + i;
						if(selectedSearchResult > scrollThresholdSearchMode) {
							document.getElementById('searchResults').scrollTop += (i * lineHeightSearchMode);
						}
						break;
					}
				}
			}
			return false;
		} else if(playlistLength > 0) {
			for(var i = pagesize; i > 0; i--) {
				var el = document.getElementById('playlistentry'+ i);
				if(el) {
					switchModeTo('playlist');
					el.className = 'playlistentry_selected';
					selectedPlaylistEntry = i;
					searchField.blur();
					break;
				}
			}
		}
	} else if(mode == 'browse') {
		for(var i = pagesize; i > 0; i--) {
			var el = document.getElementById('fileBrowserEntry'+ (selectedFile + i));
			if(el) {
				var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
				el.className += ' fileBrowserEntry_selected';
				el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
				selectedFile = selectedFile + i;
				if(selectedFile > scrollThreshold) {
					document.getElementById('fileBrowser').scrollTop += (i * lineHeight);
				}
				break;
			}
		}
	} else if(mode == 'playlist') {
		if(selectedPlaylistEntry === null) {
			for(var i = pagesize; i > 0; i--) {
				var el = document.getElementById('playlistentry'+ i);
				if(el) {
					el.className = 'playlistentry_selected';
					selectedPlaylistEntry = i;
					searchField.blur();
					break;
				}
			}
		} else {
			for(var i = pagesize; i > 0; i--) {
				var el = document.getElementById('playlistentry'+ (selectedPlaylistEntry + i));
				if(el) {
					var el2 = document.getElementById('playlistentry'+ selectedPlaylistEntry);
					el.className = 'playlistentry_selected';
					el2.className = 'playlistentry';
					selectedPlaylistEntry = selectedPlaylistEntry + i;
					if(selectedPlaylistEntry > scrollThreshold) {
						document.getElementById('playlist').scrollTop += (i * lineHeight);
					}
					break;
				}
			}
		}
	}
	return true;
}

function handleArrowUp() {
	if(mode == 'search') {
		if(selectedSearchResult !== null) {
			if(selectedSearchResult == 1) {
				var el = document.getElementById('searchresultsentry1');
				el.className = 'searchresultsentry';
				selectedSearchResult = null;
				searchField.focus();
			} else {
				var el = document.getElementById('searchresultsentry'+ (selectedSearchResult - 1));
				var el2 = document.getElementById('searchresultsentry'+ selectedSearchResult);
				el.className = 'searchresultsentry_selected';
				el2.className = 'searchresultsentry';
				selectedSearchResult = selectedSearchResult - 1;
				if(selectedSearchResult < numResults - scrollThresholdSearchMode) {
					document.getElementById('searchResults').scrollTop -= lineHeightSearchMode;
				}
			}
		}
		return false;
	} else if(mode == 'browse') {
		if(selectedFile > 1) {
			var el = document.getElementById('fileBrowserEntry'+ (selectedFile - 1));
			var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
			el.className += ' fileBrowserEntry_selected';
			el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
			selectedFile = selectedFile - 1;
			if(selectedFile < numFiles - scrollThreshold) {
				document.getElementById('fileBrowser').scrollTop -= lineHeight;
			}
		}
	} else if(mode == 'playlist') {
		if(event.altKey) {
			return _moveEntryInPlaylist(-1);
		} else {
			if(selectedPlaylistEntry !== null) {
				if(selectedPlaylistEntry == 1) {
					switchModeTo('search');
				} else {
					var el = document.getElementById('playlistentry'+ (selectedPlaylistEntry - 1));
					var el2 = document.getElementById('playlistentry'+ selectedPlaylistEntry);
					el.className = 'playlistentry_selected';
					el2.className = 'playlistentry';
					selectedPlaylistEntry = selectedPlaylistEntry - 1;
					if(selectedPlaylistEntry < playlistLength - scrollThreshold) {
						document.getElementById('playlist').scrollTop -= lineHeight;
					}
				}
			}
		}
	}
	return true;
}

function handlePageUp() {
	if(mode == 'search') {
		if(selectedSearchResult !== null) {
			if(selectedSearchResult - pagesize <= 1) {
				var el = document.getElementById('searchresultsentry'+ selectedSearchResult);
				el.className = 'searchresultsentry';
				selectedSearchResult = null;
				searchField.focus();
			} else {
				var el = document.getElementById('searchresultsentry'+ (selectedSearchResult - pagesize));
				var el2 = document.getElementById('searchresultsentry'+ selectedSearchResult);
				el.className = 'searchresultsentry_selected';
				el2.className = 'searchresultsentry';
				selectedSearchResult = selectedSearchResult - pagesize;
				if(selectedSearchResult < numResults - scrollThresholdSearchMode) {
					document.getElementById('searchResults').scrollTop -= (pagesize * lineHeightSearchMode);
				}
			}
		}
	} else if(mode == 'browse') {
		if(selectedFile > pagesize) {
			var el = document.getElementById('fileBrowserEntry'+ (selectedFile - pagesize));
			var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
			el.className += ' fileBrowserEntry_selected';
			el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
			selectedFile = selectedFile - pagesize;
			if(selectedFile < numFiles - scrollThreshold) {
				document.getElementById('fileBrowser').scrollTop -= (pagesize * lineHeight);
			}
		} else {
			var el = document.getElementById('fileBrowserEntry1');
			var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
			el.className += ' fileBrowserEntry_selected';
			el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
			selectedFile = 1;
			document.getElementById('fileBrowser').scrollTop = 0;
		}
	} else if(mode == 'playlist') {
		if(selectedPlaylistEntry !== null) {
			if(selectedPlaylistEntry - pagesize <= 1) {
				switchModeTo('search');
			} else {
				var el = document.getElementById('playlistentry'+ (selectedPlaylistEntry - pagesize));
				var el2 = document.getElementById('playlistentry'+ selectedPlaylistEntry);
				el.className = 'playlistentry_selected';
				el2.className = 'playlistentry';
				selectedPlaylistEntry = selectedPlaylistEntry - pagesize;
				if(selectedPlaylistEntry < playlistLength - scrollThreshold) {
					document.getElementById('playlist').scrollTop -= (pagesize * lineHeight);
				}
			}
		}
	}
	return true;
}

function handleArrowRight() {
	if(mode == 'browse') {
		if(selectedFile) {
			var el = document.getElementById('fileBrowserEntry'+ selectedFile);
			if(el.className.match(/fileBrowserDirectory/)) {
				browseStack.push(selectedFile);
				selectedFile = 1;
				listFiles(true, el.directory);
			} else if(el.className.match(/fileBrowserCdup/)) {
				selectedFile = browseStack.pop();
				listFiles(true, el.cdup);
			}
		}
	}
	return true;
}

function handleArrowLeft() {
	if(mode == 'browse') {
		var el = document.getElementById('fileBrowserEntry1');
		if(el.className.match(/fileBrowserCdup/)) {
			selectedFile = browseStack.pop();
			listFiles(true, el.cdup);
		}
	}
	return true;
}

function handleTab() {
	if(mode == 'search') {
		switchModeTo('browse');
	} else if(mode == 'browse') {
		exitBrowseMode();
	} else if(mode == 'playlist') {
		if(selectedFile === null) {
			selectedFile = 1;
		}
		switchModeTo('browse');
	}
	return false;
}

function handleEscape() {
	if(mode == 'search') {
		if(document.getElementById('searchResults').style.display == 'none') {
			lastSearch = null;
			searchField.value = '';
		} else {
			document.getElementById('searchResults').style.display = 'none';
			searchField.focus();
		}
	} else if(mode == 'browse') {
		exitBrowseMode();
	} else if(mode == 'playlist') {
		switchModeTo('search');
	}
	return true;
}

function handleDelete() {
	if(mode == 'playlist') {
		if(selectedPlaylistEntry !== null) { // Deze check zou niet nodig moeten zijn
			command('delete', selectedPlaylistEntry);
		}
	}
	return true;
}

function handleBackspace() {
	if(document.activeElement == searchField) {
		return true;
	}
	// voorkomt gebruik backspace als back-button
	return false;
}

function handlePlus() {
	_moveEntryInPlaylist(-1);
	return true;
}

function handleMinus() {
	_moveEntryInPlaylist(1);
	return true;
}

function _moveEntryInPlaylist(offset) {
	if(mode == 'playlist') {
		if(selectedPlaylistEntry !== null) {
			var el2 = document.getElementById('playlistentry'+ (selectedPlaylistEntry + offset));
			if(el2) {
				var el = document.getElementById('playlistentry'+ selectedPlaylistEntry);
				var tmp = el.innerHTML;
				el.innerHTML = el2.innerHTML;
				el2.innerHTML = tmp;
				el.className = 'playlistentry';
				el2.className = 'playlistentry_selected';
				command('move', selectedPlaylistEntry +','+ (selectedPlaylistEntry + offset));
				selectedPlaylistEntry += offset;
				if(selectedPlaylistEntry > (offset < 0 ? playlistLength : 0) + offset * scrollThreshold) {
					document.getElementById('playlist').scrollTop += offset * lineHeight;
				}
			}
		}
	}
}

function handleDefault(event) {
	if(mode == 'browse') {
		if((event.keyCode >= 48 && event.keyCode <= 57) || (event.keyCode >= 65 && event.keyCode <= 90)) {
			// Letter of cijfer
			for(var i = selectedFile + 1;; i++) {
				var el = document.getElementById('fileBrowserEntry'+ i);
				if(!el) {
					i = 1;
					el = document.getElementById('fileBrowserEntry1');
				}
				if(i == selectedFile) {
					break;
				}

				var firstchar = el.innerHTML.substr(0, 1).toLowerCase();
				if(firstchar == String.fromCharCode(event.keyCode).toLowerCase()) {
					var el2 = document.getElementById('fileBrowserEntry'+ selectedFile);
					el.className += ' fileBrowserEntry_selected';
					el2.className = el2.className.replace(/ fileBrowserEntry_selected/, '');
					selectedFile = i;
					document.getElementById('fileBrowser').scrollTop = lineHeight * Math.max(selectedFile - scrollThreshold, 0);
					break;
				}
			}
		}
	} else if(mode == 'playlist') {
		if((event.keyCode >= 48 && event.keyCode <= 57) || (event.keyCode >= 65 && event.keyCode <= 90)) {
			searchField.value = String.fromCharCode(event.keyCode).toLowerCase();
			switchModeTo('search');
			return false;
		}
	}
	return true;
}

function exitBrowseMode() {
	if(selectedPlaylistEntry) {
		switchModeTo('playlist');
	} else {
		switchModeTo('search');
	}
}

function switchModeTo(newMode) {
	if(mode == newMode) {
		return;
	}
	switch(mode) {
		case 'search':
			lastSearch = null;
			searchField.value = '';
			searchField.blur();
			document.getElementById('searchResults').style.display = 'none';
			switch(newMode) {
				case 'browse':
					listFiles(false);
					document.getElementById('search').style.display = 'none';
					document.getElementById('playlist').style.display = 'none';
					document.getElementById('fileBrowser').style.display = 'block';
					break;
				case 'playlist':
					break;
			}
			break;
		case 'browse':
			document.getElementById('search').style.display = '';
			document.getElementById('playlist').style.display = '';
			document.getElementById('fileBrowser').style.display = '';
			document.getElementById('searchResults').style.display = 'none';
			lastSearch = null;
			searchField.value = '';
			switch(newMode) {
				case 'search':
					searchField.focus();
					break;
				case 'playlist':
					break;
			}
			break;
		case 'playlist':
			switch(newMode) {
				case 'search':
					if(selectedPlaylistEntry) {
						var el = document.getElementById('playlistentry'+ selectedPlaylistEntry);
						el.className = 'playlistentry';
						selectedPlaylistEntry = null;
					}
					searchField.focus();
					break;
				case 'browse':
					listFiles(false);
					document.getElementById('search').style.display = 'none';
					document.getElementById('playlist').style.display = 'none';
					document.getElementById('fileBrowser').style.display = 'block';
					lastSearch = null;
					searchField.value = '';
					searchField.blur();
					break;
			}
			break;
	}
	mode = newMode;
}

function xml_doRequest(request, callback) {
	var xml;
	
	try {
		xml = new XMLHttpRequest();
	} catch(error) {
		try {
			xml = new ActiveXObject('Microsoft.XMLHTTP');
		}
		catch(error) {
			xml = null;
		}
	}
	if(xml) {
		xml.onreadystatechange = function() {
			if(xml.readyState == 4 && xml.status == 200) {
				callback(xml.responseText);
			}
		};
		xml.open('GET', request);
		xml.send(null);
	}
}

function listFiles_callback(response) {
	var el = document.getElementById('fileBrowser');
	el.innerHTML = '';
	mpd_callback(response);
	eval('var data = '+ response);
	data = data.result;
	var counter = 1;

	if(selectedFile <= 1) {
		selectedFile = 1;
	}

	if(data.parentDirectory) {
		var div = document.createElement('div');
		div.className = 'fileBrowserEntry fileBrowserCdup';
		if(counter == selectedFile) {
			if(data.directories.length == 0 && data.files.length == 0) {
				div.className += ' fileBrowserEntry_selected';
			} else {
				selectedFile++;
			}
		}
		div.id = 'fileBrowserEntry'+ counter;
		div.cdup = data.parentDirectory;
		div.appendChild(document.createTextNode('Map omhoog'+ (div.cdup != '' ? ' ('+ div.cdup +')' : ' (/)')));
		el.appendChild(div);
		counter++;
	}

	for(var i in data.directories) {
		var div = document.createElement('div');
		div.className = 'fileBrowserEntry fileBrowserDirectory';
		div.id = 'fileBrowserEntry'+ counter;
		div.directory = data.directories[i].Fullname;
		div.filename = data.directories[i].Fullname;
		div.appendChild(document.createTextNode(data.directories[i].Name));
		el.appendChild(div);
		if(counter == selectedFile) {
			div.className += ' fileBrowserEntry_selected';
		}
		counter++;
	}
	for(var i in data.files) {
		var div = document.createElement('div');
		div.className = 'fileBrowserEntry fileBrowserFile';
		div.id = 'fileBrowserEntry'+ counter;
		div.appendChild(document.createTextNode(data.files[i].Name +' ('+ data.files[i].Time +')'));
		div.filename = data.files[i].Filename;
		el.appendChild(div);
		if(counter == selectedFile) {
			div.className += ' fileBrowserEntry_selected';
		}
		counter++;
	}
	numFiles = counter - 1;
	document.getElementById('fileBrowser').scrollTop = lineHeight * Math.max(selectedFile - scrollThreshold, 0);
}

function mpd_callback(response) {
	try {
		eval('var data = '+ response);
	} catch(e) {
		alert(e);
		alert(response);
		return;
	}
	if(!data) {
		return;
	}

	if(data.misconfigured) {
		misconfigured = true;
		showMisconfiguredPage();
		scheduleUpdate();
		return;
	}
	if(misconfigured) {
		misconfigured = false;
		hideMisconfiguredPage();
	}

	setError(data.error);
	lastError = data.error;

	var e = document.getElementById('nowplaying_state');
	if(e) {
		e.innerHTML = '<i>'+ stateDescriptions[data.state] +'</i>';
	}
	if(data.playlist !== null) {
		var e = document.getElementById('nowplaying_track');
		if(e) {
			var bar = '';
			if(data.title != undefined || data.artist != undefined) {
				if(data.title != 'unknown' && data.artist != 'unknown') {
					bar = ': <span class="songinfo">' +
						data.title +'</span> by <span class="songinfo" id="artist">' +
						data.artist +'</span> ';
						if(data.album != 'unknown') {
							bar += 'from <span class="songinfo">'+ data.album +'</span>';
						}
				} else if(data.file) {
					bar += ': <span class="songinfo">' + data.file + '</span>';
				}
			}
			e.innerHTML = bar;
		}
	}

	var play = document.getElementById('play');
	if(data.state != 'play') {
		play.innerHTML = 'F1<br/>Play';
		if(!play.className.match(/ active/)) {
			play.className += ' active';
		}
	} else {
		play.innerHTML = 'F1<br/>Pause';
		play.className = play.className.replace(/ active/g, '');
	}

	var xfade = document.getElementById('crossfade');
	if(data.xfade == 0) {
		xfade.className = xfade.className.replace(/ active/g, '');
	} else {
		if(!xfade.className.match(/ active/)) {
			xfade.className += ' active';
		}
	}
	
	e = document.getElementById('volume');
	if(e && data.volume != -1) {
		e.style.width = Math.round(parseInt(data.volume, 10) / 100 * 150) +'px';
	}

	e = document.getElementById('songProgressed');
	if(e) {
		if(data.seconds_elapsed && data.seconds_total) {
			e.style.width = ((data.seconds_elapsed / data.seconds_total) * 600) + 'px';
			e = document.getElementById('time_elapsed');
			e.innerHTML = data.time_elapsed;
			e = document.getElementById('time_total');
			e.innerHTML = data.time_left;
		} else {
			e.style.width = 0;
			e = document.getElementById('time_elapsed').innerHTML = '';
			e = document.getElementById('time_total').innerHTML = '';
		}
	}

	if(data.playlist !== null) {
		var playlist = data.playlist;
		myPlaylistSeq = data.playlist_seq;
		e = document.getElementById('playlist');
		e.innerHTML = '';
		for(var i = 0; i < playlist.length; i++) {
			var entry = playlist[i];
			var pos = entry.pos;
			var div = document.createElement('div');
			if(pos == selectedPlaylistEntry) {
				div.className = 'playlistentry_selected';
			} else {
				div.className = 'playlistentry';
			}
			div.id = 'playlistentry'+ pos;
			if(entry.time != '0:00') {
				div.innerHTML = entry.display +' ('+ entry.time +')';
			} else {
				div.innerHTML = entry.display;
			}
			e.appendChild(div);
		}

		playlistLength = playlist.length;

		if(selectedPlaylistEntry !== null) {
			var el = document.getElementById('playlistentry'+ selectedPlaylistEntry);
			if(!el) {
				selectedPlaylistEntry = playlistLength;
				var el = document.getElementById('playlistentry'+ selectedPlaylistEntry).className = 'playlistentry_selected';
			}
		}
	}

	e = document.getElementById('updating');
	if(e) {
		if(data.updating_db) {
			if(e.innerHTML == '') {
				var img = document.createElement('img');
				img.src = 'images/loading.gif';
				img.title = 'De database wordt bijgewerkt';
				e.appendChild(img);
			}
			refreshedSinceLastUpdate = false;
		} else {
			e.innerHTML = '';
		}
	}

	scheduleUpdate();
}

function update() {
	xml_doRequest('command.php?my_playlist_seq='+ encodeURIComponent(myPlaylistSeq), mpd_callback);
}

function scheduleUpdate() {
	if(updateTimer) {
		clearTimeout(updateTimer);
	}
	var factor = 1;
	if(misconfigured) {
		factor = 20;
	}
	updateTimer = setTimeout('updateTimer = false; update();', factor * refreshDelay);
}

function listFiles(forceReload, dir) {
	if(!refreshedSinceLastUpdate) {
		forceReload = true;
		refreshedSinceLastUpdate = true;
	}
	var el = document.getElementById('fileBrowser');
	if(!forceReload && el.innerHTML != '') {
		return;
	}
	xml_doRequest('command.php?my_playlist_seq='+ encodeURIComponent(myPlaylistSeq) +'&command=list'+ (dir ? '&args='+ encodeURIComponent(dir) : ''), listFiles_callback);
}

function play() {
	var e = document.getElementById('play');
	cmd = e.innerHTML.toLowerCase();
	
	if(cmd == 'play') {
		e.innerHTML = 'Pause';
		command('play');
	} else {
		e.innerHTML = 'Play';
		command('pause',true);
	}
}

function command(cmd, args) {
	xml_doRequest('command.php?my_playlist_seq='+ encodeURIComponent(myPlaylistSeq) +'&command='+ cmd + (args ? '&args='+ encodeURIComponent(args) : ''), mpd_callback);
}

function search_getResults(response) {
	mpd_callback(response);
	try {
		eval('var data = '+ response);
	} catch(e) {
		return;
	}
	if(!data) {
		return;
	}

	e = document.getElementById('searchResults');
	e.innerHTML = '';
	var i = 0;
	for(var fn in data.result) {
		i++;
		var entry = data.result[fn];
		var div = document.createElement('div');
		div.className = 'searchresultsentry';
		div.id = 'searchresultsentry'+ i;
		div.filename = fn;
		div.innerHTML = entry.display;
		e.appendChild(div);
	}
	numResults = i;
	if(i > 0) {
		e.style.height = Math.min(600, lineHeightSearchMode * numResults) +'px';
		searchField.style.backgroundColor = '';
		searchField.style.color = '';
		e.style.display = 'block';
	} else {
		searchField.style.backgroundColor = '#c40c17';
		searchField.style.color = 'white';
		e.style.display = 'none';
	}
}

function search_trigger() {
	if(searchField.value.length >= 3) {
		lastSearch = searchField.value;
		xml_doRequest('command.php?my_playlist_seq='+ encodeURIComponent(myPlaylistSeq) +'&command=search&args='+ encodeURIComponent(searchField.value), search_getResults);
		selectedSearchResult = null;
	}
}

function setError(msg) {
	var el = document.getElementById('error');
	if(!el) {
		return;
	}
	if(lastError == msg) {
		return;
	}
	if(errorTimer) {
		clearTimeout(errorTimer);
		el.innerHTML = '';
		el.style.display = '';
	}
	if(notifyTimer) {
		var el2 = document.getElementById('notify');
		clearTimeout(notifyTimer);
		el2.innerHTML = '';
		el2.style.display = '';
	}
	if(msg) {
		el.innerHTML = msg;
		el.style.display = 'block';
		errorTimer = setTimeout(function() {
			el.style.display = '';
		}, 5000);
	} else {
		el.innerHTML = '';
		el.style.display = '';
	}
}

function notify(msg) {
	var el = document.getElementById('notify');
	if(!el) {
		return;
	}
	if(notifyTimer) {
		clearTimeout(notifyTimer);
		el.innerHTML = '';
		el.style.display = '';
	}

	var el2 = document.getElementById('error');
	if(el2 && el2.style.display == 'block') {
		return;
	}

	if(msg) {
		el.innerHTML = msg;
		el.style.display = 'block';
		notifyTimer = setTimeout(function() {
			el.style.display = '';
		}, 2500);
	} else {
		el.innerHTML = '';
		el.style.display = '';
	}
}

function showMisconfiguredPage() {
	document.getElementById('playerbox').style.display = 'none';
	document.getElementById('misconfiguredbox').style.display = 'block';
	document.getElementById('restoreButton').focus();
}

function hideMisconfiguredPage() {
	document.getElementById('playerbox').style.display = '';
	document.getElementById('misconfiguredbox').style.display = '';
}
