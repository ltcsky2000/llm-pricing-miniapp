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
    loadError: false,
    dataSource: 'auto',       // 当前数据源
    dataSourceLabel: '自动',   // 显示标签
    dataSourceIcon: '🔄'      // 显示图标
  },

  onLoad: function() {
    var self = this
    var app = getApp()
    var ds = app.globalData.getDataSource()
    self.setData({ dataSource: ds })
    self.updateSourceLabel(ds)
    self.fetchData(ds)
  },

  // 更新数据源标签
  updateSourceLabel: function(ds) {
    var labels = { 'auto': '自动', 'selfhosted': '自建', 'cloud': '云端' }
    var icons = { 'auto': '🔄', 'selfhosted': '🏠', 'cloud': '☁️' }
    this.setData({
      dataSourceLabel: labels[ds] || ds,
      dataSourceIcon: icons[ds] || '🔄'
    })
  },

  // 获取数据：按优先级尝试
  fetchData: function(ds) {
    var self = this
    var app = getApp()

    if (ds === 'selfhosted') {
      // 仅自建
      self.trySelfHosted(function(success) {
        if (!success) self.tryCloud(function(success2) {
          if (!success2) self.fallbackToLocal()
        })
      })
    } else if (ds === 'cloud') {
      // 仅云端
      self.tryCloud(function(success) {
        if (!success) self.fallbackToLocal()
      })
    } else {
      // auto: 优先自建，回退云端
      self.setData({ dataSourceLabel: '自建', dataSourceIcon: '🏠' })
      self.trySelfHosted(function(success, label) {
        if (success) {
          // 自建成功
        } else {
          self.setData({ dataSourceLabel: '云端', dataSourceIcon: '☁️' })
          self.tryCloud(function(success2) {
            if (!success2) {
              self.updateSourceLabel('auto')  // 恢复标签
              self.fallbackToLocal()
            }
          })
        }
      })
    }
  },

  // 尝试自建服务器 API
  trySelfHosted: function(callback) {
    var self = this
    var app = getApp()
    wx.request({
      url: app.globalData.SELF_HOSTED_API,
      timeout: 8000,
      success: function(res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0 && res.data.data && res.data.data.length > 0) {
          console.log('[数据] 自建服务器 (' + res.data.data.length + ' 条)')
          self.initData(res.data.data, res.data.updateTime)
          callback(true, '自建')
        } else {
          console.warn('[数据] 自建服务器返回异常:', res.statusCode)
          callback(false)
        }
      },
      fail: function(err) {
        console.warn('[数据] 自建服务器连接失败:', err)
        callback(false)
      }
    })
  },

  // 尝试微信云函数
  tryCloud: function(callback) {
    var self = this
    if (!wx.cloud) {
      callback(false)
      return
    }
    wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
      var result = res.result
      if (result && result.code === 0 && result.data && result.data.length > 0) {
        console.log('[数据] 微信云函数 (' + result.data.length + ' 条)')
        self.initData(result.data, result.updateTime)
        callback(true)
      } else {
        console.warn('[数据] 云函数返回空数据')
        callback(false)
      }
    }).catch(function(err) {
      console.warn('[数据] 云函数调用失败:', err)
      callback(false)
    })
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
    var app = getApp()
    var ds = app.globalData.getDataSource()
    self.updateSourceLabel(ds)
    self.fetchData(ds)
    // fetchData is async, stop refresh after a short delay
    setTimeout(function() { wx.stopPullDownRefresh() }, 3000)
  },

  // 切换数据源（手动）
  onDataSourceToggle: function() {
    var self = this
    var app = getApp()
    var ds = app.globalData.getDataSource()
    var next = ds === 'auto' ? 'selfhosted' : ds === 'selfhosted' ? 'cloud' : 'auto'
    app.globalData.setDataSource(next)
    self.setData({ loading: true, filteredList: [], dataSource: next })
    self.updateSourceLabel(next)
    self.fetchData(next)
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
