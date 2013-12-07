<?php
	header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
	<title>MPD client</title>
	<link rel="stylesheet" type="text/css" href="css/style.css" />
	<script type="text/javascript" src="js/shortcut.js"></script>
	<script type="text/javascript" src="js/script.js"></script>
</head>
<body onload="page_init();">
	<div id="playerbox">

		<div id="controls">
			<div class="fkeydesc control" id="play" onclick="command('toggle');">
				F1<br/>
				Play
			</div> 
			<div class="fkeydesc control" id="next" onclick="command('next');">
				F2<br/>
				Next
			</div> 
			<div class="fkeydesc control" id="vol_down" onclick="command('volumeDown');">
				F5<br/>
				Vol down
			</div>
			<div class="fkeydesc control" id="vol_up" onclick="command('volumeUp');">
				F6<br/>
				Vol up
			</div>
			<div class="fkeydesc control" id="crossfade" onclick="command('crossfade');">
				F8<br/>
				Crossfade
			</div>
			<div class="fkeydesc control" id="flats" onclick="command('flats');">
				F9<br/>
				Flats
			</div>
			<div class="fkeydesc control" id="shuffle" onclick="command('shuffle');">
				F10<br/>
				Shuffle
			</div>
			<div id="volumeHolder">
				<img src="images/volume_low.png" />
				<div id="volumeBar"><div id="volume"></div></div>
				<img src="images/volume_high.png" />
			</div>
		</div>

		<div id="status">
			<div id="nowplaying" class="nowplaying"><span id="nowplaying_state"><!-- --></span><span id="nowplaying_track"><!-- --></span></div>

			<div id="bar">
				<div id="time_elapsed"><!-- --></div>
				<div id="songProgress">
					<div id="songProgressed">&nbsp;</div>
				</div>
				<div id="time_total"><!-- --></div>
			</div>
			<div class="clear"></div>
		</div>

		<div id="search">
			<input type="text" id="searchField" placeholder="Enter search query or press TAB to browse the library" autocomplete="off" />
		</div>

		<div id="playlist"><!-- --></div>

		<div id="searchResults"></div>

		<div id="fileBrowser"></div>

		<div id="footer">
			<span id="updating"></span>
			&copy; 2012,2013 <a href="https://github.com/Jille/">Jille Timmermans</a> and <a href="https://github.com/thundur">Felix Janssen</a>
		</div>

	</div>
	<div id="misconfiguredbox">
		<div>
			<h1>Error</h1>
			<p>
				The configuration is broken by an external device. Press ENTER to restore the configuration.
			</p>
			<p>
				<input type="button" id="restoreButton" value="Restore" onclick="command('repairConfig');" />
			</p>
		</div>
	</div>

	<div id="error"></div>
	<div id="notify"></div>
</body>
</html>
