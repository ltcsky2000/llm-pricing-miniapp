Page({
  data: { model: {} },
  onLoad: function(o) {
    var self = this
    var app = getApp()
    setTimeout(function() {
      var pricingData = app.globalData
      var raw = (pricingData.models||[]).find(function(m) { return m.id === parseInt(o.id) })
      if (raw) { var m = pricingData.expand(raw); wx.setNavigationBarTitle({title: m.name}); self.setData({model: m}) }
    }, 50)
  },
  onCopySource: function(e) { wx.setClipboardData({data: e.currentTarget.dataset.url, success: function(){wx.showToast({title:'链接已复制',icon:'success'})}}) }
})
