
# FD.PathSolver
# ==============================================
# Compiles a Multiverse JSON tree into FD constraints, where each branch is a FDVar and the paths (plus an implicit 0 or off path) are it's domain.  Adds additional constraint primitives for constraining branches to each other.

# TODO:
# - branchpath query selectors
# .align:(0) > .text_align:(0)
# .align:()[]

module.exports = (FD) ->
  MAX = Math.max
  PAIR_SIZE = 2

  {
    Domain
    Solver
  } = FD

  {
    domain_create_one
    domain_create_range
    domain_create_zero
    domain_from_list
  } = Domain

  class PathSolver extends Solver

    constructor: ({rawtree}, o = {}) ->

      super

      {
        branchRules
      } = o

      @distribute = 'naive'
      @rootBranchName = rawtree.branchName

      @vars.root = undefined

      @compileTree rawtree, branchRules

    solutionToPath: (solution) ->
      bvars_by_id = @vars.byId
      path = {}
      for var_id, solution_value of solution
        if solution_value isnt 0
          branch_var = bvars_by_id[var_id]
          if branch_var
            path[branch_var.branchId] = find_path_for_val_or_throw branch_var.pathMeta, solution_value
      return path

    find_path_for_val_or_throw = (path_meta, value) ->
      for path_name, meta of path_meta
        if meta.value is value
          return path_name

      throw new Error "solution to Path error"

    collapseSolution: (solution) ->
      path = @S.solutionToPath(solution)
      collapsed = @M.collapse path
      # console.log JSON.stringify collapsed,1,1
      collapsed

    lookDown: (node, callback) ->
      observation =
        round:0
        flooredRounds: []
        data:[]
        continue: true
        done: () ->
          observation.continue = false
        floor: () ->
          observation.flooredRounds.push observation.round
      @_lookDown node, callback, observation

    _lookDown: (node, cb, o) ->
      return o unless o.continue
      o.round++
      cb node, o
      round = o.round
      #continue if round in o.flooredRounds
      for child in node.children
        break unless o.continue
        @_lookDown child, cb, o
      o

    # overwrite == to handle paths on both sides
    eq: (e1, e2) ->
      if e1 instanceof Array
        if e2 instanceof Array
          # this only works with ==
          @eq e1, e2[0]
          @eq e2, e1[0]
          return @
        else
          for e in e1
            @_eq e, e2
          return @
      else
        return @_eq(e1, e2)


    '~=': (e1, e2) ->
      if e1 instanceof Array
        if e2 instanceof Array
          # validate if all are paths?
          return @['{}~='] e1.concat e2
        else
          for e in e1
            @['_~'] '==', e, e2
          return @
      else
        return @['_~']('==', e1, e2)

    '~>=': (e1, e2) ->
      if e1 instanceof Array
        if e2 instanceof Array
          # validate if all are paths?
          return @['{}~='] e1.concat e2
        else
          for e in e1
            @['_~'] '>=', e, e2
          return @
      else
        return @['_~']('>=', e1, e2)

    '_~': (op, e1, e2) ->
      if e1.type is 'branch' and e2.type isnt 'branch'
        @['>='](
          @["#{op}?"](e1, e2),
          @['==?'](e1.parent, @num e1.parentValue)
        )

      #if e2.type is 'branch'
      #  parents.push e2.parent
      #if parents.length > 0
      #  parents.push(@num 1) if parents.length is 1
      #  @['>='](
      #    @['==?'](e1, e2),
      #    @['==?'](parents[0], parents[1])
      #  )
      else
        throw new Error "FDTreeSolver... ~= ???"
        return @['=='] e1, e2


    'kill': (paths) ->
      for path in paths
        @['=='] path, @num 0

    '{}~=': (vars) ->
      # TODO
      # - cache collections by selector!!!!

      @bindingCount ?= 0
      binder = "__bind#{@bindingCount}__"

      minDomain = 0 # TOFIX: this is always 0. is that correct?
      maxDomain = -99
      for v in vars
        domain = v.domain
        if domain
          for index in [0...domain.length] by PAIR_SIZE
            hi = domain[index+1]
            maxDomain = MAX hi, maxDomain
      if maxDomain is -99
        throw new Error "{}~= Cant find domain for binding"
      @S.decl binder, domain_create_range(minDomain, maxDomain)

      @['=='](
        @['==?'](binder, @num 0),
        @['==?'](@['sum'](vars), @num 0)
      )
      for v in vars
        @['>='](
          @['==?'](v,binder),
          @['==?'](v.parent, @num v.parentValue)
        )
      @bindingCount++
      return binder


    compileTree: (rawtree,branchRules) ->
      ###
        {
          name: branchName
          data: (from parent path)
          children:  [
            ... tp leaf node!
          ]

        }

        # Leaf Node
        - boolean domain
        - leaf

      ###
      return @_compileTree(rawtree, branchRules)

    _compileTree: (branch, branchRules, parentBranchVar, parentValue, depth = 0) ->
      {branchName, branchId, paths, _type} = branch
      _type ?= 'branch'

      parentIsRoot = parentBranchVar?.id is @rootBranchName

      required = false
      optional = false

      id = branchId

      # handle API for required `!` & optional `?` branches
      if branchName.indexOf('!') >= 0
        required = true
        branchName = branchName.substr 0, branchName.indexOf('!')
        id = branchId.split('!').join('')
      else if branchName.indexOf('?') >= 0
        optional = true
        branchName = branchName.substr 0, branchName.indexOf('?')
        id = branchId.split('?').join('')
      else if parentIsRoot
        required = true
      else if parentBranchVar?
        if parentBranchVar.required and parentBranchVar.paths.length is 1
          required = true

      branchVar = {
        _class: 'branchvar'
        id:id,
        branchId:branchId
        required: required,
        type: _type,
        name: branchName,
        paths: paths,
        pathNameByValue:{},
        pathMeta:{},
        parent: parentBranchVar,
        parentValue: parentValue,
        children: [],
        childByName: {},
        classes: [],
        depth: depth,
        isLeaf: undefined
      }

      numberedPaths = false
      possibleValues = []

      # branchVar.pathMeta
      if paths?
        {path} = branch

        #
        for pName, pIndex in paths
          pathData = path?[pName]?.data
          if !isNaN(pName)
            numberedPaths = true
            branchValue = Number(pName) + 1
          else
            throw new Error "Cant mix numbered paths with nonnumbered paths" if numberedPaths
            branchValue = pIndex + 1
          # apply branchRules
          valid = true
          if branchRules
            for rule in branchRules
              # {$class:'target', type:'kill'}
              if rule.$class and pathData?.$class
                if rule.$class in path?[pName]?.data.$class
                  if rule.type is 'kill'
                    valid = false
                    break
          if valid
            # TODO
            # - what if none are valid?  make optional?
            possibleValues.push branchValue

          meta = {
            pathIndex: pIndex
            value: branchValue
            constant: @num branchValue
          }
          if pathData
            meta.data = pathData
          branchVar.pathMeta[pName] = meta
          branchVar.pathNameByValue[branchValue] = pName

      # create the domain for the branch Var
      if possibleValues.length > 0
        possibleValues.unshift 0 unless required
        domain = domain_from_list possibleValues
      else
        throw new Error "PathSolver: no possible values???"
        domain = domain_create_zero()
      branchVar.domain = domain

      if depth is 0
        @vars.root = branchVar

      #if branchName isnt @rootBranchName
      @addVar branchVar

      # root branch must be on
      if branchVar?.id is @rootBranchName
        @['=='] branchVar, @num 1

      if parentBranchVar?

        # if optional
        if optional
          # must be off if parent is off,
          # but if off, parent can be on
          unless parentIsRoot or parentBranchVar?.required
            @['>='](
              @['==?'](branchVar, @num 0),
              @['==?'](parentBranchVar, @num 0)
            )
        # if branch is required
        else if required or parentIsRoot
          # branch is on
          @['>='](branchVar, @num 1)
          # parent branch must be parentValue as well
          @['=='](parentBranchVar, @num parentValue) unless parentIsRoot or parentBranchVar?.required
        else
          # branch is on if parent is parentValue
          @['=='](
            @['>=?'](branchVar, @num 1),
            @['==?'](parentBranchVar, @num parentValue)
          )

        parentBranchVar.children.push branchVar
        parentBranchVar.childByName[branchName] = branchVar


      isLeaf = true

      if paths?
        {path} = branch

        for pName, pIndex in paths
          childBranches = path?[pName]?.children
          if childBranches?
            isLeaf = false
            branchValue = branchVar.pathMeta[pName].value
            for childBranch in childBranches
              depth++
              @_compileTree childBranch, branchRules, branchVar, branchValue, depth
          #else
          #  @leafCount ?= 0
          #  childBranch = {branchName:"__LEAF__", branchId:"LEAF_#{@leafCount}", _type:'leaf'}
          #  @leafCount++
          #  # create leaf node
          #  @_compileTree childBranch, branchRules, branchVar, branchValue+1, pathData, depth++

      branchVar.isLeaf = isLeaf

      branchVar

  FD.PathSolver = PathSolver
