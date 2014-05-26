// Generated by CoffeeScript 1.6.3
(function() {
  var __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  (function(factory) {
    /*
    # Uses AMD or browser globals to create a jQuery plugin.
    # It does not try to register in a CommonJS environment since
    # jQuery is not likely to run in those environments.
    #
    # form [umd](https://github.com/umdjs/umd) project
    */

    if (typeof define === 'function' && define.amd) {
      return define(['jquery'], factory);
    } else {
      return factory(window.jQuery);
    }
  })(function($) {
    var Controller, EventEmitter, KEY, Mentions, Model, View, defaultSettings, utils;
    KEY = {
      BACKSPACE: 8,
      TAB: 9,
      ENTER: 13,
      ESC: 27,
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      COMMA: 188,
      SPACE: 32,
      HOME: 36,
      END: 35
    };
    defaultSettings = {
      triggerChar: '@',
      matchFields: "name",
      valueField: "name",
      data: [],
      displayLimit: 5,
      matchLength: 20,
      matchCase: false,
      elastic: true,
      at: "bottom",
      autoCompleteItemActive: 'cur',
      tpl_wrapper: _.template('<div class="mentions-autocomplete atwho-view"></div>'),
      tpl_autocompleteList: _.template('<ul><%= items %></ul>'),
      tpl_autocompleteListItem: _.template('<li><%= name %></li>')
    };
    utils = {
      htmlEncode: function(str) {
        return _.escape(str);
      },
      isFocusable: function(domNode) {
        return (domNode != null) && (domNode.focus || domNode.selectionStart || domNode.createTextRange);
      },
      highlightTerm: function(value, term) {
        if (!(term != null ? term.length : void 0)) {
          value;
        }
        return value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + term + ")(?![^<>]*>)(?![^&;]+;)", 'gi'), '<b>$1</b>');
      },
      setCaratPosition: function(domNode, caretPos) {
        var range;
        if (caretPos == null) {
          caretPos = 0;
        }
        if (!domNode && !this.isFocusable(domNode)) {
          false;
        }
        if (domNode.createTextRange) {
          range = domNode.createTextRange();
          range.move('character', caretPos);
          range.select();
        } else if (domNode.selectionStart) {
          domNode.focus();
          domNode.setSelectionRange(caretPos, caretPos);
        } else {
          domNode.focus();
        }
      },
      rtrim: function(str) {
        if (str == null) {
          str = '';
        }
        return str.replace(/\s+$/, '');
      },
      indexOfWithCase: function(str, str_to_match, isCaseSensitive) {
        var e;
        try {
          if (!isCaseSensitive) {
            str = str.toLowerCase();
            str_to_match = str_to_match.toLowerCase();
          }
          return str.indexOf(str_to_match);
        } catch (_error) {
          e = _error;
          return -1;
        }
      }
    };
    /*
    # Tiny browser/node EventEmitter implementation in coffeescript
    # From: https://gist.github.com/Contra/2759355
    */

    EventEmitter = (function() {
      function EventEmitter() {
        this.events = {};
      }

      EventEmitter.prototype.emit = function() {
        var args, event, listener, _i, _len, _ref;
        event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
        if (!this.events[event]) {
          return false;
        }
        _ref = this.events[event];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          listener = _ref[_i];
          listener.apply(null, args);
        }
        return true;
      };

      EventEmitter.prototype.addListener = function(event, listener) {
        this.emit('newListener', event, listener);
        this.events[event] = this.events[event] || [];
        this.events[event].push(listener);
        return this;
      };

      EventEmitter.prototype.on = EventEmitter.prototype.addListener;

      EventEmitter.prototype.once = function(event, listener) {
        var fn,
          _this = this;
        fn = function() {
          _this.removeListener(event, fn);
          return listener.apply(null, arguments);
        };
        this.on(event, fn);
        return this;
      };

      EventEmitter.prototype.removeListener = function(event, listener) {
        var l;
        if (!this.events[event]) {
          return this;
        }
        this.events[event] = (function() {
          var _i, _len, _ref, _results;
          _ref = this.events[event];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            l = _ref[_i];
            if (l !== listener) {
              _results.push(l);
            }
          }
          return _results;
        }).call(this);
        return this;
      };

      EventEmitter.prototype.removeAllListeners = function(event) {
        delete this.events[event];
        return this;
      };

      return EventEmitter;

    })();
    Controller = (function(_super) {
      __extends(Controller, _super);

      function Controller(key, data, $input, settings) {
        this.key = key;
        this.$input = $input;
        this.model = new Model(data, settings);
        this.view = new View($input, settings);
        this.settings = settings;
        this.listenToModel();
        this.listenToView();
        Controller.__super__.constructor.call(this, key, data, $input);
      }

      Controller.prototype.listenToView = function() {
        var _this = this;
        this.view.on("shown", function() {
          return _this.$input.trigger("jqm_shown", [_this.key, _this]);
        });
        this.view.on("mention", function(item) {
          var content, contentFirst, replace, textAfter, textBefore;
          if (!item) {
            return;
          }
          _this.$input.trigger("jqm_selected", [_this.key, item[_this.settings.valueField], _this]);
          content = _this.$input.val();
          replace = content.substring(_this.query.start, _this.query.end);
          textBefore = content.substring(0, _this.query.start);
          textAfter = content.substring(_this.query.end);
          contentFirst = textBefore + item[_this.settings.valueField];
          _this.$input.val(contentFirst + " " + textAfter);
          utils.setCaratPosition(_this.$input.get(0), contentFirst.length + 1);
        });
      };

      Controller.prototype.listenToModel = function() {
        var _this = this;
        this.model.on("match", function(matches, str) {
          console.log(matches, str);
          return _this.view.render(matches);
        });
      };

      Controller.prototype.activate = function() {};

      Controller.prototype.hide = function() {
        this.view.hide();
      };

      Controller.prototype.show = function() {
        return this.find_match();
      };

      Controller.prototype.rejectController = function() {
        this.view.removeView();
        this.emit("reject_controller");
      };

      Controller.prototype.reload = function(data) {
        this.model.reload(data);
      };

      Controller.prototype.handle_keydown = function(e) {
        switch (e.keyCode) {
          case KEY.ESC:
            e.preventDefault();
            this.rejectController();
            break;
          case KEY.UP:
            e.preventDefault();
            this.view.selectPrevious();
            break;
          case KEY.DOWN:
            e.preventDefault();
            this.view.selectNext();
            break;
          case KEY.TAB:
          case KEY.ENTER:
            if (this.view.getCurrentIndex() !== null) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              this.view.chooseCurrent();
            }
            this.rejectController();
            break;
          default:
            $.noop();
        }
      };

      Controller.prototype.handle_keyup = function(e) {
        switch (e.keyCode) {
          case KEY.ESC:
            e.preventDefault();
            this.rejectController();
            return;
          case KEY.UP:
          case KEY.DOWN:
            e.preventDefault();
            return;
          case KEY.TAB:
          case KEY.ENTER:
            if (this.view.getCurrentIndex() !== null) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              this.view.chooseCurrent();
            }
            this.rejectController();
            return;
          default:
            $.noop();
        }
        this.find_match();
      };

      Controller.prototype.find_match = function() {
        var match;
        match = this.matcher(this.$input.val(), this.$input[0].selectionStart);
        if (match === null) {
          this.rejectController();
        } else {
          this.model.get_matches(match);
        }
      };

      Controller.prototype.matcher = function(text, caratPos, start_with_space) {
        var end, match, start, subtext;
        if (caratPos == null) {
          caratPos = (text != null ? text.length : void 0) || 0;
        }
        if (start_with_space == null) {
          start_with_space = false;
        }
        if (!text) {
          return;
        }
        subtext = text.substr(0, caratPos);
        match = this.extract_after_match(this.key, subtext, false);
        this.query = null;
        if (typeof match === "string" && match.length <= this.settings.matchLength) {
          match.toLowerCase();
          start = caratPos - match.length;
          end = start + match.length;
          this.query = {
            text: match,
            start: start,
            end: end
          };
          return match;
        } else {
          return null;
        }
      };

      /*
      # Copied from At.js - the best possible matching algorithm and regular expression
      */


      Controller.prototype.extract_after_match = function(key, input_val, should_start_with_space) {
        var match, regexp;
        key = key.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        if (should_start_with_space) {
          key = '(?:^|\\s)' + key;
        }
        regexp = new RegExp(key + '([A-Za-z0-9_\+\-]*)$|' + key + '([^\\x00-\\xff]*)$', 'gi');
        match = regexp.exec(input_val);
        if (match) {
          return match[2] || match[1];
        } else {
          return null;
        }
      };

      return Controller;

    })(EventEmitter);
    Model = (function(_super) {
      __extends(Model, _super);

      function Model(data, settings) {
        if (_.isArray(settings.matchFields)) {
          this.matchFields = settings.matchFields;
        } else {
          this.matchFields = [settings.matchFields];
        }
        this.settings = settings;
        this.isSaved = false;
        this.data = data;
        this.saved_data = null;
        Model.__super__.constructor.call(this, data);
      }

      Model.prototype.get_matches = function(str_to_match, callback) {
        var matches,
          _this = this;
        if (!this.data) {
          return callback([], str_to_match);
        }
        if (!this.isSaved) {
          this.load(this.data, function() {
            return _this.get_matches(str_to_match, callback);
          });
        }
        if (this.isSaved) {
          matches = this._get_matches(str_to_match);
          if (typeof callback === "function") {
            callback(matches, str_to_match);
          }
          this.emit("match", matches, str_to_match);
        }
        return true;
      };

      Model.prototype.load = function(data, callback) {
        var _this = this;
        if (typeof data === "string") {
          $.ajax(data, {
            dataType: "json"
          }).done(function(ret_data) {
            return _this.save(ret_data, callback);
          });
        } else {
          this.save(data, callback);
        }
      };

      Model.prototype.reload = function(data) {
        if (data == null) {
          data = this.data;
        }
        this.data = data;
        this.isSaved = false;
        this.saved_data = null;
      };

      Model.prototype.save = function(data, callback) {
        this.saved_data = data;
        this.isSaved = true;
        callback();
      };

      Model.prototype._get_matches = function(str_to_match) {
        var matched,
          _this = this;
        matched = [];
        if (typeof str_to_match === "undefined" || !str_to_match.toLowerCase) {
          return matched;
        }
        _.each(this.saved_data, function(item) {
          var item_match_found;
          item_match_found = false;
          _.each(_this.matchFields, function(field) {
            if (_.isString(item[field]) && utils.indexOfWithCase(item[field], str_to_match, _this.settings.matchCase) !== -1) {
              item_match_found = true;
            }
          });
          if (item_match_found && matched.length < _this.settings.displayLimit) {
            matched.push(item);
          }
        });
        return matched;
      };

      return Model;

    })(EventEmitter);
    View = (function(_super) {
      __extends(View, _super);

      function View($input, settings) {
        this.item_map = {};
        this.items = [];
        this.isInDom = false;
        this.isShown = false;
        this.settings = settings;
        this.index = 0;
        this.limit = 5;
        this.$input = $input;
        this.$dom = null;
        View.__super__.constructor.call(this, $input);
      }

      View.prototype.hide = function() {
        var _ref;
        this.isShown = false;
        this.index = null;
        if ((_ref = this.$dom) != null) {
          _ref.hide();
        }
      };

      View.prototype.show = function() {
        var _ref;
        if ((_ref = this.$dom) != null) {
          _ref.show();
        }
        if (!this.isShown) {
          this.emit("shown");
        }
        this.isShown = true;
      };

      View.prototype.setPosition = function() {
        var left, top, _ref;
        _ref = this.$input.offset(), top = _ref.top, left = _ref.left;
        if (this.settings.at === "top") {
          top = 0 - (this.$dom.height() + this.$input.height() + 15);
        } else {
          top = 0;
        }
        this.$dom.css({
          position: "relative",
          top: top + "px",
          left: 0 + "px"
        });
      };

      View.prototype.setDimension = function() {
        this.$dom.css({
          width: this.$input.width + "px"
        });
      };

      View.prototype.setView = function() {
        var _base;
        this.$dom = $(typeof (_base = this.settings).tpl_wrapper === "function" ? _base.tpl_wrapper() : void 0);
        this.$input.parent().append(this.$dom);
        this.isInDom = true;
      };

      View.prototype.removeView = function() {
        var _ref;
        this.hide();
        if ((_ref = this.$dom) != null) {
          _ref.remove();
        }
        this.$dom = null;
        this.isInDom = false;
      };

      View.prototype.render = function(items, match) {
        var $items_el,
          _this = this;
        if (!items || !items.length) {
          return this.hide();
        }
        if (!this.isInDom) {
          this.setView();
        }
        if (!this.isShown) {
          this.show();
        }
        this.item_map = {};
        this.items = items;
        this.$dom.html(this.settings.tpl_autocompleteList({
          items: "<div class='place_holder'></div>"
        }));
        $items_el = [];
        _.each(items, function(item, idx) {
          var $el, _base;
          $el = $(typeof (_base = _this.settings).tpl_autocompleteListItem === "function" ? _base.tpl_autocompleteListItem(item) : void 0);
          $el.insertBefore($('.place_holder', _this.$dom));
          $el.on("click", function(e) {
            e.preventDefault();
            _this.choose(idx);
          }).on("mouseover", function(e) {
            _this.select(idx);
          });
          /*uid = _.uniqueId("acm_")
          if not $el.attr "id"
            $el.attr "id", uid
          else
            uid = $el.attr "id"
          */

          _this.item_map[idx] = $el;
        });
        $('.place_holder', this.$dom).remove();
        this.setDimension();
        this.setPosition();
        this.selectFirst();
        return this.isShow = true;
      };

      View.prototype.getCurrentIndex = function() {
        return this.index;
      };

      View.prototype.chooseCurrent = function() {
        return this.choose(this.index);
      };

      View.prototype.choose = function(idx) {
        if (idx === null) {
          this.emit("mention");
        }
        return this.emit("mention", this.items[idx]);
      };

      View.prototype.selectFirst = function() {
        this.select(0);
      };

      View.prototype.select = function(idx) {
        var $current_el, _ref;
        if (!this.isInDom || !this.isShown) {
          return;
        }
        if (idx >= ((_ref = this.items) != null ? _ref.length : void 0) || idx < 0) {
          return;
        }
        $current_el = this.item_map[this.index || 0];
        if ($current_el != null) {
          $current_el.removeClass(this.settings.autoCompleteItemActive);
        }
        this.index = idx;
        $current_el = this.item_map[this.index || 0];
        if ($current_el != null) {
          $current_el.addClass(this.settings.autoCompleteItemActive);
        }
      };

      View.prototype.selectNext = function() {
        return this.select(this.index + 1);
      };

      View.prototype.selectPrevious = function() {
        return this.select(this.index - 1);
      };

      return View;

    })(EventEmitter);
    Mentions = (function() {
      function Mentions(settings, input) {
        this.$input = $(input);
        this.key_controllers = {};
        this.active_controller = null;
        this.attachInputEvents();
      }

      Mentions.prototype.attachInputEvents = function() {
        var _this = this;
        return this.$input.on('keyup', function(e) {
          return _this.on_keyup(e);
        }).on('keydown', function(e) {
          return _this.on_keydown(e);
        }).on('scroll', function(e) {
          return _this.hide();
        }).on('blur', function(e) {
          return setTimeout(function() {
            return _this.hide();
          }, 1000);
        }).on('focus', function(e) {
          return setTimeout(function() {
            return _this.show();
          }, 100);
        });
      };

      Mentions.prototype.on_keyup = function(e) {
        var _ref;
        if (!this.getActiveController()) {
          this.setActiveController(this.detect_controller_trigger());
        }
        if ((_ref = this.getActiveController()) != null) {
          _ref.handle_keyup(e);
        }
        return true;
      };

      Mentions.prototype.on_keydown = function(e) {
        var active_controller;
        active_controller = this.getActiveController();
        if (!active_controller) {
          return;
        }
        return active_controller.handle_keydown(e);
      };

      Mentions.prototype.show = function() {
        var _ref;
        if (!this.getActiveController()) {
          this.setActiveController(this.detect_controller_trigger());
        }
        if ((_ref = this.getActiveController()) != null) {
          _ref.show();
        }
        return true;
      };

      Mentions.prototype.setData = function(key, data) {
        var controller;
        controller = this.getController(key);
        return controller.reload(data);
      };

      Mentions.prototype.hide = function() {
        var controller, key, _ref;
        _ref = this.key_controllers;
        for (key in _ref) {
          controller = _ref[key];
          controller.hide();
        }
      };

      Mentions.prototype.reset = function() {
        return this.hide();
      };

      Mentions.prototype.detect_controller_trigger = function() {
        var controller, key, _ref;
        _ref = this.key_controllers;
        for (key in _ref) {
          controller = _ref[key];
          if (controller.matcher(this.$input.val(), this.$input[0].selectionStart) !== null) {
            return controller;
          }
        }
      };

      Mentions.prototype.getMentions = function() {};

      Mentions.prototype.init = function(instance, settings) {
        var controller, key;
        settings = _.defaults(settings || {}, defaultSettings);
        key = settings.triggerChar;
        controller = this.getController(key);
        if (!controller) {
          controller = new Controller(key, settings.data, this.$input, settings);
          this.setController(key, controller);
        }
      };

      Mentions.prototype.listen = function() {};

      Mentions.prototype.getActiveController = function() {
        return this.active_controller;
      };

      Mentions.prototype.setActiveController = function(controller) {
        if (controller) {
          return this.active_controller = controller;
        }
      };

      Mentions.prototype.unsetActiveController = function() {
        return this.active_controller = null;
      };

      Mentions.prototype.hasController = function(key) {
        return this.key_controllers[key] != null;
      };

      Mentions.prototype.setController = function(key, controller) {
        var _this = this;
        controller.on("reject_controller", function() {
          if (_this.active_controller === controller) {
            return _this.unsetActiveController();
          }
        });
        return this.key_controllers[key] = controller;
      };

      Mentions.prototype.getController = function(key) {
        return this.key_controllers[key];
      };

      Mentions.api = {
        init: function(instance, settings) {
          return instance.init(instance, settings);
        },
        reset: function(instance, settings) {
          return instance.reset.apply(instance, settings);
        },
        getMentions: function(instance, settings) {
          return instance.getMentions.apply(instance, settings);
        },
        show: function(instance, settings) {
          return instance.show.apply(instance, settings);
        },
        data: function(instance, key, data) {
          return instance.setData.call(instance, key, data);
        }
      };

      return Mentions;

    })();
    $.fn.mentionsInput = function() {
      var method, outerArguments, settings;
      method = arguments[0], settings = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      outerArguments = settings;
      if (typeof method === 'object' || !method) {
        settings = method;
      } else {
        settings = settings[0];
      }
      return this.each(function() {
        var instance;
        instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new Mentions(settings, this));
        outerArguments.unshift(instance);
        if (_.isFunction(Mentions.api[method])) {
          return Mentions.api[method].apply(this, outerArguments);
        } else if (typeof method === 'object' || !method) {
          return Mentions.api.init.call(this, instance, method);
        } else {
          return $.error("Method " + method + " does not exist");
        }
      });
    };
    return Mentions;
  });

}).call(this);

/*
//@ sourceMappingURL=jquery.mentions.map
*/
