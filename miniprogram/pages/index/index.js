// pages/index/index.js

function pickCoverUrl(data) {
  const v = data?.video || {};
  const origin = v?.origin_cover?.url_list?.[0];
  const cover = v?.cover?.url_list?.[0];
  const dyn = v?.dynamic_cover?.url_list?.[0];
  return origin || cover || dyn || '';
}

Page({
  data: {
    navH: 0,
    safeB: 0,

    inputUrl: '',
    result: null,
    isImageMode: false,
    isLoading: false,

    meta: {
      title: '',
      desc: '',
      coverUrl: '',
      videoUrl: '',
      shareUrl: '',
      // 👇 新增字段，注意前面的逗号
      author: { name: '', avatar: '' },
      music: { title: '', url: '', author: '', cover: '' },
      stats: { digg: 0, comment: 0, collect: 0, share: 0 },
      tags: []
    }
  },

  config: {
    envId: 'prod-9gvulm8k9ad81470',
    serviceName: 'douyin-api',
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    // 计算底部安全区 (手动减去15px调整视觉)
    let safeB = sys.safeArea ? (sys.screenHeight - sys.safeArea.bottom) : 0;
    if (safeB > 0) {
      safeB = safeB - 15;
      if (safeB < 0) safeB = 0;
    }

    const navH = (sys.statusBarHeight || 0) + 44;

    this.setData({
      navH: navH,
      safeB: safeB
    });
  },

  onInput(e) {
    this.setData({ inputUrl: e.detail.value });
  },

  clearInput() {
    this.setData({
      inputUrl: '',
      result: null,
      meta: {
        title: '', desc: '', coverUrl: '', videoUrl: '', shareUrl: '',
        author: { name: '', avatar: '' },
        music: { title: '', url: '', author: '', cover: '' },
        stats: { digg: 0, comment: 0, collect: 0, share: 0 },
        tags: []
      }
    });
  },

  onlyPaste() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ inputUrl: res.data });
          wx.showToast({ title: '已粘贴', icon: 'none' });
        } else {
          wx.showToast({ title: '剪切板为空', icon: 'none' });
        }
      }
    });
  },

  startParse() {
    if (this.data.inputUrl) return this.executeParse();

    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ inputUrl: res.data });
          wx.showLoading({ title: '识别链接中...' });
          setTimeout(() => this.executeParse(), 500);
        } else {
          wx.showToast({ title: '请输入或复制链接', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '请手动粘贴链接', icon: 'none' })
    });
  },

  executeParse() {
    const rawText = this.data.inputUrl;
    const urlMatch = rawText.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      wx.showToast({ title: '未检测到有效链接', icon: 'none' });
      return;
    }
    const cleanUrl = urlMatch[0];

    this.setData({
      isLoading: true,
      result: null,
      meta: { ...this.data.meta, shareUrl: cleanUrl }
    });
    wx.showLoading({ title: '云端解析中...' });

    wx.cloud.callContainer({
      config: { env: this.config.envId },
      path: `/api/hybrid/video_data?url=${encodeURIComponent(cleanUrl)}&minimal=false`,
      header: {
        'X-WX-SERVICE': this.config.serviceName,
        'content-type': 'application/json'
      },
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: '服务繁忙: ' + res.statusCode, icon: 'none' });
          return;
        }
        const apiData = res.data;
        if (apiData.code === 200 && apiData.data) {
          this.handleSuccess(apiData.data);
        } else {
          wx.showToast({ title: '解析失败，请检查链接', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '网络请求超时', icon: 'none' });
      },
      complete: () => this.setData({ isLoading: false })
    });
  },

  handleSuccess(data) {
    console.log('API全量数据:', data);

    // 1. 基础信息
    const desc = data?.desc || '';
    const title = data?.title || (desc ? (desc.length > 18 ? desc.slice(0, 18) + '…' : desc) : '视频标题');
    const coverUrl = pickCoverUrl(data);
    
    // 2. 提取作者信息
    const author = {
      name: data?.author?.nickname || '未知作者',
      avatar: data?.author?.avatar_thumb?.url_list?.[0] || '../../assets/icons/avatar.png'
    };

    // 3. 提取 BGM
    const musicData = data?.music || {};
    const music = {
      title: musicData.title || '原声',
      author: musicData.author || '未知歌手',
      url: musicData.play_url?.url_list?.[0] || musicData.play_url || '',
      cover: musicData.cover_thumb?.url_list?.[0] || ''
    };

    // 4. 提取统计数据
    const statData = data?.statistics || {};
    const stats = {
      digg: this.formatNum(statData.digg_count || 0),
      comment: this.formatNum(statData.comment_count || 0),
      collect: this.formatNum(statData.collect_count || 0),
      share: this.formatNum(statData.share_count || 0)
    };

    // 5. 提取标签
    const tags = (data?.hashtags || []).map(t => t.hashtag_name);

    // 6. 判断类型
    let type = 'video';
    let result = null;
    let isImageMode = false;

    if (data.images && data.images.length > 0) {
      type = 'image';
      isImageMode = true;
      result = data.images.map(item => item?.url_list?.[0] || '').filter(Boolean);
      wx.showToast({ title: `提取到 ${result.length} 张图片`, icon: 'success' });
    } else {
      type = 'video';
      isImageMode = false;
      result = data?.video?.play_addr?.url_list?.[0] || '';
      if (!result) { return wx.showToast({ title: '无法识别资源', icon: 'none' }); }
      wx.showToast({ title: '解析成功', icon: 'success' });
    }

    // 7. 更新数据
    this.setData({
      isImageMode,
      result,
      meta: { 
        ...this.data.meta, 
        title, desc, coverUrl, 
        videoUrl: isImageMode ? '' : result,
        author, music, stats, tags
      }
    });

    // 8. 存入历史
    this.saveToHistory({
      id: new Date().getTime(),
      title, desc, coverUrl, type: isImageMode ? '图文' : '视频',
      shareUrl: this.data.meta.shareUrl,
      timeText: this.formatTime(new Date())
    });
  },

  // 格式化数字 (12000 -> 1.2w)
  formatNum(num) {
    if (!num) return '0';
    if (num > 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toString();
  },

downloadMusic() {
  const url = this.data.meta.music.url;
  if (!url) return wx.showToast({ title: '无音乐资源', icon: 'none' });

  // 既然 openDocument 不支持音频，我们直接提供最实用的两个选项
  wx.showActionSheet({
    itemList: ['在线播放', '复制链接 (去浏览器下载)'],
    success: (res) => {
      // 选项 1: 在线播放 (使用微信原生背景音频播放器，体验最好)
      if (res.tapIndex === 0) {
        const bgm = wx.getBackgroundAudioManager();
        bgm.title = this.data.meta.music.title || '背景音乐';
        bgm.epname = this.data.meta.author.name;
        bgm.coverImgUrl = this.data.meta.music.cover;
        bgm.src = url; // 设置 src 后会自动开始播放
        wx.showToast({ title: '开始播放', icon: 'none' });
      } 
      // 选项 2: 复制链接
      else if (res.tapIndex === 1) {
        wx.setClipboardData({ 
          data: url,
          success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
        });
      }
    }
  });
},

  saveToHistory(item) {
    let history = wx.getStorageSync('historyList') || [];
    const index = history.findIndex(h => h.shareUrl === item.shareUrl);
    if (index > -1) {
      history.splice(index, 1);
    }
    history.unshift(item);
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    wx.setStorageSync('historyList', history);
  },

  formatTime(date) {
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${m}-${d} ${h}:${min}`;
  },

  copyDesc() {
    const text = this.data.meta?.desc || '';
    if (!text) return wx.showToast({ title: '没有可复制的文案', icon: 'none' });
    wx.setClipboardData({ data: text });
  },

  copyVideoLink() {
    const url = this.data.meta?.videoUrl || this.data.result || '';
    if (!url) return wx.showToast({ title: '没有可复制的视频链接', icon: 'none' });
    wx.setClipboardData({ data: url });
  },

  copyCoverLink() {
    const url = this.data.meta?.coverUrl || '';
    if (!url) return wx.showToast({ title: '没有封面链接', icon: 'none' });
    wx.setClipboardData({ data: url });
  },

  handleSaveCover() {
    const coverUrl = this.data.meta?.coverUrl;
    if (!coverUrl) return wx.showToast({ title: '没有封面可保存', icon: 'none' });

    wx.showLoading({ title: '下载封面中...' });
    wx.downloadFile({
      url: coverUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '封面已保存', icon: 'success' });
            },
            fail: (err) => {
              wx.hideLoading();
              this.checkAuth(err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '封面下载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '封面下载失败', icon: 'none' });
      }
    });
  },

  handleSaveVideo() {
    if (!this.data.result) return;

    wx.showLoading({ title: '下载视频中...' });
    wx.downloadFile({
      url: this.data.result,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveVideoToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已保存到相册', icon: 'success' });
            },
            fail: (err) => {
              wx.hideLoading();
              this.checkAuth(err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  },

  handleSaveImages() {
    const images = this.data.result;
    if (!images || !images.length) return;

    wx.showLoading({ title: '准备保存...' });
    let successCount = 0;
    let failCount = 0;

    images.forEach((url) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                successCount++;
                this.checkSaveStatus(images.length, successCount, failCount);
              },
              fail: (err) => {
                failCount++;
                this.checkAuth(err);
                this.checkSaveStatus(images.length, successCount, failCount);
              }
            });
          } else {
            failCount++;
            this.checkSaveStatus(images.length, successCount, failCount);
          }
        },
        fail: () => {
          failCount++;
          this.checkSaveStatus(images.length, successCount, failCount);
        }
      });
    });
  },

  checkSaveStatus(total, success, fail) {
    if (success + fail === total) {
      wx.hideLoading();
      if (fail === 0) wx.showToast({ title: '全部保存成功', icon: 'success' });
      else wx.showToast({ title: `成功${success}张，失败${fail}张`, icon: 'none' });
    }
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({ current, urls: this.data.result });
  },

  checkAuth(err) {
    if (err && err.errMsg && (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize:fail'))) {
      wx.showModal({
        title: '权限提示',
        content: '保存到相册需要您的授权，请点击确定去开启权限。',
        success: (res) => { if (res.confirm) wx.openSetting(); }
      });
    }
  },

  onShareAppMessage() {
    return { title: '一键提取无水印高清视频', path: '/pages/index/index' };
  },

  onShareTimeline() {
    return { title: '这款去水印工具太好用了，推荐给你！' };
  },

  goHistory() {
    wx.reLaunch({ url: '/pages/history/history' });
  },

  onLeftBtnTap() {
    if (this.data.inputUrl) {
      this.clearInput();
    } else {
      this.onlyPaste();
    }
  }
});
