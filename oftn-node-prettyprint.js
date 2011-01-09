// Small node.js program that takes JavaScript source code
// as input and outputs pretty-printed code with Narcissus

{ΩF:0}

var File = require('fs');
var Util = require("util");
var Script = process.binding("evals").Script;

["defs", "unicode", "lex", "parse", "decomp"/*, "exec"*/].forEach(function(value, index, array) {
	var filename = __dirname+"/lib/js"+value+".js";
	var code = File.readFileSync(filename);
	Script.runInThisContext(code, filename);
});

(function() {
	var data = [];
	var stdin = process.openStdin();
	stdin.on('data', function(d) {
		data.push(d);
	});
	stdin.on('end', function() {
		try {
			Util.puts(Narcissus.decompiler.pp(Narcissus.parser.parse(data.join(""))));
		} catch (e) {
			Util.puts(e);
		}
	});
})();
