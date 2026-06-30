var util = require('../../utils/util.js')

Page({
  data: {
    // === Tokens Tab ===
    keyword: '',
    sortBy: 'input',
    sortAsc: true,
    filteredList: [],
    lastUpdate: '',
    loading: true,
    activeSource: 'selfhosted',
    selfhosted: { label: '主数据源', icon: '🏠', updateTime: '', connected: false, color: 'gray' },
    cloud: { label: '备份源', icon: '☁️', updateTime: '', connected: false, color: 'gray' },
    providerTags: [],
    activeProvider: '天翼云',

    // === Tab 切换 ===
    activeTab: 'tokens',

    // === 算力 Tab ===
    computeLoading: true,
    computeData: [],
    computeFilteredList: [],
    computeUpdateTime: '',
    computeAvailable: 0,
    computeSellout: 0,
    computeRegionOptions: ['全部'],
    computeRegionIndex: 0,
    computeCheckingSellout: false,
    computeGpuOptions: ['全部'],
    computeGpuIndex: 0
  },

  onLoad: function() {
    var self = this
    var app = getApp()
    var ds = app.globalData.getDataSource()
    if (ds === 'cloud') { self.setData({ activeSource: 'cloud' }) }
    else { self.setData({ activeSource: 'selfhosted' }) }
    self.probeBothSources()

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onShareAppMessage: function() {
    return {
      title: '词元价格计算器-大模型Tokens价格每日更新',
      path: '/pages/index/index',
      imageUrl: ''
    }
  },

  onShareTimeline: function() {
    return {
      title: '词元价格计算器-大模型Tokens价格每日更新',
      query: '',
      imageUrl: ''
    }
  },

  onPullDownRefresh: function() {
    var self = this
    if (self.data.activeTab === 'tokens') {
      self.probeBothSources()
    } else {
      self.loadComputeData()
    }
    setTimeout(function() { wx.stopPullDownRefresh() }, 5000)
  },

  // ============================================================
  // Tab 切换
  // ============================================================
  onSwitchTab: function(e) {
    var self = this
    var tab = e.currentTarget.dataset.tab
    if (tab === self.data.activeTab) return
    self.setData({ activeTab: tab })
    if (tab === 'compute' && self.data.computeData.length === 0) {
      self.loadComputeData()
    }
  },

  // ============================================================
  // Tokens 数据加载 (原有逻辑)
  // ============================================================
  probeBothSources: function() {
    var self = this
    var shown = false
    var cacheHit = false

    // 1. 先尝试本地缓存（即时显示）
    try {
      var cached = wx.getStorageSync('tokensCache')
      if (cached && cached.data && cached.data.length > 0) {
        self.initData(cached.data, cached.updateTime)
        // 更新数据源状态
        self.setData({
          'selfhosted.updateTime': cached.updateTime || '',
          'selfhosted.connected': true,
          'selfhosted.color': self.timeColor(cached.updateTime)
        })
        shown = true
        cacheHit = true
      }
    } catch(e) {}

    if (!cacheHit) self.setData({ loading: true })

    // 2. 网络请求：先到先显示
    var done = 0
    var selfhostedData = null
    var cloudData = null

    function tryShow() {
      var active = self.data.activeSource
      var showData = null
      var showTime = ''
      if (active === 'selfhosted' && selfhostedData) { showData = selfhostedData.data; showTime = selfhostedData.updateTime }
      else if (active === 'cloud' && cloudData) { showData = cloudData.data; showTime = cloudData.updateTime }
      else if (selfhostedData) { showData = selfhostedData.data; showTime = selfhostedData.updateTime }
      else if (cloudData) { showData = cloudData.data; showTime = cloudData.updateTime }
      else return false
      self.initData(showData, showTime)
      // 写入缓存
      try { wx.setStorageSync('tokensCache', { data: showData, updateTime: showTime, cachedAt: Date.now() }) } catch(e) {}
      return true
    }

    function finish() {
      done++
      if (tryShow()) { shown = true }
      self.setData({ loading: false })
      if (done >= 2 && !shown) { self.fallbackToLocal() }
    }

    self.probeSelfHosted(function(result) { selfhostedData = result; finish() })
    self.probeCloud(function(result) { cloudData = result; finish() })
  },

  probeSelfHosted: function(callback) {
    var self = this
    var app = getApp()
    wx.request({
      url: app.globalData.SELF_HOSTED_API, timeout: 5000,
      success: function(res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0 && res.data.data && res.data.data.length > 0) {
          var t = res.data.updateTime || ''
          var color = self.timeColor(t)
          self.setData({ 'selfhosted.connected': true, 'selfhosted.updateTime': t, 'selfhosted.color': color })
          callback({ data: res.data.data, updateTime: t })
        } else { self.markSourceDown('selfhosted'); callback(null) }
      },
      fail: function(err) { self.markSourceDown('selfhosted'); callback(null) }
    })
  },

  probeCloud: function(callback) {
    var self = this
    if (!wx.cloud) { self.markSourceDown('cloud'); callback(null); return }
    wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
      var result = res.result
      if (result && result.code === 0 && result.data && result.data.length > 0) {
        var t = result.updateTime || ''
        var color = self.timeColor(t)
        self.setData({ 'cloud.connected': true, 'cloud.updateTime': t, 'cloud.color': color })
        callback({ data: result.data, updateTime: t })
      } else { self.markSourceDown('cloud'); callback(null) }
    }).catch(function() { self.markSourceDown('cloud'); callback(null) })
  },

  markSourceDown: function(source) {
    var update = {}
    update[source + '.connected'] = false
    update[source + '.color'] = 'red'
    this.setData(update)
  },

  timeColor: function(dateStr) {
    if (!dateStr) return 'gray'
    try {
      var parts = dateStr.split('-')
      if (parts.length !== 3) return 'gray'
      var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      var now = new Date()
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      var updateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      var diff = (today - updateDay) / (1000 * 60 * 60 * 24)
      if (diff <= 0) return 'green'
      if (diff <= 1) return 'yellow'
      return 'red'
    } catch(e) { return 'gray' }
  },

  onSwitchSource: function(e) {
    var self = this
    var source = e.currentTarget.dataset.source
    if (source === self.data.activeSource) return
    if (source === 'selfhosted' && !self.data.selfhosted.connected) return
    if (source === 'cloud' && !self.data.cloud.connected) return
    var app = getApp()
    app.globalData.setDataSource(source === 'cloud' ? 'cloud' : 'selfhosted')
    self.setData({ activeSource: source, loading: true, filteredList: [] })
    self.probeBothSources()
  },

  fallbackToLocal: function() {
    var app = getApp()
    var pricingData = app.globalData
    var models = (pricingData.models || []).map(function(m) { return pricingData.expand(m) })
    this.initData(models, pricingData.updateTime)
  },

  initData: function(rawModels, updateTime) {
    var self = this
    var app = getApp()
    var expand = app.globalData.expand
    var models = rawModels.map(function(m) { return expand(m) })
    self.allModels = models

    var provSet = {}
    models.forEach(function(m) { provSet[m.provider] = 1 })
    var provs = Object.keys(provSet)
    provs.sort(function(a, b) {
      if (a === '天翼云') return -1
      if (b === '天翼云') return 1
      return a.localeCompare(b)
    })

    var tags = [{ name: '全部', active: false }]
    var currentActive = self.data.activeProvider || '天翼云'
    provs.forEach(function(p) {
      tags.push({ name: p, active: p === currentActive })
    })

    self.setData({
      providerTags: tags,
      activeProvider: currentActive,
      lastUpdate: updateTime || '',
      loading: false
    })
    self.applyFilters()
  },

  onProviderTag: function(e) {
    var name = e.currentTarget.dataset.name
    var tags = this.data.providerTags.map(function(t) {
      return { name: t.name, active: t.name === name }
    })
    this.setData({ providerTags: tags, activeProvider: name === '全部' ? '' : name, filteredList: [] })
    this.applyFilters()
  },

  onSearch: function(e) { this.setData({ keyword: e.detail.value }); this.applyFilters() },
  onSort: function(e) {
    var f = e.currentTarget.dataset.field
    var a = this.data.sortBy === f ? !this.data.sortAsc : true
    this.setData({ sortBy: f, sortAsc: a })
    this.applyFilters()
  },
  onTapModel: function(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }) },

  applyFilters: function() {
    var list = this.allModels.slice()
    var kw = this.data.keyword.toLowerCase()
    if (kw) list = list.filter(function(m) { return m.name.toLowerCase().indexOf(kw) !== -1 || m.provider.toLowerCase().indexOf(kw) !== -1 })
    var ap = this.data.activeProvider
    if (ap) list = list.filter(function(m) { return m.provider === ap })
    var sb = this.data.sortBy, sa = this.data.sortAsc
    // 分离按量模型和订阅套餐
    var tokenList = list.filter(function(m) { return !m.planType })
    var planList = list.filter(function(m) { return m.planType })
    tokenList.sort(function(a, b) {
      var va, vb
      if (sb === 'input') { va = a.inputPrice||0; vb = b.inputPrice||0 }
      else if (sb === 'output') { va = a.outputPrice||0; vb = b.outputPrice||0 }
      else { va = a.name; vb = b.name; return sa ? va.localeCompare(vb) : vb.localeCompare(va) }
      return sa ? va - vb : vb - va
    })
    // 订阅套餐始终排在按量模型后面，按 planPrice 排序
    planList.sort(function(a, b) {
      var pa = a.planPrice || 0, pb = b.planPrice || 0
      return sa ? pa - pb : pb - pa
    })
    this.setData({ filteredList: tokenList.concat(planList) })
  },

  // ============================================================
  // 算力数据加载
  // ============================================================
  loadComputeData: function() {
    var self = this
    var hasCache = false

    // 1. 先尝试从本地缓存加载（即时显示，减少延迟）
    try {
      var cached = wx.getStorageSync('computeCache')
      if (cached && cached.data && cached.data.length > 0) {
        self.initComputeData({
          data: cached.data,
          updateTime: cached.updateTime || '',
          available: cached.available || 0,
          sellout: cached.sellout || 0
        })
        hasCache = true
      }
    } catch(e) {}

    if (!hasCache) {
      self.setData({ computeLoading: true })
    }

    // 2. 优先云函数数据源
    self.tryComputeCloud()
  },

  tryComputeCloud: function() {
    var self = this
    var hasCache = self.data.computeData.length > 0
    if (!wx.cloud) {
      // 云函数不可用，尝试自建 API
      wx.request({
        url: 'https://api.ltcsky.net/compute/gpu.json',
        timeout: 8000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.code === 0) {
            self.initComputeData(res.data)
            try {
              wx.setStorageSync('computeCache', {
                data: res.data.data,
                updateTime: res.data.updateTime || '',
                available: res.data.available || 0,
                sellout: res.data.sellout || 0,
                cachedAt: Date.now()
              })
            } catch(e) {}
            self.checkComputeSellout(self.data.computeFilteredList)
          } else {
            self.setData({ computeLoading: false })
          }
        },
        fail: function() { self.setData({ computeLoading: false }) }
      })
      return
    }
    wx.cloud.callFunction({ name: 'getCompute' }).then(function(res) {
      var result = res.result
      if (result && result.code === 0 && result.data && result.data.length > 0) {
        var raw = { data: result.data, updateTime: result.updateTime,
          available: result.available, sellout: result.sellout }
        self.initComputeData(raw)
        // 写入缓存
        try {
          wx.setStorageSync('computeCache', {
            data: result.data,
            updateTime: result.updateTime || '',
            available: result.available || 0,
            sellout: result.sellout || 0,
            cachedAt: Date.now()
          })
        } catch(e) {}

        self.checkComputeSellout(self.data.computeFilteredList)
      } else {
        self.setData({ computeLoading: false })
        if (!hasCache) wx.showToast({ title: '暂无数据，下拉刷新重试', icon: 'none' })
      }
    }).catch(function(err) {
      console.error('getCompute failed:', err && err.message)
      self.setData({ computeLoading: false })
    })
  },

  // 按归属节点(parent)过滤算力数据，可售优先
  filterComputeByRegion: function(data, parent) {
    var filtered
    if (parent === "全部") {
      filtered = data.slice()
    } else if (parent === "华东江苏") {
      filtered = data.filter(function(item) {
        return item.parent === "华东" || item.parent === "江苏"
      })
    } else {
      filtered = data.filter(function(item) { return item.parent === parent })
    }
    // 可售优先排列
    filtered.sort(function(a, b) {
      if (a.sellout === b.sellout) return 0
      return a.sellout ? 1 : -1
    })
    return filtered
  },

  initComputeData: function(raw) {
    var self = this
    var data = raw.data || []

    // 按归属节点(parent)分组下拉选项
    var parentSet = {}
    var hasHuadong = false, hasJiangsu = false
    data.forEach(function(item) {
      var p = item.parent
      if (!p) return
      if (p === "华东") hasHuadong = true
      else if (p === "江苏") hasJiangsu = true
      else parentSet[p] = 1
    })
    var otherParents = Object.keys(parentSet).sort()
    var options = ["全部"]
    if (hasHuadong || hasJiangsu) options.push("华东江苏")
    options = options.concat(otherParents)

    // 保留用户已选择的区域（下拉刷新时不重置为默认）
    var currentOptions = self.data.computeRegionOptions
    var currentIndex = self.data.computeRegionIndex
    var regionIndex = 0  // fallback: 全部
    if (currentOptions.length > 1 && currentIndex > 0 && currentIndex < currentOptions.length) {
      var savedRegion = currentOptions[currentIndex]
      // 在新选项中查找同名区域
      for (var i = 0; i < options.length; i++) {
        if (options[i] === savedRegion) { regionIndex = i; break }
      }
    } else {
      // 首次加载：默认华东江苏
      regionIndex = (hasHuadong || hasJiangsu) ? 1 : 0
    }
    var selectedParent = options[regionIndex]

    var gpuOptions = self.buildGpuOptions(data)

    var filteredData = self.filterComputeByRegion(data, selectedParent)
    // 为列表渲染添加唯一 key
    for (var ki = 0; ki < data.length; ki++) {
      data[ki]._key = data[ki].spec + '|' + data[ki].region
    }

    self.setData({
      computeData: data,
      computeFilteredList: filteredData,
      computeLoading: false,
      computeUpdateTime: util.formatTime(raw.updateTime) || raw.updateTime || '',
      computeAvailable: filteredData.length,
      computeSellout: 0,
      computeRegionOptions: options,
      computeRegionIndex: regionIndex,
      computeGpuIndex: 0
    })
    // 单独设置 GPU 选项确保 picker 刷新
    self.setData({ computeGpuOptions: gpuOptions })
  },

  // 从数据中提取 GPU 型号选项（带缓存保护）
  buildGpuOptions: function(data) {
    var gpuSet = {}
    if (data && data.length > 0) {
      for (var i = 0; i < data.length; i++) {
        var m = data[i].gpuModel
        if (m && typeof m === 'string' && m.length > 0) gpuSet[m] = 1
      }
    }
    var models = Object.keys(gpuSet).sort()
    if (models.length > 0) return ['全部'].concat(models)
    var existing = this.data.computeGpuOptions
    return (existing && existing.length > 1) ? existing : ['全部']
  },

  // 懒加载售罄状态：只查当前区域
  checkComputeSellout: function(specs) {
    var self = this
    if (!specs || specs.length === 0) return
    if (!wx.cloud) return

    var toCheck = []
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i]
      if (s.regionID && s.flavorID) {
        toCheck.push({ regionID: s.regionID, flavorID: s.flavorID, index: i })
      }
    }
    if (toCheck.length === 0) {
      // No specs with IDs (old cached data, will update on next refresh)
      return
    }

    self.setData({ computeCheckingSellout: true })

    wx.cloud.callFunction({
      name: 'checkSellout',
      data: { specs: toCheck.map(function(x) { return { regionID: x.regionID, flavorID: x.flavorID } }) }
    }).then(function(res) {
      var result = res.result
      if (result && result.code === 0 && result.results) {
        var data = self.data.computeFilteredList.slice()
        var changed = false
        for (var j = 0; j < result.results.length; j++) {
          var idx = toCheck[j].index
          if (idx < data.length) {
            var r = result.results[j]
            data[idx]._key = data[idx].spec + '|' + data[idx].region
            data[idx].sellout = r.sellout
            data[idx].ecsQuota = r.ecsQuota || 0
            data[idx].ecsUsed = r.ecsUsed || 0
            data[idx].ecsAvail = r.ecsAvail || 0
            changed = true
          }
        }
        if (changed) {
          // 重新排序：可售优先
          data.sort(function(a, b) {
            if (a.sellout === b.sellout) return 0
            return a.sellout ? 1 : -1
          })
          var available = 0, sellout = 0
          for (var k = 0; k < data.length; k++) {
            data[k].sellout ? sellout++ : available++
          }
          self.setData({
            computeFilteredList: data,
            computeAvailable: available,
            computeSellout: sellout,
            computeCheckingSellout: false
          })
        } else {
          self.setData({ computeCheckingSellout: false })
        }
      } else {
        self.setData({ computeCheckingSellout: false })
      }
    }).catch(function(err) {
      console.error("checkSellout failed:", err)
      self.setData({ computeCheckingSellout: false })
    })
  },

  // GPU 型号筛选
  onComputeGpuChange: function(e) {
    var self = this
    var gpuIndex = parseInt(e.detail.value)
    var gpuModel = self.data.computeGpuOptions[gpuIndex]
    self.setData({ computeGpuIndex: gpuIndex })
    self.applyComputeFilters()
  },

  // 合并区域+GPU筛选并触发售罄检查
  applyComputeFilters: function() {
    var self = this
    var region = self.data.computeRegionOptions[self.data.computeRegionIndex]
    var gpuModel = self.data.computeGpuOptions[self.data.computeGpuIndex]
    var data = self.filterComputeByRegion(self.data.computeData, region)
    if (gpuModel !== '全部') {
      data = data.filter(function(item) { return item.gpuModel === gpuModel })
    }
    self.setData({
      computeFilteredList: data,
      computeAvailable: data.length,
      computeSellout: 0
    })
    self.checkComputeSellout(data)
  },

  onComputeRegionChange: function(e) {
    var self = this
    var index = parseInt(e.detail.value)
    self.setData({ computeRegionIndex: index })
    self.applyComputeFilters()
  }
})
