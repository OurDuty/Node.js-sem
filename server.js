var settings = require("./config/config");
var APP_SECRET = settings.app_secret;

var http = require('http');

var queue_sem = require('semaphore')(1);

var express = require('express');
var app = express();

var crypto = require('crypto');

var io = require('socket.io').listen(settings.socket_server.port);
io.set('log level', settings.socket_server.log_level);

var redis = require('redis');

var redisClient;
try {
	redisClient = redis.createClient();
} catch (err) {
	console.log(err);
	process.exit(1);
}


var bluebird = require("bluebird");
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


app.use(express.static('public'));

app.get('/', function (req, res) {
  res.sendFile(settings.index_path, {root: __dirname })
});

app.listen(settings.http_server.port, function () {
  console.log('Example app listening on port ' + settings.http_server.port);
});

var queue = [];

function updateQueue() {
	if (queue.length >= 2) {
		var player1 = queue.pop();
		var player2 = queue.pop();
		
		var match_id = Date.now();
		var multi = redisClient.multi();
		multi.rpush('user_'+player1.user_id, match_id);
		multi.rpush('user_'+player2.user_id, match_id);
		multi.execAsync().then(function() {
			var multi = redisClient.multi();
			multi.rpush('match_'+match_id, player1.user_id);
			multi.rpush('match_'+match_id, player2.user_id);
			multi.execAsync().then(function() {
				player1.socket.emit("start_game", match_id);
				player2.socket.emit("start_game", match_id);
			});
		}).catch(function(e) {
	    	queue.push(player1);
	    	queue.push(player2);
		});
	}
};


io.sockets.on('connection', function (socket) {
	socket.on('handshake', function (data) {
		var str = "expire="+data.expire+"mid="+data.mid+"secret="+data.secret+"sid="+data.sid+APP_SECRET;
		var hash = crypto.createHash('md5').update(str).digest("hex");
		if (data.sig == hash) {
			socket.emit('handshake');
			var user_id = data.mid;

			redisClient.existsAsync(user_id).then(function(err, ex) {
				redisClient.hmset(user_id, "wins", 0, "loses", 0);
			}).catch(function(e) {
			    socket.emit('registration_failed');
			});

			socket.on('get_match_list', function () {
				redisClient.lrangeAsync('user_' + user_id, 0, -1).then(function(match_list) {
					socket.emit("update_match_list", match_list);
			  	});
	    	});

	    	socket.on("reconnect_to_game", function (math_id) {
			    redisClient.lrangeAsync('match_' + math_id, 0, -1).then(function(match_data) {
					socket.emit("update_match_state", {"match_id": math_id, "history": match_data});
			  	}).catch(function(e) {
			    	socket.emit('reconnect_to_game_failed');
				});
	    	});

			socket.on('enter_queue', function () {
				var player = {"socket": socket, "user_id": user_id};
				queue_sem.take(function() {
					if (queue.indexOf(player)) {
						queue.push();
						updateQueue();
					}
				});
	    	});

	    	socket.on('make_move', function (data) {
	    		var key = 'match_' + data.match_id;

	    		// here should be a check that it's that user's turn
	    		// here should be a check that the turn can be made

	    		multi = redisClient.multi();
				multi.rpush(key, data.x);
				multi.rpush(key, data.y);
				multi.execAsync().then(function() {
					return redisClient.lrangeAsync(key, 0, -1);
				}).then(function(match_data) {
					var players;
					if (match_data[0] == user_id)
						players = match_data.splice(0, 2);
					else if (match_data[1] == user_id)
						players = match_data.splice(0, 4);
					else {
						throw "err";
					}

					if (checkWin(match_data, settings.points_in_row_to_win)) {
	    				var winner_id = user_id;
	    				var looser_id = (players[0]!=user_id)?players[0]:players[1];

	    				var multi = redisClient.multi();
	    				multi.lremAsync("user_"+winner_id, 1, match_id);
	    				multi.lremAsync("user_"+looser_id, 1, match_id);
	    				multi.execAsync().then(function() {
		    				redisClient.hincrby(winner_id, "wins", 1);
							redisClient.hincrby(looser_id, "loses", 1);
							socket.emit('apply_winning_move', data);
    						socket.broadcast.emit('apply_winning_move', data);
						}).catch(function(e) {
					    	throw "err";
						});
	    			} else {
	    				socket.emit('apply_move', data);
    					socket.broadcast.emit('apply_move', data);
	    			}
			  	}).catch(function(e) {
			    	socket.emit('move_restricted', data);
				});
	    	});
		}
	});
});

function checkWin(list, inRowToWin) {
	// in fact, for the game we need to check jst that the last added point is a parent for a winning row
	// but for the task (to enable tests) it was made with a "bad" O(n^2) solution
	var steps_of_winner = Math.ceil((list.length) / 4);

	for (var i = 0; i < steps_of_winner; i++) {
		var x = list[4 * i];
		var y = list[4 * i + 1];

		var uu = 1;
		var rr = 1;
		var ur = 1;
		var ul = 1;

		for (var j = 0; j < steps_of_winner; j++) {
			var new_x = list[4 * j];
			var new_y = list[4 * j + 1];

			if ((new_x == x) && ((new_y - y) > 0) && ((new_y - y) < (inRowToWin))) 
				uu++;

			if ((new_y == y) && ((new_x - x) > 0) && ((new_x - x) < (inRowToWin))) 
				rr++;

			if (((new_x - x) == (new_y - y)) && ((new_x > x) && (new_y > y)) && ((new_x - x) < (inRowToWin)))
				ur++;

			if (((x - new_x) == (new_y - y)) && ((new_x < x) && (new_y > y)) && ((x - new_x) < (inRowToWin)))
				ul++;
		}

		if ((uu == inRowToWin) || (rr == inRowToWin) || (ur == inRowToWin) || (ul == inRowToWin))
			return true;
	}

	return false;
}

module.exports = checkWin;