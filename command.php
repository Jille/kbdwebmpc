<?php
	require_once('config.php');

	require_once('mpd.php');

	try {
		$mpd = new MPDClient($server, $port, $password);

		$result = NULL;

		if(isset($_GET['command'])) {
			switch($_GET['command']) {
				case 'toggle':
					$mpd->toggle();
					break;
				case 'next':
					$mpd->next();
					break;
				case 'shuffle':
					$mpd->shuffle();
					break;
				case 'crossfade':
					$status = $mpd->getStatus();
					if($status['xfade'] == 0) {
						$mpd->crossfade(5);
					} else {
						$mpd->crossfade(0);
					}
					break;
				case 'volumeUp':
					$mpd->setVolume(4, true);
					break;
				case 'volumeDown':
					$mpd->setVolume(-4, true);
					break;
				case 'move':
					list($from, $to) = explode(',', $_GET['args']);
					$mpd->playlistMove($from, $to);
					break;
				case 'queue':
					$result = $mpd->add($_GET['args']);
					break;
				case 'delete':
					$result = $mpd->playlistDelete($_GET['args']);
					break;
				case 'prepend':
					$result = $mpd->prepend($_GET['args']);
					break;
				case 'flats':
					$all = $mpd->listAll();
					foreach(array_rand($all, 5) as $idx) {
						$mpd->add($all[$idx]);
					}
					break;
				case 'search':
					$result = array();
					foreach($mpd->search($_GET['args']) as $song) {
						$result[$song['file']] = array(
							'time' => isset($song['Time']) ? sprintf('%d:%02d', $song['Time'] / 60, $song['Time'] % 60) : '?:??',
						);
						if(isset($song['Artist'], $song['Title'])) {
							$result[$song['file']]['display'] = $song['Artist'] .' - '. $song['Title'];
						} else {
							$result[$song['file']]['display'] = $song['file'];
						}
					}
					uasort($result, function($a, $b) {
						return strcmp($a['display'], $b['display']);
					});
					break;
				case 'list':
					if(isset($_GET['args'])) {
						$result = $mpd->listFiles($_GET['args']); 
					} else {
						$result = $mpd->listFiles(); 
					}
					break;
				case 'repairConfig':
					$status = $mpd->getStatus();
					if($status['repeat']) {
						$mpd->setRepeat(false);
					}
					if($status['random']) {
						$mpd->setRandom(false);
					}
					if($status['single']) {
						$mpd->setSingle(false);
					}
					if($status['consume']) {
						$mpd->setConsume(true);
					}
					if(isset($status['song']) && $status['song'] != 0) {
						$mpd->playlistMove($status['song'], 0);
					}
					break;
			}
		}

		$status = $mpd->getStatus();

		if(isset($_GET['my_playlist_seq']) && $_GET['my_playlist_seq'] == $status['playlist']) {
			$current = NULL;
			$playlist = NULL;
		} else {
			$_playlist = $mpd->getPlaylist();
			$playlist = array();
			$current = array_shift($_playlist);
			foreach($_playlist as $song) {
				if(isset($song['Artist'], $song['Title'])) {
					$display = $song['Artist'] .' - '. $song['Title'];
				} else {
					$display = $song['file'];
				}
				$playlist[] = array(
					'pos' => $song['Pos'],
					'queueId' => $song['Id'],
					'display' => $display,
					'time' => isset($song['Time']) ? sprintf('%d:%02d', $song['Time'] / 60, $song['Time'] % 60) : '?:??',
				);
			}
		}
		$mpd->disconnect();
	} catch(MPDClientRuntimeException $e) {
		header('Content-Type: text/javascript; charset=UTF-8');
		print('null; setError('. json_encode(nl2br($e->getMessage())) .');');
		exit;
	}

	$json = array();
	$json['misconfigured'] = !(!$status['repeat'] && !$status['random'] && !$status['single'] && $status['consume'] && (!isset($status['song']) || $status['song'] == 0));
	if(!$json['misconfigured']) {
		$json['playlist_seq'] = $status['playlist'];
		$json['playlist'] = $playlist;
		if(isset($status['time_elapsed'], $status['time_total'])) {
			$json['time_elapsed'] = sprintf('%d:%02d', $status['time_elapsed'] / 60, $status['time_elapsed'] % 60);
			$json['seconds_elapsed'] = (isset($status['elapsed']) ? round($status['elapsed']) : $status['time_elapsed']);
			$json['time_total'] = sprintf('%d:%02d', $status['time_total'] / 60, $status['time_total'] % 60);
			$json['seconds_total'] = $status['time_total'];
			$json['seconds_left'] = $status['time_total'] - $status['time_elapsed'];
			$json['time_left'] = sprintf('%d:%02d', $json['seconds_left'] / 60, $json['seconds_left'] % 60);
		}
		if($current) {
			$json['file'] = $current['file'];
			$json['artist'] = isset($current['Artist']) ? $current['Artist'] : 'unknown';
			$json['title'] = isset($current['Title']) ? $current['Title'] : 'unknown';
			$json['album'] = isset($current['Album']) ? $current['Album'] : 'unknown';
		}
		$json['volume'] = $status['volume'];
		$json['state'] = $status['state'];
		$json['xfade'] = $status['xfade'];
		if(isset($status['updating_db'])) {
			$json['updating_db'] = $status['updating_db'];
		}
		if(isset($_GET['command'])) {
			$json['result'] = $result;
		}
	}

	$out = json_encode($json);
	if($status['state'] != 'play') {
		$etag = '"'. md5($out) .'"';
		if(isset($_SERVER['HTTP_IF_NONE_MATCH']) && $_SERVER['HTTP_IF_NONE_MATCH'] == $etag) {
			header('HTTP/1.1 304 Not Modified');
			exit;
		}
		header('Etag: '. $etag);
	}

	header('Content-Type: text/javascript; charset=UTF-8');
	print($out);

?>
