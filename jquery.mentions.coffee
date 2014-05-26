( (factory) ->
  ###
  # Uses AMD or browser globals to create a jQuery plugin.
  # It does not try to register in a CommonJS environment since
  # jQuery is not likely to run in those environments.
  #
  # form [umd](https://github.com/umdjs/umd) project
  ###
  if typeof define is 'function' and define.amd
    # Register as an anonymous AMD module:
    define ['jquery'], factory
  else
    # Browser globals
    factory window.jQuery
) ($) ->
  KEY =
    BACKSPACE: 8
    TAB : 9
    ENTER : 13
    ESC : 27
    LEFT : 37
    UP : 38
    RIGHT : 39
    DOWN : 40
    COMMA : 188
    SPACE : 32
    HOME : 36
    END : 35

  defaultSettings =
    triggerChar: '@'
    matchFields: "name"
    valueField: "name"
    data: []
    displayLimit: 5
    matchLength: 20
    matchCase: false
    elastic: true
    at: "bottom" #can be either "top" or "bottom"
    autoCompleteItemActive: 'cur'
    tpl_wrapper                       : _.template('<div class="mentions-autocomplete atwho-view"></div>')
    tpl_autocompleteList              : _.template('<ul><%= items %></ul>')
    tpl_autocompleteListItem          : _.template('<li><%= name %></li>')

  utils =
    htmlEncode  : (str) ->
      _.escape(str)

    isFocusable : (domNode) ->
      domNode? and (domNode.focus or domNode.selectionStart or domNode.createTextRange)

    highlightTerm : (value, term) ->
      value if not term?.length
      value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(#{ term })(?![^<>]*>)(?![^&;]+;)", 'gi'), '<b>$1</b>')

    setCaratPosition : (domNode, caretPos=0) ->
      false if not domNode and not @isFocusable(domNode)
      if domNode.createTextRange
        range = domNode.createTextRange()
        range.move('character', caretPos)
        range.select()
      else if domNode.selectionStart
        domNode.focus()
        domNode.setSelectionRange(caretPos, caretPos)
      else
        domNode.focus()
      return

    rtrim: (str = '') ->
      str.replace(/\s+$/,'')

    indexOfWithCase: (str, str_to_match, isCaseSensitive) ->
      try
        if not isCaseSensitive
          str = str.toLowerCase()
          str_to_match = str_to_match.toLowerCase()
        return str.indexOf(str_to_match)
      catch e
        return -1

  ###
  # Tiny browser/node EventEmitter implementation in coffeescript
  # From: https://gist.github.com/Contra/2759355
  ###
  class EventEmitter
    constructor: ->
      @events = {}

    emit: (event, args...) ->
      return false unless @events[event]
      listener args... for listener in @events[event]
      return true

    addListener: (event, listener) ->
      @emit 'newListener', event, listener
      @events[event] = @events[event] or []
      @events[event].push listener
      return @

    on: @::addListener

    once: (event, listener) ->
      fn = =>
        @removeListener event, fn
        listener arguments...
      @on event, fn
      return @

    removeListener: (event, listener) ->
      return @ unless @events[event]
      @events[event] = (l for l in @events[event] when l isnt listener)
      return @

    removeAllListeners: (event) ->
      delete @events[event]
      return @

  class Controller extends EventEmitter
    constructor: (key, data, $input, settings) ->
      @key = key
      @$input = $input
      @model = new Model(data, settings)
      @view = new View($input, settings)
      @settings = settings
      do @listenToModel
      do @listenToView
      super(key, data, $input)

    listenToView: ->
      @view.on "shown", ()=>
        @$input.trigger("jqm_shown", [@key, this])
      @view.on "mention", (item) =>
        return unless item
        @$input.trigger("jqm_selected", [@key, item[@settings.valueField], this])
        content = @$input.val()
        replace = content.substring(@query.start, @query.end)
        textBefore = content.substring(0, @query.start)
        textAfter = content.substring(@query.end)
        contentFirst = textBefore + item[@settings.valueField]
        @$input.val(contentFirst + " " + textAfter)
        utils.setCaratPosition @$input.get(0), contentFirst.length+1
        return
      return

    listenToModel: ->
      @model.on "match", (matches, str) =>
        console.log matches, str
        @view.render(matches)
      return
    activate: ->
      return
    hide: ->
      # TODO: send hide command to the view
      @view.hide()
      return
    show: ->
      @find_match()
    rejectController: ->
      @view.removeView()
      @emit "reject_controller"
      return
    reload: (data) ->
      @model.reload(data)
      return
    handle_keydown: (e) ->
      # TODO: Handle down key especially for escape, navigation keys and enter key
      switch e.keyCode
        when KEY.ESC
          e.preventDefault()
          @rejectController()
        when KEY.UP
          e.preventDefault()
          do @view.selectPrevious
        when KEY.DOWN
          e.preventDefault()
          do @view.selectNext
        when KEY.TAB, KEY.ENTER
          unless @view.getCurrentIndex() is null
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            do @view.chooseCurrent
          @rejectController()
        else
          $.noop()
      return
    handle_keyup: (e) ->
      switch e.keyCode
        when KEY.ESC
          e.preventDefault()
          @rejectController()
          return
        when KEY.UP, KEY.DOWN
          e.preventDefault()
          return
        when KEY.TAB, KEY.ENTER
          unless @view.getCurrentIndex() is null
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            do @view.chooseCurrent
          @rejectController()
          return
        else
          $.noop()
      @find_match()
      return

    find_match: () ->
      match = @matcher(@$input.val(), @$input[0].selectionStart)
      if match is null
        @rejectController()
      else
        # TODO: send the match to the model, let the model return some data, display it in the view
        @model.get_matches(match)
      return

    matcher: (text, caratPos = text?.length || 0, start_with_space = false) ->
      return if not text
      subtext = text.substr(0, caratPos)
      match = @extract_after_match @key, subtext, false
      @query = null
      if typeof match is "string" and match.length <= @settings.matchLength
        match.toLowerCase()
        start = caratPos - match.length
        end = start + match.length
        @query =  {text: match, start: start, end: end}
        match
      else
        null
    ###
    # Copied from At.js - the best possible matching algorithm and regular expression
    ###
    extract_after_match: (key, input_val, should_start_with_space) ->
      # escape RegExp
      key = key.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
      key = '(?:^|\\s)' + key if should_start_with_space
      regexp = new RegExp key+'([A-Za-z0-9_\+\-]*)$|'+key+'([^\\x00-\\xff]*)$','gi'
      match = regexp.exec input_val
      if match then match[2] || match[1] else null


  class Model extends EventEmitter
    constructor: (data, settings) ->
      if _.isArray(settings.matchFields)
        @matchFields = settings.matchFields
      else
        @matchFields = [settings.matchFields]
      @settings = settings
      @isSaved = false
      @data = data
      @saved_data = null
      super(data)
    get_matches: (str_to_match, callback) ->
      #No data so every match is going to be empty
      return callback([], str_to_match) if not @data
      #The data is not loaded yet, so load the data from remote or from given arrat
      # and call the same get_matches function once the data is loaded
      @load(@data, ()=>
        @get_matches str_to_match, callback
      ) if not @isSaved
      #the data is already loaded,
      if @isSaved
        matches = @_get_matches str_to_match
        callback? matches, str_to_match
        @emit "match", matches, str_to_match
      return true
    load: (data, callback) ->
      if typeof data is "string"
        $.ajax(data, dataType: "json").done (ret_data) => @save ret_data, callback
      else
        @save data, callback
      return
    reload: (data = @data) ->
      #Just reset the saved flag and let the model reload on the next match
      @data = data
      @isSaved = false
      @saved_data = null
      return
    save: (data, callback) ->
      @saved_data = data
      @isSaved = true
      do callback
      return
    _get_matches: (str_to_match) ->
      matched = []
      return matched if(typeof(str_to_match) is "undefined" || !str_to_match.toLowerCase)
      _.each @saved_data, (item) =>
        item_match_found = false
        _.each @matchFields, (field) =>
          if _.isString(item[field]) and utils.indexOfWithCase(item[field], str_to_match, @settings.matchCase) isnt -1
            item_match_found = true
          return
        matched.push item if item_match_found and matched.length < @settings.displayLimit
        return
      return matched

  class View extends EventEmitter
    constructor: ($input, settings) ->
      @item_map={}
      @items=[]
      @isInDom = false
      @isShown = false
      @settings = settings
      @index = 0
      @limit = 5
      @$input = $input
      @$dom = null
      super($input)
    hide: () ->
      @isShown = false
      @index = null
      @$dom?.hide()
      return
    show: () ->
      @$dom?.show()
      @emit "shown" if not @isShown
      @isShown = true
      return
    setPosition: () ->
      #TODO : Need to fix this function
      {top, left} = @$input.offset()
      if @settings.at is "top"
        top = 0 - (@$dom.height() + @$input.height() + 15)
      else
        top = 0
      @$dom.css(
        position: "relative"
        top: top + "px"
        left: 0 + "px"
      )
      return
    setDimension: () ->
      @$dom.css({width:@$input.width+"px"})
      return
    setView: () ->
      @$dom = $(@settings.tpl_wrapper?());
      @$input.parent().append(@$dom);
      @isInDom = true
      return
    removeView: () ->
      do @hide
      @$dom?.remove()
      @$dom = null
      @isInDom = false
      return
    render: (items, match) ->
      return do @hide if !items or !items.length
      do @setView if not @isInDom
      do @show if not @isShown
      @item_map = {}
      @items = items
      @$dom.html(@settings.tpl_autocompleteList({items:"<div class='place_holder'></div>"}))
      $items_el=[]
      _.each items, (item, idx) =>
        $el = $(@settings.tpl_autocompleteListItem?(item))
        $el.insertBefore($('.place_holder', @$dom))
        $el.on("click", (e)=>
          do e.preventDefault
          @choose idx
          return
        ).on("mouseover", (e)=>
          @select idx
          return
        )
        ###uid = _.uniqueId("acm_")
        if not $el.attr "id"
          $el.attr "id", uid
        else
          uid = $el.attr "id"
        ###
        @item_map[idx] = $el
        return
      $('.place_holder', @$dom).remove();
      do @setDimension
      do @setPosition
      do @selectFirst
      @isShow = true
    getCurrentIndex: ->
      return @index
    chooseCurrent: ->
      @choose @index
    choose: (idx) ->
      @emit "mention" if idx is null
      @emit "mention", @items[idx]
    selectFirst: ->
      @select 0
      return
    select: (idx)->
      return if !@isInDom or !@isShown
      return if idx >= @items?.length or idx < 0
      $current_el = @item_map[@index || 0]
      $current_el?.removeClass @settings.autoCompleteItemActive
      @index = idx
      $current_el = @item_map[@index || 0]
      $current_el?.addClass @settings.autoCompleteItemActive
      return
    selectNext: ->
      @select @index+1
    selectPrevious: ->
      @select @index-1

  # mentions.js central contoller(searching, matching, evaluating and rendering.)
  class Mentions
    # @param inputor [HTML DOM Object] `input` or `textarea`
    constructor: (settings, input) ->
      @$input = $(input)
      @key_controllers = {}
      @active_controller = null
      #create controller for the given setting
      #attach event listener on the text field
      @attachInputEvents()

    attachInputEvents: () ->
      @$input
        .on 'keyup', (e) =>
          @on_keyup(e)
        .on 'keydown', (e) =>
          @on_keydown(e)
        .on 'scroll', (e) =>
          @hide()
        .on 'blur', (e) =>
          setTimeout(()=>
            do @hide
          , 1000
          )
        .on 'focus', (e) =>
          setTimeout(()=>
            do @show
          , 100
          )

    on_keyup: (e) ->
      @setActiveController @detect_controller_trigger() if not @getActiveController()
      @getActiveController()?.handle_keyup(e)
      return true


    on_keydown: (e) ->
      active_controller = @getActiveController()
      return if not active_controller
      active_controller.handle_keydown(e)

    show: () ->
      @setActiveController @detect_controller_trigger() if not @getActiveController()
      @getActiveController()?.show()
      return true

    setData: (key, data) ->
      controller = @getController(key)
      controller.reload(data)

    hide: () ->
      for key, controller of @key_controllers
        controller.hide()
      return

    reset: () ->
      @hide()

    detect_controller_trigger: ->
      for key, controller of @key_controllers
        return controller unless controller.matcher(@$input.val(), @$input[0].selectionStart) is null

    getMentions: () ->

    init: (instance, settings) ->
      settings = _.defaults(settings or {}, defaultSettings)
      key = settings.triggerChar
      controller = @getController(key)
      if not controller
        controller = new Controller(key, settings.data, @$input, settings)
        @setController key, controller
      return

    listen: () ->

    getActiveController: () ->
      @active_controller

    setActiveController: (controller) ->
      if controller
        @active_controller = controller

    unsetActiveController: () ->
      @active_controller = null

    hasController: (key) ->
      @key_controllers[key]?

    setController: (key, controller) ->
      controller.on "reject_controller", () =>
        @unsetActiveController() if @active_controller is controller
      @key_controllers[key] = controller

    getController: (key) ->
      @key_controllers[key]

    @api:
      #init
      init: (instance, settings) ->
        instance.init(instance, settings)
      #reset
      reset: (instance, settings) ->
        instance.reset.apply(instance, settings)
      #getMentions
      getMentions: (instance, settings) ->
        instance.getMentions.apply(instance, settings)
      show: (instance, settings) ->
        instance.show.apply(instance, settings)
      data: (instance, key, data) ->
        instance.setData.call(instance, key, data)

  #Jquery pluginizer
  $.fn.mentionsInput = (method, settings...) ->
    outerArguments = settings
    if typeof method is 'object' or not method
      settings = method
    else
      settings = settings[0]

    this.each(
      ()->
        instance = $.data(this, 'mentionsInput') or $.data(this, 'mentionsInput', new Mentions(settings, this))
        outerArguments.unshift(instance)
        if _.isFunction(Mentions.api[method])
          Mentions.api[method].apply(this, outerArguments)
        else if typeof method is 'object' or not method
          Mentions.api.init.call(this, instance, method)
        else
          $.error("Method #{ method } does not exist")
    )

  #return the Mentions Class from the amd factory
  Mentions