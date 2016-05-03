var session;

window.onload = function(){
	socket = io.connect('http://127.0.0.1:8080');
	VK.init({
		  apiId: 4611385
		});
		function authInfo(response) {
		  if (response.session) {
		  	session = response.session;
		  	socket.emit('handshake', session);
		  	socket.on('handshake', function(){
		  		socket.emit('get_match_list');

		  		socket.on('update_match_list', function(data){
		  			$("#match_list").empty();
		  			for (var i in data) {
		  				var t = $('<li>'+data[i]+'</li>');
		  				t.on('click', function(e) {  
					        socket.emit("reconnect_to_game", data[i]);
					    });

		  				$("#match_list").append(t);
		  			}
		  		});

		  		$("#enter_queue").on('click', function(e) {  
			        socket.emit('enter_queue');
			    });

			    socket.on("start_game", function(data){
			  		socket.emit("reconnect_to_game", data);
			  		socket.emit('get_match_list');
			  	});

			    socket.on("update_match_state", function(data) {
			    	console.log(data);
			    })
		  	});
		  	
		  } else {
		    alert('Auth to play game!');
		  }
		}
		VK.Auth.getLoginStatus(authInfo);
};