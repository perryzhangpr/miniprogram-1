// miniprogram/pages/history/history.js
Page({
  data: {
    navH: 0,
    safeB: 0,
    list: [] 
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();

    // ✅ 修改后的逻辑：
    let safeB = sys.safeArea ? (sys.screenHeight - sys.safeArea.bottom) : 0;
    if (safeB > 0) {
      safeB = safeB - 10;
      if (safeB < 0) safeB = 0;
    }
    
    this.setData({
      navH: (sys.statusBarHeight || 0) + 44,
      safeB: safeB
    });
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const history = wx.getStorageSync('historyList') || [];
    this.setData({ list: history });
  },

  // ✅ 修复：使用 reLaunch 避免返回动画
  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onCopyUrl(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.setClipboardData({ data: url });
    }
  },

  // ✅ 修复：解析后跳转也使用 reLaunch
  onReparse(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showToast({ title: '已复制，正在前往提取', icon: 'none' });
          setTimeout(() => {
             wx.reLaunch({ url: '/pages/index/index' });
          }, 800);
        }
      });
    }
  },

  onClearTap() {
    if (!this.data.list.length) return;
    wx.showModal({
      title: '提示',
      content: '确定清空所有记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('historyList');
          this.setData({ list: [] });
        }
      }
    });
  }
});