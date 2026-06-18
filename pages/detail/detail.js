Page({
  data: { model: {} },

  onLoad: function(o) {
    var self = this
    var id = parseInt(o.id)
    var app = getApp()
    var ds = app.globalData.getDataSource()
    self.fetchModel(id, ds === 'cloud' ? 'cloud' : 'selfhosted')
  },

  fetchModel: function(id, source) {
    var self = this
    var app = getApp()
    if (source === 'selfhosted') {
      wx.request({
        url: app.globalData.SELF_HOSTED_API, timeout: 8000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.data && res.data.data.length > 0) {
            if (self.renderModel(res.data.data, id)) return
          }
          self.fetchModel(id, 'cloud')
        },
        fail: function() { self.fetchModel(id, 'cloud') }
      })
    } else {
      if (!wx.cloud) { self.fallbackToLocal(id); return }
      wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
        var result = res.result
        if (result && result.code === 0 && result.data && result.data.length > 0) {
          if (self.renderModel(result.data, id)) return
        }
        self.fallbackToLocal(id)
      }).catch(function() { self.fallbackToLocal(id) })
    }
  },

  fallbackToLocal: function(id) {
    var app = getApp()
    var raw = (app.globalData.models || []).find(function(m) { return m.id === id })
    if (raw) {
      var m = app.globalData.expand(raw)
      wx.setNavigationBarTitle({ title: m.name })
      this.setData({ model: m })
    }
  },

  renderModel: function(models, id) {
    var app = getApp()
    var raw = models.find(function(m) { return m.id === id })
    if (raw) {
      var m = app.globalData.expand(raw)
      wx.setNavigationBarTitle({ title: m.name })
      this.setData({ model: m })
      return true
    }
    return false
  },

  onCopySource: function(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.url,
      success: function() { wx.showToast({ title: '链接已复制', icon: 'success' }) }
    })
  }
})
