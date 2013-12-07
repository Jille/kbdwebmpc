<?php
	final class MPDClient {
		private $host;
		private $port;
		private $password;

		private $socket;

		public function __construct($host, $port, $password) {
			$this->host = $host;
			$this->port = $port;
			$this->password = $password;

			$this->connect();
		}

		private function connect() {
			$this->socket = fsockopen($this->host, $this->port, $errno, $error);
			if(!$this->socket) {
				throw new MPDClientRuntimeException('Could not connect: '. $error, $errno);
			}
			$ret = $this->readLine();
			if(!preg_match('/^OK MPD ([0-9\.]+)$/', $ret)) {
				throw new MPDClientRuntimeException('Remote peer is not an MPD');
			}

			if($this->password) {
				$this->sendPassword($this->password);
			}
		}

		private function readLine() {
			set_error_handler(array($this, '_readErrorHandler'));
			try {
				$line = fgets($this->socket);
			} catch(Exception $e) {
				restore_error_handler();
				$this->socket = false;
				throw $e;
			}
			restore_error_handler();
			if($line === false) {
				$this->socket = false;
				throw new MPDClientRuntimeException('Disconnected');
			}
			$line = substr($line, 0, -1); // trim \n
			if(preg_match('/^ACK \[(\d+)@(\d+)\] \{([^{}]+)\} (.+)$/', $line, $m)) {
				if($m[3] == 'lsinfo' && trim($m[4]) == 'directory not found') {
					throw new MPDClientDirectoryNotFoundException('Command '. $m[3] ." failed:\n". $m[4]);
				} else {
					throw new MPDClientRuntimeException('Command '. $m[3] ." failed:\n". $m[4]);
				}
			}
			return $line;
		}

		function _readErrorHandler($errno, $error, $file, $line) {
			throw new MPDClientRuntimeException('Read error: '. $error, $errno);
		}

		private function sendCommand($command /* , $args... */) {
			$parts = array();
			foreach(func_get_args() as $arg) {
				if(!$arg || strpos($arg, ' ') !== false) {
					$parts[] = '"'. addslashes($arg) .'"';
				} else {
					$parts[] = $arg;
				}
			}
			$line = implode(' ', $parts);
			fwrite($this->socket, $line ."\n");
		}

		private function getReply() {
			$reply = array();
			while(true) {
				$line = $this->readLine();
				if($line == 'OK') {
					break;
				}
				$reply[] = $line;
			}
			return $reply;
		}

		private function getKeyValueReply() {
			$results = array();
			$lines = $this->getReply();
			foreach($lines as $line) {
				list($key, $value) = explode(': ', $line, 2);
				$results[$key] = $value;
			}
			return $results;
		}

		private function getPairListReply() {
			$results = array();
			$lines = $this->getReply();
			foreach($lines as $line) {
				if(preg_match('/^([^:]+): (.+)$/', $line, $m)) {
					$results[$m[1]][] = $m[2];
				} else {
					assert(!"reached");
				}
			}
			return $results;
		}

		private function getSongListReply($key) {
			$results = array();
			$result = NULL;
			$lines = $this->getReply();
			foreach($lines as $line) {
				if(preg_match('/^file: (.+)$/', $line, $m)) {
					if($result) {
						$results[$result[$key]] = $result;
						$result = array();
					}
					$result['file'] = $m[1];
				} elseif(preg_match('/^([^:]+): (.+)$/', $line, $m)) {
					$result[$m[1]] = $m[2];
				} else {
					assert(!"reached");
				}
			}
			if($result) {
				$results[$result[$key]] = $result;
			}
			return $results;
		}

		private function getLsinfoReply() {
			$ret = array('directories' => array(), 'files' => array());
			$lines = $this->getReply();

			$currentFile = null;
			foreach($lines as $line) {
				if(preg_match('/^directory: (.*)$/', $line, $args)) {
					$ret['directories'][$args[1]]['Fullname']  = $args[1];
				} elseif(preg_match('/^file: (.*)$/', $line, $args)) {
					$currentFile = $args[1];
					$ret['files'][$currentFile]['Filename'] = $args[1];
				} elseif(preg_match('/^playlist: (.*)$/', $line, $args)) {
					continue;
				} elseif(preg_match('/^([^:]+): (.+)$/', $line, $args)) {
					$ret['files'][$currentFile][$args[1]] = $args[2];
				}
			}

			return $ret;
		}

		private function getOKReply() {
			$ret = $this->readLine();
			if($ret != 'OK') {
				debug_print_backtrace();
			}
			assert($ret == 'OK');
			return true;
		}

		public function sendPassword($password) {
			$this->sendCommand('password', $password);
			return $this->getOKReply();
		}

		public function getStatus() {
			$this->sendCommand('status');
			$ret = $this->getKeyValueReply();
			foreach($ret as $key => $value) {
				switch($key) {
					case 'volume':
					case 'playlist':
					case 'playlistlength':
					case 'xfade':
					case 'song':
					case 'songid':
					case 'bitrate':
					case 'nextsong':
					case 'nextsongid':
					case 'updating_db':
						$ret[$key] = intval($value);
						break;
					case 'repeat':
					case 'random':
					case 'consume':
					case 'single':
						$ret[$key] = ($value == '1');
						break;
					case 'mixrampdb':
					case 'elapsed':
						$ret[$key] = floatval($value);
						break;
					case 'time':
						list($elapsed, $total) = explode(':', $value);
						$ret['time_elapsed'] = $elapsed;
						$ret['time_total'] = $total;
						break;
					case 'state':
					case 'audio':
						break;
				}
			}
			return $ret;
		}

		public function toggle() {
			$status = $this->getStatus();
			if($status['state'] == 'play') {
				$this->sendCommand('pause');
			} else {
				$this->sendCommand('play');
			}
			return $this->getOKReply();
		}

		public function next() {
			$this->sendCommand('next');
			return $this->getOKReply();
		}

		public function getPlaylist($song = NULL) {
			if($song === NULL) {
				$this->sendCommand('playlistinfo');
			} else {
				$this->sendCommand('playlistinfo', $song);
			}
			return $this->getSongListReply('Pos');
		}

		public function search($query) {
			$ex = explode(' ', $query);
			$ex = array_filter($ex);
			if(!$ex) {
				return array();
			}
			usort($ex, function($a, $b) {
				if(strlen($a) == strlen($b)) {
					return 0;
				}
				return (strlen($a) < strlen($b) ? 1 : -1);
			});
			$this->sendCommand('command_list_begin');
			$first = array_shift($ex);
			$this->sendCommand('search', 'artist', $first);
			$this->sendCommand('search', 'title', $first);
			$this->sendCommand('search', 'filename', $first);
			$this->sendCommand('command_list_end');
			$results = $this->getSongListReply('file');
			if(count($ex) > 0) {
				$results = array_filter($results, function($song) use($ex) {
					foreach($ex as $part) {
						if((!isset($song['Artist']) || stripos($song['Artist'], $part) === false) && (!isset($song['Title']) || stripos($song['Title'], $part) === false)) {
							return false;
						}
					}
					return true;
				});
			}
			return $results;
		}

		public function listAll($dir = NULL) {
			if($dir === NULL) {
				$this->sendCommand('listall');
			} else {
				$this->sendCommand('listall', $dir);
			}
			$pairs = $this->getPairListReply();
			return $pairs['file'];
		}

		public function listFiles($dir = NULL) {
			if($dir === NULL) {
				$this->sendCommand('lsinfo');
			} else {
				$this->sendCommand('lsinfo', $dir);
			}
			try {
				$reply = $this->getLsinfoReply();
			} catch(MPDClientDirectoryNotFoundException $e) {
				// XXX deze logica een niveau hoger afhandelen
				$parts = explode('/', $dir);
				if($dir == '') {
					throw $e;
				} elseif(count($parts) == 1) {
					return $this->listFiles();
				} else {
					array_pop($parts);
					return $this->listFiles(implode('/', $parts));
				}
			}

			if($dir === NULL) {
				$reply['currentDirectory'] = '';
				$reply['parentDirectory'] = NULL;
			} else {
				$reply['currentDirectory'] = $dir;
				$parts = explode('/', $dir);
				if(count($parts) <= 1) {
					$reply['parentDirectory'] = '/';
				} else {
					array_pop($parts);
					$reply['parentDirectory'] = implode('/', $parts);
				}
			}
			foreach($reply['directories'] as $i => $directory) {
				$reply['directories'][$i]['Name'] = str_replace($reply['currentDirectory'] .'/', '', $directory['Fullname']);
			}
			foreach($reply['files'] as $i => $file) {
				$reply['files'][$i]['Name'] = str_replace($reply['currentDirectory'] .'/', '', $file['Filename']);
				$reply['files'][$i]['Time'] = floor($file['Time'] / 60) .':'. sprintf('%02d', $file['Time'] % 60);
			}

			$order = array();
			foreach($reply['directories'] as $i => $directory) {
				$order[$i] = $directory['Name'];
			}
			natcasesort($order);
			$directories = $reply['directories'];
			$reply['directories'] = array();
			foreach($order as $key => $value) {
				$reply['directories'][$key] = $directories[$key];
			}

			$order = array();
			foreach($reply['files'] as $i => $file) {
				$order[$i] = $file['Name'];
			}
			natcasesort($order);
			$files = $reply['files'];
			$reply['files'] = array();
			foreach($order as $key => $value) {
				$reply['files'][$key] = $files[$key];
			}

			return $reply;
		}

		public function add($file) {
			$this->sendCommand('add', $file);
			return $this->getOKReply();
		}

		public function prepend($file) {
			$this->sendCommand('addid', $file, 1);
			return $this->getReply();
		}

		public function setVolume($pct, $relative = false) {
			if($relative) {
				$status = $this->getStatus();
				$pct += $status['volume'];
			}
			$pct = min(100, max(0, $pct));
			$this->sendCommand('setvol', $pct);
			return $this->getOKReply();
		}

		/**
		 * Verplaats het nummer op positie $from naar $to
		 */
		public function playlistMove($from, $to) {
			$this->sendCommand('move', $from, $to);
			return $this->getOKReply();
		}

		public function playlistDelete($song) {
			$this->sendCommand('delete', $song);
			return $this->getOKReply();
		}

		public function disconnect() {
			fclose($this->socket);
			$this->socket = false;
		}

		public function shuffle() {
			$this->sendCommand('shuffle');
			return $this->getOKReply();
		}

		public function setRepeat($bool) {
			$this->sendCommand('repeat', $bool ? 1 : 0);
			return $this->getOKReply();
		}

		public function setRandom($bool) {
			$this->sendCommand('random', $bool ? 1 : 0);
			return $this->getOKReply();
		}

		public function setSingle($bool) {
			$this->sendCommand('single', $bool ? 1 : 0);
			return $this->getOKReply();
		}

		public function setConsume($bool) {
			$this->sendCommand('consume', $bool ? 1 : 0);
			return $this->getOKReply();
		}

		public function crossfade($value) {
			$this->sendCommand('crossfade', $value);
			return $this->getOKReply();
		}
	}

	class MPDClientRuntimeException extends Exception {
	}

	class MPDClientDirectoryNotFoundException extends MPDClientRuntimeException {
	}
?>
