Page({
  data: { model: {} },

  onLoad: function(o) {
    var self = this
    var id = parseInt(o.id)
    // 优先从云函数获取
    if (wx.cloud) {
      wx.cloud.callFunction({ name: 'getPricing' }).then(function(res) {
        var result = res.result
        if (result && result.code === 0 && result.data.length > 0) {
          self.renderModel(result.data, id)
        } else {
          self.fallbackToLocal(id)
        }
      }).catch(function() {
        self.fallbackToLocal(id)
      })
    } else {
      self.fallbackToLocal(id)
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
    }
  },

  onCopySource: function(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.url,
      success: function() { wx.showToast({ title: '链接已复制', icon: 'success' }) }
    })
  }
})
