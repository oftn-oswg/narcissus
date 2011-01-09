/* vim: set sw=4 ts=4 et tw=78: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Narcissus - JS implemented in JS.
 *
 * Decompiler and pretty-printer.
 */

Narcissus.decompiler = (function() {

    const parser = Narcissus.parser;
    const definitions = Narcissus.definitions;
    const tokens = definitions.tokens;
    
    var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };

    // Set constants in the local scope.
    eval(definitions.consts);

    function indent(n, s) {
        var ss = "", d = true;

        for (var i = 0, j = s.length; i < j; i++) {
            if (d)
                for (var k = 0; k < n; k++)
                    ss += " ";
            ss += s[i];
            d = s[i] === '\n';
        }

        return ss;
    }

    function isBlock(n) {
        return n && (n.type === BLOCK);
    }

    function isNonEmptyBlock(n) {
        return isBlock(n) && n.children.length > 0;
    }

    var nodeStr = (function() {
        if (JSON) {
            return function(n) {
                return JSON.stringify(n.value);
            }
        } else {
            return function(n) {
                var string = n.value;
                escapable.lastIndex = 0;
                return escapable.test(string) ?
                    '"' + string.replace(escapable, function (a) {
                        var c = meta[a];
                        return typeof c === 'string' ? c :
                            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                    }) + '"' :
                    '"' + string + '"';
            }
        }
    })();

    function pp(n, d, inLetHead) {
        var topScript = false;

        if (!n)
            return "";
        if (!(n instanceof Object))
            return n;
        if (!d) {
            topScript = true;
            d = 1;
        }

        var p = [];

        if (n.parenthesized)
            p.push("(");

        switch (n.type) {
          case FUNCTION:
          case GETTER:
          case SETTER:
            if (n.type === FUNCTION)
                p.push("function");
            else if (n.type === GETTER)
                p.push("get");
            else
                p.push("set");

            p.push((n.name ? " " + n.name : "") + "(");
            for (var i = 0, j = n.params.length; i < j; i++)
                p.push((i > 0 ? ", " : "") + pp(n.params[i], d));
            p.push(") " + pp(n.body, d));
            break;

          case SCRIPT:
          case BLOCK:
            var nc = n.children;
            if (topScript) {
                // No indentation.
                for (var i = 0, j = nc.length; i < j; i++) {
                    if (i > 0)
                        p.push("\n");
                    p.push(pp(nc[i], d));
                    var eoc = p[p.length - 1];
                    eoc = eoc[eoc.length - 1];
                    if (eoc != ";")
                        p.push(";");
                }

                break;
            }

            p.push("{");
            if (n.id !== undefined)
                p.push(" /* " + n.id + " */");
            p.push("\n");
            for (var i = 0, j = nc.length; i < j; i++) {
                if (i > 0)
                    p.push("\n");
                p.push(indent(4, pp(nc[i], d)));
                var eoc = p[p.length - 1];
                eoc = eoc[eoc.length - 1];
                if (eoc != ";")
                    p.push(";");
            }
            p.push("\n}");
            break;

          case LET_BLOCK:
            p.push("let (" + pp(n.variables, d, true) + ") ");
            if (n.expression)
                p.push(pp(n.expression, d));
            else
                p.push(pp(n.block, d));
            break;

          case IF:
            p.push("if (" + pp(n.condition, d) + ") ");

            var tp = n.thenPart, ep = n.elsePart;
            var b = isBlock(tp) || isBlock(ep);
            if (!b)
                p.push("{\n");
            p.push((b ? pp(tp, d) : indent(4, pp(tp, d))) + "\n");

            if (ep) {
                if (!b)
                    p.push("} else {\n");
                else
                    p.push(" else ");

                p.push((b ? pp(ep, d) : indent(4, pp(ep, d))) + "\n");
            }
            if (!b)
                p.push("}");
            break;

          case SWITCH:
            p.push("switch (" + pp(n.discriminant, d) + ") {\n");
            for (var i = 0, j = n.cases.length; i < j; i++) {
                var ca = n.cases[i];
                if (ca.type === CASE)
                    p.push("  case " + pp(ca.caseLabel, d) + ":\n");
                else
                    p.push("  default:\n");
                ps = pp(ca.statements, d);
                p.push(ps.slice(2, ps.length - 2) + "\n");
            }
            p.push("}");
            break;

          case FOR:
            p.push("for (" + pp(n.setup, d) + "; "
                         + pp(n.condition, d) + "; "
                         + pp(n.update, d) + ") ");

            var pb = pp(n.body, d);
            if (!isBlock(n.body))
                p.push("{\n" + indent(4, pb) + ";\n}");
            else if (n.body)
                p.push(pb);
            break;

          case WHILE:
            p.push("while (" + pp(n.condition, d) + ") ");

            var pb = pp(n.body, d);
            if (!isBlock(n.body))
                p.push("{\n" + indent(4, pb) + ";\n}");
            else
                p.push(pb);
            break;

          case FOR_IN:
            var u = n.varDecl;
            p.push(n.isEach ? "for each (" : "for (");
            p.push((u ? pp(u, d) : pp(n.iterator, d)) + " in " +
                 pp(n.object, d) + ") ");

            var pb = pp(n.body, d);
            if (!isBlock(n.body))
                p.push("{\n" + indent(4, pb) + ";\n}");
            else if (n.body)
                p.push(pb);
            break;

          case DO:
            p.push("do " + pp(n.body, d));
            p.push(" while (" + pp(n.condition, d) + ");");
            break;

          case BREAK:
            p.push("break" + (n.label ? " " + n.label : "") + ";");
            break;

          case CONTINUE:
            p.push("continue" + (n.label ? " " + n.label : "") + ";");
            break;

          case TRY:
            p.push("try ");
            p.push(pp(n.tryBlock, d));
            for (var i = 0, j = n.catchClauses.length; i < j; i++) {
                var t = n.catchClauses[i];
                p.push(" catch (" + pp(t.varName, d) +
                                (t.guard ? " if " + pp(t.guard, d) : "") +
                                ") ");
                p.push(pp(t.block, d));
            }
            if (n.finallyBlock) {
                p.push(" finally ");
                p.push(pp(n.finallyBlock, d));
            }
            break;

          case THROW:
            p.push("throw " + pp(n.exception, d));
            break;

          case RETURN:
            p.push("return");
            if (n.value)
              p.push(" " + pp(n.value, d));
            break;

          case YIELD:
            p.push("yield");
            if (n.value.type)
              p.push(" " + pp(n.value, d));
            break;

          case GENERATOR:
            p.push(pp(n.expression, d) + " " + pp(n.tail, d));
            break;

          case WITH:
            p.push("with (" + pp(n.object, d) + ") ");
            p.push(pp(n.body, d));
            break;

          case LET:
          case VAR:
          case CONST:
            var nc = n.children;
            if (!inLetHead) {
                p.push(tokens[n.type] + " ");
            }
            for (var i = 0, j = nc.length; i < j; i++) {
                if (i > 0)
                    p.push(", ");
                var u = nc[i];
                p.push(pp(u.name, d));
                if (u.initializer)
                    p.push(" = " + pp(u.initializer, d));
            }
            break;

          case DEBUGGER:
            p.push("debugger NYI\n");
            break;

          case SEMICOLON:
            if (n.expression) {
                p.push(pp(n.expression, d) + ";");
            }
            break;

          case LABEL:
            p.push(n.label + ":\n" + pp(n.statement, d));
            break;

          case COMMA:
          case LIST:
            var nc = n.children;
            for (var i = 0, j = nc.length; i < j; i++) {
                if (i > 0)
                    p.push(", ");
                p.push(pp(nc[i], d));
            }
            break;

          case ASSIGN:
            var nc = n.children;
            var t = n.assignOp;
            p.push(pp(nc[0], d) + " " + (t ? tokens[t] : "") + "="
                              + " " + pp(nc[1], d));
            break;

          case HOOK:
            var nc = n.children;
            p.push("(" + pp(nc[0], d) + " ? "
                     + pp(nc[1], d) + " : "
                     + pp(nc[2], d));
            p.push(")");
            break;

          case OR:
          case AND:
            var nc = n.children;
            p.push("(" + pp(nc[0], d) + " " + tokens[n.type] + " "
                     + pp(nc[1], d));
            p.push(")");
            break;

          case BITWISE_OR:
          case BITWISE_XOR:
          case BITWISE_AND:
          case EQ:
          case NE:
          case STRICT_EQ:
          case STRICT_NE:
          case LT:
          case LE:
          case GE:
          case GT:
          case IN:
          case INSTANCEOF:
          case LSH:
          case RSH:
          case URSH:
          case PLUS:
          case MINUS:
          case MUL:
          case DIV:
          case MOD:
            var nc = n.children;
            p.push("(" + pp(nc[0], d) + " " + tokens[n.type] + " "
                     + pp(nc[1], d) + ")");
            break;

          case DELETE:
          case VOID:
          case TYPEOF:
            p.push(tokens[n.type] + " "  + pp(n.children[0], d));
            break;

          case NOT:
          case BITWISE_NOT:
            p.push(tokens[n.type] + pp(n.children[0], d));
            break;

          case UNARY_PLUS:
            p.push("+" + pp(n.children[0], d));
            break;

          case UNARY_MINUS:
            p.push("-" + pp(n.children[0], d));
            break;

          case INCREMENT:
          case DECREMENT:
            if (n.postfix) {
                p.push(pp(n.children[0], d) + tokens[n.type]);
            } else {
                p.push(tokens[n.type] + pp(n.children[0], d));
            }
            break;

          case DOT:
            var nc = n.children;
            p.push(pp(nc[0], d) + "." + pp(nc[1], d));
            break;

          case INDEX:
            var nc = n.children;
            p.push(pp(nc[0], d) + "[" + pp(nc[1], d) + "]");
            break;

          case CALL:
            var nc = n.children;
            p.push(pp(nc[0], d) + "(" + pp(nc[1], d) + ")");
            break;

          case NEW:
          case NEW_WITH_ARGS:
            var nc = n.children;
            p.push("new " + pp(nc[0], d));
            if (nc[1])
                p.push("(" + pp(nc[1], d) + ")");
            break;

          case ARRAY_INIT:
            p.push("[");
            var nc = n.children;
            var items = [];
            for (var i = 0, j = nc.length; i < j; i++) {
                items.push(nc[i] ? pp(nc[i], d) : "");
            }
            p.push(items.join(", "));
            p.push("]");
            break;

          case ARRAY_COMP:
            p.push("[" + pp (n.expression, d) + " ");
            p.push(pp(n.tail, d));
            p.push("]");
            break;

          case COMP_TAIL:
            var nc = n.children;
            for (var i = 0, j = nc.length; i < j; i++) {
                if (i > 0)
                    p.push(" ");
                p.push(pp(nc[i], d));
            }
            if (n.guard)
                p.push(" if (" + pp(n.guard, d) + ")");
            break;

          case OBJECT_INIT:
            var nc = n.children;
            if (nc[0] && nc[0].type === PROPERTY_INIT)
                p.push("{\n");
            else
                p.push("{");
            for (var i = 0, j = nc.length; i < j; i++) {
                if (i > 0) {
                    p.push(",\n");
                }

                var t = nc[i];
                if (t.type === PROPERTY_INIT) {
                    var tc = t.children;
                    var l;
                    // see if the key needs to be a string
                    if (/[^A-Za-z0-9_$]/.test(tc[0].value)) {
                        l = nodeStr(tc[0]);
                    } else {
                        l = pp(tc[0], d);
                    }
                    p.push(indent(4, l) + ": " +
                         indent(4, pp(tc[1], d)).substring(4));
                } else {
                    p.push(indent(4, pp(t, d)));
                }
            }
            p.push((nc.length ? "\n" : "")+"}");
            break;

          case NULL:
            p.push("null");
            break;

          case THIS:
            p.push("this");
            break;

          case TRUE:
            p.push("true");
            break;

          case FALSE:
            p.push("false");
            break;

          case IDENTIFIER:
          case NUMBER:
          case REGEXP:
            p.push(n.value);
            break;

          case STRING:
            p.push(nodeStr(n));
            break;

          case GROUP:
            p.push("(" + pp(n.children[0], d) + ")");
            break;

          default:
            throw "PANIC: unknown operation " + tokens[n.type] + " " + n.toSource();
        }

        if (n.parenthesized)
            p.push(")");

        return p.join("");
    }

    return {
        pp: pp
    };

}());
