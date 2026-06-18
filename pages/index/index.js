Page({
  data: {
    keyword: '',
    providerIdx: 0,
    providers: ['全部厂商'],
    sortBy: 'input',
    sortAsc: true,
    filteredList: [],
    lastUpdate: '',
    loading: true,
    activeSource: 'selfhosted',
    selfhosted: { label: '自建', icon: '🏠', updateTime: '', connected: false, color: 'gray' },
    cloud: { label: '云端', icon: '☁️', updateTime: '', connected: false, color: 'gray' }
  },

  onLoad: function() {
    var self = this
    var app = getApp()
    var ds = app.globalData.getDataSource()
    if (ds === 'cloud') { self.setData({ activeSource: 'cloud' }) }
    else { self.setData({ activeSource: 'selfhosted' }) }
    self.probeBothSources()
  },

  onPullDownRefresh: function() {
    var self = this
    self.probeBothSources()
    setTimeout(function() { wx.stopPullDownRefresh() }, 5000)
  },

  probeBothSources: function() {
    var self = this
    self.setData({ loading: true })
    var done = 0
    var selfhostedData = null
    var cloudData = null
    function finish() {
      done++
      if (done < 2) return
      self.setData({ loading: false })
      var active = self.data.activeSource
      var showData = null
      var showTime = ''
      if (active === 'selfhosted' && selfhostedData) { showData = selfhostedData.data; showTime = selfhostedData.updateTime }
      else if (active === 'cloud' && cloudData) { showData = cloudData.data; showTime = cloudData.updateTime }
      else if (selfhostedData) { showData = selfhostedData.data; showTime = selfhostedData.updateTime }
      else if (cloudData) { showData = cloudData.data; showTime = cloudData.updateTime }
      else { self.fallbackToLocal(); return }
      self.initData(showData, showTime)
    }
    self.probeSelfHosted(function(result) { selfhostedData = result; finish() })
    self.probeCloud(function(result) { cloudData = result; finish() })
  },

  probeSelfHosted: function(callback) {
    var self = this
    var app = getApp()
    wx.request({
      url: app.globalData.SELF_HOSTED_API, timeout: 8000,
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
    var provSet = {}
    models.forEach(function(m) { provSet[m.provider] = 1 })
    self.allModels = models
    self.setData({ providers: ['全部厂商'].concat(Object.keys(provSet)), lastUpdate: updateTime || '', loading: false })
    self.applyFilters()
  },

  onSearch: function(e) { this.setData({ keyword: e.detail.value }); this.applyFilters() },
  onProviderChange: function(e) { this.setData({ providerIdx: parseInt(e.detail.value) }); this.applyFilters() },
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
    var pi = this.data.providerIdx
    if (pi > 0) { var p = this.data.providers[pi]; list = list.filter(function(m) { return m.provider === p }) }
    var sb = this.data.sortBy, sa = this.data.sortAsc
    list.sort(function(a, b) {
      var va, vb
      if (sb === 'input') { va = a.inputPrice||0; vb = b.inputPrice||0 }
      else if (sb === 'output') { va = a.outputPrice||0; vb = b.outputPrice||0 }
      else { va = a.name; vb = b.name; return sa ? va.localeCompare(vb) : vb.localeCompare(va) }
      return sa ? va - vb : vb - va
    })
    this.setData({ filteredList: list })
  }
})