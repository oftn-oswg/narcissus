// Program made for node.js to look at unicode information
// There is no documentation other than the following code

{ΩF:0}

var File = require('fs');
var Script = process.binding("evals").Script;

String.prototype.repeat = function(times) {
	var times = +times;
	if (isNaN(times)) return ""+this;
	if (times === -1) throw new RangeError("Invalid repeat argument");
	return Array(times+1).join(""+this);
};


var Instance = function(splitted) {
	this.splitted = splitted;
	this.len = this.splitted.length;
	this.limit = 0xffff;
};

Instance.prototype.show = function() {
	var chars = [], args;
	args = Array.prototype.slice.call(arguments).map(function(value) {
		return value.toLowerCase();
	});
	for (var i = 0; i < this.len; i++) {
		if (!this.splitted[i]) continue;
		var info = this.splitted[i].split(';');
		if (~args.indexOf(info[2].toLowerCase())) {
			var code = parseInt(info[0], 16);
			if (!this.limit || code <= this.limit) {
				chars.push(code);
			}
		}
	}
	process.stdout.write(String.fromCharCode.apply(String, chars)+"\n");
	
};

Instance.prototype.list = {
	category: function(category) {
		for (var i = 0; i < this.len; i++) {
			if (!this.splitted[i]) continue;
			var info = this.splitted[i].split(';');
			if (info[2].toLowerCase() === category.toLowerCase()) {
				var code = parseInt(info[0], 16);
				if (!this.limit || code <= this.limit) {
					var hex = code.toString(16);
					hex = "0".repeat(4-hex.length) + hex;
					process.stdout.write(hex+"\n");
				}
			}
		}
	},
	json: function() {
		var chars = [], args;
		args = Array.prototype.slice.call(arguments).map(function(value) {
			return value.toLowerCase();
		});
		for (var i = 0; i < this.len; i++) {
			if (!this.splitted[i]) continue;
			var info = this.splitted[i].split(';');
			if (~args.indexOf(info[2].toLowerCase())) {
				var code = parseInt(info[0], 16);
				if (!this.limit || code <= this.limit) {
					chars.push(code);
				}
			}
		}
		process.stdout.write(JSON.stringify(chars)+"\n");
	},
	table: function(categories) {
		var chars = [], args;
		args = categories.toLowerCase().split(',');
		for (var i = 0; i < this.len; i++) {
			if (!this.splitted[i]) continue;
			var info = this.splitted[i].split(';');
			if (~args.indexOf(info[2].toLowerCase())) {
				var code = parseInt(info[0], 16);
				if (!this.limit || code <= this.limit) {
					chars[code] = true;
				}
			}
		}
		var more = Array.prototype.slice.call(arguments, 1).map(function(v) {
			var num = parseInt(v);
			if (!isNaN(num)) return num;
			return v.charCodeAt(0);
		}).forEach(function(v) {
			chars[v] = true;
		});
		var table = [];
		for (var i = 0; i <= 0xffff; i++) {
			var tkey = i/32|0;
			
			if (typeof table[tkey] === "undefined") table[tkey] = 0;
			if (chars[i]) {
				table[tkey] |= 1 << i%32;
			}
		};
		process.stdout.write(JSON.stringify(table)+"\n");
	}
};

Instance.prototype.set = {
	limit: function(limit) {
		limit = parseInt(limit);
		if (isNaN(limit)) throw new Error("Expected decimal or hexadecimal number");
		this.limit = limit;
	}
};


var Runner = function(inst) {
	this.inst = inst;
	this.obj = inst.constructor.prototype;
};

Runner.prototype.execute = function(command) {
		
	var obj = this.obj;
	
	for (var i = 0; i < command.length; i++) {
		if (typeof obj === "function") {
			try {
				obj.apply(this.inst, command.slice(i));
				break;
			} catch (e) {
				process.stdout.write(e+"\n");
			}
		} else if (typeof obj === "object") {
			obj = obj[command[i].toLowerCase()];
		} else if (typeof obj === "undefined") {
			process.stdout.write("Could not find.\n");
			break;
		} else {
			process.stdout.write("Unexpected "+typeof obj+".\n");
		}
	}
};


var start = function start(data) {

	var inst = new Instance(data.split("\n"));
	var runner = new Runner(inst);

	if (process.argv.length > 2) {
	
		runner.execute(process.argv.splice(2));
	
	} else {
	
		process.stdout.write(">>> ");
	
		var stdin = process.openStdin();
		stdin.setEncoding("utf-8");
		stdin.on('data', function(data) {
			var command = data.replace("\n", '').split(/\s+/);
		
			runner.execute(command);
		
			process.stdout.write(">>> ");
		});
	
	}
};




File.readFile("/var/www/main/files/UnicodeData.txt", "ascii", function(err, data) {
	if (err) {
		process.stdout.write(err+"Error\n");
	} else {
		start(data);
	}
});
