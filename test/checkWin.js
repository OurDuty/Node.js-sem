var assert = require('assert');
var checkWin = require('../server.js');
 
describe('checkWin', function() {
	var ur_true = [0, 0, -1, -1, 1, 1, -1, -1, 2, 2, -1, -1, 3, 3, -1, -1, 4, 4];
	var ul_true = [4, 4, -1, -1, 3, 3, -1, -1, 2, 2, -1, -1, 1, 1, -1, -1, 0, 0];
	var uu_true = [4, 0, -1, -1, 2, 0, -1, -1, 3, 0, -1, -1, 1, 0, -1, -1, 0, 0];
	var rr_true = [0, 0, -1, -1, 0, 1, -1, -1, 0, 2, -1, -1, 0, 3, -1, -1, 0, 4];

	var list_false = [0, 0, -1, -1, 1, 1, -1, -1, 2, 2, -1, -1, 3, 3, -1, -1, 4, 5];

	it(ur_true + ' ur 5 true', function() {
		assert.equal(checkWin(ur_true, 5), true);
	});

	it(ur_true + ' ur 4 true', function() {
		assert.equal(checkWin(ur_true, 4), true);
	});

	it(ul_true + ' ul 5 true', function() {
		assert.equal(checkWin(ul_true, 5), true);
	});

	it(uu_true + ' uu 5 true', function() {
		assert.equal(checkWin(uu_true, 5), true);
	});

	it(rr_true + ' rr 5 true', function() {
		assert.equal(checkWin(rr_true, 5), true);
	});


	it(list_false + ' 5 false', function() {
		assert.equal(checkWin(list_false, 5), false);
	});

	it(list_false + ' 4 true', function() {
		assert.equal(checkWin(list_false, 4), true);
	});

});