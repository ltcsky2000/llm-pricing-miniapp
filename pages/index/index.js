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
    loadError: false
  },

  onLoad: function() {
    var self = this
    // 优先从云函数获取最新数据
    if (wx.cloud) {
      wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
        var result = res.result
        if (result && result.code === 0 && result.data.length > 0) {
          self.initData(result.data, result.updateTime)
        } else {
          self.fallbackToLocal()
        }
      }).catch(function() {
        self.fallbackToLocal()
      })
    } else {
      self.fallbackToLocal()
    }
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
    self.setData({
      providers: ['全部厂商'].concat(Object.keys(provSet)),
      lastUpdate: updateTime || '',
      loading: false
    })
    self.applyFilters()
  },

  onPullDownRefresh: function() {
    var self = this
    if (wx.cloud) {
      wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
        var result = res.result
        if (result && result.code === 0 && result.data.length > 0) {
          self.initData(result.data, result.updateTime)
        }
        wx.stopPullDownRefresh()
      }).catch(function() {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  onSearch: function(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilters()
  },

  onProviderChange: function(e) {
    this.setData({ providerIdx: parseInt(e.detail.value) })
    this.applyFilters()
  },

  onSort: function(e) {
    var f = e.currentTarget.dataset.field
    var a = this.data.sortBy === f ? !this.data.sortAsc : true
    this.setData({ sortBy: f, sortAsc: a })
    this.applyFilters()
  },

  onTapModel: function(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  applyFilters: function() {
    var list = this.allModels.slice()
    var kw = this.data.keyword.toLowerCase()
    if (kw) list = list.filter(function(m) {
      return m.name.toLowerCase().indexOf(kw) !== -1 ||
             m.provider.toLowerCase().indexOf(kw) !== -1
    })
    var pi = this.data.providerIdx
    if (pi > 0) {
      var p = this.data.providers[pi]
      list = list.filter(function(m) { return m.provider === p })
    }
    var sb = this.data.sortBy
    var sa = this.data.sortAsc
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
