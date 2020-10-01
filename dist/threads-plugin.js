function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Types = require('@babel/types');
var path = _interopDefault(require('path'));
var ParserHelpers = _interopDefault(require('webpack/lib/ParserHelpers'));
var WORKER_PLUGIN_SYMBOL = _interopDefault(require('./symbol.js'));

/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
var NAME = 'WorkerPlugin';
var JS_TYPES = ['auto', 'esm', 'dynamic'];
var workerLoader = path.resolve(__dirname, 'loader.js');
var WorkerPlugin = function WorkerPlugin(options) {
  this.options = options || {};
  this[WORKER_PLUGIN_SYMBOL] = true;
};

WorkerPlugin.prototype.apply = function apply (compiler) {
  var workerId = 0;
  compiler.hooks.normalModuleFactory.tap(NAME, function (factory) {
    for (var i = 0, list = JS_TYPES; i < list.length; i += 1) {
      var type = list[i];

        factory.hooks.parser.for(("javascript/" + type)).tap(NAME, function (parser) {
        parser.hooks.new.for('imported var').tap(NAME, function (expr) {
          if (expr.callee.name !== 'Worker') { return false; }
          var dep = parser.evaluateExpression(expr.arguments[0]);

          if (!dep.isString()) {
            parser.state.module.warnings.push({
              message: 'new Worker() will only be bundled if passed a String.'
            });
            return false;
          }

          if (/^(https?:)?\/\//i.test(dep.string)) {
            // Ignore absolute URL workers
            return false;
          }

          var optsExpr = expr.arguments[1];
          var typeModuleExpr = Types.objectProperty(Types.identifier("type"), Types.stringLiteral("module"));
          typeModuleExpr.range = [0, 0];
          var opts = {};

          if (optsExpr) {
            opts = {};

            for (var i = optsExpr.properties.length; i--;) {
              var prop = optsExpr.properties[i];

              if (prop.type === 'Property' && !prop.computed && !prop.shorthand && !prop.method) {
                opts[prop.key.name] = parser.evaluateExpression(prop.value).string;

                if (prop.key.name === 'type') {
                  typeModuleExpr = prop;
                }
              }
            }
          }

          var loaderOptions = {
            name: opts.name || workerId + ''
          };
          var req = "require(" + (JSON.stringify(workerLoader + '?' + JSON.stringify(loaderOptions) + '!' + dep.string)) + ")";
          var id = "__webpack__worker__" + (workerId++);
          ParserHelpers.toConstantDependency(parser, id)(expr.arguments[0]);
          ParserHelpers.addParsedVariableToModule(parser, id, req);
        });
      });
    }
  });
  compiler.hooks.afterEmit.tap(NAME, function (compilation) {
    if (workerId === 0) {
      compilation.warnings.push({
        message: 'No instantiations of threads.js workers found.\n' + 'Please check that:\n' + '  1. You have configured Babel / TypeScript to not transpile ES modules\n' + '  2. You import `Worker` from `threads` where you use it\n\n' + 'For more details see: https://github.com/andywer/threads-plugin\n'
      });
    }
  });
};

module.exports = WorkerPlugin;
//# sourceMappingURL=threads-plugin.js.map
